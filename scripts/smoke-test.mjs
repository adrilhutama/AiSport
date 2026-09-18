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
    if (!syncData.summary?.oddsApiQuota || typeof syncData.summary.oddsApiQuota.remaining === 'undefined') {
      throw new Error('Sync API summary missing oddsApiQuota tracking');
    }
    console.log(`   ✅ Sync API returned success (${syncData.summary.fixturesUpdated} fixtures, quota remaining: ${syncData.summary.oddsApiQuota.remaining}, mode: ${syncData.summary.mode}).`);

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
      // Form check: no dummy 'DDDDD' or 'N/A'
      if (!f.homeTeam.form || f.homeTeam.form === 'DDDDD' || f.homeTeam.form === 'N/A' || f.homeTeam.form.length !== 5) {
        throw new Error(`Invalid form '${f.homeTeam.form}' found on team ${f.homeTeam.name}`);
      }
      if (!f.awayTeam.form || f.awayTeam.form === 'DDDDD' || f.awayTeam.form === 'N/A' || f.awayTeam.form.length !== 5) {
        throw new Error(`Invalid form '${f.awayTeam.form}' found on team ${f.awayTeam.name}`);
      }
      // Crest check: official crest URL present
      if (!f.homeTeam.crest_url || !f.awayTeam.crest_url) {
        throw new Error(`Fixture ${f.id} missing crest_url for home or away team`);
      }
      // Quant Multi-Market Derivations & EV bounds check
      if (f.quantAnalysis) {
        const probs = f.quantAnalysis.trueProbabilities;
        // Verify Totals sum
        const totals15Sum = probs.over15 + probs.under15;
        if (Math.abs(totals15Sum - 1.0) > 0.01) {
          throw new Error(`Fixture ${f.id}: Over 1.5 + Under 1.5 true probabilities sum to ${totals15Sum}, expected 1.0`);
        }
        // Verify BTTS sum
        const bttsSum = probs.bttsYes + probs.bttsNo;
        if (Math.abs(bttsSum - 1.0) > 0.01) {
          throw new Error(`Fixture ${f.id}: BTTS Yes + No true probabilities sum to ${bttsSum}, expected 1.0`);
        }
        // Verify Asian Handicap line -0.5 / +0.5 sum
        const ah05Sum = (probs.asianHandicap['home_-0.5'] || 0) + (probs.asianHandicap['away_+0.5'] || 0);
        if (Math.abs(ah05Sum - 1.0) > 0.02) {
          throw new Error(`Fixture ${f.id}: AH -0.5/+0.5 true probabilities sum to ${ah05Sum}, expected 1.0`);
        }

        const evs = f.quantAnalysis.expectedValues;
        for (const [key, val] of Object.entries(evs)) {
          if (typeof val === 'number' && val > 25.01) {
            throw new Error(`Runaway EV detected in fixture ${f.id} (${key}: +${val}% EV exceeds 25% boundary)`);
          }
          if (typeof val === 'object' && val !== null) {
            for (const [subKey, subVal] of Object.entries(val)) {
              if (subVal > 25.01) {
                throw new Error(`Runaway EV detected in fixture ${f.id} (${key}.${subKey}: +${subVal}% EV exceeds 25% boundary)`);
              }
            }
          }
        }
      }
    }
    console.log(`   ✅ All ${fixtures.length} fixtures passed strict league isolation, valid 5-match form, official crests, and calibrated multi-market models (1X2, AH, Totals, BTTS <= 25% EV).`);

    // 4. Test AI Curated Parlays Integrity
    console.log('\n4. Testing AI Curated Parlays (Upcoming Fixtures & Strict Kickoff Filter)...');
    const parlays = fixturesData.parlays || [];
    const activeParlays = parlays.filter(p => p.status === 'pending');
    if (activeParlays.length < 3) {
      throw new Error(`Expected at least 3 active AI parlays, found ${activeParlays.length}`);
    }

    const expectedTitles = ['Safe Combo #48', 'Value Seeker #29', 'Weekend Lotto Moonshot #14'];
    for (const title of expectedTitles) {
      const found = activeParlays.find(p => p.title === title);
      if (!found) {
        throw new Error(`Missing expected curated slip title: ${title}`);
      }
      if (!found.legs || found.legs.length === 0) {
        throw new Error(`Slip ${title} has no legs`);
      }
      // Check legs match upcoming fixtures and are not in the past
      for (const leg of found.legs) {
        if (!leg.homeCrest || !leg.awayCrest) {
          throw new Error(`Slip ${title} leg missing homeCrest or awayCrest for ${leg.homeTeam} vs ${leg.awayTeam}`);
        }
        if (!leg.homeForm || !leg.awayForm) {
          throw new Error(`Slip ${title} leg missing homeForm or awayForm for ${leg.homeTeam} vs ${leg.awayTeam}`);
        }
        const fixture = fixtures.find(f => f.id === leg.fixtureId);
        if (fixture && (fixture.status === 'FINISHED' || fixture.status === 'IN_PLAY')) {
          throw new Error(`Slip ${title} includes finished or in-play fixture: ${fixture.id}`);
        }
      }
    }
    console.log(`   ✅ Curated slips verified: Safe Combo #48, Value Seeker #29, and Weekend Lotto Moonshot #14 contain strictly upcoming legs with official crests and form.`);

    console.log('\n🎉 All smoke tests passed successfully!');
  } catch (err) {
    console.error(`\n❌ Smoke test failure:`, err.message);
    process.exit(1);
  }
}

runSmokeTests();
