#!/usr/bin/env bash
# Install solc 0.8.28 into .solc/ for Foundry (no secrets).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/.solc/solc-0.8.28"
mkdir -p "$ROOT/.solc"
if [[ -x "$DEST" ]]; then
  echo "solc already present: $DEST"
  "$DEST" --version
  exit 0
fi
URL="https://github.com/ethereum/solidity/releases/download/v0.8.28/solc-macos"
echo "Downloading $URL"
curl -fsSL -o "$DEST" "$URL"
chmod +x "$DEST"
"$DEST" --version
echo "Installed to $DEST"
echo "Run: cd contracts && forge test --use ../.solc/solc-0.8.28"
