# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start           # Start Expo dev server (scan QR with Expo Go, or press a/i for emulator)
npm run android     # Launch on Android emulator
npm run ios         # Launch on iOS simulator
npm run web         # Launch in browser
npm run lint        # Run ESLint (expo lint)
```

There are no tests. There is no build step — Expo handles bundling.

## Architecture

**Pea** is a single-screen Tamagotchi-style React Native app (Expo managed workflow, TypeScript, expo-router).

### State lives entirely in one file

`app/(tabs)/index.tsx` is the entire app. It holds all Pea's stats (`water`, `sun`, `soil`, `fun`, `energy`), mood, sleep state, game overlay state, and coins as `useState`. There is no global store or context.

Mood is derived from stats via `calculateMood()` — a pure function checked whenever stats change. Background color and sprite also derive from mood/stats.

### Mini-games as overlay components

Games (`TapGame`, `FlappyPeaGame`, `ReflexGame`) are rendered in a full-screen overlay inside `index.tsx`. They receive callbacks:
- `onFinished(score)` → parent updates Fun/Energy/Coins and mood
- `onClose()` → parent hides the overlay

The game overlay dims the main Pea view (`opacity: 0.15`) while open. Stat decay and sleep timers are paused while `isGameOpen` is true.

### Sleep system

Three sleep reasons (`tiredFromPlay`, `manual`, `longAway`) each have different wake-up behavior in `handleWake()`. Sleep duration differs: manual = 5 s, tired = 20 s, longAway = indefinite (user must tap).

### Persistence (AsyncStorage keys)

| Key | Value |
|-----|-------|
| `PEA_LAST_VISIT` | Timestamp (ms) — used to detect "long away" (> 30 min) |
| `PEA_FLAPPY_HIGHSCORE` | Number |
| `PEA_COINS` | Number |

Stats themselves are **not persisted** — they reset on app restart.

### Assets

Pea sprites live in `assets/pea/` and are imported statically in `peaSprites` map at the top of `index.tsx`. The `playing` mood reuses the `happy` sprite. Adding a new mood requires a new sprite file + entry in that map.

### Navigation

`app/_layout.tsx` sets up a Stack navigator with `(tabs)` as the anchor. The `(tabs)` folder currently has only `index.tsx` (the main screen) and `modal.tsx` is unused.

### UI language

All user-facing text and comments are in Turkish.

### Notable config

- `newArchEnabled: true` (React Native New Architecture)
- `experiments.reactCompiler: true` (React Compiler)
- Portrait-only orientation
