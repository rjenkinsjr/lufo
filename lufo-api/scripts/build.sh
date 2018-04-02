#!/bin/bash
set -e
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
$DIR/lint.sh
echo '[build]'
rm -rf lib
./node_modules/.bin/babel -q src/ -d lib/
./node_modules/.bin/flow-copy-source src lib
