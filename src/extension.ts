import * as path from 'path';
import * as vscode from 'vscode';
import * as net from 'net';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    State,
    StreamInfo,
    TransportKind
} from 'vscode-languageclient/node';
import { registerDebugProviders } from './debugAdapter';
import { resolveXrayPath } from './xrayPath';
import { highlightXray } from './markdownHighlighter';

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let client: LanguageClient | undefined;
let outputChannel: vscode.OutputChannel | undefined;
let traceChannel: vscode.OutputChannel | undefined;
let statusItem: vscode.LanguageStatusItem | undefined;
let debugOutputChannel: vscode.OutputChannel | undefined;
let extensionContext: vscode.ExtensionContext | undefined;
let intentionalStop = false;
let autoRestartAttempts = 0;
const MAX_AUTO_RESTART_ATTEMPTS = 5;
const AUTO_RESTART_BASE_DELAY_MS = 1000;

// ---------------------------------------------------------------------------
// Activation
// ---------------------------------------------------------------------------

export async function activate(context: vscode.ExtensionContext) {
    extensionContext = context;

    outputChannel = vscode.window.createOutputChannel('Xray Language Server');
    traceChannel = vscode.window.createOutputChannel('Xray LSP Trace');
    context.subscriptions.push(outputChannel, traceChannel);

    createStatusItem(context);
    debugOutputChannel = registerDebugProviders(context);
    registerCommands(context);

    // Restart LSP on relevant config changes.
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(async (e) => {
            // Settings that require a full LSP restart (binary / transport change).
            const restartKeys = [
                'xray.lsp.path',
                'xray.lsp.transport',
                'xray.lsp.tcp.port',
                'xray.lsp.args',
                'xray.lsp.env',
                'xray.lsp.trace.server'
            ];
            if (restartKeys.some((k) => e.affectsConfiguration(k))) {
                // Full restart — the new server will pick up all latest settings.
                await restartLsp();
            } else {
                // Settings that can be hot-reloaded via workspace/didChangeConfiguration.
                const hotKeys = [
                    'xray.diagnostics.enabled',
                    'xray.diagnostics.debounceMs',
                    'xray.completion.autoImport',
                    'xray.completion.maxItems',
                    'xray.analysis.typeChecking',
                    'xray.format.tabSize',
                    'xray.format.insertSpaces',
                    'xray.inlayHints.typeAnnotations',
                    'xray.inlayHints.parameterNames'
                ];
                if (client && hotKeys.some((k) => e.affectsConfiguration(k))) {
                    void client.sendNotification('workspace/didChangeConfiguration', {
                        settings: buildInitializationOptions(
                            vscode.workspace.getConfiguration('xray')
                        )
                    });
                }
            }
            if (e.affectsConfiguration('xray.server.showStatusBar')) {
                toggleStatusItem();
            }
        })
    );

    try {
        await startLsp();
    } catch (err) {
        handleStartupFailure(err);
    }

    // Markdown code-block highlighter (for hover / Markdown preview of .md docs).
    return {
        extendMarkdownIt(md: any) {
            const origHighlight = md.options.highlight;
            md.options.highlight = (code: string, lang: string, attrs: string) => {
                if (lang === 'xray' || lang === 'xr') {
                    return highlightXray(code);
                }
                return origHighlight ? origHighlight(code, lang, attrs) : '';
            };
            return md;
        }
    };
}

export async function deactivate(): Promise<void> {
    statusItem?.dispose();
    statusItem = undefined;
    if (client) {
        try {
            await client.stop();
        } catch {
            /* ignore */
        }
        client = undefined;
    }
}

// ---------------------------------------------------------------------------
// LSP lifecycle
// ---------------------------------------------------------------------------

