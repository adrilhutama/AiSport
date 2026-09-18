import { getOddsMatrixData } from '@/lib/data';
import { DashboardClient } from '@/components/DashboardClient';

// Enable dynamic rendering with zero caching to guarantee fresh Supabase reads
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function HomePage() {
  const { fixtures, parlays, source } = await getOddsMatrixData();

  return (
    <DashboardClient
      initialFixtures={fixtures}
      initialParlays={parlays}
      dataSource={source}
    />
  );
}
