# Feature Research

**Domain:** TV-readable sales leaderboard dashboard
**Researched:** 2026-03-31
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features that any TV-mounted sales board must have to be functional from across an office. Missing these means the board fails its primary purpose.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Enlarged table font sizes (agent names, counts, premiums) | Current 14-18px agent names and 12-15px premiums are unreadable beyond 6 feet. 10-foot UI guidelines mandate 24px minimum for any text. Sales offices typically have 10-20ft viewing distances. | LOW | Existing inline styles use hardcoded px values. Change fontSize properties in WeeklyView TH/TD styles and DailyView column styles. No layout changes needed -- current cells have generous padding that accommodates larger text. |
| Enlarged KPI card numbers | KPI cards (Today's Sales, Today's Premium, Weekly Sales, Weekly Premium) use 26-30px numbers. At 15+ feet these blur together. Need 36-42px minimum for the primary number. | LOW | Only touches the 4 stat card divs in the main SalesBoard component. Labels can stay small (they provide context, not data). |
| Enlarged team total row | Team total row uses 14px label, 20px daily counts, 28px grand total. This is the most-glanced row and needs to dominate visually -- 24px+ for daily, 36px+ for grand total. | LOW | Single `<tr>` at bottom of WeeklyView. Increase fontSize on the 3 style objects in that row. |
| Sufficient contrast on secondary text | Premium amounts use `colors.textTertiary` (muted gray) at 12px. On a TV in a bright office with overhead lighting, these wash out. Need either bolder color or larger size or both. | LOW | Change color from textTertiary to textSecondary for premium values. This is a token swap, not a design overhaul. Dark theme already provides good base contrast for primary text. |
| Abbreviated dollar amounts for large numbers | "$34,231.42" at distance is noise. "$34.2K" communicates instantly. Klipfolio and digital signage best practices universally recommend numeric suffixes for TV displays. | LOW | Add a `fmt$short` helper (already have `fmt$` and `fmt$whole`). Use for premium columns where precision beyond hundreds is not actionable from a TV. Keep full precision on desktop/close-up views or use the existing `fmt$whole` which already drops cents. |
| Bold/heavy font weights on data cells | Current daily count cells use fontWeight 800 (good) but premium sub-values use 600. At distance, anything below 700 loses definition. Industry guidance says avoid thin/light typefaces on TV. | LOW | Bump fontWeight from 600 to 700 on premium sub-text in daily cells and agent column premium values. |

### Differentiators (Competitive Advantage)

Features that would make this sales board notably better than generic TV dashboard tools (Klipfolio, Spinify, Geckoboard) when wall-mounted.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Auto-scaling font sizes based on agent count | With 9 agents the table is spacious; with 15 it gets tight. A simple `clamp()` or computed fontSize that shrinks proportionally as agent rows increase keeps text maximally large without overflow. Better than picking one fixed size that works for 15 but wastes space with 9. | MEDIUM | Calculate based on `sorted.length`. Use `Math.max(MIN, BASE - (agentCount - 9) * STEP)` pattern. Apply to agent name, count, and premium fontSize. Requires testing at 9, 12, 15 agent counts. |
| Podium card size increase for TV | The DailyView podium cards use 14-17px names and 26-36px counts. These are designed for desktop proximity. Scaling podium dimensions and font sizes ~1.5x makes the leaderboard view dramatic and readable from across the room. | MEDIUM | Modify PODIUM_CONFIG constants (nameSize, countSize, height, width). Must verify 3 cards still fit side-by-side at 1920px width with increased widths. The podium is the "hero" view so this has high visual payoff. |
| Row height optimization for 9-15 agent fit | The milestone spec says "cell dimensions unchanged -- increased fonts use existing whitespace." Current row padding is `14px 16px`. At 1080p with header + KPI bar + tab nav, available table height is roughly 600-700px. With 15 agents + header + team total = 17 rows, each row gets ~38px. Current 14px vertical padding (28px total) + line height means rows are already ~48px. The constraint is real: fonts must grow but rows must not. | MEDIUM | Audit exact pixel budget: 1080px viewport minus header (~120px), KPI bar (~100px), tab nav (~48px), table header (~48px), team total row (~56px), bottom padding (~24px) = ~741px for agent rows. At 15 agents that is 49px per row. Current padding of 14px top+bottom = 28px padding + ~20px text = 48px. Fits. Can increase font without increasing row height by reducing vertical padding slightly if needed (12px instead of 14px). |
| Whole-dollar display in table cells | Premium sub-values in daily cells currently show cents ($1,234.56). Dropping cents to show "$1,235" saves 3 characters per cell, which at 7 day columns times 15 agents = 105 fewer characters of visual noise. The existing `fmt$whole` helper already does this. | LOW | Already partially implemented -- WeeklyView uses `fmt$whole` for premium. Verify DailyView podium and remaining-agent columns also use it. Consistency pass only. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Auto-rotating between views | "Show leaderboard for 30s then weekly table for 30s." Feels like it adds value by showing everything. | Viewers glance at the board for 2-3 seconds. If the view they need is not showing, they get nothing and wait. Klipfolio warns against cycling when a single focused view serves better. | Let the office pick one default view (likely weekly table). If both views are needed, use two TVs or let an admin toggle manually. |
| Responsive/mobile layout for TV | "What if someone opens it on their phone?" | The board is explicitly for TV. Adding responsive breakpoints dilutes the TV optimization. Mobile users should use the ops-dashboard. | Keep as a single-purpose TV display. Project already decided "sales board stays standalone" and "mobile app is out of scope." |
| Animated transitions on data updates | "Numbers should flash when they change to draw attention." | Constant animation fatigues peripheral vision over 8+ hour display. Persistent motion becomes annoying noise. | Keep existing AnimatedNumber (subtle counting animation). Do NOT add flashing, bouncing, or color-change on update. The live pulse dot is sufficient. |
| Color-coded rows by performance tier | "Green for top performers, red for low performers." | Publicly shaming low performers on a wall TV is a morale killer. Spinify and Ambition warn against this. Also fragments the color scheme. | Keep subtle gold highlight on top 3 rows. Rank badges communicate position without punishment. |
| Scrolling/pagination for large teams | "Support 30+ agents with scrolling." | A scrolling table on a TV is unusable -- nobody controls the scroll from across the room. | 9-15 agent range is the design target. For larger teams, split into sub-teams or use multiple boards. |
| Dense multi-metric cells | "Show count + premium + close rate + calls in each cell." | More data per cell = smaller text. At TV distance, 4 values in one cell means 4 unreadable values. | One primary metric (count) with one secondary (premium). Close rate and call data belong on ops-dashboard. |

