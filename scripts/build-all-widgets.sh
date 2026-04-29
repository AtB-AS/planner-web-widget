#!/bin/bash

# This script builds the widget for all orgs based on version found
# in package.json.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

for orgId in atb nfk fram troms vkt farte; do
  echo "Building widget for $orgId"
  ORG_ID=$orgId sh "$SCRIPT_DIR/build-widget.sh"
done
