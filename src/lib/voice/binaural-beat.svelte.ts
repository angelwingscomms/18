// ENTRANMENT - BINAURAL FREQUENCY - entry point
// 432 Hz left ear, 439 Hz right ear (7 Hz binaural beat)

import { browser } from '$app/environment';

const STORAGE_KEY = 'binaural_volume';

export class BinauralBeat {
  ctx: AudioContext | null = null;
  leftOsc: OscillatorNode | null = null;
  rightOsc: OscillatorNode | null = null;
  gain: GainNode | null = null;
  leftPanner: StereoPannerNode | null = null;
  rightPanner: StereoPannerNode | null = null;

  private _playing = false;
  private _volume: number;

  constructor() {
    this._volume = browser ? parseFloat(localStorage.getItem(STORAGE_KEY) ?? '0.3') : 0.3;
  }

  get playing() { return this._playing; }
  get volume() { return this._volume; }

  set volume(v: number) {
    this._volume = Math.max(0, Math.min(1, v));
    if (browser) localStorage.setItem(STORAGE_KEY, String(this._volume));
    if (this.gain) this.gain.gain.value = this._volume;
  }

  start() {
    if (this._playing) return;
    try {
      this.ctx = new AudioContext();
      this.gain = this.ctx.createGain();
      this.gain.gain.value = this._volume;
      this.gain.connect(this.ctx.destination);

      this.leftOsc = this.ctx.createOscillator();
      this.leftOsc.type = 'sine';
      this.leftOsc.frequency.value = 432;
      this.leftPanner = this.ctx.createStereoPanner();
      this.leftPanner.pan.value = -1;
      this.leftOsc.connect(this.leftPanner).connect(this.gain);
      this.leftOsc.start();

      this.rightOsc = this.ctx.createOscillator();
      this.rightOsc.type = 'sine';
      this.rightOsc.frequency.value = 439;
      this.rightPanner = this.ctx.createStereoPanner();
      this.rightPanner.pan.value = 1;
      this.rightOsc.connect(this.rightPanner).connect(this.gain);
      this.rightOsc.start();

      this._playing = true;
    } catch {
      this.stop();
    }
  }

  stop() {
    try { this.leftOsc?.stop(); } catch {}
    try { this.rightOsc?.stop(); } catch {}
    try { this.ctx?.close(); } catch {}
    this.leftOsc = null;
    this.rightOsc = null;
    this.leftPanner = null;
    this.rightPanner = null;
    this.gain = null;
    this.ctx = null;
    this._playing = false;
  }

  toggle() {
    if (this._playing) this.stop();
    else this.start();
  }
}
