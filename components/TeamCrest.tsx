'use client';

import React, { useState } from 'react';

interface TeamCrestProps {
  src?: string;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_MAP = {
  xs: 'w-4 h-4 text-[9px]',
  sm: 'w-5 h-5 text-[10px]',
  md: 'w-7 h-7 text-xs',
  lg: 'w-9 h-9 text-sm',
  xl: 'w-12 h-12 text-base',
};

export const TeamCrest: React.FC<TeamCrestProps> = ({
  src,
  name,
  size = 'md',
  className = '',
}) => {
  const [hasError, setHasError] = useState(false);

  // Generate 2-letter monogram for fallback
  const getInitials = (teamName: string) => {
    if (!teamName) return '??';
    const words = teamName.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return teamName.slice(0, 2).toUpperCase();
  };

  const sizeClasses = SIZE_MAP[size] || SIZE_MAP.md;

  if (!src || hasError) {
    return (
      <div
        className={`inline-flex items-center justify-center rounded-full bg-slate-800/90 border border-slate-700/80 text-cyan-300 font-mono font-bold shrink-0 select-none shadow-sm ${sizeClasses} ${className}`}
        title={name}
      >
        {getInitials(name)}
      </div>
    );
  }

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 rounded-full bg-slate-900/60 p-0.5 border border-slate-800/80 shadow-sm overflow-hidden ${sizeClasses} ${className}`}
    >
      <img
        src={src}
        alt={`${name} crest`}
        onError={() => setHasError(true)}
        className="w-full h-full object-contain filter drop-shadow-sm"
        loading="lazy"
      />
    </div>
  );
};
