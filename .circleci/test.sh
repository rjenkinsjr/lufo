#!/bin/bash
set +e
. ~/lufo/.lufoDependencies
for v in "${LUFO_NODE_VERSIONS[@]}"; do
  echo "=== $v ==="
  nvm exec $v yarn run api-test
  nvm exec $v yarn run cli-test
done
