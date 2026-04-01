# Pitfalls Research

**Domain:** TV-readable sales board leaderboard (optimizing existing Next.js dark-theme dashboard for wall-mounted TV viewing distance)
**Researched:** 2026-03-31
**Confidence:** HIGH (based on direct codebase analysis + established display/typography best practices)

## Critical Pitfalls

### Pitfall 1: Increasing font sizes causes cell height expansion, breaking 9-15 agent fit

**What goes wrong:**
The weekly table uses `padding: "14px 16px"` on every `<td>`. Bumping font sizes from 18px/20px to TV-readable sizes (24px+) increases the line box height, which adds to the existing 28px of vertical padding per cell. With 15 agents + header + team total row = 17 rows, each gaining even 8px of height totals 136px of extra vertical space. The table overflows the viewport on a 1080p TV.

**Why it happens:**
Developers increase `fontSize` but leave `padding` untouched, assuming "cell dimensions unchanged" means only padding stays the same. In reality, the browser computes cell height as `padding-top + line-height * fontSize + padding-bottom`. Bigger font = taller cell regardless of padding.

**How to avoid:**
Reduce vertical padding proportionally as font size increases. The constraint is "keep cell dimensions unchanged," which means the total rendered height per row must stay the same. If font goes from 18px to 24px (6px taller), reduce top+bottom padding by 6px (e.g., 14px -> 11px each side). Test with exactly 15 agents at 1080p to verify no overflow.

**Warning signs:**
- Vertical scrollbar appears on the table container (it has `overflowX: "auto"` but no `overflowY`)
- Team total row disappears below the fold
- Page requires scrolling when more than 12 agents are active

**Phase to address:**
Phase 1 (font size changes) -- must be validated simultaneously with size increases, not as a follow-up fix.

---

### Pitfall 2: Dark theme contrast ratios that pass on monitors fail on TVs

**What goes wrong:**
The current theme uses `--text-tertiary: #64748b` (slate-500) and `--text-muted: #475569` (slate-600) on backgrounds like `#070a0a` and `#0c1414`. On a backlit monitor at 60cm viewing distance, these pass WCAG AA. On a consumer-grade TV at 3-6 meters with ambient office lighting, lower-contrast elements become invisible. Specifically: the "dash" placeholders (`&mdash;` in `colors.borderStrong`), the premium sub-text (`colors.textTertiary`), and the rank badges on non-top-3 agents (`colors.textMuted`) will disappear.

**Why it happens:**
TV panels have lower native contrast ratios than IPS monitors (especially in bright rooms), and viewing distance means the eye integrates text with surrounding background more aggressively. A color that "looks dim but readable" on a monitor becomes "invisible" on a TV from across the room.

