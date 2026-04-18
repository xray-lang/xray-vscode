import * as path from 'path';
import * as vscode from 'vscode';
import { resolveXrayPath } from './xrayPath';

// ---------------------------------------------------------------------------
// Descriptor factory (launch -> spawn `xray dap`, attach -> TCP server)
// ---------------------------------------------------------------------------

class XrayDebugAdapterDescriptorFactory
    implements vscode.DebugAdapterDescriptorFactory, vscode.Disposable {
    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly output: vscode.OutputChannel
    ) {}

    createDebugAdapterDescriptor(
        session: vscode.DebugSession
    ): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
        const config = session.configuration;

        if (config.request === 'attach') {
            const host = config.host || 'localhost';
            const port = Number(config.port) || 4711;
            this.output.appendLine(`[xray-dap] attach -> ${host}:${port}`);
            return new vscode.DebugAdapterServer(port, host);
        }

        // Launch mode
        const explicitPath = (config.xrayPath as string | undefined)?.trim();
        const resolved = explicitPath
            ? { path: explicitPath, source: 'setting' as const, verified: true }
            : resolveXrayPath(this.context, 'xray.debug.path');

        const args = ['dap'];
        const traceSession = Boolean(config.trace);
        const traceGlobal = vscode.workspace.getConfiguration('xray').get<boolean>('debug.trace');
        if (traceSession || traceGlobal) {
            args.push('--trace');
        }

        const env: Record<string, string> = {};
        for (const [k, v] of Object.entries(process.env)) {
            if (typeof v === 'string') env[k] = v;
        }
        const userEnv = config.env as Record<string, string> | undefined;
        if (userEnv) {
            for (const [k, v] of Object.entries(userEnv)) {
                if (typeof v === 'string') env[k] = v;
            }
        }

        const options: vscode.DebugAdapterExecutableOptions = {
            env,
            cwd: typeof config.cwd === 'string' && config.cwd.length > 0 ? config.cwd : undefined
        };

        this.output.appendLine(
            `[xray-dap] launch ${resolved.path} ${args.join(' ')} (source=${resolved.source})`
        );
        return new vscode.DebugAdapterExecutable(resolved.path, args, options);
    }

    dispose(): void {
        /* no owned resources */
    }
}

// ---------------------------------------------------------------------------
// Configuration provider (resolves defaults, validates program path)
// ---------------------------------------------------------------------------

class XrayDebugConfigurationProvider implements vscode.DebugConfigurationProvider {
    constructor(private readonly output: vscode.OutputChannel) {}

    provideDebugConfigurations(): vscode.DebugConfiguration[] {
        return [
            {
                type: 'xray',
                request: 'launch',
                name: 'Launch Xray Script',
                program: '${file}',
                cwd: '${workspaceFolder}',
                stopOnEntry: false
            },
            {
                type: 'xray',
                request: 'attach',
                name: 'Attach to Xray',
                host: 'localhost',
                port: 4711
            }
        ];
    }

    resolveDebugConfiguration(
        folder: vscode.WorkspaceFolder | undefined,
        config: vscode.DebugConfiguration
    ): vscode.ProviderResult<vscode.DebugConfiguration> {
        // F5 without launch.json.
        if (!config.type && !config.request && !config.name) {
            const target = findActiveXrayDocument();
            if (!target) {
                return vscode.window
                    .showErrorMessage('Please open a .xr file to start debugging.')
                    .then(() => undefined);
            }
            config.type = 'xray';
            config.request = 'launch';
            config.name = 'Launch Current File';
            config.program = target.uri.fsPath;
            config.cwd = folder?.uri.fsPath ?? path.dirname(target.uri.fsPath);
            config.stopOnEntry = true;
            this.output.appendLine(`[xray-dap] F5 default target: ${target.fileName}`);
        }

        if (config.request === 'launch') {
            if (!config.program) {
                return vscode.window
                    .showErrorMessage('No program specified in launch configuration.')
                    .then(() => undefined);
            }
            if (!config.cwd) {
                config.cwd = folder?.uri.fsPath ?? '${workspaceFolder}';
            }
            if (!config.args) {
                config.args = [];
            }
            if (!config.console) {
                config.console =
                    vscode.workspace
                        .getConfiguration('xray')
                        .get<string>('debug.console', 'internalConsole');
            }
        } else if (config.request === 'attach') {
            config.host = config.host ?? 'localhost';
            config.port = config.port ?? 4711;
        }

        return config;
    }

    resolveDebugConfigurationWithSubstitutedVariables(
        _folder: vscode.WorkspaceFolder | undefined,
        config: vscode.DebugConfiguration
    ): vscode.ProviderResult<vscode.DebugConfiguration> {
        if (config.request === 'launch' && typeof config.program === 'string') {
            const fs = require('fs') as typeof import('fs');
            if (!fs.existsSync(config.program)) {
                return vscode.window
                    .showErrorMessage(`Script not found: ${config.program}`)
                    .then(() => undefined);
            }
        }
        return config;
    }
}

// ---------------------------------------------------------------------------
// Inline values provider (shows variable values gutter-side while paused)
// ---------------------------------------------------------------------------

/**
 * Matches identifiers that are candidates for inline display:
 *   let x = ...
 *   const y = ...
 *   for (let z of iter)
 *   fn(a, b): T { ... }     // parameters
 *   a = expr                // assignment target
 *
 * We purposefully over-approximate here because VS Code filters out the
 * variables that are actually not in scope (the provider is called while
 * paused, and unresolved names just don't render a value).
 */
