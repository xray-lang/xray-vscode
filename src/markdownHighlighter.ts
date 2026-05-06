/**
 * Lightweight Xray syntax highlighter used by the Markdown preview extension
 * point. Keeps tokens in sync with the TextMate grammar at a coarse level so
 * ```xray fenced blocks in `.md` files render with consistent colouring.
 */

import {
    KEYWORDS, LITERALS,
    BUILTIN_FUNCTIONS, BUILTIN_TYPES, PRIMITIVE_TYPES
} from './xrayLanguage';

interface Token {
    type: 'comment' | 'string' | 'number' | 'keyword' | 'literal' | 'builtin' | 'text';
    value: string;
}

export function highlightXray(code: string): string {
    const tokens: Token[] = tokenize(code);
    const inner = tokens.map(renderToken).join('');
    return `<pre class="hljs"><code>${inner}</code></pre>`;
}

function tokenize(code: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    const len = code.length;

    while (i < len) {
        const c = code[i];

        // Line comment
        if (c === '/' && code[i + 1] === '/') {
            let end = code.indexOf('\n', i);
            if (end === -1) end = len;
            tokens.push({ type: 'comment', value: code.slice(i, end) });
            i = end;
            continue;
        }

        // Block comment
        if (c === '/' && code[i + 1] === '*') {
            let end = code.indexOf('*/', i + 2);
            end = end === -1 ? len : end + 2;
            tokens.push({ type: 'comment', value: code.slice(i, end) });
            i = end;
            continue;
        }

        // Strings / template literals
        if (c === '"' || c === "'" || c === '`') {
            const quote = c;
            let j = i + 1;
            while (j < len && code[j] !== quote) {
                if (code[j] === '\\' && j + 1 < len) j++;
                j++;
            }
            tokens.push({ type: 'string', value: code.slice(i, Math.min(j + 1, len)) });
            i = Math.min(j + 1, len);
            continue;
        }

        // Raw strings: r"...", r'...', r`...`
        if (c === 'r' && i + 1 < len && (code[i + 1] === '"' || code[i + 1] === "'" || code[i + 1] === '`')) {
            const quote = code[i + 1];
            let j = i + 2;
            while (j < len && code[j] !== quote) j++;
            tokens.push({ type: 'string', value: code.slice(i, Math.min(j + 1, len)) });
            i = Math.min(j + 1, len);
            continue;
        }

        // Numbers
        if (/[0-9]/.test(c)) {
            let j = i;
            if (c === '0' && (code[i + 1] === 'x' || code[i + 1] === 'X')) {
                j = i + 2;
                while (j < len && /[0-9a-fA-F_]/.test(code[j])) j++;
            } else if (c === '0' && (code[i + 1] === 'b' || code[i + 1] === 'B')) {
                j = i + 2;
                while (j < len && /[01_]/.test(code[j])) j++;
            } else if (c === '0' && (code[i + 1] === 'o' || code[i + 1] === 'O')) {
                j = i + 2;
                while (j < len && /[0-7_]/.test(code[j])) j++;
            } else {
                while (j < len && /[0-9._]/.test(code[j])) j++;
                if (j < len && (code[j] === 'e' || code[j] === 'E')) {
                    j++;
                    if (j < len && (code[j] === '+' || code[j] === '-')) j++;
                    while (j < len && /[0-9]/.test(code[j])) j++;
                }
            }
            // BigInt suffix
            if (j < len && code[j] === 'n') j++;
            tokens.push({ type: 'number', value: code.slice(i, j) });
            i = j;
            continue;
        }

        // Identifiers
        if (/[a-zA-Z_]/.test(c)) {
            let j = i;
            while (j < len && /[a-zA-Z0-9_]/.test(code[j])) j++;
            const word = code.slice(i, j);
            if (KEYWORDS.has(word)) {
                tokens.push({ type: 'keyword', value: word });
            } else if (LITERALS.has(word)) {
                tokens.push({ type: 'literal', value: word });
            } else if (BUILTIN_FUNCTIONS.has(word) || BUILTIN_TYPES.has(word) || PRIMITIVE_TYPES.has(word)) {
                tokens.push({ type: 'builtin', value: word });
            } else {
                tokens.push({ type: 'text', value: word });
            }
            i = j;
            continue;
        }

        tokens.push({ type: 'text', value: c });
        i++;
    }

    return tokens;
}

function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderToken(t: Token): string {
    const escaped = escapeHtml(t.value);
    switch (t.type) {
        case 'comment':
            return `<span class="hljs-comment">${escaped}</span>`;
        case 'string':
            return `<span class="hljs-string">${escaped}</span>`;
        case 'number':
            return `<span class="hljs-number">${escaped}</span>`;
        case 'keyword':
            return `<span class="hljs-keyword">${escaped}</span>`;
        case 'literal':
            return `<span class="hljs-literal">${escaped}</span>`;
        case 'builtin':
            return `<span class="hljs-built_in">${escaped}</span>`;
        default:
            return escaped;
    }
}
