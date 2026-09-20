'use client';

import React from 'react';
import { SportsbookSidebar } from './SportsbookSidebar';
import { LeagueCode } from '@/types';

export interface LeagueSidebarProps {
  selectedLeague: LeagueCode | 'ALL';
  onSelectLeague: (league: LeagueCode | 'ALL') => void;
  leagueCounts: Record<LeagueCode | 'ALL', number>;
}

export const LeagueSidebar: React.FC<LeagueSidebarProps> = (props) => {
  return <SportsbookSidebar {...props} />;
};

export default LeagueSidebar;
