#!/usr/bin/env bash
# Build a platform-specific .vsix for the Xray VS Code extension.
#
# Usage:
#   scripts/package.sh                          # auto-detect host platform
#   scripts/package.sh darwin-arm64             # explicit target
#   scripts/package.sh darwin-arm64 /path/xray  # explicit target + binary
#
# Supported targets (vsce platform identifiers):
#   darwin-arm64, darwin-x64
#   linux-arm64, linux-x64, linux-armhf
#   alpine-arm64, alpine-x64
#   win32-arm64, win32-x64, win32-ia32
#
# The script:
#   1. Optionally copies a prebuilt xray binary into bin/<binname>.
#   2. Runs `vsce package --target <target>` to produce a .vsix.
#   3. Writes the artifact path to stdout for CI capture.

set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

# ---------------------------------------------------------------------------
# Detect host platform when no target is provided.
# ---------------------------------------------------------------------------
detect_target() {
    local os arch
    case "$(uname -s)" in
        Darwin) os=darwin ;;
        Linux)  os=linux ;;
        MINGW*|MSYS*|CYGWIN*) os=win32 ;;
        *) echo "Unsupported host OS: $(uname -s)" >&2; exit 1 ;;
    esac
    case "$(uname -m)" in
        arm64|aarch64) arch=arm64 ;;
        x86_64|amd64)  arch=x64 ;;
        *) echo "Unsupported host arch: $(uname -m)" >&2; exit 1 ;;
    esac
    echo "${os}-${arch}"
}

TARGET="${1:-$(detect_target)}"
BINARY_SRC="${2:-}"

# ---------------------------------------------------------------------------
# Validate target.
# ---------------------------------------------------------------------------
case "$TARGET" in
    darwin-arm64|darwin-x64) ;;
    linux-arm64|linux-x64|linux-armhf) ;;
    alpine-arm64|alpine-x64) ;;
    win32-arm64|win32-x64|win32-ia32) ;;
    *)
        echo "Unsupported vsce target: $TARGET" >&2
        echo "See https://code.visualstudio.com/api/working-with-extensions/publishing-extension#platformspecific-extensions" >&2
        exit 1
        ;;
esac

# Determine binary filename for this target.
case "$TARGET" in
    win32-*) BIN_NAME=xray.exe ;;
    *)       BIN_NAME=xray ;;
esac

# ---------------------------------------------------------------------------
# Stage the binary if a source path was provided.
# ---------------------------------------------------------------------------
mkdir -p bin
if [[ -n "$BINARY_SRC" ]]; then
    if [[ ! -f "$BINARY_SRC" ]]; then
        echo "Binary not found: $BINARY_SRC" >&2
        exit 1
    fi
    echo "[package] staging $BINARY_SRC -> bin/$BIN_NAME"
    cp "$BINARY_SRC" "bin/$BIN_NAME"
    chmod +x "bin/$BIN_NAME" || true
elif [[ ! -f "bin/$BIN_NAME" ]]; then
    echo "[package] WARNING: bin/$BIN_NAME not found — packaging without bundled binary" >&2
    echo "[package] users will need to set xray.lsp.path or install xray on PATH" >&2
fi

# ---------------------------------------------------------------------------
# Build and package.
# ---------------------------------------------------------------------------
echo "[package] target=$TARGET"
npm run package-ext

# vsce will read version from package.json and produce <name>-<target>-<version>.vsix
npx vsce package --target "$TARGET" --no-dependencies --out "."

# Find the artifact (vsce names it: <publisher>-<name>-<target>-<version>.vsix on some setups,
# or <name>-<target>-<version>.vsix). Pick the most recent .vsix.
ARTIFACT=$(ls -t *.vsix 2>/dev/null | head -n 1 || true)
if [[ -z "$ARTIFACT" ]]; then
    echo "[package] ERROR: no .vsix produced" >&2
    exit 1
fi

echo "[package] produced: $ARTIFACT"