async function startLsp(): Promise<void> {
    if (!extensionContext || !outputChannel || !traceChannel) {
        return;
    }
    if (client) {
        // Already running.
        return;
    }

    const cfg = vscode.workspace.getConfiguration('xray');
    const resolved = resolveXrayPath(extensionContext, 'xray.lsp.path');
    outputChannel.appendLine(
        `[xray-lsp] Using xray binary: ${resolved.path} (source=${resolved.source}, verified=${resolved.verified})`
    );
    if (!resolved.verified && resolved.source !== 'path') {
        vscode.window.showErrorMessage(
            `Xray: resolved binary is not executable: ${resolved.path}. ` +
                `Please set 'xray.lsp.path' or rebuild the extension.`
        );
        setStatus('Error', 'Binary not executable');
        return;
    }

    const extraArgs = cfg.get<string[]>('lsp.args', []);
    const extraEnv = cfg.get<Record<string, string>>('lsp.env', {});
    const transport = cfg.get<'stdio' | 'tcp'>('lsp.transport', 'stdio');
    const tcpPort = cfg.get<number>('lsp.tcp.port', 7711);

    let serverOptions: ServerOptions;
    if (transport === 'tcp') {
        serverOptions = () =>
            new Promise<StreamInfo>((resolve, reject) => {
                const socket = net.connect({ host: '127.0.0.1', port: tcpPort }, () => {
                    resolve({ reader: socket, writer: socket });
                });
                socket.once('error', reject);
            });
    } else {
        const runOptions = {
            command: resolved.path,
            args: ['lsp', '--stdio', ...extraArgs],
            transport: TransportKind.stdio,
            options: {
                env: { ...process.env, ...extraEnv }
            }
        };
        serverOptions = { run: runOptions, debug: runOptions };
    }

    const clientOptions: LanguageClientOptions = {
        documentSelector: [
            { scheme: 'file', language: 'xray' },
            { scheme: 'untitled', language: 'xray' }
        ],
        synchronize: {
            fileEvents: vscode.workspace.createFileSystemWatcher('**/*.xr'),
            configurationSection: 'xray'
        },
        outputChannel,
        traceOutputChannel: traceChannel,
        initializationOptions: buildInitializationOptions(cfg),
        middleware: {
            // Route errors to the output channel; no console spam.
            provideCompletionItem: async (document, position, context, token, next) => {
                try {
                    return await next(document, position, context, token);
                } catch (err) {
                    traceChannel!.appendLine(`[completion] error: ${stringifyError(err)}`);
                    throw err;
                }
            },
            provideDocumentFormattingEdits: async (document, options, token, next) => {
                try {
                    return await next(document, options, token);
                } catch (err) {
                    traceChannel!.appendLine(`[format] error: ${stringifyError(err)}`);
                    throw err;
                }
            }
        }
    };

    client = new LanguageClient('xray-lsp', 'Xray Language Server', serverOptions, clientOptions);

    client.onDidChangeState((e) => {
        switch (e.newState) {
            case State.Starting:
                setStatus('Starting', '');
                break;
            case State.Running:
                setStatus('Running', 'Ready');
                break;
            case State.Stopped:
                setStatus('Stopped', '');
                handleUnexpectedStop();
                break;
        }
    });

    intentionalStop = false;
    setStatus('Starting', '');
    try {
        await client.start();
        outputChannel.appendLine('[xray-lsp] started');
    } catch (err) {
        outputChannel.appendLine(`[xray-lsp] start failed: ${stringifyError(err)}`);
        setStatus('Error', stringifyError(err));
        throw err;
    }
}

async function stopLsp(): Promise<void> {
    if (!client) {
        return;
    }
    intentionalStop = true;
    try {
        await client.stop();
    } catch (err) {
        outputChannel?.appendLine(`[xray-lsp] stop error: ${stringifyError(err)}`);
    }
    client = undefined;
    setStatus('Stopped', '');
}

async function restartLsp(): Promise<void> {
    await stopLsp();
    intentionalStop = false;
    autoRestartAttempts = 0;
    try {
        await startLsp();
    } catch (err) {
        handleStartupFailure(err);
    }
}

