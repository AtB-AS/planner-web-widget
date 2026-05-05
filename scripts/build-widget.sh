#!/bin/bash

# This script builds the widget for a single org based on version found
# in package.json.

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SCRIPT_DIR"

if [ -n "$ORG_ID" ]; then
    ORG_ID="$ORG_ID"
    echo "Found ORG_ID=$ORG_ID in environment. Building widget for $ORG_ID"
    ORG_ID=$ORG_ID yarn build
else
  echo "No ORG_ID found in environment. Please expose it, or build all widgets instead"
  exit 1
fi
