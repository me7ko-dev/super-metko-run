#!/bin/bash
# Сглобява Супер Метко Рън за iPhone и го слага на свързания телефон (кабел или същата Wi-Fi мрежа, телефонът отключен).
# С безплатен Apple акаунт приложението работи 7 дни — после пак пусни този файл.
# Работи и БЕЗ iOS платформата в Xcode (Settings → Components): сглобява се „target“, без storyboard/xcassets (виж mobile/ios-plain.py).
# Пускане: bash mobile/ios-install.sh
set -e
cd "$(dirname "$0")/.."
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
TEAM=FUW9HQV9D7   # Apple Development: roikata023@gmail.com
BUNDLE=com.me7ko.metkorun
npm run ios
DEV=$(xcrun devicectl list devices 2>/dev/null | grep 'iPhone 13 Pro Max' | grep -E 'available|connected' | grep -oE '[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}' | head -1)
[ -z "$DEV" ] && { echo "Телефонът не се вижда — свържи го (кабел или същата Wi-Fi мрежа) и го отключи."; exit 1; }
(cd ios/App && xcodebuild -project App.xcodeproj -target App -configuration Release -sdk iphoneos -arch arm64 \
  SYMROOT="$PWD/build/sym" -allowProvisioningUpdates DEVELOPMENT_TEAM=$TEAM CODE_SIGN_STYLE=Automatic \
  DISABLE_MANUAL_TARGET_ORDER_BUILD_WARNING=YES build -quiet)
xcrun devicectl device install app --device "$DEV" ios/App/build/sym/Release-iphoneos/App.app
xcrun devicectl device process launch --device "$DEV" --terminate-existing $BUNDLE || echo "Инсталирано — отключи телефона и натисни иконата."
echo "Готово 🍄"