function handleUnexpectedStop(): void {
    if (intentionalStop) {
        return;
    }
    // Clear stale client reference so startLsp() can proceed.
    client = undefined;

    const autoRestart = vscode.workspace
        .getConfiguration('xray')
        .get<boolean>('lsp.autoRestart', true);
    if (!autoRestart) {
        outputChannel?.appendLine('[xray-lsp] server stopped; autoRestart is disabled');
        return;
    }
    if (autoRestartAttempts >= MAX_AUTO_RESTART_ATTEMPTS) {
        outputChannel?.appendLine(
            `[xray-lsp] server stopped; giving up after ${autoRestartAttempts} restart attempts`
        );
        vscode.window
            .showErrorMessage(
                `Xray language server crashed ${autoRestartAttempts} times. Please check the log.`,
                'Show Log'
            )
            .then((pick) => {
                if (pick === 'Show Log') {
                    outputChannel?.show(true);
                }
            });
        return;
    }

    autoRestartAttempts++;
    const delay = AUTO_RESTART_BASE_DELAY_MS * Math.pow(2, autoRestartAttempts - 1);
    outputChannel?.appendLine(
        `[xray-lsp] server stopped unexpectedly; restarting in ${delay}ms (attempt ${autoRestartAttempts}/${MAX_AUTO_RESTART_ATTEMPTS})`
    );
    setTimeout(async () => {
        try {
            await startLsp();
            autoRestartAttempts = 0;
        } catch (err) {
            handleStartupFailure(err);
        }
    }, delay);
}

function handleStartupFailure(err: unknown): void {
    const msg = stringifyError(err);
    outputChannel?.appendLine(`[xray-lsp] start failed: ${msg}`);
    setStatus('Error', msg);
    vscode.window
        .showErrorMessage(
            `Failed to start Xray language server: ${msg}`,
            'Show Log',
            'Retry'
        )
        .then((pick) => {
            if (pick === 'Show Log') {
                outputChannel?.show(true);
            } else if (pick === 'Retry') {
                void restartLsp();
            }
        });
}

function buildInitializationOptions(cfg: vscode.WorkspaceConfiguration): Record<string, unknown> {
    return {
        xray: {
            diagnostics: {
                enabled: cfg.get<boolean>('diagnostics.enabled', true),
                debounceMs: cfg.get<number>('diagnostics.debounceMs', 300)
            },
            completion: {
                autoImport: cfg.get<boolean>('completion.autoImport', false),
                maxItems: cfg.get<number>('completion.maxItems', 100)
            },
            analysis: {
                typeChecking: cfg.get<boolean>('analysis.typeChecking', true)
            },
            format: {
                tabSize: cfg.get<number>('format.tabSize', 4),
                insertSpaces: cfg.get<boolean>('format.insertSpaces', true)
            },
            inlayHints: {
                typeAnnotations: cfg.get<boolean>('inlayHints.typeAnnotations', true),
                parameterNames: cfg.get<boolean>('inlayHints.parameterNames', true)
            }
        }
    };
}

// ---------------------------------------------------------------------------
// Status bar
// ---------------------------------------------------------------------------

function createStatusItem(context: vscode.ExtensionContext): void {
    const show = vscode.workspace.getConfiguration('xray').get<boolean>('server.showStatusBar', true);
    if (!show) {
        return;
    }
    statusItem = vscode.languages.createLanguageStatusItem('xray.lspStatus', {
        language: 'xray'
    });
    statusItem.name = 'Xray LSP';
    statusItem.command = {
        title: 'Restart',
        command: 'xray.restartServer'
    };
    setStatus('Starting', '');
    context.subscriptions.push(statusItem);
}

function toggleStatusItem(): void {
    const show = vscode.workspace.getConfiguration('xray').get<boolean>('server.showStatusBar', true);
    if (show && !statusItem && extensionContext) {
        createStatusItem(extensionContext);
    } else if (!show && statusItem) {
        statusItem.dispose();
        statusItem = undefined;
    }
}

