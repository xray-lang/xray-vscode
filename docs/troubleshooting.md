# xray-vscode Troubleshooting

A running log of non-obvious failure modes that have bitten this extension.
Update this file whenever a new class of bug surfaces — preserving the
"how the symptom looked, how we found the cause, what fixed it" trail saves
hours next time something goes silent.

---

## activate() must resolve fast — or every command silently no-ops

### Symptom

In the affected build, the user reports:

- The Run File triangle is visible in the editor title bar.
- Clicking it does nothing — no terminal opens, no error, no notification.
- `Cmd+Shift+P` finds `Xray: Run File`, `Xray: Restart Language Server`,
  `Xray: Collect Diagnostic Info`, etc., but selecting any of them does
  nothing.
- Keybindings (e.g. `Cmd+F5`) do nothing.
- The extension appears installed and "Active" in the extensions panel.
- The status bar item / output channel may or may not be visible depending
  on how far through `activate()` the host got.

### Diagnosis

Inject `vscode.window.showInformationMessage(...)` calls at strategic points
in the minified `out/extension.js` and restart the host. Every probe up to
and including the call to `startLsp()` fires, plus the post-registration
probe `xray.runFile registered: true (total cmds: 8)`. The probe immediately
*after* `await startLsp()` never fires, and a `setTimeout(...)` queued earlier
never runs either. The deactivate probe also never fires.

This rules out the obvious suspects:

- Commands *are* registered — `vscode.commands.getCommands(true)` confirms it.
- The extension host process is *not* dying — `deactivate()` never runs and
  the activation notifications stay on screen.
- The menu `when` clauses are *not* the cause — the same dead behavior shows
  up via the command palette, which has no `when` filter.

What is actually happening: `activate()` is still pending. VS Code (and
Windsurf) gate UI-driven command dispatch on `activate()` resolving. Until
the returned Promise settles, every menu click / palette invocation /
keybinding for this extension is silently dropped. The host does not surface
this as an error.

### Root cause

`activate()` was awaiting `startLsp()`. When the language server bound
slowly, hung on a transport handshake, or crashed in a way that left the
client in an indeterminate state, `LanguageClient.start()` never resolved.
That stall propagated all the way up to `activate()`, which therefore never
returned, which jammed the entire command dispatch path for the extension.

The bug only manifested on hosts where LSP startup happened to stall
(observed on Windsurf macOS in 1.0.x ≤ 1.0.2). On hosts where startup was
fast — every Windows install we tested, fresh VS Code installs on macOS —
the await resolved within a few hundred ms and nobody noticed.

### Fix

Detach LSP startup from activation:

```ts
void startLsp().catch((err) => {
    handleStartupFailure(err);
});
```

Now `activate()` resolves immediately after synchronous registration. The
LSP comes up in the background; if it fails, that failure surfaces through
`handleStartupFailure` (status bar + output channel) without taking the
command dispatch path down with it.

### Rules of thumb to keep this from regressing

1. `activate()` does *only* synchronous registration plus fire-and-forget
   background work. Never `await` anything that could outlive a few
   milliseconds.
2. Register commands before any optional subsystem (debug providers, LSP,
   file watchers). If an optional subsystem throws, isolate it in
   `try/catch` so it cannot prevent the rest of activation.
3. When debugging "the button does nothing" reports, the very first probe
   to add is one immediately after the `activate()` body's `return` — if
   that probe never runs, you are looking at this class of bug.

### Notification-based debugging recipe

When the only signal you have is "nothing happens," patch
`out/extension.js` directly to add notifications:

```python
# Inject a probe at the top of the activate function
old = 'async function <minified-activate>(n){'
new = old + 'oe.window.showInformationMessage("[XRAY] activate");'
```

Then add probes before/after every suspected blocker (`registerCommands`,
`registerDebugProviders`, `startLsp`, etc.) and a probe inside the relevant
command handler. The first probe that *fails* to fire pinpoints the stall.

A `getCommands(true)` probe at the end of activation is decisive — it
distinguishes "commands not registered" from "commands registered but UI
dispatch is gated."

---

## CI must publish a `universal` vsix on every release

### Symptom

After publishing 1.0.1 and 1.0.2 with platform-specific packages only,
Windsurf macOS users started seeing 1.0.0 again on every uninstall /
reinstall. Marketplace listings showed "Version 1.0.0" even when the latest
was 1.0.2.

### Cause

Open VSX (and the VS Code marketplace listing API) prefer the `universal`
target when surfacing a single canonical version of an extension. Once the
publishing pipeline started shipping only platform-specific packages, the
last `universal` package on record was 1.0.0, so that became the headline
version on Mac. Windsurf's auto-install path then pulled 1.0.0 universal as
a fallback whenever the locally cached 1.0.2 darwin-arm64 entry was missing.

### Fix

`publish.yml` now runs a `package_universal` job alongside the platform
matrix and uploads a `universal` vsix on every release. With both universal
and platform-specific packages present at the latest version, Windsurf macOS
matches the platform-specific build first and still has a same-version
universal fallback if it ever reaches for one.

### Rule of thumb

If you ever drop the universal artifact — for binary-size reasons or
otherwise — verify on a clean Windsurf macOS install that the marketplace
client is still resolving the platform-specific package and not falling
back to whichever older universal happens to be lying around.
