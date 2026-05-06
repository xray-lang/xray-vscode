#!/usr/bin/env node
// Sync the xray-vscode extension version with the xray core repo.
//
// Reads the project version from the sibling xray repo's CMakeLists.txt
// (the single source of truth for the language runtime version) and
// writes it into this extension's package.json.
//
// Usage:
//   node scripts/sync-version.mjs                # auto-detect from sibling
//   node scripts/sync-version.mjs 0.6.0          # force specific version
//   node scripts/sync-version.mjs --dry-run      # show what would change
//
// Search order for the xray core CMakeLists.txt:
//   1. ../xray/CMakeLists.txt                    (sibling layout)
//   2. ../../xray/CMakeLists.txt                 (nested workspace)
//   3. $XRAY_CORE_PATH/CMakeLists.txt            (env override)

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = resolve(__dirname, '..')
const PKG_JSON = resolve(ROOT_DIR, 'package.json')

let dryRun = false
let forced = null
for (const arg of process.argv.slice(2)) {
    if (arg === '--dry-run') dryRun = true
    else if (arg === '-h' || arg === '--help') {
        const lines = readFileSync(fileURLToPath(import.meta.url), 'utf-8')
            .split('\n').slice(1, 17).map(l => l.replace(/^\/\/ ?/, ''))
        console.log(lines.join('\n'))
        process.exit(0)
    } else if (/^\d+\.\d+\.\d+/.test(arg)) forced = arg
    else { console.error(`Unknown argument: ${arg}`); process.exit(1) }
}

function resolveVersion() {
    if (forced) return forced

    const candidates = [
        resolve(ROOT_DIR, '../xray/CMakeLists.txt'),
        resolve(ROOT_DIR, '../../xray/CMakeLists.txt'),
        process.env.XRAY_CORE_PATH
            ? resolve(process.env.XRAY_CORE_PATH, 'CMakeLists.txt')
            : null,
    ].filter(Boolean)

    for (const p of candidates) {
        if (!existsSync(p)) continue
        try {
            const text = readFileSync(p, 'utf-8')
            const m = text.match(/project\s*\(\s*Xray\s+VERSION\s+(\d+\.\d+\.\d+)/i)
            if (m) return m[1]
        } catch {}
    }

    console.error('Could not resolve xray core version from any candidate path.')
    console.error('Set XRAY_CORE_PATH or pass an explicit version like 0.6.0.')
    process.exit(1)
}

const newVersion = resolveVersion()
const pkg = JSON.parse(readFileSync(PKG_JSON, 'utf-8'))
const currentVersion = pkg.version

console.log(`current package.json version: ${currentVersion}`)
console.log(`target xray core version:     ${newVersion}`)

if (currentVersion === newVersion) {
    console.log('Already in sync. Nothing to do.')
    process.exit(0)
}

if (dryRun) {
    console.log(`(dry-run) would update package.json: ${currentVersion} -> ${newVersion}`)
    process.exit(0)
}

// Write back preserving the original formatting (2-space indent, trailing newline)
pkg.version = newVersion
const ORIG = readFileSync(PKG_JSON, 'utf-8')
const trailingNewline = ORIG.endsWith('\n') ? '\n' : ''
writeFileSync(PKG_JSON, JSON.stringify(pkg, null, 2) + trailingNewline)
console.log(`Updated ${PKG_JSON}: ${currentVersion} -> ${newVersion}`)
