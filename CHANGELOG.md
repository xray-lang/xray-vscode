# Changelog

All notable changes to the Xray VS Code extension are documented in this file.

## 0.7.0 – 2026-05

### Changed
- Bundled Xray runtime updated to 0.7.0 for supported platform-specific
  Marketplace builds.
- Marketplace publish workflow now consumes the current Xray release asset
  names for macOS, Linux, and Windows packages.

### Added
- Windows x64 platform-specific package with bundled `xray.exe`.

## 0.5.2 – 2026-04

> The extension version is now kept in lock-step with the `xray` core
> (`CMakeLists.txt` `project(Xray VERSION …)`), so a given `.vsix` always
> matches the bundled binary.


### Added
- **LSP status bar** showing server state (`Starting`, `Running`, `Stopped`,
  `Error`) with click-to-restart.
- **`xray.startServer`, `xray.stopServer`, `xray.showServerLog`,
  `xray.showDebugLog`, `xray.collectDiagnostics`** commands.
- Debugger: honour **`cwd`**, **`env`** and **`console`** from
  `launch.json` (integrated/external terminal, or internal debug console).
- Debugger: optional **per-session `trace`** flag propagated to `xray dap --trace`.
- Settings: `xray.diagnostics.*`, `xray.completion.*`, `xray.analysis.*`,
  `xray.format.*`, `xray.lsp.args/env/autoRestart/transport/tcp.port`,
  `xray.server.showStatusBar`.
- Keybindings: `Cmd/Ctrl+F5` to debug the current file,
  `Cmd/Ctrl+Shift+Alt+R` to restart the language server.
- Editor title "Run" button for `.xr` files.
- Production bundle via **esbuild** – extension activation is dramatically
  faster and the packaged `.vsix` is much smaller.

### Changed
- Minimum VS Code version bumped to **1.92** (`@types/vscode ^1.92`).
- Dependencies refreshed: `typescript ^5.6`, `@types/node ^20.14`,
  `@vscode/vsce ^3.2`.
- Bundled-binary detection now:
  - uses `xray.exe` on Windows,
  - verifies the binary exists and is executable before spawning,
  - logs (not `console.log`) the resolved path through the output channel.
- Completion / formatting middleware no longer spams `console.log`; all
  diagnostic information flows to the "Xray Language Server" output channel.
- `InlineValuesProvider` now covers `let/const`, function parameters,
  `for (let x of …)` loop variables and assignment targets.
- `language` icon no longer references non-existent `xray-light.png` /
  `xray-dark.png`.

### Fixed
- Extension no longer leaves the LSP child process orphaned after
  `deactivate()` is interrupted.
- Debug adapter factory now disposes its output channel.
- `xray.restartServer` handles the case when the client has never been
  started (the older 0.6.x vsix threw an error here).

### Removed
- Legacy `activationEvents` (`onLanguage`, `onDebugResolve`, …) – modern
  VS Code derives these from contributions automatically.

## Earlier 0.6.0 VSIX

- Initial public release with full LSP + DAP integration and bundled
  `xray` binary. (Starting from 0.5.2 the extension version follows the
  core version, so the standalone 0.6.x series has been retired.)
