// Иконата за iPhone: mobile/icon-128.png (Метко, нарисуван с кода на играта — drawPlayer, плочки от draw.js)
// се уголемява 8 пъти без размазване → 1024×1024 без прозрачност. Пускане: swift mobile/make-ios-icon.swift
import AppKit

let src = NSImage(contentsOfFile: "mobile/icon-128.png")!.cgImage(forProposedRect: nil, context: nil, hints: nil)!
let g = CGContext(data: nil, width: 1024, height: 1024, bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(),
                  bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
g.interpolationQuality = .none
g.draw(src, in: CGRect(x: 0, y: 0, width: 1024, height: 1024))
let out = URL(fileURLWithPath: "mobile/ios-icon-1024.png")
try! NSBitmapImageRep(cgImage: g.makeImage()!).representation(using: .png, properties: [:])!.write(to: out)
print("иконата за iPhone е готова")
