import * as vscode from 'vscode';
import { scanQuotedLiteral } from './quotedLiteralScanner';

/**
 * Folding provider for Xray source. Quoted literals are scanned with the same
 * six-prefix, variable-quote contract as the Markdown preview helper.
 */
export class XrayFoldingRangeProvider implements vscode.FoldingRangeProvider {
    provideFoldingRanges(document: vscode.TextDocument): vscode.FoldingRange[] {
        const ranges: vscode.FoldingRange[] = [];
        const source = document.getText();
        const braceStack: number[] = [];
        let importStart = -1;
        let importEnd = -1;

        for (let line = 0; line < document.lineCount; line++) {
            const text = document.lineAt(line).text;
            if (/^\s*import\b/.test(text)) {
                if (importStart === -1) importStart = line;
                importEnd = line;
            } else if (importStart !== -1 && !/^\s*$/.test(text)) {
                if (importEnd > importStart) {
                    ranges.push(new vscode.FoldingRange(importStart, importEnd,
                                                        vscode.FoldingRangeKind.Imports));
                }
                importStart = -1;
            }
        }

        let offset = 0;
        while (offset < source.length) {
            const quoted = scanQuotedLiteral(source, offset);
            if (quoted) {
                if (quoted.block) {
                    const startLine = document.positionAt(quoted.start).line;
                    const endLine = document.positionAt(quoted.end).line;
                    if (endLine > startLine) {
                        ranges.push(new vscode.FoldingRange(startLine, endLine));
                    }
                }
                offset = Math.max(quoted.end, offset + 1);
                continue;
            }

            if (source.startsWith('//', offset)) {
                const newline = source.indexOf('\n', offset + 2);
                offset = newline < 0 ? source.length : newline + 1;
                continue;
            }
            if (source.startsWith('/*', offset)) {
                const close = source.indexOf('*/', offset + 2);
                const end = close < 0 ? source.length : close + 2;
                const startLine = document.positionAt(offset).line;
                const endLine = document.positionAt(end).line;
                if (endLine > startLine) {
                    ranges.push(new vscode.FoldingRange(startLine, endLine,
                                                        vscode.FoldingRangeKind.Comment));
                }
                offset = end;
                continue;
            }
            if (source[offset] === "'") {
                offset++;
                while (offset < source.length && source[offset] !== '\n') {
                    if (source[offset] === '\\' && offset + 1 < source.length) offset++;
                    if (source[offset++] === "'") break;
                }
                continue;
            }
            if (source[offset] === '{') {
                braceStack.push(document.positionAt(offset).line);
            } else if (source[offset] === '}' && braceStack.length > 0) {
                const openLine = braceStack.pop()!;
                const closeLine = document.positionAt(offset).line;
                if (closeLine > openLine) {
                    ranges.push(new vscode.FoldingRange(openLine, closeLine));
                }
            }
            offset++;
        }

        if (importStart !== -1 && importEnd > importStart) {
            ranges.push(new vscode.FoldingRange(importStart, importEnd,
                                                vscode.FoldingRangeKind.Imports));
        }
        return ranges;
    }
}
