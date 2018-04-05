#!/bin/bash
set -e
echo '--------------------------------------------------'
echo 'Installing dependencies...'
echo '--------------------------------------------------'
rm -rf node_modules
yarn
. ../.lufoDependencies
echo
for v in "${LUFO_NODE_VERSIONS[@]}"; do
  echo '--------------------------------------------------'
  nvm use $v
  echo '--------------------------------------------------'
  scripts/test.sh
done
