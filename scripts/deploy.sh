#!/bin/bash
yarn run api-pack
yarn run cli-pack
mv -t . lufo-api/*.tgz lufo-cli/*.tgz
ls -al
# TODO publish packages to npm registry
# TODO publish docs to github gh-pages
