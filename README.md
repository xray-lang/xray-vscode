# Xray Language Extension for VS Code

Full-featured VS Code support for the [Xray programming language](https://www.xray-lang.org) — a lightweight typed scripting language with native concurrency.

This extension ships with a bundled `xray` binary that provides both the Language Server (LSP) and the Debug Adapter (DAP), so everything works out of the box.

## Features

### Editor

- **Syntax highlighting** — keywords, types, strings, comments, decorators, coroutine syntax, and Markdown fenced code blocks (` ```xray `)
- **Code completion** — context-aware suggestions for keywords, built-in functions, standard library modules, imported symbols, class/enum members, and method signatures
- **Hover information** — function signatures, parameter types, and documentation
- **Go to Definition** — jump to the definition of functions, classes, variables, and imports
- **Find References** — locate all usages of a symbol across the document
- **Document Symbols** — outline view of all symbols (functions, classes, enums, etc.)
- **Rename Symbol** — safe rename with all references updated
- **Code Formatting** — automatic code formatting
- **Inlay Hints** — inferred type annotations and parameter name hints
- **Snippets** — ready-to-use templates for common patterns

### Debugging

- **Breakpoints** — line breakpoints, conditional breakpoints, and log points
- **Step controls** — Step In, Step Out, Step Over, Continue
- **Variable inspection** — view local variables, upvalues, and shared variables
- **Call stack** — full call stack with source locations
- **Debug console** — evaluate expressions at runtime
- **Coroutine awareness** — inspect all active coroutines and their state
- **Remote debugging** — attach to a running `xray dap` server over TCP

## Installation

### From VSIX (recommended)

1. Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Run **Extensions: Install from VSIX...**
3. Select the `xray-lang-x.x.x.vsix` file

### Build from source

```bash
npm install
npm run package-ext    # type-check + esbuild bundle into out/
npm run package        # produces xray-lang-x.x.x.vsix
```

The `.vsix` file can then be installed as described above.

### Development mode

```bash
npm install
npm run bundle-watch   # incremental bundle on every save
```

Then press **F5** in VS Code to launch the Extension Development Host.
Use `Cmd/Ctrl+Shift+Alt+R` inside the dev host to restart the language
server after rebuilding the native `xray` binary.

## Configuration

All settings live under the `xray.*` namespace.

### Server / binary

| Setting | Description | Default |
|---------|-------------|---------|
| `xray.lsp.path` | Override path to the `xray` executable used for the language server. | `""` (bundled) |
| `xray.lsp.transport` | `stdio` (default) or `tcp` (server must also be launched with `--port`). | `stdio` |
| `xray.lsp.tcp.port` | Port used when `transport = tcp`. | `7711` |
| `xray.lsp.args` | Extra arguments passed to `xray lsp`. | `[]` |
| `xray.lsp.env` | Extra environment variables for the server. | `{}` |
| `xray.lsp.autoRestart` | Auto-restart the server on unexpected exit. | `true` |
| `xray.lsp.trace.server` | LSP communication trace (`off` / `messages` / `verbose`). | `off` |
| `xray.server.showStatusBar` | Show "Xray LSP" status item in the status bar. | `true` |
| `xray.debug.path` | Override path to the `xray` executable for debugging. | `""` (bundled) |
| `xray.debug.trace` | Enable debug adapter protocol tracing. | `false` |
| `xray.debug.console` | Where the debugged program's output is shown. | `internalConsole` |

### Language behaviour

| Setting | Description | Default |
|---------|-------------|---------|
| `xray.diagnostics.enabled` | Publish compiler diagnostics while editing. | `true` |
| `xray.diagnostics.debounceMs` | Delay between last edit and diagnostics. | `300` |
| `xray.completion.autoImport` | Propose symbols from other files and auto-import. | `false` |
| `xray.completion.maxItems` | Cap on completion items per request. | `100` |
| `xray.analysis.typeChecking` | Run full type-checking diagnostics. | `true` |
| `xray.format.tabSize` | Formatter indentation width. | `4` |
| `xray.format.insertSpaces` | Spaces vs tabs for indentation. | `true` |
| `xray.inlayHints.typeAnnotations` | Inline inferred types. | `true` |
| `xray.inlayHints.parameterNames` | Inline parameter names at call sites. | `true` |

## Debug Configuration

Add debug configurations to `.vscode/launch.json`:

### Launch a script

```json
{
  "type": "xray",
  "request": "launch",
  "name": "Launch Script",
  "program": "${file}",
  "cwd": "${workspaceFolder}",
  "args": [],
  "stopOnEntry": false
}
```

### Attach to a remote session

```json
{
  "type": "xray",
  "request": "attach",
  "name": "Attach to Remote",
  "host": "localhost",
  "port": 4711
}
```

### Launch configuration options

| Option | Description |
|--------|-------------|
| `program` | Path to the `.xr` script to debug (required) |
| `cwd` | Working directory for the script |
| `args` | Command-line arguments passed to the script |
| `env` | Environment variables passed to the script |
| `stopOnEntry` | Pause execution at the first line |
| `console` | `internalConsole` / `integratedTerminal` / `externalTerminal` |
| `trace` | Enable DAP trace for this session only |
| `xrayPath` | Override the path to the `xray` executable |

### Attach configuration options

| Option | Description |
|--------|-------------|
| `host` | Host to connect to (default: `localhost`) |
| `port` | Debug port to connect to (default: `4711`) |

## Commands

| Command | Default keybinding | Description |
|---------|---------------------|-------------|
| `Xray: Debug Current File` | `Cmd/Ctrl+F5` | Launch a debug session for the active `.xr` file |
| `Xray: Restart Language Server` | `Cmd/Ctrl+Shift+Alt+R` | Restart the LSP server |
| `Xray: Start Language Server` | — | Start a stopped server |
| `Xray: Stop Language Server` | — | Stop the running server |
| `Xray: Show Language Server Output` | — | Focus the server log channel |
| `Xray: Show Debug Adapter Output` | — | Focus the debug adapter log channel |
| `Xray: Collect Diagnostic Info` | — | Assemble versions / paths / logs into a bug report |

## Snippets

| Prefix | Description |
|--------|-------------|
| `fn` | Anonymous function |
| `fnn` | Named function |
| `class` | Class definition |
| `classex` | Class with inheritance |
| `for` | For-in loop |
| `forc` | C-style for loop |
| `if` / `ife` | If / if-else statement |
| `match` | Match expression |
| `try` / `tryf` | Try-catch / try-catch-finally |
| `go` / `gon` | Coroutine / coroutine with variable |
| `chan` | Channel declaration |
| `select` | Select statement |
| `defer` | Defer statement |
| `import` | Import statement |
| `httpserver` | HTTP server template |
| `main` | Main function template |

## Requirements

The extension bundles the `xray` binary (`bin/xray`) which provides both:

- **Language Server** — invoked as `xray lsp --stdio`
- **Debug Adapter** — invoked as `xray dap`

To use a custom build, set `xray.lsp.path` and/or `xray.debug.path` in VS Code settings, or ensure `xray` is available on your `PATH`.

Build from source:

```bash
cd /path/to/xray
cmake -B build-release -DCMAKE_BUILD_TYPE=Release
cmake --build build-release -j8
```

## License

MIT License
