#!/bin/bash
set -e
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$DIR/.."

echo '--------------------------------------------------'
echo '[nvm:deploy-version]'
echo '--------------------------------------------------'
eval . "$CIRCLE_WORKING_DIRECTORY/.lufoDependencies"
cd ~/.nvm
. nvm.sh
nvm use $LUFO_DEPLOY_NODE_VERSION
echo

echo '--------------------------------------------------'
echo '[pack:api]'
echo '--------------------------------------------------'
cd $ROOT_DIR/lufo-api
yarn pack

echo
echo '--------------------------------------------------'
echo '[pack:cli]'
echo '--------------------------------------------------'
cd $ROOT_DIR/lufo-cli
yarn pack

echo
echo '--------------------------------------------------'
echo '[pack:cli:merge]'
echo '--------------------------------------------------'
cd $ROOT_DIR
API_TARBALL=$(ls lufo-api/*.tgz)
CLI_TARBALL=$(ls lufo-cli/*.tgz)
echo 'Decompressing CLI package...'
TMP_DIR="/tmp/lufo-cli-$RANDOM"
mkdir $TMP_DIR
tar -xzf $CLI_TARBALL -C $TMP_DIR
echo 'Decompressing API package as a bundled dependency...'
PKG_ROOT_DIR='package'
TMP_API_DIR="$TMP_DIR/$PKG_ROOT_DIR/node_modules/lufo-api"
mkdir -p $TMP_API_DIR
tar -xzf $API_TARBALL \
  --strip-components=1 \
  -C $TMP_API_DIR \
  --exclude=README.md \
  --exclude=lib/*.flow
echo 'Stripping API dependency and repackaging CLI package...'
PACKAGE_JSON="$TMP_DIR/$PKG_ROOT_DIR/package.json"
PACKAGE_JSON_TMP="$PACKAGE_JSON.tmp"
cat $PACKAGE_JSON | jq 'del(.dependencies."lufo-api")' > $PACKAGE_JSON_TMP
mv $PACKAGE_JSON_TMP $PACKAGE_JSON
rm -f $CLI_TARBALL
tar -czf $CLI_TARBALL -C $TMP_DIR $PKG_ROOT_DIR
echo 'Done merging.'

echo
echo '--------------------------------------------------'
echo '[deploy:login]'
echo '--------------------------------------------------'
cd ~
echo "//registry.npmjs.org/:_authToken=$NPM_TOKEN" >> ~/.npmrc

echo
echo '--------------------------------------------------'
echo '[deploy:api]'
echo '--------------------------------------------------'
cd $ROOT_DIR/lufo-api
npm publish $(ls *.tgz)

echo
echo '--------------------------------------------------'
echo '[deploy:cli]'
echo '--------------------------------------------------'
cd $ROOT_DIR/lufo-cli
npm publish $(ls *.tgz)

echo
echo '--------------------------------------------------'
echo '[tag]'
echo '--------------------------------------------------'
VERSION=$(cd $ROOT_DIR/lufo-api ; npx -c 'echo "$npm_package_version"')
cd $ROOT_DIR
git tag -a $VERSION -m "$VERSION [skip ci]"
git push origin $VERSION
