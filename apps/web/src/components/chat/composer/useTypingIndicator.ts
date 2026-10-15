import { useEffect, useMemo, useRef } from 'react';
import { TypingController } from './typing';

/** React wrapper around TypingController; always reports `false` when the composer unmounts. */
export function useTypingIndicator(onTyping?: (isTyping: boolean) => void) {
  const cb = useRef(onTyping);
  cb.current = onTyping;
  const controller = useMemo(() => new TypingController((t) => cb.current?.(t)), []);
  useEffect(() => () => controller.stop(), [controller]);
  return controller;
}
