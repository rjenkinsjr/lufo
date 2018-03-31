#!/bin/bash
set -e
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $DIR/..
if [[ "$1" == "api" ]]; then
  cd lufo-api
elif [[ "$1" == "cli" ]]; then
  cd lufo-cli
else
  echo 'ERROR: component not specified.'
  exit 1
fi
echo "[lint:$1]"
../node_modules/.bin/eslint src
