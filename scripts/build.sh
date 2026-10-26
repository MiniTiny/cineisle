#!/usr/bin/env bash
set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
deveco_paths=()
while IFS= read -r -d '' deveco_path; do deveco_paths+=("$deveco_path"); done < <(python3 "$PROJECT_DIR/scripts/deveco-runtime.py" --null)
if [[ ${#deveco_paths[@]} -ne 3 ]]; then
  echo "Unable to resolve DevEco toolchain roots" >&2
  exit 1
fi
DEVECO_CONTENTS="${deveco_paths[0]}"
export NODE_HOME="${deveco_paths[1]}"
export DEVECO_SDK_HOME="${deveco_paths[2]}"
cd "$PROJECT_DIR"
python3 "$PROJECT_DIR/scripts/generate-jellyfin.py" --check
python3 "$PROJECT_DIR/scripts/generate-icons.py" --check
python3 "$PROJECT_DIR/scripts/prepare-native-ass.py"
python3 "$PROJECT_DIR/scripts/prepare-native-mpv.py"
exec "$DEVECO_CONTENTS/tools/hvigor/bin/hvigorw" --mode module -p product=default -p module=entry@default -p buildMode=debug assembleHap --no-daemon "$@"
