import AVFoundation
// confronta byte per byte i fotogrammi video di due file
func frames(_ path: String) -> (Int, Int, UInt64) {
  let asset = AVURLAsset(url: URL(fileURLWithPath: path))
  let t = asset.tracks(withMediaType: .video).first!
  let r = try! AVAssetReader(asset: asset); let o = AVAssetReaderTrackOutput(track: t, outputSettings: nil); r.add(o); r.startReading()
  var n = 0, bytes = 0; var h: UInt64 = 1469598103934665603
  while let s = o.copyNextSampleBuffer() {
    guard let b = CMSampleBufferGetDataBuffer(s) else { continue }
    let len = CMBlockBufferGetDataLength(b); var data = [UInt8](repeating: 0, count: len)
    CMBlockBufferCopyDataBytes(b, atOffset: 0, dataLength: len, destination: &data)
    for x in data { h = (h ^ UInt64(x)) &* 1099511628211 }
    n += 1; bytes += len
  }
  return (n, bytes, h)
}
let a = frames(CommandLine.arguments[1]), b = frames(CommandLine.arguments[2])
print("originale: \(a.0) fotogrammi, \(a.1) byte, impronta \(a.2)")
print("nuovo:     \(b.0) fotogrammi, \(b.1) byte, impronta \(b.2)")
print(a == b ? "VIDEO IDENTICO" : "VIDEO DIVERSO")
