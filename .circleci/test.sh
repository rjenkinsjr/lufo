#!/bin/bash
set +e
. ~/lufo/.lufoDependencies
PARALLEL_ARGFILE="/tmp/lufoTest-$RANDOM"
for v in "${LUFO_NODE_VERSIONS[@]}"; do
  echo "nvm exec $v yarn run api-test > ${PARALLEL_ARGFILE}-$v-api" >> $PARALLEL_ARGFILE
  echo "nvm exec $v yarn run cli-test > ${PARALLEL_ARGFILE}-$v-cli" >> $PARALLEL_ARGFILE
done
cat PARALLEL_ARGFILE="/tmp/lufoTest-$RANDOM"
parallel --no-notice --keep-order --tag --group :::: $PARALLEL_ARGFILE
