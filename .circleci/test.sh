#!/bin/bash
set +e
HEADER="false"
. ~/lufo/.lufoDependencies
for v in "${LUFO_NODE_VERSIONS[@]}"; do
  if [[ "$HEADER" == "false" ]]; then
    HEADER="true"
  else
    echo; echo; echo
  fi
  echo "=== $v ==="
  echo '--- API ---'
  nvm exec $v yarn run api-test
  echo '--- CLI ---'
  nvm exec $v yarn run cli-test
done
