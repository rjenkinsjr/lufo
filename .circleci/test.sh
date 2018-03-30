#!/bin/bash
set +e
yarn run api-test
yarn run cli-test
