#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Clear only generated outputs, never device or application data.
mkdir -p build/ui-captures
rm -f build/ui-captures/{overview,heart,empty}.png
status=0
./gradlew :app:connectedDebugAndroidTest --no-daemon \
    -Pandroid.enableAdditionalTestOutput=true \
    -PfitnessApiOrigin=https://murim-ci.example.test || status=$?
python3 scripts/collect-ui-captures.py || status=1
exit "$status"
