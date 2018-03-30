#!/bin/bash
set +e
. ~/lufo/.lufoDependencies
for v in "${LUFO_NODE_VERSIONS[@]}"; do
  echo "=== $v ==="
  echo '--- API ---'
  nvm exec $v yarn run api-test
  echo '--- CLI ---'
  nvm exec $v yarn run cli-test
  echo
done
