// esbuild bundler for the Xray VS Code extension.
// Produces:
//   out/extension.js      - main activation entry
//   out/debugAdapter.js   - standalone node entry for the debug adapter (kept for
//                           backward compatibility with the `debuggers[].program`
//                           declaration, even though DAP is actually started via
//                           DebugAdapterDescriptorFactory)
//
// Usage:
//   node esbuild.config.mjs           # one-shot production bundle
//   node esbuild.config.mjs --watch   # incremental rebuilds for F5 dev host

import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');
const production = !watch && process.env.NODE_ENV !== 'development';

/** @type {import('esbuild').BuildOptions} */
const common = {
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node18',
    sourcemap: !production,
    minify: production,
    logLevel: 'info',
    // VS Code supplies the 'vscode' module at runtime and there is no npm package for it.
    external: ['vscode'],
    legalComments: 'linked'
};

const targets = [
    { entryPoints: ['src/extension.ts'], outfile: 'out/extension.js' },
    { entryPoints: ['src/debugAdapter.ts'], outfile: 'out/debugAdapter.js' }
];

async function run() {
    if (watch) {
        const ctxs = await Promise.all(
            targets.map((t) => esbuild.context({ ...common, ...t }))
        );
        await Promise.all(ctxs.map((c) => c.watch()));
        console.log('[esbuild] watching ...');
    } else {
        await Promise.all(
            targets.map((t) => esbuild.build({ ...common, ...t }))
        );
    }
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
