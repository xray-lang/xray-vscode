import * as vscode from 'vscode';

/**
 * Folding provider for Xray (.xr) files.
 *
 * Single-pass scanner that produces folding ranges for:
 *   1. Brace blocks  { … }   — fn, class, struct, if, while, for, match, etc.
 *   2. Multi-line string literals  '…' / "…"
 *   3. Block comments  /* … *​/
 *   4. Consecutive import lines
 *
 * Registering a FoldingRangeProvider causes VS Code to stop using its built-in
 * indentation-based folding, so we must emit brace ranges ourselves.
 */
export class XrayFoldingRangeProvider implements vscode.FoldingRangeProvider {
    provideFoldingRanges(document: vscode.TextDocument): vscode.FoldingRange[] {
        const ranges: vscode.FoldingRange[] = [];
        const lineCount = document.lineCount;

        // State
        let inString: string | null = null;   // quote char while inside multi-line string
        let stringStart = -1;
        let inBlock = false;                  // inside /* … */
        let blockStart = -1;
        let importStart = -1;
        let importEnd = -1;
        const braceStack: number[] = [];      // line numbers of unmatched '{'

        for (let i = 0; i < lineCount; i++) {
            const text = document.lineAt(i).text;

            // ── Inside multi-line string ──
            if (inString) {
                if (closesString(text, inString)) {
                    if (i > stringStart) {
                        ranges.push(new vscode.FoldingRange(stringStart, i));
                    }
                    inString = null;
                }
                continue;
            }

            // ── Inside block comment ──
            if (inBlock) {
                if (text.includes('*/')) {
                    ranges.push(
                        new vscode.FoldingRange(blockStart, i, vscode.FoldingRangeKind.Comment)
                    );
                    inBlock = false;
                }
                continue;
            }

            // ── Import block tracking ──
            if (/^\s*import\b/.test(text)) {
                if (importStart === -1) { importStart = i; }
                importEnd = i;
            } else if (importStart !== -1 && !/^\s*$/.test(text)) {
                if (importEnd > importStart) {
                    ranges.push(
                        new vscode.FoldingRange(importStart, importEnd, vscode.FoldingRangeKind.Imports)
                    );
                }
                importStart = -1;
            }

            // ── Scan characters for braces, strings, comments ──
            let j = 0;
            while (j < text.length) {
                const ch = text[j];

                // Line comment — rest of line is inert
                if (ch === '/' && j + 1 < text.length && text[j + 1] === '/') {
                    break;
                }

                // Block comment start
                if (ch === '/' && j + 1 < text.length && text[j + 1] === '*') {
                    const endPos = text.indexOf('*/', j + 2);
                    if (endPos === -1) {
                        // Multi-line block comment
                        inBlock = true;
                        blockStart = i;
                        break;
                    }
                    // Single-line block comment — skip past it
                    j = endPos + 2;
                    continue;
                }

                // String literal
                if (ch === '\'' || ch === '"') {
                    const q = ch;
                    j++;
                    let closed = false;
                    while (j < text.length) {
                        if (text[j] === '\\') { j += 2; continue; }
                        if (text[j] === q) { closed = true; j++; break; }
                        j++;
                    }
                    if (!closed) {
                        // Opens a multi-line string
                        inString = q;
                        stringStart = i;
                        break;
                    }
                    continue;
                }

                // Braces
                if (ch === '{') {
                    braceStack.push(i);
                } else if (ch === '}') {
                    if (braceStack.length > 0) {
                        const openLine = braceStack.pop()!;
                        if (i > openLine) {
                            ranges.push(new vscode.FoldingRange(openLine, i));
                        }
                    }
                }

                j++;
            }
        }

        // Flush trailing import block
        if (importStart !== -1 && importEnd > importStart) {
            ranges.push(
                new vscode.FoldingRange(importStart, importEnd, vscode.FoldingRangeKind.Imports)
            );
        }

        return ranges;
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if the line contains an unescaped instance of `q` that would
 * close the currently open multi-line string.
 */
function closesString(line: string, q: string): boolean {
    for (let i = 0; i < line.length; i++) {
        if (line[i] === '\\') { i++; continue; }
        if (line[i] === q) { return true; }
    }
    return false;
}
