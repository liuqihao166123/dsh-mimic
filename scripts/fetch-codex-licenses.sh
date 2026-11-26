#!/usr/bin/env bash
set -euo pipefail
node="/c/Users/LQH/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/node/bin/node.exe"
"$node" scripts/fetch-codex-licenses.mjs
