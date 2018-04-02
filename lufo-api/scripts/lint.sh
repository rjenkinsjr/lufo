#!/bin/bash
set -e
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
echo '[lint]'
./node_modules/.bin/eslint src
echo '[flow]'
./node_modules/.bin/flow check
