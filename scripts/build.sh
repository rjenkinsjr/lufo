#!/bin/bash
set -e
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $DIR/..
if [[ "$1" == "api" ]]; then
  echo "[build:api]"
  cd lufo-api
  rm -rf lib
  ../node_modules/.bin/babel -q src/ -d lib/
  ../node_modules/.bin/flow-copy-source src lib
elif [[ "$1" == "cli" ]]; then
  echo "[build:cli]"
  cd lufo-cli
  rm -rf lufo.js
  ../node_modules/.bin/babel -q src/ -d .
  chmod +x lufo.js
else
  echo 'ERROR: component not specified.'
  exit 1
fi
