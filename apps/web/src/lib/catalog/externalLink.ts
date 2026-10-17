import { safeProviderUrl } from '@synccinema/common';

/**
 * Props for an outbound provider link. Returns null unless the URL is a valid https destination from the
 * availability source; the caller then renders no link at all (never a guessed one).
 */
export interface ExternalLinkProps {
  href: string;
  target: '_blank';
  rel: 'noopener noreferrer';
  caption: string;
}
export function externalLinkProps(url: string | null | undefined, providerName: string): ExternalLinkProps | null {
  const href = safeProviderUrl(url);
  if (!href) return null;
  const name = providerName.replace(/[<>]/g, '').trim().slice(0, 60) || 'the provider';
  return { href, target: '_blank', rel: 'noopener noreferrer', caption: `Opens ${name}. You may need to sign in there.` };
}
