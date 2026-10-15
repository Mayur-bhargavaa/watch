import React from 'react';
import { initialsOf } from '../../lib/planUi';

/** Photo when the person has one, otherwise their initials (no third-party avatar service, no stranger photos). */
export const PersonAvatar: React.FC<{ name?: string | null; src?: string | null; className?: string }> = ({ name, src, className = 'w-8 h-8' }) => {
  const [failed, setFailed] = React.useState(false);
  if (src && !failed) {
    return <img src={src} alt={name || 'Member'} onError={() => setFailed(true)} className={`${className} rounded-full object-cover bg-slate-200 dark:bg-zinc-800 shrink-0`} />;
  }
  return (
    <span
      aria-label={name || 'Member'}
      className={`${className} rounded-full bg-gradient-to-tr from-[#ee1d49] to-[#ff6b8b] text-white text-[10px] font-black flex items-center justify-center shrink-0 select-none`}
    >
      {initialsOf(name)}
    </span>
  );
};
