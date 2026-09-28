#!/usr/bin/env python3
# Прави iOS проекта на Capacitor да се сглобява БЕЗ iOS платформата/симулатора в Xcode (Settings → Components):
# без storyboard-и (ibtool) и без Assets.xcassets (actool) — те искат платформата. Екранът се създава с код
# (SceneDelegate → GameViewController), иконата е обикновени PNG файлове, началният екран е черен (тъмен режим).
# Пуска се веднъж след `npx cap add ios` (може и пак — не чупи нищо). Иконата: mobile/ios-icon-1024.png.
import os, re, subprocess, shutil
root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
app = os.path.join(root, 'ios/App/App')
pbx = os.path.join(root, 'ios/App/App.xcodeproj/project.pbxproj')

# --- иконата: 120 и 180 px
for n, px in [('AppIcon60x60@2x.png', 120), ('AppIcon60x60@3x.png', 180)]:
    subprocess.run(['sips', '-z', str(px), str(px), os.path.join(root, 'mobile/ios-icon-1024.png'), '--out', os.path.join(app, n)], check=True, capture_output=True)

# --- проектът
s = open(pbx).read()
drop = [m.group(1) for m in re.finditer(r'(\w{24}) /\* (?:Main\.storyboard|LaunchScreen\.storyboard|Assets\.xcassets)(?: in Resources)? \*/', s)]
drop += [m.group(1) for m in re.finditer(r'(\w{24}) /\* Base \*/ = \{isa = PBXFileReference; lastKnownFileType = file\.storyboard', s)]
drop = set(drop)
out, skip = [], 0
for line in s.split('\n'):
    if skip:  # многоредов запис (PBXVariantGroup на storyboard-ите)
        skip += line.count('{') - line.count('}')
        continue
    ids = [i for i in drop if line.lstrip().startswith(i)]
    if ids:
        if line.rstrip().endswith('= {'):
            skip = 1
        continue
    out.append(line)
s = '\n'.join(out)
if 'AppIcon60x60@2x.png' not in s:
    ids = {'r2': 'F1A5000000000000000000A1', 'b2': 'F1A5000000000000000000B1', 'r3': 'F1A5000000000000000000A2', 'b3': 'F1A5000000000000000000B2'}
    s = s.replace('/* End PBXBuildFile section */',
        f'\t\t{ids["b2"]} /* AppIcon60x60@2x.png in Resources */ = {{isa = PBXBuildFile; fileRef = {ids["r2"]} /* AppIcon60x60@2x.png */; }};\n'
        f'\t\t{ids["b3"]} /* AppIcon60x60@3x.png in Resources */ = {{isa = PBXBuildFile; fileRef = {ids["r3"]} /* AppIcon60x60@3x.png */; }};\n'
        '/* End PBXBuildFile section */')
    s = s.replace('/* End PBXFileReference section */',
        f'\t\t{ids["r2"]} /* AppIcon60x60@2x.png */ = {{isa = PBXFileReference; lastKnownFileType = image.png; path = "AppIcon60x60@2x.png"; sourceTree = "<group>"; }};\n'
        f'\t\t{ids["r3"]} /* AppIcon60x60@3x.png */ = {{isa = PBXFileReference; lastKnownFileType = image.png; path = "AppIcon60x60@3x.png"; sourceTree = "<group>"; }};\n'
        '/* End PBXFileReference section */')
    s = re.sub(r'(isa = PBXResourcesBuildPhase;\s*buildActionMask = \d+;\s*files = \()',
        lambda m: m.group(1) + f'\n\t\t\t\t{ids["b2"]} /* AppIcon60x60@2x.png in Resources */,\n\t\t\t\t{ids["b3"]} /* AppIcon60x60@3x.png in Resources */,', s, count=1)
    s = re.sub(r'(/\* App \*/ = \{\s*isa = PBXGroup;\s*children = \()',
        lambda m: m.group(1) + f'\n\t\t\t\t{ids["r2"]} /* AppIcon60x60@2x.png */,\n\t\t\t\t{ids["r3"]} /* AppIcon60x60@3x.png */,', s, count=1)
s = s.replace('TARGETED_DEVICE_FAMILY = "1,2";', 'TARGETED_DEVICE_FAMILY = 1;')
s = re.sub(r'\s*ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;', '', s)
open(pbx, 'w').write(s)

# --- Info.plist
p = os.path.join(app, 'Info.plist'); s = open(p).read()
s = re.sub(r'\s*<key>UISceneStoryboardFile</key>\s*<string>Main</string>', '', s)
s = re.sub(r'\s*<key>UIMainStoryboardFile</key>\s*<string>Main</string>', '', s)
s = re.sub(r'<key>UILaunchStoryboardName</key>\s*<string>LaunchScreen</string>', '<key>UILaunchScreen</key>\n\t<dict/>', s)
s = re.sub(r'<key>UILaunchScreen</key>\s*<dict>.*?</dict>', '<key>UILaunchScreen</key>\n\t<dict/>', s, flags=re.S)
if 'UIUserInterfaceStyle' not in s:
    s = s.replace('\t<key>UIViewControllerBasedStatusBarAppearance</key>',
        '\t<key>UIUserInterfaceStyle</key>\n\t<string>Dark</string>\n'
        '\t<key>CFBundleIcons</key>\n\t<dict>\n\t\t<key>CFBundlePrimaryIcon</key>\n\t\t<dict>\n\t\t\t<key>CFBundleIconFiles</key>\n'
        '\t\t\t<array>\n\t\t\t\t<string>AppIcon60x60</string>\n\t\t\t</array>\n\t\t</dict>\n\t</dict>\n'
        '\t<key>UIViewControllerBasedStatusBarAppearance</key>')
open(p, 'w').write(s)

# --- екранът с код
p = os.path.join(app, 'SceneDelegate.swift'); s = open(p).read()
s = s.replace('window?.rootViewController = CAPBridgeViewController()',
              'window?.rootViewController = GameViewController() // цял екран, хоризонтално (виж AppDelegate.swift)')
open(p, 'w').write(s)

for d in ['Base.lproj', 'Assets.xcassets']:
    shutil.rmtree(os.path.join(app, d), ignore_errors=True)
subprocess.run(['plutil', '-lint', os.path.join(app, 'Info.plist')], check=True)
print('iOS проектът е без storyboard/xcassets')
