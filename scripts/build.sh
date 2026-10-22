#!/usr/bin/env bash
set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEVECO_CONTENTS="${DEVECO_CONTENTS:-/Applications/DevEco-Studio.app/Contents}"
export NODE_HOME="${NODE_HOME:-$DEVECO_CONTENTS/tools/node}"
export DEVECO_SDK_HOME="${DEVECO_SDK_HOME:-$DEVECO_CONTENTS/sdk}"
cd "$PROJECT_DIR"
python3 "$PROJECT_DIR/scripts/generate-jellyfin.py" --check
python3 "$PROJECT_DIR/scripts/generate-icons.py" --check
python3 "$PROJECT_DIR/scripts/prepare-native-ass.py"
python3 "$PROJECT_DIR/scripts/prepare-native-mpv.py"
exec "$DEVECO_CONTENTS/tools/hvigor/bin/hvigorw" --mode module -p product=default -p module=entry@default -p buildMode=debug assembleHap --no-daemon "$@"
