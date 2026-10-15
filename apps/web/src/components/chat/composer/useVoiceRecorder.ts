import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_VOICE_BYTES, MAX_VOICE_SECONDS, describeMicError, downsampleWaveform, pickAudioMimeType } from './voice';

export interface VoiceRecording {
  audioDataUrl: string;
  durationSec: number;
  waveform: number[];
}

interface Options {
  onFinished: (recording: VoiceRecording) => void;
  onError: (message: string) => void;
}

/**
 * Microphone recording with a live level meter. Owns every browser resource it opens (stream, AudioContext,
 * timers, animation frame) and releases them on stop, cancel and unmount. Stops by itself at MAX_VOICE_SECONDS.
 */
export function useVoiceRecorder({ onFinished, onError }: Options) {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [bars, setBars] = useState<number[]>([25, 40, 60, 45, 25]);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const samplesRef = useRef<number[]>([]);
  const secondsRef = useRef(0);
  const callbacks = useRef({ onFinished, onError });
  callbacks.current = { onFinished, onError };

  const releaseHardware = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const ctx = audioCtxRef.current;
    audioCtxRef.current = null;
    if (ctx && ctx.state !== 'closed') void ctx.close().catch(() => undefined);
  }, []);

  useEffect(() => releaseHardware, [releaseHardware]);

  const start = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      callbacks.current.onError('Voice recording is not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = typeof MediaRecorder !== 'undefined' ? pickAudioMimeType((m) => MediaRecorder.isTypeSupported(m)) : '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      samplesRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      // Live level meter (optional: recording still works if the AudioContext cannot be created)
      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          audioCtxRef.current = ctx;
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 64;
          ctx.createMediaStreamSource(stream).connect(analyser);
          const data = new Uint8Array(analyser.frequencyBinCount);
          const sample = () => {
            if (!audioCtxRef.current) return;
            analyser.getByteFrequencyData(data);
            const avg = data.reduce((a, b) => a + b, 0) / data.length;
            const level = Math.min(100, Math.max(15, Math.round((avg / 255) * 100)));
            samplesRef.current.push(level);
            setBars((prev) => [...prev.slice(1), level]);
            frameRef.current = requestAnimationFrame(sample);
          };
          frameRef.current = requestAnimationFrame(sample);
        }
      } catch (err) {
        console.warn('Voice level meter unavailable:', err);
      }

      recorder.start(100);
      recorderRef.current = recorder;
      secondsRef.current = 0;
      setSeconds(0);
      setIsRecording(true);
      timerRef.current = setInterval(() => {
        secondsRef.current += 1;
        setSeconds(secondsRef.current);
        if (secondsRef.current >= MAX_VOICE_SECONDS) stopAndSendRef.current();
      }, 1000);
    } catch (err) {
      releaseHardware();
      callbacks.current.onError(describeMicError(err));
    }
  }, [releaseHardware]);

  const finish = useCallback(
    (send: boolean) => {
      const recorder = recorderRef.current;
      recorderRef.current = null;
      const durationSec = Math.max(secondsRef.current, 1);
      const waveform = downsampleWaveform(samplesRef.current);
      setIsRecording(false);
      setSeconds(0);
      secondsRef.current = 0;

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;

      if (!recorder || recorder.state === 'inactive') {
        releaseHardware();
        return;
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        chunksRef.current = [];
        releaseHardware();
        if (!send) return;
        if (blob.size > MAX_VOICE_BYTES) {
          callbacks.current.onError('That voice note is too long to send. Keep it under about a minute and a half.');
          return;
        }
        const reader = new FileReader();
        reader.onerror = () => callbacks.current.onError('Could not read the recording. Please try again.');
        reader.onloadend = () => {
          if (typeof reader.result === 'string' && reader.result) {
            callbacks.current.onFinished({ audioDataUrl: reader.result, durationSec, waveform });
          }
        };
        reader.readAsDataURL(blob);
      };
      recorder.stop();
    },
    [releaseHardware]
  );

  const stopAndSend = useCallback(() => finish(true), [finish]);
  const cancel = useCallback(() => finish(false), [finish]);
  const stopAndSendRef = useRef(stopAndSend);
  stopAndSendRef.current = stopAndSend;

  return { isRecording, seconds, bars, start, stopAndSend, cancel };
}
