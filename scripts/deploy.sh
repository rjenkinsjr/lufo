#!/bin/bash
set -e
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$DIR/.."

VERSION=$(cd $ROOT_DIR/lufo-api ; npx -c 'echo "$npm_package_version"')

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
yarn --ignore-engines
yarn run pack

echo
echo '--------------------------------------------------'
echo '[pack:cli]'
echo '--------------------------------------------------'
cd $ROOT_DIR/lufo-cli
yarn --ignore-engines
yarn run pack

echo
echo '--------------------------------------------------'
echo '[pack:cli:repack]'
echo '--------------------------------------------------'
cd $ROOT_DIR
echo 'Decompressing CLI package...'
CLI_TARBALL=$(ls lufo-cli/*.tgz)
TMP_DIR="/tmp/lufo-cli-$RANDOM"
mkdir $TMP_DIR
tar -xzf $CLI_TARBALL -C $TMP_DIR
echo 'Pinning API dependency and repackaging CLI package...'
PKG_ROOT_DIR='package'
PACKAGE_JSON="$TMP_DIR/$PKG_ROOT_DIR/package.json"
PACKAGE_JSON_TMP="$PACKAGE_JSON.tmp"
cat $PACKAGE_JSON | jq ".dependencies.\"lufo-api\" = \"$VERSION\" | del(.scripts.postinstall)" > $PACKAGE_JSON_TMP
mv $PACKAGE_JSON_TMP $PACKAGE_JSON
rm -f $CLI_TARBALL
tar -czf $CLI_TARBALL -C $TMP_DIR $PKG_ROOT_DIR
echo 'Done repackaging.'

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
cd $ROOT_DIR
git config user.email "do-not-reply@ronjenkins.info"
git config user.name "CircleCI"
git tag -a $VERSION -m "$VERSION [skip ci]"
git push origin $VERSION
