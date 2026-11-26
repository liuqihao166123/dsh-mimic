#!/usr/bin/env bash
set -euo pipefail
"/c/Users/LQH/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/node/bin/node.exe" "C:/Program Files/nodejs/node_modules/rea-agents/scripts/rea.mjs" analyze-javascript-application "D:/DeepSeek Harness/resources/app.asar" --source-path package.json --json > evidence/dsh-asar-analysis.json
