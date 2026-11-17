#!/bin/zsh
# Rebuild the web app, build the iPhone app, and install it on your phone.
# Works over Wi-Fi once the phone has been paired with this Mac by cable:
# keep the phone unlocked and on the same Wi-Fi as the Mac.
#
#   tools/install-iphone.sh            # first paired iPhone
#   tools/install-iphone.sh <UDID>     # a specific one
set -euo pipefail
root=${0:A:h:h}
dd=${TMPDIR:-/tmp}/lockin-derived

echo "1/4 Building the web app"
python3 "$root/tools/build.py"

if [[ $# -ge 1 ]]; then
  udid=$1
else
  udid=$(xcrun devicectl list devices 2>/dev/null | awk '/physical/ && /iPhone/ && /connected|available/ {for (i=1;i<=NF;i++) if ($i ~ /^[0-9A-F]{8}-[0-9A-F]{16}$/) {print $i; exit}}')
fi
if [[ -z ${udid:-} ]]; then
  echo "No iPhone found. Unlock it, put it on the same Wi-Fi as this Mac (or plug it in), and try again."
  exit 1
fi
echo "2/4 Building for iPhone $udid"
xcodebuild -project "$root/ios/LockIn.xcodeproj" -scheme LockIn -destination "id=$udid" \
  -derivedDataPath "$dd" -allowProvisioningUpdates -quiet build

echo "3/4 Installing"
xcrun devicectl device install app --device "$udid" "$dd/Build/Products/Debug-iphoneos/LockIn.app" >/dev/null

echo "4/4 Opening Lock In"
xcrun devicectl device process launch --terminate-existing --device "$udid" com.shreyshah.lockin >/dev/null 2>&1 || echo "   (Installed. Unlock the phone and open Lock In.)"
echo "Done. Installed apps from a free Apple account stop opening after 7 days; run this again to renew."
