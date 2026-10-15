/**
 * Single source for the legal pages (/terms, /privacy, /refunds). Every value that starts with "TODO" is a placeholder
 * the owner MUST replace before charging anyone: scripts/billing-check.mjs warns while any is left.
 * The pages render with the placeholders so nothing breaks in development.
 */
export const LEGAL = {
  companyName: 'TODO: legal company name (e.g. StitchByte Private Limited)',
  productName: 'Watch',
  address: 'TODO: registered business address',
  contactEmail: 'TODO: support@your-domain.example',
  grievanceOfficerName: 'TODO: grievance officer name',
  grievanceOfficerEmail: 'TODO: grievance@your-domain.example',
  effectiveDate: 'TODO: effective date (YYYY-MM-DD)',
  governingCity: 'TODO: city for courts (e.g. Bengaluru)',
  refundWindowDays: 'TODO: number of days (e.g. 7)'
} as const;

export const DRAFT_NOTICE = 'Draft: have a lawyer review before you charge anyone';

export const isPlaceholder = (v: string): boolean => v.startsWith('TODO');
