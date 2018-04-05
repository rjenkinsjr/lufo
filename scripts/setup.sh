#!/bin/bash
set -e

echo '--------------------------------------------------'
echo 'Installing nvm...'
echo '--------------------------------------------------'
cd ~
[ ! -d ".nvm" ] && git clone https://github.com/creationix/nvm.git .nvm
cd .nvm
git checkout $LUFO_NVM_VERSION
. nvm.sh

echo
echo '--------------------------------------------------'
echo 'Installing NodeJS versions necessary for testing...'
echo '--------------------------------------------------'
eval . "$CIRCLE_WORKING_DIRECTORY/.lufoDependencies"
for v in "${LUFO_NODE_VERSIONS[@]}"; do
  nvm install $v
  if [[ "$v" != "$LUFO_DEFAULT_NODE_VERSION" ]]; then
    echo '*****'
  fi
done
nvm alias default $LUFO_DEFAULT_NODE_VERSION > /dev/null 2>&1
# Make nvm available in future shells.
echo 'export NVM_DIR="$HOME/.nvm"' >> $BASH_ENV
echo '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"' >> $BASH_ENV

echo
echo '--------------------------------------------------'
echo 'Installing Yarn...'
echo '--------------------------------------------------'
[ ! -d ".yarn" ] && curl -o- -L https://yarnpkg.com/install.sh | bash -s -- --version $LUFO_YARN_VERSION
# Make yarn available in future shells.
echo 'export PATH="$HOME/.yarn/bin:$HOME/.config/yarn/global/node_modules/.bin:$PATH"' >> $BASH_ENV
