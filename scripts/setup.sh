#!/bin/bash
set -e
# Install nvm.
echo 'Installing nvm...'
cd ~
[ ! -d ".nvm" ] && git clone https://github.com/creationix/nvm.git .nvm
cd .nvm
git checkout $LUFO_NVM_VERSION
. nvm.sh
# Install NodeJS.
echo 'Installing NodeJS versions necessary for testing...'
eval . "$CIRCLE_WORKING_DIRECTORY/.lufoDependencies"
for v in "${LUFO_NODE_VERSIONS[@]}"; do nvm install $v; echo '---'; done
nvm alias default $LUFO_DEFAULT_NODE_VERSION
# Make nvm available in future shells.
echo 'export NVM_DIR="$HOME/.nvm"' >> $BASH_ENV
echo '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"' >> $BASH_ENV
# Install Yarn.
[ ! -d ".yarn" ] && curl -o- -L https://yarnpkg.com/install.sh | bash -s -- --version $LUFO_YARN_VERSION
# Make yarn available in future shells.
echo 'export PATH="$HOME/.yarn/bin:$HOME/.config/yarn/global/node_modules/.bin:$PATH"' >> $BASH_ENV
