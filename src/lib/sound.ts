class SoundEngine {
  private ctx: AudioContext | null = null;
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

  /** Crisp cascading card-deal riffle/shuffle sound when 13 cards are dealt */
  playCardDeal() {
    const cardTicks = 9;
    for (let i = 0; i < cardTicks; i++) {
      const delay = i * 0.042;
      this.playNoiseFlick(delay, 0.055, 1600 + i * 110);
      this.playTone(320 + i * 24, 0.045, 'triangle', 0.028, delay);
    }
  }

  /** Soft linen slide + damped felt thump when a card lands on the table */
  playCardSnap() {
    this.playNoiseFlick(0, 0.032, 3100, 0.026, 0.9);
    this.playFeltThud(150, 58, 0.048, 0.085, 0.012);
  }

  /** Crisp double-snap + deep felt thud with subtle shimmer for a spade trump cut */
  playTrumpCut() {
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
