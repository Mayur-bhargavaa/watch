'use client';

import { useEffect, useMemo, useState } from 'react';
import { isSpeakingLevel } from '../lib/audioLevel';

interface SpeakingSource {
  userId: string;
  stream: MediaStream | null;
  isMuted?: boolean;
}

/**
 * Which of the given participants are speaking right now, measured from their audio with a Web Audio analyser (the
 * WebRTC hook does not report it). Muted people never count. Everything is best effort: without Web Audio the set is empty.
 */
export function useSpeakingUsers(participants: SpeakingSource[]): Set<string> {
  const [speaking, setSpeaking] = useState<Set<string>>(() => new Set());

  // Re-run only when the set of audible streams changes, not on every render of the caller
  const signature = participants
    .map((p) => `${p.userId}:${p.stream?.id ?? ''}:${p.stream?.getAudioTracks().length ?? 0}:${p.isMuted ? 1 : 0}`)
    .join('|');
  const sources = useMemo(() => participants, [signature]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const Ctx: typeof AudioContext | undefined = window.AudioContext || (window as any).webkitAudioContext;
    const audible = sources.filter((p) => p.stream && !p.isMuted && p.stream.getAudioTracks().length > 0);
    if (!Ctx || audible.length === 0) {
      setSpeaking((prev) => (prev.size === 0 ? prev : new Set()));
      return;
    }
    let ctx: AudioContext | null = null;
    const taps: { userId: string; analyser: AnalyserNode; source: MediaStreamAudioSourceNode; data: Uint8Array }[] = [];
    try {
      ctx = new Ctx();
      for (const p of audible) {
        const source = ctx.createMediaStreamSource(p.stream as MediaStream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        taps.push({ userId: p.userId, analyser, source, data: new Uint8Array(analyser.frequencyBinCount) });
      }
    } catch {
      /* no Web Audio: no ring */
    }
    const timer = setInterval(() => {
      const next = new Set<string>();
      for (const t of taps) {
        t.analyser.getByteFrequencyData(t.data as Uint8Array<ArrayBuffer>);
        if (isSpeakingLevel(t.data)) next.add(t.userId);
      }
      setSpeaking((prev) => (prev.size === next.size && [...next].every((id) => prev.has(id)) ? prev : next));
    }, 180);
    return () => {
      clearInterval(timer);
      for (const t of taps) {
        try { t.source.disconnect(); } catch { /* already gone */ }
      }
      void ctx?.close().catch(() => {});
      setSpeaking((prev) => (prev.size === 0 ? prev : new Set()));
    };
  }, [sources]);

  return speaking;
}
