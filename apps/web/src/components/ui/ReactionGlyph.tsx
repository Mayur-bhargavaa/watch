import React from 'react';
import { AppIcon, isIconName } from './AppIcon';

/**
 * A reaction can be a real emoji (sent by a person, shown as text) or an icon name (sent by the app itself, e.g. a
 * "nudge" bell). This renders whichever it is, so the word "bell" is never shown literally.
 */
export const ReactionGlyph: React.FC<{ value: string; className?: string }> = ({ value, className = 'w-[1em] h-[1em]' }) =>
  isIconName(value) ? <AppIcon name={value} className={className} /> : <>{value}</>;
