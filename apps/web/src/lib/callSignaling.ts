'use client';

type CallListener = (msg: any) => void;

class CallSignalingManager {
  private listeners = new Set<CallListener>();

  subscribe(listener: CallListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  dispatch(msg: any): void {
    this.listeners.forEach((fn) => {
      try {
        fn(msg);
      } catch (e) {
        console.error('CallSignaling dispatch error:', e);
      }
    });
  }
}

export const CallSignaling = new CallSignalingManager();
