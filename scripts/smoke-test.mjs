/**
 * Lightweight Smoke Test Script for OddsMatrix
 * Verifies local dev/production server rendering and sync API without full browser overhead.
 */

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

async function runSmokeTests() {
  console.log(`🔍 Running OddsMatrix smoke tests against ${BASE_URL}...\n`);

  try {
    // 1. Test Homepage HTML
    console.log('1. Testing Homepage Rendering...');
    const homeRes = await fetch(BASE_URL);
    if (!homeRes.ok) {
      throw new Error(`Homepage returned HTTP status ${homeRes.status}`);
    }
    const html = await homeRes.text();
    if (!html.includes('OddsMatrix') && !html.includes('Top 5 European Leagues')) {
      throw new Error('Homepage HTML does not contain expected OddsMatrix title content');
    }
    console.log('   ✅ Homepage rendered valid HTML with status 200.');

    // 2. Test Sync API Route
    console.log('\n2. Testing Background Sync API (/api/sync)...');
    const syncRes = await fetch(`${BASE_URL}/api/sync`);
    if (!syncRes.ok) {
      throw new Error(`Sync API returned HTTP status ${syncRes.status}`);
    }
    const syncData = await syncRes.json();
    if (!syncData.success || !Array.isArray(syncData.summary?.leaguesProcessed)) {
      throw new Error('Sync API response structure is invalid');
    }
    console.log(`   ✅ Sync API returned success (${syncData.summary.fixturesUpdated} fixtures, mode: ${syncData.summary.mode}).`);

    console.log('\n🎉 All smoke tests passed successfully!');
  } catch (err) {
    console.error(`\n❌ Smoke test failure:`, err.message);
    process.exit(1);
  }
}

runSmokeTests();
