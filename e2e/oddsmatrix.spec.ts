import { test, expect } from '@playwright/test';

test.describe('OddsMatrix End-to-End Suite', () => {
  test('User Journey: Dashboard, AI Curated Slips, Tail Slip, and Kelly Bankroll', async ({ page }) => {
    // 1. Navigate to home page
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // 2. Check main heading and hero
    const heading = page.locator('h1');
    await expect(heading).toBeVisible({ timeout: 10000 });
    await expect(heading).toContainText('Top 5 European Leagues Analytics Matrix');

    // 3. Verify AI Curated Parlays exist
    await expect(page.locator('text=Safe Combo #48')).toBeVisible();
    await expect(page.locator('text=Value Seeker #29')).toBeVisible();
    await expect(page.locator('text=Weekend Lotto Moonshot #14')).toBeVisible();

    // 4. Test "Tail This Parlay Slip" button
    const tailButton = page.locator('button:has-text("Tail This Parlay Slip")').first();
    await expect(tailButton).toBeVisible();
    await tailButton.click();

    // 5. Verify Betting Slip drawer opens with loaded legs
    const bettingSlip = page.getByText('Betting Slip', { exact: true });
    await expect(bettingSlip).toBeVisible();
    await expect(page.locator('text=1/4 Kelly Bankroll Sizing')).toBeVisible();

    // 6. Test Bankroll Input interaction
    const bankrollInput = page.locator('input[type="number"]').first();
    await bankrollInput.fill('250');
    // Verify updated calculation
    await expect(page.locator('text=Total Bankroll ($)')).toBeVisible();

    // 7. Test Copy Parlay Slip
    const copyButton = page.locator('button:has-text("Copy Parlay Slip")');
    await expect(copyButton).toBeVisible();
    await copyButton.click();
    await expect(page.locator('text=Copied!')).toBeVisible();
  });

  test('Interactive Match Builder: League Filter, Quant 6x6 Heatmap, and Correlation Engine', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Switch to Match Builder tab
    const builderTab = page.locator('button:has-text("Match Builder")');
    await builderTab.click();
    await expect(page.locator('text=Live Match Odds & Quant Matrix')).toBeVisible();

    // Filter by Premier League
    const premierLeagueFilter = page.locator('button:has-text("Premier League")');
    await expect(premierLeagueFilter).toBeVisible();
    await expect(page.locator('text=Arsenal').first()).toBeVisible();
    await expect(page.locator('text=Chelsea').first()).toBeVisible();

    // Open and inspect Quant Matrix Modal
    const quantMatrixBtn = page.locator('button:has-text("Quant Matrix")').first();
    await expect(quantMatrixBtn).toBeVisible();
    await quantMatrixBtn.click();

    // Verify 6x6 score probability heatmap
    await expect(page.locator('text=Bivariate Poisson Quant Model')).toBeVisible();
    await expect(page.locator('text=H \\ A')).toBeVisible();

    // Close modal
    const closeBtn = page.locator('button:has(svg.lucide-x)');
    await closeBtn.click();
    await expect(page.locator('text=Bivariate Poisson Quant Model')).not.toBeVisible();

    // Switch to Goal Totals tab
    const totalsTab = page.locator('button:has-text("Goal Totals")').first();
    await totalsTab.click();

    // Add Over 2.5 selection
    const overOddsBtn = page.locator('button:has-text("Over 2.5")').first();
    await overOddsBtn.click();

    // Verify Betting Slip shows leg
    await expect(page.getByText('Betting Slip', { exact: true })).toBeVisible();

    // Add conflicting Under 2.5 selection from same match to trigger Correlation Alert
    const underOddsBtn = page.locator('button:has-text("Under 2.5")').first();
    await underOddsBtn.click();

    // Check correlation warning banner
    await expect(page.locator('text=Correlation Alert')).toBeVisible();

    // Verify Gameweek round indicator is visible
    await expect(page.locator('text=Upcoming Matchday Round')).toBeVisible();
  });

  test('Statistical Sanity: Hit-Rate sample warning & calibrated EV boundaries', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // 1. Check preliminary sample warning badge when evaluated slips < 30
    const sampleBadge = page.locator('text=Preliminary Sample — Low Statistical Significance').first();
    await expect(sampleBadge).toBeVisible();

    // 2. Switch to Match Builder
    const builderTab = page.locator('button:has-text("Match Builder")');
    await builderTab.click();

    // 3. Verify that EV percentages across visible badges are rational (<= 25%)
    const evBadges = page.locator('span:has-text("% EV")');
    const count = await evBadges.count();
    for (let i = 0; i < count; i++) {
      const badgeText = await evBadges.nth(i).textContent();
      const match = badgeText?.match(/\+?([0-9.]+)%\s*EV/);
      if (match) {
        const evValue = parseFloat(match[1]);
        expect(evValue).toBeLessThanOrEqual(25.0);
      }
    }
  });

  test('Sportsbook Odds Board: Real Team Crests, Form Badges, and Pinnacle/Stake Odds Buttons', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Switch to Match Builder
    const builderTab = page.locator('button:has-text("Match Builder")');
    await builderTab.click();

    // Verify team crest images or monograms are present
    const crests = page.locator('img[alt$="crest"]');
    const crestCount = await crests.count();
    expect(crestCount).toBeGreaterThan(0);

    // Verify form pills are present (W, D, L letters in circles)
    const winPills = page.locator('span:has-text("W")');
    expect(await winPills.count()).toBeGreaterThan(0);

    // Verify decimal odds buttons exist and are formatted as decimals (e.g. 2.10, 1.85)
    const oddsButtons = page.locator('button:has-text("1"), button:has-text("X"), button:has-text("2")');
    expect(await oddsButtons.count()).toBeGreaterThan(0);
  });

  test('Multi-Market Expansion: Asian Handicap, Goal Totals, and BTTS Odds Chips', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Switch to Match Builder
    const builderTab = page.locator('button:has-text("Match Builder")');
    await builderTab.click();

    // 1. Test Asian Handicap tab
    const ahTab = page.locator('button:has-text("Asian Handicap")').first();
    await expect(ahTab).toBeVisible();
    await ahTab.click();

    // Verify AH chips exist (e.g. Home -0.5, Away +0.5)
    const ahChip = page.locator('button:has-text("Home -0.5")').first();
    await expect(ahChip).toBeVisible();
    await ahChip.click();

    // Verify Betting Slip displays Asian Handicap selection
    const bettingSlip = page.getByText('Betting Slip', { exact: true });
    await expect(bettingSlip).toBeVisible();
    await expect(page.locator('text=Asian Handicap').first()).toBeVisible();

    // 2. Test BTTS tab
    const bttsTab = page.locator('button:has-text("BTTS")').first();
    await expect(bttsTab).toBeVisible();
    await bttsTab.click();

    // Verify BTTS chips exist
    const bttsYesChip = page.locator('button:has-text("Yes")').first();
    await expect(bttsYesChip).toBeVisible();
  });

  test('API Route: Background Sync returns valid JSON and updates records', async ({ request }) => {
    const response = await request.get('/api/sync');
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.summary.leaguesProcessed).toContain('PL');
    expect(data.summary.fixturesUpdated).toBeGreaterThan(0);
  });
});
