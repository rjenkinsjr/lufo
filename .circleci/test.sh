#!/bin/bash
set +e
. ~/lufo/.lufoDependencies
PARALLEL_ARGFILE="/tmp/lufoTest-$RANDOM"
for v in "${LUFO_NODE_VERSIONS[@]}"; do
  echo "nvm exec $v yarn run api-test" >> $PARALLEL_ARGFILE
  echo "nvm exec $v yarn run cli-test" >> $PARALLEL_ARGFILE
done
parallel -k --ungroup :::: $PARALLEL_ARGFILE
