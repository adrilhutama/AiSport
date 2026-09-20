'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MarketOdds } from '@/types';

/**
 * Realtime Odds Streaming Hook
 * Subscribes to Supabase postgres_changes on the public.market_odds table.
 * Dynamically streams updated odds to client views without full-page reloads.
 * Emits recently updated fixture IDs to trigger glowing flash micro-animations on odds chips.
 */
export function useRealtimeOdds(
  initialOddsList: MarketOdds[] = [],
  onUpdate?: (updatedOdds: MarketOdds) => void
) {
  const [oddsMap, setOddsMap] = useState<Record<string, MarketOdds>>(() => {
    const map: Record<string, MarketOdds> = {};
    initialOddsList.forEach((o) => {
      if (o.fixture_id) map[o.fixture_id] = o;
    });
    return map;
  });

  const [recentlyUpdatedIds, setRecentlyUpdatedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;

    const channel = supabase
      .channel('sportsbook-realtime-odds')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'market_odds',
        },
        (payload) => {
          const newRow = payload.new as MarketOdds;
          if (newRow && newRow.fixture_id) {
            setOddsMap((prev) => ({
              ...prev,
              [newRow.fixture_id]: newRow,
            }));

            // Mark fixture for glowing flash
            setRecentlyUpdatedIds((prev) => {
              const next = new Set(prev);
              next.add(newRow.fixture_id);
              return next;
            });

            setTimeout(() => {
              setRecentlyUpdatedIds((prev) => {
                const next = new Set(prev);
                next.delete(newRow.fixture_id);
                return next;
              });
            }, 3000);

            if (onUpdate) {
              onUpdate(newRow);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onUpdate]);

  return {
    oddsMap,
    recentlyUpdatedIds,
  };
}