## Feature Dependencies

```
[Enlarged table font sizes]
    +-- depends on --> [Row height optimization for 9-15 agent fit]
                           (font increase must be validated against row budget)

[Auto-scaling font sizes based on agent count]
    +-- depends on --> [Enlarged table font sizes]
                           (base sizes must be established before scaling logic)

[Podium card size increase]
    +-- independent (DailyView only, does not affect WeeklyView)

[Abbreviated dollar amounts]
    +-- independent (helper function change, applies across views)

[Bold font weights on data cells]
    +-- independent (style property changes only)

[Sufficient contrast on secondary text]
    +-- independent (color token swap)
```

### Dependency Notes

- **Enlarged table fonts requires row height validation:** Cannot blindly increase font sizes without confirming the pixel budget accommodates 15 agent rows plus header and team total within 1080px viewport height. Research suggests it fits (see differentiator analysis), but implementation must verify.
- **Auto-scaling depends on base sizes:** The scaling formula needs established min/max font sizes as inputs. Set the fixed enlarged sizes first, then add the dynamic scaling as a refinement.
- **Podium changes are isolated:** The podium only appears in DailyView (leaderboard tab), so changes there do not affect the weekly breakdown table at all.

## MVP Definition

### Launch With (v2.0)

The milestone is narrowly scoped ("increase font sizes for TV readability"). These are the changes that directly satisfy the stated requirements.

- [ ] Enlarged table font sizes in WeeklyView -- agent names, daily counts, premiums, totals
- [ ] Enlarged KPI card numbers -- primary stat values in the 4 top cards
- [ ] Enlarged team total row -- label, daily counts, grand total, grand premium
- [ ] Bold font weights on all data-bearing text (minimum 700)
- [ ] Contrast improvement on premium/secondary text (textTertiary to textSecondary)
- [ ] Whole-dollar display consistency across both views

### Add After Validation (v2.x)

Features to add once the basic font sizing is confirmed readable on an actual office TV.

- [ ] Auto-scaling font sizes based on agent count -- add after confirming static sizes work at both 9 and 15 agents on a real TV
- [ ] Podium card size increase -- add after confirming the weekly table changes
- [ ] Abbreviated dollar amounts with K/M suffixes -- add if full dollar amounts still feel noisy after the font increase

### Future Consideration (v3+)

