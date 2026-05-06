import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

/**
 * Resolve the path to the `xray` executable based on the user setting and the
 * extension's bundled binary.
 *
 * Priority:
 *   1. Explicit setting (`xray.lsp.path` / `xray.debug.path`)
 *   2. Bundled binary in `<extension>/bin/xray(.exe)`
 *   3. `xray` on PATH (resolved lazily by the OS when spawning)
 */
export interface XrayPathResult {
    path: string;
    /** 'setting' | 'bundled' | 'path' */
    source: 'setting' | 'bundled' | 'path';
    /** true when the file was found on disk and is executable. */
    verified: boolean;
}

export type XraySettingKey = 'xray.lsp.path' | 'xray.debug.path';

function isExecutable(p: string): boolean {
    try {
        // Windows: existence is enough (PATHEXT handles .exe).
        if (process.platform === 'win32') {
            return fs.existsSync(p);
        }
        fs.accessSync(p, fs.constants.X_OK);
        return true;
    } catch {
        return false;
    }
}

export function binaryName(): string {
    return process.platform === 'win32' ? 'xray.exe' : 'xray';
}

export function resolveXrayPath(
    context: vscode.ExtensionContext,
    settingKey: XraySettingKey
): XrayPathResult {
    // 1. Explicit user setting
    const cfg = vscode.workspace.getConfiguration();
    const explicit = cfg.get<string>(settingKey, '').trim();
    if (explicit) {
        return {
            path: explicit,
            source: 'setting',
            verified: isExecutable(explicit)
        };
    }

    // 2. Bundled binary
    const bundled = path.join(context.extensionPath, 'bin', binaryName());
    if (fs.existsSync(bundled)) {
        // Ensure executable bit on POSIX (git archive may drop it).
        if (process.platform !== 'win32') {
            try {
                fs.chmodSync(bundled, 0o755);
            } catch {
                /* best effort */
            }
        }
        return {
            path: bundled,
            source: 'bundled',
            verified: isExecutable(bundled)
        };
    }

    // 3. Fall back to PATH — try to verify it actually exists.
    const name = binaryName();
    let verified = false;
    try {
        const cmd = process.platform === 'win32' ? `where ${name}` : `which ${name}`;
        execSync(cmd, { stdio: 'pipe', timeout: 3000 });
        verified = true;
    } catch {
        /* binary not found on PATH */
    }
    return { path: name, source: 'path', verified };
}
