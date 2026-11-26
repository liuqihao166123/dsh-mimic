#!/usr/bin/env bash
set -euo pipefail
mkdir -p evidence/rea-tmp
export TEMP="$(cygpath -w "$PWD/evidence/rea-tmp")"
export TMP="$TEMP"
export TMPDIR="$TEMP"
"/c/Users/LQH/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/node/bin/node.exe" "C:/Program Files/nodejs/node_modules/rea-agents/scripts/rea.mjs" extract-artifact "D:/DeepSeek Harness/resources/app.asar" --format yaml > evidence/dsh-extraction.yml
