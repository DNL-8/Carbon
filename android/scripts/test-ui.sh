#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p build/ui-captures
# A failed test must fail CI. Recover any available synthetic screenshots.
status=0
./gradlew :app:connectedDebugAndroidTest --no-daemon -PfitnessApiOrigin=https://murim-ci.example.test || status=$?
for shot in overview heart empty; do
    if ! adb exec-out run-as com.dnl8.fitnessrpg.debug cat "files/${shot}.png" > "build/ui-captures/${shot}.png"; then
        rm -f "build/ui-captures/${shot}.png"
        status=1
    fi
done
exit "$status"
