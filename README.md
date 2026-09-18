# OddsMatrix: European Top 5 Football Parlay Analysis & Quant Generator

**OddsMatrix** is a production-ready, zero-maintenance sports betting quantitative analytics web application and parlay generator engineered exclusively for the European Top 5 Leagues:
- 🏴󠁧󠁢󠁥󠁮󠁧󠁿 **Premier League (PL)**
- 🇪🇸 **La Liga (PD)**
- 🇮🇹 **Serie A (SA)**
- 🇩🇪 **Bundesliga (BL1)**
- 🇫🇷 **Ligue 1 (FL1)**

Built with Next.js 14 App Router, TypeScript, Tailwind CSS, Supabase (PostgreSQL), and quantitative models (Bivariate Poisson distribution, 6x6 score probability matrix, de-vigged market odds, +EV detection, and 1/4 Kelly Criterion bankroll sizing).

---

## ⚡ Key Highlights & Architecture

1. **Zero-Breakage Fallback Engine**:
   - Runs out-of-the-box with hyper-realistic Top 5 League data even before API keys or database credentials are configured.
2. **Quantitative Bivariate Poisson Engine**:
   - Calculates dynamic expected goals ($\lambda_{home}$ and $\lambda_{away}$) from attack and defense ratings adjusted against league baselines.
   - Computes a full 6×6 score probability heatmap ($0\text{-}0$ through $5\text{-}5$).
   - Derives true probabilities for Full-Time Result (1X2), Over/Under 2.5 Goals, and Both Teams to Score (BTTS).
3. **De-vigging & Expected Value (+EV)**:
   - Removes bookmaker margin (vigorish) via multiplicative normalization.
   - Calculates mathematical Expected Value: $\text{EV}\% = (\text{True Probability} \times \text{Bookmaker Odds} - 1) \times 100$.
   - Automatically flags positive EV opportunities with electric emerald badges.
4. **Interactive Betting Slip & Correlation Alert Engine**:
   - Real-time product accumulator odds, combined win chance %, and total parlay EV%.
   - Detects Same Game Parlay (SGP) correlations and warns against mutually exclusive selections.
5. **Fractional Kelly Criterion ($\frac{1}{4}$ Kelly)**:
   - Recommends optimal bankroll stake sizing capped at 5% to protect against accumulator variance.
6. **AI Curated Parlays**:
   - **Safe Combo**: 2–3 legs, lower variance, high confidence anchors.
   - **Value Seeker**: 3–4 legs, strictly positive EV selections with market edge.
   - **Weekend Lotto**: 5+ legs accumulator moonshot with minimal stake recommendation.
   - Historical hit-rate tracker tracking Won/Lost/Active performance and ROI.

---

## 🚀 Quickstart Local Development

### 1. Clone & Install Dependencies
```bash
git clone <your-repo-url>
cd AiSport
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Fill in your configuration:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
FOOTBALL_DATA_API_KEY=your_football_data_api_key
THE_ODDS_API_KEY=your_the_odds_api_key
CRON_SECRET=oddsmatrix_secure_cron_secret_key_2026
```

*(Note: If left unset, OddsMatrix will run in Zero-Breakage Demo Mode using the built-in Top 5 League data engine).*

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🗄️ Supabase Database Setup

1. Create a free project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** in the Supabase Dashboard.
3. Open the file [`supabase/schema.sql`](./supabase/schema.sql) in this repository and paste the entire script into the SQL Editor.
4. Click **Run**.
5. The script will automatically create:
   - `teams` table with attack/defense ratings and recent form
   - `fixtures` table for scheduled matches
   - `market_odds` table for 1X2 and Over/Under lines
   - `ai_parlays` table for historical track records
   - Performance indexes on `league`, `match_time`, and `category`
   - Row Level Security (RLS) policies allowing public read and service-role write
   - Seed data for the historical hit-rate tracker

---

## 🔄 Automated Ingestion & Background Sync

