#!/bin/bash
set -e
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
$DIR/lint.sh
echo '[build]'
rm -f lufo.js
./node_modules/.bin/babel -q src/ -d .
chmod +x lufo.js
