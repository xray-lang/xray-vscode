import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { scanQuotedLiteral } = require('../out/quotedLiteralScanner.js');
const { highlightXray } = require('../out/markdownHighlighter.js');

const html = 'const page = r"""\n<div title="quoted">\n  // inert { comment marker\n</div>\n"""\n';
const htmlStart = html.indexOf('r"""');
const htmlSpan = scanQuotedLiteral(html, htmlStart);
assert.ok(htmlSpan?.block && htmlSpan.closed);
assert.equal(html.slice(htmlSpan.start, htmlSpan.end),
             'r"""\n<div title="quoted">\n  // inert { comment marker\n</div>\n"""');

const collision = 'br""""\n"""\n${HOME} \\ path\n""""';
const collisionSpan = scanQuotedLiteral(collision, 0);
assert.ok(collisionSpan?.closed);
assert.equal(collisionSpan.quoteCount, 4);
assert.equal(collisionSpan.prefix, 'br');
assert.equal(collisionSpan.end, collision.length);

for (const source of ['"x"', 'r"x"', 'b"x"', 'br"x"', 'c"x"', 'cr"x"',
                      '""', 'r""', 'b""', 'br""', 'c""', 'cr""']) {
    const span = scanQuotedLiteral(source, 0);
    assert.ok(span?.closed, source);
    assert.equal(span.end, source.length, source);
}

for (const [source, start] of [['bravo"x"', 0], ['create"x"', 0], ['abc"x"', 2]]) {
    assert.equal(scanQuotedLiteral(source, start), null, source);
}
assert.equal(scanQuotedLiteral('(br"x")', 1)?.end, 6);

const nested = '"outer ${fn(r"""\ninner " quote\n""")} tail"';
assert.equal(scanQuotedLiteral(nested, 0)?.end, nested.length);

const highlighted = highlightXray(html + 'const done = true\n');
assert.equal((highlighted.match(/hljs-string/g) ?? []).length, 1);
assert.match(highlighted, /&lt;div title="quoted"&gt;/);
assert.match(highlighted, /hljs-keyword">const/);

console.log('quoted literal tooling tests passed');
