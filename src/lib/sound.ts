// Recorded card sounds: Kenney "Casino Audio" (kenney.nl), CC0.
const CARD_PLACE_SAMPLE_URLS = [
  '/sounds/card-place-1.mp3',
  '/sounds/card-place-2.mp3',
  '/sounds/card-place-3.mp3',
  '/sounds/card-place-4.mp3',
];
const CARD_PLACE_GAIN = 0.6;
const CARD_SHUFFLE_SAMPLE_URL = '/sounds/card-shuffle.mp3';
const CARD_SHUFFLE_GAIN = 0.5;
// Seconds into the shuffle animation at which cards start flying to the seats.
const DEAL_TICKS_DELAY_S = 1.15;

class SoundEngine {
  private ctx: AudioContext | null = null;
  private cardPlaceBuffers: AudioBuffer[] = [];
  private shuffleBuffer: AudioBuffer | null = null;
  private samplesRequested = false;
  public muted = false;

  private getContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.loadSamples(this.ctx);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public unlock() {
    this.getContext();
  }

  private loadSamples(ctx: AudioContext): void {
    if (this.samplesRequested) return;
    this.samplesRequested = true;
    for (const url of CARD_PLACE_SAMPLE_URLS) {
      fetch(url)
        .then((res) => {
          if (!res.ok) throw new Error(`Sound ${url} returned ${res.status}`);
          return res.arrayBuffer();
        })
        .then((data) => ctx.decodeAudioData(data))
        .then((buffer) => {
          this.cardPlaceBuffers = [...this.cardPlaceBuffers, buffer];
        })
        .catch(() => {
          // A missing sample is not fatal: card plays fall back to the synthesized snap.
        });
    }
    fetch(CARD_SHUFFLE_SAMPLE_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Sound ${CARD_SHUFFLE_SAMPLE_URL} returned ${res.status}`);
        return res.arrayBuffer();
      })
      .then((data) => ctx.decodeAudioData(data))
      .then((buffer) => {
        this.shuffleBuffer = buffer;
      })
      .catch(() => {
        // Not fatal: the deal falls back to the synthesized riffle alone.
      });
  }

  /** Plays the recorded riffle shuffle. Returns false when it has not loaded yet. */
  private playShuffleSample(): boolean {
    const ctx = this.getContext();
    if (!ctx || !this.shuffleBuffer) return false;
    const source = ctx.createBufferSource();
    source.buffer = this.shuffleBuffer;
    const gainNode = ctx.createGain();
    gainNode.gain.value = CARD_SHUFFLE_GAIN;
    source.connect(gainNode);
    gainNode.connect(ctx.destination);
    source.start();
    return true;
  }

  /** Plays a random recorded card sound. Returns false when none has loaded yet. */
  private playCardPlaceSample(gain: number, playbackRate: number): boolean {
    const ctx = this.getContext();
    if (!ctx || this.cardPlaceBuffers.length === 0) return false;
    const buffer =
      this.cardPlaceBuffers[Math.floor(Math.random() * this.cardPlaceBuffers.length)];
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = playbackRate;
    const gainNode = ctx.createGain();
    gainNode.gain.value = gain;
    source.connect(gainNode);
    gainNode.connect(ctx.destination);
    source.start();
    return true;
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    gainPeak = 0.06,
    delay = 0
  ) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  private playFeltThud(
    startFreq = 140,
    endFreq = 58,
    duration = 0.055,
    gainPeak = 0.09,
    delay = 0
  ) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  private playNoiseFlick(
    delay: number,
    gainPeak = 0.045,
    filterFreq = 1800,
    duration = 0.035,
    q = 1.4
  ) {
    const ctx = this.getContext();
    if (!ctx) return;
    const sampleRate = ctx.sampleRate;
    const length = Math.max(1, Math.floor(sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (length * 0.35));
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = q;

    const gain = ctx.createGain();
    const start = ctx.currentTime + delay;
    gain.gain.setValueAtTime(gainPeak, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start(start);
  }

  /**
   * New deal: a recorded riffle shuffle, then quick ticks as the cards go out.
   * Without the recording the ticks play straight away.
   */
  playCardDeal() {
    const ticksStart = this.playShuffleSample() ? DEAL_TICKS_DELAY_S : 0;
    const cardTicks = 9;
    for (let i = 0; i < cardTicks; i++) {
      const delay = ticksStart + i * 0.042;
      this.playNoiseFlick(delay, 0.055, 1600 + i * 110);
      this.playTone(320 + i * 24, 0.045, 'triangle', 0.028, delay);
    }
  }

  /** A real card landing on the table, with slight pitch variety per play. */
  playCardSnap() {
    const playbackRate = 0.96 + Math.random() * 0.1;
    if (this.playCardPlaceSample(CARD_PLACE_GAIN, playbackRate)) return;
    // Fallback until the recordings load: soft linen slide + damped felt thump.
    this.playNoiseFlick(0, 0.032, 3100, 0.026, 0.9);
    this.playFeltThud(150, 58, 0.048, 0.085, 0.012);
  }

  /** A heavier card slap with a subtle shimmer for a spade trump cut */
  playTrumpCut() {
    if (this.playCardPlaceSample(CARD_PLACE_GAIN * 1.3, 0.9)) {
      this.playTone(659.25, 0.1, 'sine', 0.035, 0.025);
      return;
    }
    this.playNoiseFlick(0, 0.045, 3400, 0.024, 1.1);
    this.playFeltThud(185, 64, 0.065, 0.11, 0.01);
    this.playNoiseFlick(0.032, 0.035, 2400, 0.028, 1.2);
    this.playTone(659.25, 0.1, 'sine', 0.035, 0.025);
  }

  /** Soft wooden token tap when locking in a bid */
  playBidLock() {
    this.playFeltThud(240, 120, 0.04, 0.05, 0);
    this.playTone(587.33, 0.075, 'sine', 0.035, 0.01);
  }

  playTrickWin() {
    this.playTone(523.25, 0.11, 'sine', 0.05, 0);
    this.playTone(659.25, 0.16, 'sine', 0.05, 0.07);
  }

  playRoundComplete() {
    this.playTone(440, 0.14, 'sine', 0.055, 0);
    this.playTone(554.37, 0.14, 'sine', 0.055, 0.09);
    this.playTone(659.25, 0.24, 'sine', 0.06, 0.18);
  }

  playRoundLose() {
    this.playTone(392.0, 0.14, 'sine', 0.045, 0);
    this.playTone(329.63, 0.16, 'sine', 0.045, 0.1);
    this.playTone(261.63, 0.22, 'sine', 0.05, 0.2);
  }

  playTurnPrompt() {
    this.playTone(587.33, 0.07, 'sine', 0.025, 0);
    this.playTone(783.99, 0.09, 'sine', 0.025, 0.055);
  }
}

export const soundFx = new SoundEngine();
