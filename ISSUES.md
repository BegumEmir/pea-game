# Pea Game — Issue List

Prioritized list of bugs and architectural issues found during code review.
Status updated as fixes are committed.

---

## ✅ Fixed

### #1 — Stats not persisted across app restarts
**File:** `app/(tabs)/index.tsx` (now `hooks/usePea.ts`)
Three separate `useEffect` calls each loaded one key from AsyncStorage and used hardcoded initial values when applying the long-away penalty instead of the loaded values. On first install all three fired but on subsequent launches only `checkLastVisit` ran, so water/sun/soil/fun/energy always reset to defaults. Fixed by replacing the three effects with a single `initPea` using `AsyncStorage.multiGet` for all 8 keys, and applying the long-away penalty on top of the loaded values.

### #2 — Stale `handleWake` closure in sleep-countdown effect
**File:** `app/(tabs)/index.tsx` (now `hooks/usePea.ts`)
The sleep countdown `setInterval` captured `handleWake` at the time the effect first ran. If any sleep-related state changed before the auto-wake fired, the interval called the old, stale version of `handleWake`. Fixed with the stable-callback-via-ref pattern: `handleWakeRef.current = handleWake` in the render body; the interval calls `handleWakeRef.current(false)`.

### #3 — Side effects called inside state updaters in `ReflexGame`
**File:** `components/ReflexGame.tsx`
`setTimeLeftMs(prev => { clearInterval(...); handleTimeout(); return 0; })` and `setLives(prev => { setGameOver(true); setTimeout(...); return prev - 1; })` put side effects inside state updater functions. React may call updaters more than once (strict mode, concurrent mode). Fixed by adding `timeLeftMsRef` and `livesRef` as authoritative values; side effects moved to plain callback bodies.

### #4 — Stale `score` closure in `TapGame` time-up handler
**File:** `components/TapGame.tsx`
The `useEffect` countdown called `onFinished(score)` where `score` was the state value captured when the effect last ran — always 0 if the component hadn't re-rendered since. Fixed by adding `scoreRef`, incrementing it synchronously in `handleTap`, and calling `onFinished(scoreRef.current)` in both the time-up effect and `handleExit`.

### #5 — FlappyPea game loop restarts on every scored pipe
**File:** `components/FlappyPeaGame.tsx`
The main game-loop effect listed `flappyScore` in its dependency array. Each time a pipe was passed the score changed, React tore down the 16 ms interval and started a new one, causing a brief physics stutter on every point. Fixed by adding `flappyScoreRef`; the score comparison and increment happen via the ref so `flappyScore` is removed from the deps.

### #6 — God component: `index.tsx` was 1 265 lines
**File:** `app/(tabs)/index.tsx`
The root screen contained all Pea state, every `useEffect`, all game-result handlers, animation, particles, overlay JSX, sub-components, and styles in one file. Extracted all Pea logic into `hooks/usePea.ts`; `index.tsx` is now ~320 lines of purely visual/overlay code.

### #7 — Decay interval restarted on every stat change
**File:** `hooks/usePea.ts`
The stat-decay `useEffect` listed `[water, sun, soil, fun, energy, isSleeping, isGameOpen]` as deps. Every decay tick changed all five stats, immediately tearing down and recreating the 5-second interval — resetting the timer to zero on every cycle, and also on every care action. Fixed by adding `statsRef`, `isSleepingRef`, and `isGameOpenRef` (synced in the render body); interval deps changed to `[]` so it runs once for the component lifetime.

### #8 — FlappyPea game loop uses `setInterval` at 16 ms instead of `requestAnimationFrame`
**File:** `components/FlappyPeaGame.tsx`
Already replaced with a `requestAnimationFrame` loop (delta-time, vsync-aligned, `deps=[]`) in commit `bf37fa0`. ISSUES.md was written after that commit and incorrectly listed this as open.

### #9 — Unstable function references cause unnecessary child re-renders
**Files:** `hooks/usePea.ts`, `app/(tabs)/index.tsx`
`experiments.reactCompiler: true` is set in `app.json`. The React Compiler automatically memoizes all components and callbacks — manually adding `useCallback` would be redundant and could interfere with compiler output. No action needed.

### #10 — Unused Expo template files still in the project
**Files:** `app/(tabs)/explore.tsx`, `components/hello-wave.tsx`, `components/external-link.tsx`, `components/parallax-scroll-view.tsx`, `components/themed-text.tsx`, `components/themed-view.tsx`, `components/ui/collapsible.tsx`, `components/ui/icon-symbol.tsx`, `components/ui/icon-symbol.ios.tsx`, `components/haptic-tab.tsx`, `constants/theme.ts`, `hooks/use-theme-color.ts`
All deleted from disk (unstaged). Awaiting commit.

### #11 — "Explore" tab is live Expo template boilerplate
**File:** `app/(tabs)/explore.tsx`, `app/(tabs)/_layout.tsx`
`explore.tsx` deleted; `_layout.tsx` updated to single `<Tabs.Screen name="index" />` with tab bar hidden. Awaiting commit.

### #12 — Magic numbers for mood thresholds are scattered across the codebase
**File:** `hooks/usePea.ts`
All thresholds already extracted as named constants during the #6 refactor: `LOW_WATER_THRESHOLD`, `LOW_SUN_THRESHOLD`, `LOW_SOIL_THRESHOLD`, `LOW_ENERGY_THRESHOLD`, `LOW_FUN_THRESHOLD`, `ENERGY_REFUSE_SLEEP`, `ENERGY_COLLAPSE`. No action needed.

### #14 — `saveCoins` effect runs on mount before coins are loaded
**File:** `hooks/usePea.ts`
Fixed by moving `hasLoadedStats.current = true` to before the state-setter calls inside `initPea`, ensuring any React re-render triggered by those setters sees the flag as `true` and the `saveCoins`/`saveStats` effects don't skip saving the loaded values.

---

## 🔲 Open

### #13 — `'playing'` mood has no dedicated sprite
**File:** `app/(tabs)/index.tsx` (`peaSprites`)
`playing` maps to `pea_happy.png`. During a game session Pea visually looks the same as when it is simply happy. Requires a new `assets/pea/pea_playing.png` sprite file, then a one-line update to the `peaSprites` map.
