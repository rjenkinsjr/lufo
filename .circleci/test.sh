#!/bin/bash
set +e
. ~/lufo/.lufoDependencies
PARALLEL_ARGFILE="/tmp/lufoTest-$RANDOM"
for v in "${LUFO_NODE_VERSIONS[@]}"; do
  echo "nvm exec $v yarn run api-test > ${PARALLEL_ARGFILE}-$v-api 2>&1" >> $PARALLEL_ARGFILE
  echo "cat ${PARALLEL_ARGFILE}-$v-api" >> $PARALLEL_ARGFILE
  echo "nvm exec $v yarn run cli-test > ${PARALLEL_ARGFILE}-$v-cli 2>&1" >> $PARALLEL_ARGFILE
  echo "cat ${PARALLEL_ARGFILE}-$v-cli" >> $PARALLEL_ARGFILE
done
parallel -k --ungroup :::: $PARALLEL_ARGFILE
