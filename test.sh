#!/usr/bin/env bash

npx jest \
  --config ./all-test-jest.config.json \
  --runInBand \
  --testTimeout 6000000 \
  --testLocationInResults \
  --testNamePattern "DocumentsController should be defined" \
  --no-coverage \
  --colors \
  --watchAll=false \
  --testPathPattern /workspaces/bodypace-personal-data-server/src/modules/documents/documents\.controller\.spec\.ts