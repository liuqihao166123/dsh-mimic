#!/usr/bin/env bash
set -euo pipefail
"/c/Users/LQH/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/node/bin/node.exe" --test --test-isolation=none build/test/*.test.js