**How to avoid:**
Promote all text elements by one contrast tier: `textTertiary` -> `textSecondary`, `textMuted` -> `textTertiary`. For the sales board specifically, nothing should use `textMuted` or `borderStrong` for any visible text or numbers. The minimum should be `textTertiary` (#64748b) for truly secondary info, and `textSecondary` (#94a3b8) for anything a manager needs to read from across the room.

**Warning signs:**
- Any text element using `colors.textMuted` or `colors.borderStrong` for content that should be readable
- Premium dollar amounts using `colors.textTertiary` at small font sizes
- Placeholder dashes using border colors instead of text colors

**Phase to address:**
Phase 1 -- contrast adjustments must ship with font size changes. Bigger text at low contrast is still unreadable.

---

### Pitfall 3: The podium section on DailyView consumes too much vertical space for TV

**What goes wrong:**
The DailyView has a podium section with cards at heights 160px, 180px, 220px plus a 48px platform base, plus "Top Performers" header, plus day/week toggle, plus "All Agents" section below. This layout assumes vertical scrolling is acceptable. On a TV, the entire board must fit in one viewport with no scrolling -- nobody can scroll a wall-mounted TV.

**Why it happens:**
The existing design was built for desktop browser use where scrolling is natural. The podium is a visual showpiece that prioritizes engagement over information density. TV use inverts this: information density and zero-scroll are paramount.

**How to avoid:**
Either (a) compress the podium section significantly (reduce card heights by 30-40%, shrink gaps), or (b) when in "weekly" tab mode the table already has no podium -- consider making weekly the default/only view for TV mode, or (c) add a TV-specific layout that removes the podium entirely and shows all agents in a flat ranked list. The milestone requirements focus on the table (font sizes, 9-15 agents), so the weekly table view is likely the primary TV target.

**Warning signs:**
- DailyView content extends below 1080px viewport height
- "All Agents" section gets compressed or cut off below the podium
- Users report needing to scroll on the TV

**Phase to address:**
Phase 1 -- decide early whether DailyView or WeeklyView is the TV target. If both, podium compression is Phase 1 work.

---

### Pitfall 4: Fixed pixel widths in podium cards break on non-1080p TV resolutions

**What goes wrong:**
Podium cards use fixed pixel widths: 200px, 175px, 165px. The platform base mirrors these. If the TV is 4K (3840x2160) running at native resolution, these cards will look tiny. If the TV is 720p, they may overlap or overflow. The weekly table has `minWidth: 760` which is fine for most TVs, but the inline pixel dimensions throughout are resolution-fragile.

**Why it happens:**
The codebase uses inline `React.CSSProperties` exclusively (project constraint: no Tailwind, no CSS files beyond theme/responsive). Fixed pixel values work well when the target viewport is known (desktop browser). TVs vary wildly: 720p, 1080p, 4K, and browsers on TV sticks may or may not honor device-pixel-ratio.

**How to avoid:**
For the weekly table (the primary TV view), column widths are already flexible (`width: "100%"` on the table). Font sizes are the main concern. Use `clamp()` in font-size values so they scale between a floor and ceiling: e.g., `fontSize: "clamp(18px, 2vw, 28px)"`. This keeps things readable across resolutions without media queries. Note: `clamp()` works in inline styles as a string value.

**Warning signs:**
- Testing only on one resolution (e.g., only 1080p)
- Podium cards overlapping or having large gaps on non-standard resolutions
- Text that looks perfect on 1080p but is too small on 4K or too large on 720p

**Phase to address:**
Phase 1 -- if using fixed pixel font sizes, document the target resolution explicitly. If using clamp(), implement it from the start.

---

### Pitfall 5: Animated numbers cause visual jitter at TV viewing distance

**What goes wrong:**
The board uses `<AnimatedNumber>` throughout for sales counts and premiums. These animate on value changes (real-time Socket.IO updates). At TV viewing distance, a number flickering from "4" to "5" with a counting animation creates momentary visual noise that draws the eye unnecessarily. Worse, if multiple cells update simultaneously (a sale triggers cascade), the entire table appears to shimmer.

**Why it happens:**
Animation that feels polished at arm's length feels chaotic from across a room. The eye can't track the transition -- it just sees "something changed" without catching the before/after. This defeats the purpose of the leaderboard: quick at-a-glance status.

**How to avoid:**
Keep AnimatedNumber but ensure the animation duration is very short (under 200ms) so it reads as a snap rather than a count-up. Alternatively, for TV mode, replace AnimatedNumber with static rendering and use a brief background flash (cell background pulses green for 1 second) to signal "this value just changed." This is more TV-appropriate: the number is always statically readable, and the flash provides change notification.

**Warning signs:**
- Multiple cells animating simultaneously when a sale is entered
- Numbers mid-animation being unreadable (showing intermediate values)
- Users reporting the board "flickers" or is "always moving"

**Phase to address:**
Phase 2 (polish) -- functional but not critical. Font sizes and contrast are Phase 1; animation tuning is refinement.

---

### Pitfall 6: Agent name truncation when font size increases

**What goes wrong:**
Agent names in the weekly table use `whiteSpace: "nowrap"` and `fontSize: 18`. Increasing to 24px+ means names like "Christopher M." or "Alejandra Rodriguez" may overflow the agent column, pushing day columns off-screen or causing horizontal scroll. The table has `overflowX: "auto"` which will add a scrollbar -- unusable on a TV.

**Why it happens:**
The agent column has no `maxWidth` or `overflow: hidden` constraint. At 18px the names fit. At 24px they may not, especially with the rank badge (24px wide + 12px gap) eating into available space.

**How to avoid:**
Add `overflow: hidden`, `textOverflow: "ellipsis"`, and a `maxWidth` on the agent name cell. Better: use first name + last initial format for TV display (server-side or client-side formatting). "Christopher M." is 30% shorter than "Christopher Martinez" and equally identifiable in a sales office where everyone knows each other.

**Warning signs:**
- Horizontal scrollbar appearing on the table
- Agent column consuming more than 20% of table width
- Day columns getting compressed to accommodate long names

**Phase to address:**
Phase 1 -- must be handled when font sizes increase, not after.

---

### Pitfall 7: `fmt$whole` dollar formatting becomes ambiguous at large font sizes

**What goes wrong:**
The `fmt$whole` function rounds premiums to whole dollars: "$1,234". At 12px this is fine as supplementary info. At TV-readable sizes (18px+), "$1,234" without cents reads as authoritative. When the total on the payroll dashboard shows "$1,234.50", users may perceive a discrepancy. More critically, "$0" for agents with no sales is large and prominent, creating visual clutter.

**Why it happens:**
The formatting was designed for a supplementary/secondary display context. Increasing font size promotes it to primary information, changing user perception.

**How to avoid:**
Keep `fmt$whole` (no cents is correct for TV readability -- fewer characters = more readable at distance). But suppress the "$0" case entirely: show a dash or nothing for zero-premium agents, same as the zero-sales treatment. This reduces visual noise.

**Warning signs:**
- Large "$0" values drawing attention to inactive agents
- Users comparing board totals to payroll and finding "mismatches" due to rounding

**Phase to address:**
Phase 1 -- part of the font size change pass.

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoding TV-specific font sizes inline | Quick to implement, matches codebase pattern | If the board is ever viewed on desktop again, sizes are wrong | Acceptable if the sales board is TV-only. If dual-use, use clamp() or a CSS class toggle. |
| Duplicating style objects for TV sizes | No need to refactor existing styles | Two sets of magic numbers to maintain | Never -- use a multiplier or scale factor applied to existing values. |
| Removing animations entirely for TV | Simplest fix for jitter | Loses the "living dashboard" feel | Only if animation tuning proves too complex. Prefer reducing duration first. |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| 30-second polling + Socket.IO both active | Duplicate data fetches, flash of stale data on poll then immediate Socket.IO correction | Not a TV-specific issue, but more visible on TV because the "flash" is large-font and prominent | With 15+ agents, visible now |
| Large AnimatedNumber re-renders on every poll | Every cell re-renders even if value unchanged | Memoize agent rows or use React.memo with comparison on count+premium | Noticeable with 15 agents x 9 columns = 135 cells re-rendering every 30s |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Day/Week toggle buttons too small for TV | Nobody can switch modes -- buttons are 12px font, 6px padding | Increase toggle size proportionally, or auto-detect TV mode and default to weekly |
| "Top Performers" and "All Agents" section labels invisible at distance | Users can't parse the visual hierarchy | Either remove labels (the podium speaks for itself) or increase to 16px+ |
| Theme toggle (light/dark) visible on TV | Someone accidentally clicks it, board goes white in a dark sales office | Hide ThemeToggle in TV mode -- the board should always be dark on a TV |
| Team total row not visually distinct enough at distance | The gold background at 0.07 opacity is barely visible on TV | Increase opacity to 0.15-0.20, or add a thicker top border (current 2px may need 3-4px) |
| Column header abbreviations (Mon, Tue...) at 15px may be too small | Headers are reference text -- need to be readable but not dominant | Increase to 18px minimum for TV, keep uppercase + letter-spacing for distinction |

## "Looks Done But Isn't" Checklist

- [ ] **Font sizes increased:** Verify padding was reduced to compensate -- total row height must not exceed original
- [ ] **Tested at 1080p:** Also test at 720p and 4K -- font sizes must remain readable at all three
- [ ] **Tested with 15 agents:** Not just 5 or 9 -- the table must fit 15 rows + header + team total without scrolling
- [ ] **Tested with long names:** Use "Christopher Rodriguez" as a test name -- if it overflows, add text-overflow handling
- [ ] **Tested with ambient light:** View the TV in a lit room, not a dark dev setup -- contrast issues only appear in real conditions
- [ ] **Tested at actual distance:** Stand 3-4 meters from the screen -- what looks readable at your desk may not be
- [ ] **Zero-sales agents tested:** An agent with 0 sales and $0 premium should look clean, not cluttered with large "0" and "$0"
- [ ] **Team total row visible:** The gold highlight must be distinct enough to separate team totals from last agent at a glance
- [ ] **No horizontal scroll:** The table must never trigger horizontal overflow on a 1080p or higher TV
- [ ] **Socket.IO updates don't cause layout shift:** When a sale comes in, the row should update in-place without the table reflowing

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Cell height overflow (too many agents) | LOW | Reduce padding values and re-test. Pure CSS change, no logic affected. |
| Contrast too low on TV | LOW | Bump color tokens one tier. Search-and-replace in the single page.tsx file. |
| Podium won't fit on TV | MEDIUM | Must either compress or remove podium. If DailyView is the TV target, this requires layout restructuring. |
| Agent names overflowing | LOW | Add textOverflow + ellipsis. 2-line change per cell. |
| Animations jarring on TV | LOW | Reduce duration prop on AnimatedNumber or swap to static rendering. |
| Fixed pixels wrong on non-1080p TV | MEDIUM | Retrofitting clamp() across all font-size values after shipping px values. Tedious but mechanical. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Cell height overflow | Phase 1 (font sizes) | Render with 15 agents at 1080p -- no scrollbar, team total visible |
| Dark theme contrast on TV | Phase 1 (font sizes) | View on actual TV in lit room -- all text readable from 3m |
| Podium vertical space | Phase 1 (layout) | DailyView fits in single viewport at 1080p with 12 agents |
| Fixed pixel resolution fragility | Phase 1 (font sizes) | Test at 720p, 1080p, 4K -- text remains proportional |
| AnimatedNumber jitter | Phase 2 (polish) | Watch board for 5 minutes during active sales -- no distracting flicker |
| Agent name truncation | Phase 1 (font sizes) | Test with "Christopher Rodriguez" at max font size -- no horizontal overflow |
| Dollar format visual noise | Phase 1 (font sizes) | Zero-premium agents show dash, not "$0" at large size |

## Sources

- Direct codebase analysis: `apps/sales-board/app/page.tsx` (current layout, font sizes, padding values, table structure)
- Direct codebase analysis: `packages/ui/src/tokens.ts` and `packages/ui/src/theme.css` (color values, contrast ratios)
- Direct codebase analysis: `packages/ui/src/responsive.css` (existing breakpoints, no TV-specific rules)
- WCAG 2.1 contrast ratio guidelines (4.5:1 minimum for normal text, 3:1 for large text)
- TV display best practices: minimum 24px font for body text at 3m viewing distance on 1080p (widely cited in digital signage industry)

---
*Pitfalls research for: TV-readable sales board leaderboard*
*Researched: 2026-03-31*
