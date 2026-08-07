/**
 * beatDetector.ts — extracts approximate beat timestamps from a media file's
 * audio track using the native Web Audio API (no external libraries, no cost).
 *
 * Approach: decode the audio, isolate low-frequency (bass/kick) energy per
 * time slice, then flag local energy spikes above a rolling average as
 * beats. This is a lightweight energy-based detector — good enough for
 * "sync my glitch effect to the beat" in a social app, not a
 * music-production-grade transient detector.
 */

export async function detectBeatsFromFile(file: File | Blob, minGapSeconds = 0.25): Promise<number[]> {
  const arrayBuffer = await file.arrayBuffer();
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    audioCtx.close();
  }
  return detectBeatsFromBuffer(audioBuffer, minGapSeconds);
}

export function detectBeatsFromBuffer(audioBuffer: AudioBuffer, minGapSeconds = 0.25): number[] {
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0);

  // Simple one-pole low-pass to isolate bass/kick energy (~<150Hz), then
  // compute short-time energy in fixed windows.
  const cutoffHz = 150;
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const dt = 1 / sampleRate;
  const alpha = dt / (rc + dt);
  const lowPassed = new Float32Array(channelData.length);
  let prev = 0;
  for (let i = 0; i < channelData.length; i++) {
    prev = prev + alpha * (channelData[i] - prev);
    lowPassed[i] = prev;
  }

  const windowSize = Math.floor(sampleRate * 0.05); // 50ms windows
  const numWindows = Math.floor(lowPassed.length / windowSize);
  const energies = new Float32Array(numWindows);
  for (let w = 0; w < numWindows; w++) {
    let sum = 0;
    const start = w * windowSize;
    for (let i = start; i < start + windowSize; i++) {
      sum += lowPassed[i] * lowPassed[i];
    }
    energies[w] = sum / windowSize;
  }

  // Rolling average for a dynamic threshold, flag windows that spike well above it.
  const rollSpan = 20; // ~1s of context
  const beats: number[] = [];
  let lastBeatTime = -Infinity;
  for (let w = 0; w < numWindows; w++) {
    const lo = Math.max(0, w - rollSpan);
    const hi = Math.min(numWindows, w + rollSpan);
    let localAvg = 0;
    for (let i = lo; i < hi; i++) localAvg += energies[i];
    localAvg /= hi - lo;

    const threshold = localAvg * 1.6 + 1e-6;
    const time = (w * windowSize) / sampleRate;
    if (energies[w] > threshold && time - lastBeatTime > minGapSeconds) {
      beats.push(Math.round(time * 100) / 100);
      lastBeatTime = time;
    }
  }

  return beats;
}

export type BeatKeyframe = {
  time: number;
  property: 'scale' | 'contrast';
  value: number;
  easing: 'linear' | 'easeOut';
};

/** Turns raw beat timestamps into scale/contrast keyframe pairs (hit + release) for the shader engine. */
export function generateBeatKeyframes(beats: number[]): BeatKeyframe[] {
  const keyframes: BeatKeyframe[] = [];
  for (const t of beats) {
    keyframes.push({ time: t, property: 'scale', value: 1.06, easing: 'easeOut' });
    keyframes.push({ time: t, property: 'contrast', value: 0.8, easing: 'easeOut' });
    keyframes.push({ time: Math.round((t + 0.12) * 100) / 100, property: 'scale', value: 1, easing: 'linear' });
    keyframes.push({ time: Math.round((t + 0.12) * 100) / 100, property: 'contrast', value: 0, easing: 'linear' });
  }
  return keyframes;
}