- [ ] TV-specific URL parameter (?tv=1) that activates TV-optimized sizing vs desktop sizing -- only if the same board needs to serve both contexts
- [ ] Configurable default view (persist leaderboard vs weekly preference) -- only matters if offices disagree on which view to show

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Enlarged table font sizes | HIGH | LOW | P1 |
| Enlarged KPI card numbers | HIGH | LOW | P1 |
| Enlarged team total row | HIGH | LOW | P1 |
| Bold font weights on data cells | MEDIUM | LOW | P1 |
| Contrast on secondary text | MEDIUM | LOW | P1 |
| Whole-dollar consistency | MEDIUM | LOW | P1 |
| Auto-scaling by agent count | HIGH | MEDIUM | P2 |
| Podium card size increase | MEDIUM | MEDIUM | P2 |
| Abbreviated K/M suffixes | LOW | LOW | P3 |
| TV-specific URL param | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for v2.0 launch -- directly satisfies milestone requirements
- P2: Should have -- validates well on real TV, adds polish
- P3: Nice to have -- only if specific pain points emerge from TV testing

## Current State Analysis

### Existing Font Sizes (from code audit)

| Element | Current Size | TV Minimum (10ft) | Gap |
|---------|-------------|-------------------|-----|
| Page title "Sales Board" | 36px | 36px+ | OK |
| KPI card labels | 11px | 18px+ | Needs increase |
| KPI card numbers | 26-30px | 36-42px | Needs increase |
| Table header (TH) | 15px | 20px+ | Needs increase |
| Agent name in table | 18px | 22-26px | Needs increase |
| Daily count in cell | 20px | 26-32px | Needs increase |
| Premium sub-value in cell | 12px | 16-20px | Needs increase |
| Total column | 24px | 30-36px | Needs increase |
| Premium column | 15px | 20-24px | Needs increase |
| Team total label | 14px | 18-22px | Needs increase |
| Team total daily count | 20px | 26-32px | Needs increase |
| Team total grand number | 28px | 36-42px | Needs increase |
| Podium name (1st place) | 17px | 24px+ | Needs increase |
| Podium count (1st place) | 36px | 48px+ | Needs increase |
| DailyView agent name (4th+) | 14px | 20px+ | Needs increase |
| DailyView agent count (4th+) | 28px | 36px+ | Needs increase |
| DailyView agent premium (4th+) | 12px | 18px+ | Needs increase |

### Pixel Budget Analysis (1080p TV, WeeklyView)

```
Viewport height:                  1080px
- Top accent bar:                    3px
- Header (title + KPI cards):     ~160px
- Tab navigation:                  ~48px
- Table header row:                ~48px
- Team total row:                  ~56px
- Bottom padding:                  ~24px
                                 -------
Available for agent rows:         ~741px

At 15 agents: 741 / 15 = 49px per row
Current row height: ~48px (14px padding top + 14px padding bottom + 20px text)
Verdict: FITS. Can increase font from 20px to 28-32px by reducing
         vertical padding from 14px to 10-12px if needed.

At 9 agents: 741 / 9 = 82px per row
Verdict: Generous. Larger fonts will look great.
```

## Sources

- [Klipfolio: Best Practices for Displaying Dashboards on Large Screens](https://www.klipfolio.com/resources/articles/best-practices-large-screen-wallboard-tv-dashboard) -- design for glancing, abbreviate numbers, remove fine details
- [DigitalSignage.com: Typography & Viewing Distance Guide](https://digitalsignage.com/digital_signage/docs/guides/typography-viewing-distance/) -- font size formulas by viewing distance
- [Pascal Potvin: Designing a 10ft UI](https://pascalpotvin.medium.com/designing-a-10ft-ui-ae2ca0da08b7) -- 24px minimum, simplicity over density
- [Spyro-soft: 8 UX/UI best practices for TV apps](https://spyro-soft.com/blog/media-and-entertainment/8-ux-ui-best-practices-for-designing-user-friendly-tv-apps) -- white space, bold typefaces, high contrast
- [Spinify: Sales Leaderboard Best Practices](https://spinify.com/blog/top-10-sales-leaderboard-best-practices/) -- motivation through visibility, avoid shaming
- [Ambition: Top 10 Best Practices for Sales Leaderboards](https://ambition.com/blog/entry/2017-09-26-how-use-wallboards-and-leaderboards-close-out-year-strong/) -- keep metrics simple, multiple recognition opportunities
- [RiseVision: Digital Signage Best Practices](https://www.risevision.com/blog/digital-signage-best-practices) -- sans-serif bold, limit text density, test at distance
- [Android TV Style Guide](https://spot.pcc.edu/~mgoodman/developer.android.com/preview/tv/design/style.html) -- 28px minimum on 1080p, light-on-dark preferred
- [Alicia.design: Solving small text for large screens](https://www.alicia.design/post/solving-small-text-and-contrast-issues-for-large-screen-readability) -- contrast requirements higher on TV than web

---
*Feature research for: TV-readable sales leaderboard dashboard*
*Researched: 2026-03-31*
