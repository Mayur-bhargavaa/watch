'use client';

class CallRingtoneManager {
  private audioCtx: AudioContext | null = null;
  private ringInterval: any = null;
  private isRinging: boolean = false;

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  /**
   * Play realistic incoming ringtone (melodic pleasant double-chime repeated)
   */
  startIncomingRingtone(): void {
    if (this.isRinging) return;
    this.isRinging = true;

    const playBursts = () => {
      if (!this.isRinging) return;
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      // Dual tone: WhatsApp/Phone inspired frequency arpeggio (C5 - E5 - G5 - C6)
      const frequencies = [523.25, 659.25, 783.99, 1046.5];
      frequencies.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);

        gain.gain.setValueAtTime(0, now + idx * 0.12);
        gain.gain.linearRampToValueAtTime(0.22, now + idx * 0.12 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.12 + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.4);
      });

      // Second burst after 600ms
      frequencies.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq * 1.05, now + 0.6 + idx * 0.12);

        gain.gain.setValueAtTime(0, now + 0.6 + idx * 0.12);
        gain.gain.linearRampToValueAtTime(0.2, now + 0.6 + idx * 0.12 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6 + idx * 0.12 + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + 0.6 + idx * 0.12);
        osc.stop(now + 0.6 + idx * 0.12 + 0.4);
      });
    };

    playBursts();
    this.ringInterval = setInterval(playBursts, 2800);
  }

  /**
   * Play outgoing ringback tone (soft dual beep: 440Hz + 480Hz)
   */
  startOutgoingRingback(): void {
    if (this.isRinging) return;
    this.isRinging = true;

    const playRingback = () => {
      if (!this.isRinging) return;
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      [440, 480].forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.08, now + 0.05);
        gain.gain.setValueAtTime(0.08, now + 1.2);
        gain.gain.linearRampToValueAtTime(0.0001, now + 1.3);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 1.35);
      });
    };

    playRingback();
    this.ringInterval = setInterval(playRingback, 3000);
  }

  /**
   * Play call end / disconnect tone (three descending beeps)
   */
  playCallEndBeep(): void {
    this.stopRingtone();
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    [480, 440, 380].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.15);

      gain.gain.setValueAtTime(0.12, now + idx * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.15 + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.15);
      osc.stop(now + idx * 0.15 + 0.14);
    });
  }

  stopRingtone(): void {
    this.isRinging = false;
    if (this.ringInterval) {
      clearInterval(this.ringInterval);
      this.ringInterval = null;
    }
  }
}

export const CallRingtone = new CallRingtoneManager();
