#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if ! command -v node >/dev/null 2>&1; then
  export PATH="/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
fi
exec node scripts/local-preview.mjs
