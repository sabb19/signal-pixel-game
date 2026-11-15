// Aggiunge il pianoforte del gioco sotto l'audio del trailer.
// Il video viene copiato così com'è (nessuna ricodifica); cambia solo la traccia audio.
// Uso: swift mix.swift TRAILER.mp4 PIANO.wav USCITA.mp4 VOLUME_PIANO
import AVFoundation

let args = CommandLine.arguments
let src = URL(fileURLWithPath: args[1]), piano = URL(fileURLWithPath: args[2]), dst = URL(fileURLWithPath: args[3])
let pianoVol = Float(args.count > 4 ? args[4] : "0.14")!
try? FileManager.default.removeItem(at: dst)

let asset = AVURLAsset(url: src), pAsset = AVURLAsset(url: piano)
let sem = DispatchSemaphore(value: 0)
var vTrack: AVAssetTrack!, aTrack: AVAssetTrack!, pTrack: AVAssetTrack!, duration = CMTime.zero
Task {
  vTrack = try! await asset.loadTracks(withMediaType: .video).first!
  aTrack = try! await asset.loadTracks(withMediaType: .audio).first!
  pTrack = try! await pAsset.loadTracks(withMediaType: .audio).first!
  duration = try! await asset.load(.duration)
  sem.signal()
}
sem.wait()

// composizione: audio originale + pianoforte, per il missaggio
let comp = AVMutableComposition()
let cA = comp.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)!
try cA.insertTimeRange(CMTimeRange(start: .zero, duration: duration), of: aTrack, at: .zero)
let cP = comp.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)!
try cP.insertTimeRange(CMTimeRange(start: .zero, duration: min(duration, pAsset.duration)), of: pTrack, at: .zero)
let mix = AVMutableAudioMix()
let pa = AVMutableAudioMixInputParameters(track: cA); pa.setVolume(1.0, at: .zero)
let pp = AVMutableAudioMixInputParameters(track: cP); pp.setVolume(pianoVol, at: .zero)
mix.inputParameters = [pa, pp]

// lettori: video in passthrough, audio missato in PCM
let vReader = try AVAssetReader(asset: asset)
let vOut = AVAssetReaderTrackOutput(track: vTrack, outputSettings: nil)
vReader.add(vOut)
let aReader = try AVAssetReader(asset: comp)
let pcm: [String: Any] = [AVFormatIDKey: kAudioFormatLinearPCM, AVSampleRateKey: 48000, AVNumberOfChannelsKey: 2, AVLinearPCMBitDepthKey: 32, AVLinearPCMIsFloatKey: true, AVLinearPCMIsNonInterleaved: false, AVLinearPCMIsBigEndianKey: false]
let aOut = AVAssetReaderAudioMixOutput(audioTracks: [cA, cP], audioSettings: pcm)
aOut.audioMix = mix
aReader.add(aOut)

let writer = try AVAssetWriter(outputURL: dst, fileType: .mp4)
let vFmt = vTrack.formatDescriptions.first as! CMFormatDescription
let vIn = AVAssetWriterInput(mediaType: .video, outputSettings: nil, sourceFormatHint: vFmt)
vIn.transform = vTrack.preferredTransform
vIn.expectsMediaDataInRealTime = false
let aIn = AVAssetWriterInput(mediaType: .audio, outputSettings: [AVFormatIDKey: kAudioFormatMPEG4AAC, AVSampleRateKey: 48000, AVNumberOfChannelsKey: 2, AVEncoderBitRateKey: 256000])
aIn.expectsMediaDataInRealTime = false
writer.add(vIn); writer.add(aIn)

vReader.startReading(); aReader.startReading()
writer.startWriting(); writer.startSession(atSourceTime: .zero)
let group = DispatchGroup()
func pump(_ input: AVAssetWriterInput, _ output: AVAssetReaderOutput, _ q: String) {
  group.enter()
  input.requestMediaDataWhenReady(on: DispatchQueue(label: q)) {
    while input.isReadyForMoreMediaData {
      if let s = output.copyNextSampleBuffer() { input.append(s) }
      else { input.markAsFinished(); group.leave(); return }
    }
  }
}
pump(vIn, vOut, "v"); pump(aIn, aOut, "a")
group.wait()
writer.finishWriting { sem.signal() }
sem.wait()
print(writer.status == .completed ? "OK \(dst.path)" : "ERRORE \(String(describing: writer.error))")