The background sync endpoint is located at `/api/sync`:
- Protected with Bearer authentication:
  ```bash
  curl -X POST https://your-domain.vercel.app/api/sync \
    -H "Authorization: Bearer <CRON_SECRET>"
  ```
- Or via URL query parameter:
  ```bash
  https://your-domain.vercel.app/api/sync?token=<CRON_SECRET>
  ```
- Uses [`lib/team-matcher.ts`](./lib/team-matcher.ts) to link disparate team names across Football-Data.org and The Odds API (e.g. "Paris Saint-Germain FC" vs "PSG", "Wolverhampton Wanderers" vs "Wolves").
- Free-tier conservation: Responses are cached (30–60 minutes) to avoid exhausting free API allowances.

### Background Sync Scheduling Options

#### Option A: Native Vercel Cron (Default - 100% Free on Hobby Plan)
Vercel's Hobby plan restricts native cron jobs to a maximum frequency of once per day. The repository is preconfigured in `vercel.json` to run automatically every day at 05:00 UTC without extra setup:

```json
{
  "crons": [
    {
      "path": "/api/sync",
      "schedule": "0 5 * * *"
    }
  ]
}
```

#### Option B: GitHub Actions Hourly Sync (Free Alternative)
To retain **hourly syncs** without needing a paid Vercel Pro subscription, use the included GitHub Actions workflow at [`.github/workflows/sync.yml`](./.github/workflows/sync.yml).

1. Go to your GitHub repository -> **Settings** -> **Secrets and variables** -> **Actions**.
2. Click **New repository secret** and add:
   - `VERCEL_APP_URL`: Your deployed Vercel domain (e.g., `aisport.vercel.app`, without `https://`).
   - `CRON_SECRET`: The same secret token configured in your Vercel Environment Variables.
3. GitHub Actions will trigger `/api/sync` every hour (`0 * * * *`) completely free, and you can also manually trigger it anytime via the **Actions** tab in GitHub.

---

## 🌐 Deploy to Vercel (100% Free Serverless)

1. Push your repository to GitHub.
2. Go to [Vercel](https://vercel.com) and click **Add New Project**.
3. Import your GitHub repository.
4. Under **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `FOOTBALL_DATA_API_KEY`
   - `THE_ODDS_API_KEY`
   - `CRON_SECRET`
5. Click **Deploy**. Vercel will build and deploy the application globally with zero server management!

---

## 📂 Project Structure

```
├── app/
│   ├── api/sync/route.ts      # Multi-API ingestion & Supabase upsert handler
│   ├── globals.css            # Dark terminal styling & custom scrollbars
│   ├── layout.tsx             # Root layout with SEO metadata
│   └── page.tsx               # Main interactive dashboard (Views A & B)
├── components/
│   ├── AIParlayCard.tsx       # Curated slip cards (Safe, Value, Lotto)
│   ├── BettingSlip.tsx        # Floating/collapsible drawer with Kelly bankroll
│   ├── Header.tsx             # Brand header, sync trigger, tab switcher
│   ├── HitRateTracker.tsx     # Historical ROI & hit-rate track record
│   ├── LeagueFilter.tsx       # Top 5 European league selector pills
│   ├── MatchCard.tsx          # Match matchup, live odds, +EV tags
│   ├── ScoreMatrixModal.tsx   # 6x6 Poisson probability heatmap inspector
│   └── StatBadge.tsx          # Form (W/D/L) pills and EV% badges
├── lib/
│   ├── analytics.ts           # Bivariate Poisson, De-vigging, EV & Kelly math
│   ├── mock-data.ts           # Zero-breakage Top 5 League fallback dataset
│   ├── supabase/              # Supabase browser and server clients
│   └── team-matcher.ts        # 98-team alias dictionary & fuzzy normalizer
├── supabase/
│   └── schema.sql             # Complete PostgreSQL migration & seed script
└── types/
    └── index.ts               # Strict TypeScript definitions
```

---

## ⚖️ Disclaimer

OddsMatrix is designed for educational, statistical, and quantitative analysis purposes only. Sports betting involves financial risk; never wager more than you can afford to lose.
