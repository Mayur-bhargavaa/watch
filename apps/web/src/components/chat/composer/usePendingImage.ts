import { useCallback, useEffect, useRef, useState } from 'react';

export interface PendingImage {
  file: File;
  previewUrl: string;
  isViewOnce: boolean;
}

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Returns an error message when the file cannot be sent as a chat photo. */
export function validateImageFile(file: { type: string; size: number }): string | null {
  if (!file.type.startsWith('image/')) return 'Only image files can be sent as photos.';
  if (file.size > MAX_IMAGE_BYTES) return 'That photo is larger than 10 MB. Choose a smaller one.';
  return null;
}

/** The photo the user picked but has not sent yet. Its preview object-URL is always revoked (cancel, replace, unmount). */
export function usePendingImage() {
  const [pending, setPending] = useState<PendingImage | null>(null);
  const urlRef = useRef<string | null>(null);

  const revoke = useCallback(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
  }, []);

  useEffect(() => revoke, [revoke]);

  /** Selects a file. Returns an error message, or null when accepted. */
  const select = useCallback(
    (file: File): string | null => {
      const error = validateImageFile(file);
      if (error) return error;
      revoke();
      const previewUrl = URL.createObjectURL(file);
      urlRef.current = previewUrl;
      setPending({ file, previewUrl, isViewOnce: false });
      return null;
    },
    [revoke]
  );

  const clear = useCallback(() => {
    revoke();
    setPending(null);
  }, [revoke]);

  const setViewOnce = useCallback((value: boolean) => {
    setPending((prev) => (prev ? { ...prev, isViewOnce: value } : prev));
  }, []);

  return { pending, select, clear, setViewOnce };
}
