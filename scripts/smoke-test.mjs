/**
 * Comprehensive Smoke Test Script for OddsMatrix
 * Verifies local dev/production server rendering, sync API, team isolation, form parsing, and EV bounds.
 */

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

async function runSmokeTests() {
  console.log(`🔍 Running OddsMatrix smoke tests against ${BASE_URL}...\n`);

  try {
    // 1. Test Homepage HTML & UI Guardrails
    console.log('1. Testing Homepage Rendering & Statistical Guardrails...');
    const homeRes = await fetch(BASE_URL);
    if (!homeRes.ok) {
      throw new Error(`Homepage returned HTTP status ${homeRes.status}`);
    }
    const html = await homeRes.text();
    if (!html.includes('OddsMatrix') && !html.includes('Top 5 European Leagues')) {
      throw new Error('Homepage HTML does not contain expected OddsMatrix title content');
    }
    if (!html.includes('Preliminary Sample — Low Statistical Significance')) {
      throw new Error('Homepage missing sample size warning badge for preliminary slips');
    }
    console.log('   ✅ Homepage rendered valid HTML with preliminary sample significance badge.');

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

    // 3. Test Fixtures Integrity via /api/fixtures
    console.log('\n3. Testing Fixtures Data Integrity & Strict League Isolation...');
    const fixturesRes = await fetch(`${BASE_URL}/api/fixtures`);
    if (!fixturesRes.ok) {
      throw new Error(`Fixtures API returned HTTP status ${fixturesRes.status}`);
    }
    const fixturesData = await fixturesRes.json();
    const fixtures = fixturesData.fixtures || [];
    if (fixtures.length === 0) {
      throw new Error('No fixtures returned from /api/fixtures');
    }

    // Verify each fixture is strictly domestic (no cross-league pairing)
    for (const f of fixtures) {
      if (!f.homeTeam || !f.awayTeam) {
        throw new Error(`Fixture ${f.id} is missing homeTeam or awayTeam object`);
      }
      if (f.homeTeam.league !== f.league || f.awayTeam.league !== f.league) {
        throw new Error(
          `Cross-League pairing violation detected in fixture ${f.id}: league ${f.league}, home ${f.homeTeam.name} (${f.homeTeam.league}), away ${f.awayTeam.name} (${f.awayTeam.league})`
        );
      }
      // Form check: no dummy 'DDDDD'
      if (f.homeTeam.form === 'DDDDD' || f.awayTeam.form === 'DDDDD') {
        throw new Error(`Dummy form 'DDDDD' found on team in fixture ${f.id}`);
      }
      // Crest check: official crest URL present
      if (!f.homeTeam.crest_url || !f.awayTeam.crest_url) {
        throw new Error(`Fixture ${f.id} missing crest_url for home or away team`);
      }
      // Quant EV check: no runaway outliers (> 25%)
      if (f.quantAnalysis) {
        const evs = f.quantAnalysis.expectedValues;
        for (const [key, val] of Object.entries(evs)) {
          if (val > 25.01) {
            throw new Error(`Runaway EV detected in fixture ${f.id} (${key}: +${val}% EV exceeds 25% boundary)`);
          }
        }
      }
    }
    console.log(`   ✅ All ${fixtures.length} fixtures passed strict league isolation, valid form data, official crest URLs, and bounded EV (<= 25%).`);

    console.log('\n🎉 All smoke tests passed successfully!');
  } catch (err) {
    console.error(`\n❌ Smoke test failure:`, err.message);
    process.exit(1);
  }
}

runSmokeTests();
