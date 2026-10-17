import type { ProviderOffer, ProviderOfferType } from '@synccinema/common';

/** Availability helpers. Offers come only from the licensed availability source; nothing is added here. */
export const OFFER_GROUP_ORDER: ProviderOfferType[] = ['subscription', 'free', 'rent', 'buy'];
export const OFFER_GROUP_LABEL: Record<ProviderOfferType, string> = { subscription: 'Stream', free: 'Free', rent: 'Rent', buy: 'Buy' };

export interface OfferGroup {
  type: ProviderOfferType;
  label: string;
  offers: ProviderOffer[];
}
export function groupOffers(offers: ProviderOffer[]): OfferGroup[] {
  const groups: OfferGroup[] = [];
  for (const type of OFFER_GROUP_ORDER) {
    const list = offers.filter((o) => o.type === type && o.verified);
    if (list.length) groups.push({ type, label: OFFER_GROUP_LABEL[type], offers: list });
  }
  return groups;
}
/** Chips shown on the hero: verified streaming/free offers only, no duplicates by provider. */
export function heroChips(offers: ProviderOffer[], max = 4): ProviderOffer[] {
  const seen = new Set<string>();
  const out: ProviderOffer[] = [];
  for (const o of offers) {
    if (!o.verified || (o.type !== 'subscription' && o.type !== 'free') || seen.has(o.id)) continue;
    seen.add(o.id);
    out.push(o);
    if (out.length >= max) break;
  }
  return out;
}