class XrayInlineValuesProvider implements vscode.InlineValuesProvider {
    private static readonly DECL_RE = /\b(?:let|const)\s+([A-Za-z_][A-Za-z0-9_]*)/g;
    private static readonly FOR_RE =
        /\bfor\s*\(\s*(?:let|const)?\s*([A-Za-z_][A-Za-z0-9_]*)\b/g;
    private static readonly PARAM_RE =
        /\bfn\s+[A-Za-z_][A-Za-z0-9_]*\s*\(([^)]*)\)/g;
    private static readonly ASSIGN_RE =
        /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?:[+\-*/%|&^]|<<|>>)?=(?!=)/;

    provideInlineValues(
        document: vscode.TextDocument,
        viewport: vscode.Range,
        context: vscode.InlineValueContext
    ): vscode.ProviderResult<vscode.InlineValue[]> {
        const values: vscode.InlineValue[] = [];
        const seen = new Set<string>();

        const endLine = Math.min(context.stoppedLocation.end.line, viewport.end.line);
        for (let line = viewport.start.line; line <= endLine; line++) {
            const text = document.lineAt(line).text;

            // let/const declarations.
            for (const m of text.matchAll(XrayInlineValuesProvider.DECL_RE)) {
                const name = m[1];
                const col = text.indexOf(name, m.index ?? 0);
                if (col < 0) continue;
                this.push(values, seen, line, col, name);
            }

            // for (let x of / in iter)
            for (const m of text.matchAll(XrayInlineValuesProvider.FOR_RE)) {
                const name = m[1];
                const col = text.indexOf(name, m.index ?? 0);
                if (col < 0) continue;
                this.push(values, seen, line, col, name);
            }

            // fn name(param: T, ...)
            for (const m of text.matchAll(XrayInlineValuesProvider.PARAM_RE)) {
                const params = m[1];
                const base = (m.index ?? 0) + m[0].indexOf('(') + 1;
                for (const part of params.split(',')) {
                    const clean = part.trim();
                    const nameMatch = clean.match(/^([A-Za-z_][A-Za-z0-9_]*)/);
                    if (!nameMatch) continue;
                    const col = base + params.indexOf(nameMatch[1]);
                    if (col < 0) continue;
                    this.push(values, seen, line, col, nameMatch[1]);
                }
            }

            // Simple assignment target.
            const assign = text.match(XrayInlineValuesProvider.ASSIGN_RE);
            if (assign) {
                const name = assign[1];
                const col = text.indexOf(name);
                if (col >= 0 && !isKeyword(name)) {
                    this.push(values, seen, line, col, name);
                }
            }
        }
        return values;
    }

    private push(
        out: vscode.InlineValue[],
        seen: Set<string>,
        line: number,
        col: number,
        name: string
    ): void {
        const key = `${line}:${name}`;
        if (seen.has(key) || isKeyword(name)) {
            return;
        }
        seen.add(key);
        const range = new vscode.Range(line, col, line, col + name.length);
        out.push(new vscode.InlineValueVariableLookup(range, name));
    }
}

const KEYWORDS = new Set([
    'let', 'const', 'fn', 'if', 'else', 'for', 'while', 'return', 'import',
    'export', 'from', 'class', 'enum', 'interface', 'type', 'match', 'case',
    'go', 'defer', 'await', 'select', 'after', 'scope', 'shared', 'break',
    'continue', 'this', 'base', 'new', 'static', 'true', 'false', 'null',
    'try', 'catch', 'finally', 'throw', 'in', 'is', 'to', 'as'
]);

function isKeyword(word: string): boolean {
    return KEYWORDS.has(word);
}

function findActiveXrayDocument(): vscode.TextDocument | undefined {
    const active = vscode.window.activeTextEditor;
    if (active && isXrayDocument(active.document)) {
        return active.document;
    }
    for (const editor of vscode.window.visibleTextEditors) {
        if (isXrayDocument(editor.document)) {
            return editor.document;
        }
    }
    return undefined;
}

function isXrayDocument(doc: vscode.TextDocument): boolean {
    return doc.languageId === 'xray' || doc.fileName.endsWith('.xr');
}

// ---------------------------------------------------------------------------
// Registration entry point
// ---------------------------------------------------------------------------

export function registerDebugProviders(context: vscode.ExtensionContext): void {
    const outputChannel = vscode.window.createOutputChannel('Xray Debug');
    context.subscriptions.push(outputChannel);

    const factory = new XrayDebugAdapterDescriptorFactory(context, outputChannel);
    context.subscriptions.push(
        vscode.debug.registerDebugAdapterDescriptorFactory('xray', factory),
        factory
    );

    const configProvider = new XrayDebugConfigurationProvider(outputChannel);
    context.subscriptions.push(
        vscode.debug.registerDebugConfigurationProvider('xray', configProvider)
    );

    context.subscriptions.push(
        vscode.languages.registerInlineValuesProvider('xray', new XrayInlineValuesProvider())
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('xray.startDebugging', async () => {
            const doc = findActiveXrayDocument();
            if (!doc) {
                vscode.window.showWarningMessage('Open a .xr file to start debugging.');
                return;
            }
            await vscode.debug.startDebugging(undefined, {
                type: 'xray',
                request: 'launch',
                name: 'Debug Current File',
                program: doc.uri.fsPath,
                cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? path.dirname(doc.uri.fsPath),
                stopOnEntry: false
            });
        })
    );

    outputChannel.appendLine('[xray-dap] providers registered');
}
