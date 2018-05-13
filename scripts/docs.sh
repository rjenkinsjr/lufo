#!/bin/bash
set -e
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$DIR/.."

VERSION=$(cd $ROOT_DIR/lufo-api ; npx -c 'echo "$npm_package_version"')
TMP_DIR="/tmp/lufo-docs-$RANDOM"
mkdir $TMP_DIR

echo '--------------------------------------------------'
echo '[docs:api]'
echo '--------------------------------------------------'
cd $ROOT_DIR/lufo-api
yarn run doc
mv docs $TMP_DIR/api

echo
echo '--------------------------------------------------'
echo '[docs:cli]'
echo '--------------------------------------------------'
cd $ROOT_DIR/lufo-cli
mkdir $TMP_DIR/cli
cp ./README.md $TMP_DIR/cli

echo
echo '--------------------------------------------------'
echo '[docs:publish]'
echo '--------------------------------------------------'
cd $ROOT_DIR
git fetch
git checkout gh-pages
shopt -s extglob
rm -rf !(.git) || true
git clean -qfdx
mv $TMP_DIR/* .
git config user.email "do-not-reply@ronjenkins.info"
git config user.name "CircleCI"
git add .
git commit -m "$VERSION"
git push
