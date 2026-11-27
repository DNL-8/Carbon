#!/usr/bin/env bash
set -euo pipefail

bun_version="$(node -p "require('./package.json').packageManager.split('@')[1]")"
tool_dir="$(mktemp -d)"
trap 'rm -rf -- "$tool_dir"' EXIT

# Use npm only to obtain the pinned Bun binary in an empty directory.
npm install --prefix "$tool_dir" --no-save --no-package-lock "bun@$bun_version"
bun_binary="$tool_dir/node_modules/.bin/bun"
test "$("$bun_binary" --version)" = "$bun_version"
"$bun_binary" install --frozen-lockfile
