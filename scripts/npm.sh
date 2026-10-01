#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if command -v npm >/dev/null 2>&1; then exec npm "$@"; fi
runtime="/Users/choi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin"
if [ -x "$runtime/node" ] && [ -f .tooling/package/bin/npm-cli.js ]; then
  PATH="$runtime:$PATH" exec "$runtime/node" .tooling/package/bin/npm-cli.js "$@"
fi
printf '%s\n' 'Node.js 22.12+ 및 npm을 설치해 주세요.' >&2
exit 1
