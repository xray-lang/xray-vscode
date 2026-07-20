export type QuotedLiteralPrefix = '' | 'r' | 'b' | 'br' | 'c' | 'cr';

export interface QuotedLiteralSpan {
    start: number;
    end: number;
    prefix: QuotedLiteralPrefix;
    quoteCount: number;
    block: boolean;
    closed: boolean;
}

const prefixes: QuotedLiteralPrefix[] = ['br', 'cr', 'r', 'b', 'c', ''];

function isIdentifierContinue(ch: string | undefined): boolean {
    return ch !== undefined && /[A-Za-z0-9_]/.test(ch);
}

function prefixAt(source: string, start: number): QuotedLiteralPrefix | null {
    for (const prefix of prefixes) {
        if (prefix !== '' && start > 0 && isIdentifierContinue(source[start - 1])) {
            continue;
        }
        if (source.startsWith(prefix + '"', start)) {
            return prefix;
        }
    }
    return null;
}

function isEscaped(prefix: QuotedLiteralPrefix): boolean {
    return prefix === '' || prefix === 'b' || prefix === 'c';
}

function hasInterpolation(prefix: QuotedLiteralPrefix): boolean {
    return prefix === '' || prefix === 'r';
}

function skipRune(source: string, start: number): number {
    let cursor = start + 1;
    while (cursor < source.length && source[cursor] !== '\n' && source[cursor] !== '\r') {
        if (source[cursor] === '\\' && cursor + 1 < source.length) {
            cursor += 2;
            continue;
        }
        if (source[cursor] === "'") {
            return cursor + 1;
        }
        cursor++;
    }
    return cursor;
}

function skipInterpolation(source: string, start: number): number {
    let cursor = start;
    let depth = 1;
    while (cursor < source.length && depth > 0) {
        if (source.startsWith('//', cursor)) {
            const newline = source.indexOf('\n', cursor + 2);
            cursor = newline < 0 ? source.length : newline + 1;
            continue;
        }
        if (source.startsWith('/*', cursor)) {
            const close = source.indexOf('*/', cursor + 2);
            cursor = close < 0 ? source.length : close + 2;
            continue;
        }
        const nested = scanQuotedLiteral(source, cursor);
        if (nested) {
            cursor = nested.end;
            continue;
        }
        if (source[cursor] === "'") {
            cursor = skipRune(source, cursor);
            continue;
        }
        if (source[cursor] === '{') {
            depth++;
        } else if (source[cursor] === '}') {
            depth--;
        }
        cursor++;
    }
    return cursor;
}

function scanInline(source: string, start: number, payloadStart: number,
                    prefix: QuotedLiteralPrefix): QuotedLiteralSpan {
    let cursor = payloadStart;
    while (cursor < source.length) {
        const ch = source[cursor];
        if (ch === '\n' || ch === '\r') {
            return { start, end: cursor, prefix, quoteCount: 1, block: false, closed: false };
        }
        if (isEscaped(prefix) && ch === '\\' && cursor + 1 < source.length) {
            cursor += 2;
            continue;
        }
        if (hasInterpolation(prefix) && ch === '$' && source[cursor + 1] === '{') {
            cursor = skipInterpolation(source, cursor + 2);
            continue;
        }
        if (ch === '"') {
            return { start, end: cursor + 1, prefix, quoteCount: 1, block: false, closed: true };
        }
        cursor++;
    }
    return { start, end: source.length, prefix, quoteCount: 1, block: false, closed: false };
}

function scanBlock(source: string, start: number, bodyStart: number,
                   prefix: QuotedLiteralPrefix, quoteCount: number): QuotedLiteralSpan {
    let lineStart = bodyStart;
    while (lineStart <= source.length) {
        let lineEnd = source.indexOf('\n', lineStart);
        if (lineEnd < 0) lineEnd = source.length;
        let contentEnd = lineEnd;
        if (contentEnd > lineStart && source[contentEnd - 1] === '\r') contentEnd--;

        let cursor = lineStart;
        while (cursor < contentEnd && (source[cursor] === ' ' || source[cursor] === '\t')) cursor++;
        let quotes = 0;
        while (cursor + quotes < contentEnd && source[cursor + quotes] === '"') quotes++;
        if (quotes === quoteCount && cursor + quotes === contentEnd) {
            return {
                start,
                end: contentEnd,
                prefix,
                quoteCount,
                block: true,
                closed: true,
            };
        }
        if (lineEnd === source.length) break;
        lineStart = lineEnd + 1;
    }
    return { start, end: source.length, prefix, quoteCount, block: true, closed: false };
}

export function scanQuotedLiteral(source: string, start: number): QuotedLiteralSpan | null {
    const prefix = prefixAt(source, start);
    if (prefix === null) return null;

    const quoteStart = start + prefix.length;
    let quoteCount = 0;
    while (source[quoteStart + quoteCount] === '"') quoteCount++;
    if (quoteCount === 1) {
        return scanInline(source, start, quoteStart + 1, prefix);
    }
    if (quoteCount === 2) {
        return {
            start,
            end: quoteStart + 2,
            prefix,
            quoteCount,
            block: false,
            closed: true,
        };
    }

    const afterQuotes = quoteStart + quoteCount;
    let bodyStart = afterQuotes;
    if (source.startsWith('\r\n', afterQuotes)) {
        bodyStart += 2;
    } else if (source[afterQuotes] === '\n') {
        bodyStart += 1;
    } else {
        return null;
    }
    return scanBlock(source, start, bodyStart, prefix, quoteCount);
}
