# Reservoir UI validation and browser handoff

## Scope and source

- Repository: `livejiaquan/taiwan-reservoir-static`
- Development branch: `codex/reservoir-time-coverage-context`
- Starting commit: `f4f64a2236c0246902171256af7ab2803b4466d2`
- This batch changes the page hierarchy and interactions; `js/api.js`, source parsing, cache semantics and data-validation thresholds are preserved
- No framework, dependency, production publication, deployment, merge or PR is part of this batch

## Implemented user benefits

1. Source observation time and actual coverage precede derived statistics; missing reservoirs stay visible
2. The focal percentage shows its numerator, denominator, unit and scope, instead of five equally weighted decorative tiles
3. The optional comparison keeps native numeric buttons if Chart.js is unavailable; all values above 100% remain intact
4. Detail links reveal targets hidden by region filters, move keyboard focus, and do not reset the page hash
5. Background refresh preserves the focused station; an unavailable target returns focus to the refresh action
6. Water-bar values sit on a stable high-contrast background independent of the amount of water; decorative perpetual water motion and hover lifts are removed
7. Empty region, uncovered east and complete fetch/validation failure are distinct; empty regional results offer a return to the full list
8. Sources and calculation rules are grouped after exploration. The hero and primary refresh action no longer imply that a successful fetch is a new observation

## Code evidence

- 56 Node regressions, including the original 36, on UTC, America/Los_Angeles and Asia/Taipei
- JavaScript syntax and referenced local asset existence
- Static foreground/background token contrast checks (at least 4.5:1 for covered text combinations)
- Source-level responsive rules for three/two/one-column records, min-width-safe grids, wrapping names and metadata; 44px or larger primary interactive controls
- CSS reduced-motion override, native reduced-motion-aware scroll and no Chart.js count-up animation
- Independent source review identified and fixed clipped disclosure focus, refresh focus loss, a loading-layout jump and misleading partial-region copy

These are code checks, not screenshots or measured browser outcomes. No independent build step exists.

## Required browser acceptance, currently unverified

The cloud preview route is subject to an existing loopback restriction. It was not bypassed, and no screenshot of production is substituted for this branch. Use a supported local executor/browser after it can fetch the exact published development source. Check out the final branch commit and record that SHA beside every capture.

Run the static page through its supported local server. Synthetic state manipulation belongs only in the browser test session; do not save or publish a fabricated live data payload. The Node tests already provide explicit synthetic fixtures for parser and UI contracts.

### Viewports and readability

At 320, 390, 768 and 1440 CSS pixels, and at 200% zoom:

- Capture the top source notice, weighted overview, expanded comparison, region controls, a long-named record, and source section
- Confirm no horizontal page loss, clipped text, units detached from values, or overlapping refresh/source-time text
- Confirm Chinese typography, line rhythm, numeric alignment, whitespace and section transitions are coherent
- Check each clickable target, visible keyboard focus and the inset disclosure focus ring; test actual font fallback with the Google font blocked
- Check late-arriving font and Chart.js layout, initial loader removal, and longest source-time range

### State matrix

- Fresh full snapshot: 20/20, both timestamps clearly distinct
- Partial snapshot: 10–19/20, all missing names readable and scope retained in statistics
- Partial snapshot with a mapped region completely missing: other-region data remains valid, selected-region absence is not called a whole-snapshot failure
- Observation older than 6h: source warning and per-card warning text
- Entire rejected snapshot, 48h expiry, unavailable API and failed refresh: no previous values in totals, comparison, records or hidden reminders
- East selected: not-covered explanation and working return-to-all action
- Capacity timestamp unknown; 0% and >100% values; long names and large volumes

### Repeated and interrupted interactions

- Expand/close comparison repeatedly, then refresh; confirm one chart click produces one focus move
- Block Chart.js: numeric comparison, detail buttons and all records remain usable; unblock/reload and retry
- Select north, activate a southern comparison/alert target: region changes before focus reaches the correct card
- Tab through controls, use Left/Right/Home/End on region filters, then Enter/Space on numeric and alert buttons
- Keep a comparison button, card or alert focused during refresh; confirm station focus is restored, or returns to refresh if its record disappears
- Repeated refresh while pending does not duplicate loads; failed refresh clears data and retry restores a valid snapshot without changing source timestamps
- Back/Forward and regular browser reload are not overridden by custom key handlers
- Enable reduced motion: no continuous water animation, animated chart values or smooth imperative scroll

### Live integration and performance

- Verify official API network responses and browser CORS separately from fixture-driven tests
- Confirm CDN failure does not block basic app initialization; no new backend or SDK was introduced
- Record actual supported browser performance diagnostics if available; do not invent scores

## Completion boundary

Source-level improvements and passing code checks may be delivered as a development branch. The visual and browser-specific quality gate remains open until these observations are recorded and any material findings are repaired. Aspirational Awwwards/Webby/FWA-level craftsmanship is a review bar, not an award claim or a completed result.
