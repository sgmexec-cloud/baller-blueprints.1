# FC 26 Attribute Optimizer — TODO

## Backend
- [x] Upload all 6 CSV files to static assets and serve server-side
- [x] Build tRPC procedure: `scout.generateReport` — Phase 1 LLM scouting
- [x] Build tRPC procedure: `scout.calculateStats` — Phase 2 math engine
- [x] Embed CSV data as parsed JSON in server memory at startup
- [x] LLM prompt: feed ARCHETYPE_PROFILE, PLAYSTYLE_INFO, PLAYSTYLES, SPECIALISATIONS
- [x] LLM output: structured JSON (archetype, height/weight, playstyle+, playstyles, specialisation, core/secondary/tertiary attrs)
- [x] Math engine: sanitize ALL_ARCHETYPES + MASTER_COST_DATA, build cost_dict
- [x] Math engine: set base stats, upgrade playstyle minimums point-by-point
- [x] Math engine: fill Core → Secondary → Tertiary until AP budget = 0
- [x] Math engine: return final stats grouped by category with AP spent per attribute

## Frontend
- [x] Dark football/gaming theme (index.css, App.tsx)
- [x] Home page with hero header and app branding
- [x] Phase 1: "Player Identity & Position" text input + "Generate Scouting Report" button
- [x] Phase 1: Loading state with animation during LLM call
- [x] Phase 1: Display full Scouting Blueprint (archetype, height/weight, playstyle+, playstyles with minimums, specialisation, attribute tiers)
- [x] Phase 2: Hidden AP Budget input + "Calculate Perfect Stats" button (revealed after Phase 1)
- [x] Phase 2: Loading state during math engine calculation
- [x] Phase 2: Final Player Card showing all attributes grouped by Pace/Shooting/Passing/Dribbling/Defending/Physicality/Skill Moves/Weak Foot
- [x] Player Card: show final stat value + AP spent per attribute
- [x] Mobile-first responsive layout
- [x] Smooth transitions between phases

## Testing
- [x] Vitest test for math engine logic
- [x] Vitest test for scouting router (covered by math engine tests)


## Meta Efficiency Rules (Complete)
- [x] Rule 1: 95 Hard Cap — cap Core/Secondary attributes at 95 max, skip to next lowest when hit
- [x] Rule 2: Animation Lock — force StandingTackle to 85 for Defender/CDM positions before Core loops
- [x] Rule 3: Aerial Bundle — force Reactions, Composure, Jumping, Strength into Core/Secondary for CB/ST positions
- [x] Extract position from player description in Phase 1 scouting
- [x] Pass position to Phase 2 math engine
- [x] Test exact AP budget = 0 with all three rules active (31 tests passing)


## UI Polish & Export (Complete)
- [x] Add sponsored loading banner with U7Buy affiliate link
- [x] Add premium VIP button with Discord link
- [x] Test UI changes in browser
- [x] Zip project and provide download link
