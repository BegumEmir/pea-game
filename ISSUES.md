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

---

## 🔲 Open

### #8 — FlappyPea game loop uses `setInterval` at 16 ms instead of `requestAnimationFrame`
**File:** `components/FlappyPeaGame.tsx`
The physics loop runs on `setInterval(fn, 16)`, which does not align with the display's vsync and can drift or fire multiple times per frame on slower devices. Should be replaced with a `requestAnimationFrame` loop using `delta` time for frame-rate-independent physics.

### #9 — Unstable function references cause unnecessary child re-renders
**Files:** `hooks/usePea.ts`, `app/(tabs)/index.tsx`
Care actions (`giveWater`, `giveSun`, etc.) and wrapper callbacks are recreated on every render because they are plain functions, not wrapped in `useCallback`. Components like `ActionButton` and the game overlays receive new function references each render, defeating `React.memo` if it is ever added.

### #10 — Unused Expo template files still in the project
**Files:** `app/(tabs)/explore.tsx`, `components/hello-wave.tsx`, `components/external-link.tsx`, `components/parallax-scroll-view.tsx`, `components/themed-text.tsx`, `components/themed-view.tsx`, `components/ui/collapsible.tsx`, `components/ui/icon-symbol.tsx`, `components/ui/icon-symbol.ios.tsx`, `components/haptic-tab.tsx`
All of these are boilerplate from the Expo template. None are used by the game. They add noise, inflate bundle size, and confuse new contributors.

### #11 — "Explore" tab is live Expo template boilerplate
**File:** `app/(tabs)/explore.tsx`, `app/(tabs)/_layout.tsx`
The second tab shows the default Expo "Explore" screen with generic documentation text. Either replace it with a real game screen (stats history, shop, settings) or remove the tab entirely to avoid confusing users.

### #12 — Magic numbers for mood thresholds are scattered across the codebase
**Files:** `hooks/usePea.ts` (`calculateMood`), `hooks/usePea.ts` (`toggleSleep`, game result handlers)
Numbers like `30` (thirst/sun/soil threshold), `15` (energy → sleepy), `20` (fun → bored), `50` (energy high enough to refuse sleep), `8` (energy collapse after game) appear as bare literals with no named constant. If a threshold is tweaked, every occurrence must be found manually.

### #13 — `'playing'` mood has no dedicated sprite
**File:** `app/(tabs)/index.tsx` (`peaSprites`)
`playing` maps to `pea_happy.png`. During a game session Pea visually looks the same as when it is simply happy. Adding a dedicated playing sprite (or at least a distinct animated state) would make it clear the game is active.

### #14 — `saveCoins` effect runs on mount before coins are loaded
**File:** `hooks/usePea.ts`
The coins `useEffect` has no guard equivalent to `hasLoadedStats`. On startup it fires immediately with `coins = 0` and writes `PEA_COINS = "0"` to AsyncStorage before `initPea` has a chance to read the real value. In practice the load is fast enough that the write likely arrives second, but the race is real. The `hasLoadedStats` guard (or a dedicated `hasLoadedCoins` ref) should cover this effect too.
