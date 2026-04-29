#!/bin/bash

# This script builds the widget for a single org based on version found
# in package.json.

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SCRIPT_DIR"

if [ -n "$ORG_ID" ]; then
    ORG_ID="$ORG_ID"
    echo "Found ORG_ID= $ORG_ID in environment. Building widget for $ORG_ID"
    ORG_ID=$ORG_ID yarn build
    ORG_ID=$ORG_ID node ./scripts/generate-widget-stat.js
else
  echo "No ORG_ID found in environment. Please expose it, or build all widgets instead"
  exit 1
fi


# Workaround for PostCSS processing issue
# Issue: PostCSS does not allow control over plugin execution order, meaning the "composes"
# CSS is not processed before other plugins. As a result, parts of the CSS remain unprocessed.
#
# Workaround: Run PostCSS twice to ensure CSS imported using "composes" also is processed properly.

BASE_DIR="dist"
VERSION=$(node -p "require('./package.json').version")

for FOLDER in "$BASE_DIR"/*/; do
  FOLDER_NAME=$(basename "$FOLDER")
  FILE_NAME="$BASE_DIR/$FOLDER_NAME/$VERSION/planner-web.css"
  if [[ ! -f "$FILE_NAME" ]]; then
    break
  fi
  npx postcss "$FILE_NAME" -o "$FILE_NAME"
done

echo "Post processing completed"
