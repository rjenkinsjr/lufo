#!/bin/bash
set -e
rm -rf node_modules
yarn
. ../.lufoDependencies
for v in "${LUFO_NODE_VERSIONS[@]}"; do
  echo -n -e '\n\n\n\n\n'
  echo "=== $v ==="
  nvm use $v
  scripts/test.sh
done
