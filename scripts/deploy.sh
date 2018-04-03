#!/bin/bash
set -e
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$DIR/.."

echo '[pack:api]'
cd $ROOT_DIR/lufo-api
yarn pack

echo
echo '[pack:cli]'
cd $ROOT_DIR/lufo-cli
yarn pack

echo
echo '[pack:cli:merge]'
cd $ROOT_DIR
API_TARBALL=$(ls lufo-api/*.tgz)
CLI_TARBALL=$(ls lufo-cli/*.tgz)
echo 'Decompressing CLI package...'
TMP_DIR="/tmp/lufo-cli-$RANDOM"
mkdir $TMP_DIR
tar -xzf $CLI_TARBALL -C $TMP_DIR
echo 'Decompressing API package as a bundled dependency...'
ROOT_DIR='package'
TMP_API_DIR="$TMP_DIR/$ROOT_DIR/node_modules/lufo-api"
mkdir -p $TMP_API_DIR
tar -xzf $API_TARBALL \
  --strip-components=1 \
  -C $TMP_API_DIR \
  --exclude=README.md \
  --exclude=lib/*.flow
echo 'Stripping API dependency and repackaging CLI package...'
PACKAGE_JSON="$TMP_DIR/$ROOT_DIR/package.json"
PACKAGE_JSON_TMP="$PACKAGE_JSON.tmp"
cat $PACKAGE_JSON | jq 'del(.dependencies."lufo-api")' > $PACKAGE_JSON_TMP
mv $PACKAGE_JSON_TMP $PACKAGE_JSON
rm -f $CLI_TARBALL
tar -czf $CLI_TARBALL -C $TMP_DIR $ROOT_DIR
echo 'Done merging.'