function setStatus(state: 'Starting' | 'Running' | 'Stopped' | 'Error', detail: string): void {
    if (!statusItem) {
        return;
    }
    statusItem.text = `$(symbol-interface) Xray: ${state}`;
    statusItem.detail = detail;
    switch (state) {
        case 'Running':
            statusItem.severity = vscode.LanguageStatusSeverity.Information;
            break;
        case 'Starting':
        case 'Stopped':
            statusItem.severity = vscode.LanguageStatusSeverity.Warning;
            break;
        case 'Error':
            statusItem.severity = vscode.LanguageStatusSeverity.Error;
            break;
    }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function registerCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('xray.startServer', async () => {
            await startLsp();
        }),
        vscode.commands.registerCommand('xray.stopServer', async () => {
            await stopLsp();
        }),
        vscode.commands.registerCommand('xray.restartServer', async () => {
            await restartLsp();
            vscode.window.showInformationMessage('Xray Language Server restarted.');
        }),
        vscode.commands.registerCommand('xray.showServerLog', () => {
            outputChannel?.show(true);
        }),
        vscode.commands.registerCommand('xray.showDebugLog', () => {
            debugOutputChannel?.show(true);
        }),
        vscode.commands.registerCommand('xray.runFile', () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || (editor.document.languageId !== 'xray' && !editor.document.fileName.endsWith('.xr'))) {
                vscode.window.showWarningMessage('Open a .xr file to run.');
                return;
            }
            const filePath = editor.document.uri.fsPath;
            const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? path.dirname(filePath);
            const resolved = resolveXrayPath(extensionContext!, 'xray.lsp.path');
            const terminal = vscode.window.createTerminal({
                name: `Xray: ${path.basename(filePath)}`,
                cwd
            });
            terminal.show();
            terminal.sendText(`${resolved.path} run "${filePath}"`);
        }),
        vscode.commands.registerCommand('xray.collectDiagnostics', async () => {
            const doc = await buildDiagnosticDocument();
            const textDoc = await vscode.workspace.openTextDocument({
                language: 'markdown',
                content: doc
            });
            vscode.window.showTextDocument(textDoc, { preview: false });
        })
    );
}

async function buildDiagnosticDocument(): Promise<string> {
    const ctx = extensionContext;
    if (!ctx) {
        return '# Xray diagnostics\n\nExtension not activated.';
    }
    const lsp = resolveXrayPath(ctx, 'xray.lsp.path');
    const dap = resolveXrayPath(ctx, 'xray.debug.path');
    const vsc = vscode.version;
    const extVersion = vscode.extensions.getExtension('xray-lang.xray-lang')?.packageJSON.version;
    const folders = vscode.workspace.workspaceFolders?.map((f) => f.uri.fsPath) ?? [];
    const cfg = vscode.workspace.getConfiguration('xray');
    const serialized = JSON.stringify(
        {
            'xray.lsp.transport': cfg.get('lsp.transport'),
            'xray.lsp.trace.server': cfg.get('lsp.trace.server'),
            'xray.debug.trace': cfg.get('debug.trace'),
            'xray.debug.console': cfg.get('debug.console'),
            'xray.analysis.typeChecking': cfg.get('analysis.typeChecking'),
            'xray.diagnostics.enabled': cfg.get('diagnostics.enabled')
        },
        null,
        2
    );
    return [
        '# Xray Diagnostic Info',
        '',
        `- VS Code: ${vsc}`,
        `- Extension: ${extVersion ?? 'unknown'}`,
        `- Platform: ${process.platform} (${process.arch})`,
        `- Node: ${process.version}`,
        '',
        '## Resolved binaries',
        '```json',
        JSON.stringify({ lsp, dap }, null, 2),
        '```',
        '',
        '## Workspace folders',
        folders.length > 0 ? folders.map((f) => `- ${f}`).join('\n') : '_(none)_',
        '',
        '## Selected settings',
        '```json',
        serialized,
        '```',
        '',
        'Please paste this document into bug reports along with the relevant',
        '`Xray Language Server` output log.',
        ''
    ].join('\n');
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function stringifyError(err: unknown): string {
    if (err instanceof Error) {
        return err.message;
    }
    return String(err);
}
