'use client';

import React, { useState } from 'react';
import { getTeamCrestUrl } from '@/lib/team-crests';

interface TeamCrestProps {
  src?: string;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const TeamCrest: React.FC<TeamCrestProps> = ({
  src,
  name,
  size = 'md',
  className = '',
}) => {
  const [hasError, setHasError] = useState(false);

  // Use provided src or fallback to comprehensive team crest map
  const resolvedSrc = src || getTeamCrestUrl(name);

  if (resolvedSrc && !hasError) {
    return (
      <img
        src={resolvedSrc}
        alt={`${name} crest`}
        className={`w-5 h-5 object-contain flex-shrink-0 ${className}`}
        onError={() => setHasError(true)}
        loading="lazy"
      />
    );
  }

  return (
    <span
      className={`w-5 h-5 rounded bg-slate-800 text-[10px] flex items-center justify-center font-bold text-slate-300 flex-shrink-0 select-none ${className}`}
      title={name}
    >
      {name ? name.slice(0, 2).toUpperCase() : '??'}
    </span>
  );
};
