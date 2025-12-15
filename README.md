# Pea • Virtual Pea Companion 🌱

**Pea** is a small virtual plant companion built with React Native & Expo.  
You take care of a cute pea by giving it water, sun and soil, letting it sleep, and playing mini–games together.  
Over time, Pea's stats change and its mood reacts to how well you care for it.

> This is a learning / hobby project to explore React Native, Expo and simple game mechanics.

---

## Features

### 🪴 Pea as a Tamagotchi-style companion

Pea has several stats:

- **Water**
- **Sun**
- **Soil**
- **Fun**
- **Energy**

Based on these stats, Pea's **mood** changes:

- `happy`
- `thirsty`
- `needsSun`
- `needsSoil`
- `sleepy`
- `bored`
- `playing`

The UI shows a different sprite for each mood (happy / thirsty / sleepy, etc.).

### ⏱ Time-based stat changes

- Every few seconds, **water / sun / soil / fun / energy slowly decrease**.
- If the app was closed for a while (e.g. more than X minutes), when you come back:
  - Some stats are reduced a bit,
  - Pea may be **sleeping** because it waited too long,
  - A custom message explains what happened.

### 😴 Sleep system

Pea can **sleep** for different reasons:

- **Manual sleep**: user sends Pea to sleep.
- **Tired from play**: mini-games consume energy; if it gets too low, Pea falls asleep.
- **Long away**: if the user doesn’t open the app for a while, Pea is sleeping when they return.

Sleep includes:

- A small **countdown** for short naps,
- Different messages depending on whether you wake Pea up early or let it rest fully.

### 🎮 Mini–games

There is a **Games** overlay with multiple mini–games that affect Pea's stats.

#### 1. Tap Game 💚

- You get **15 seconds** to tap as fast as you can.
- Every tap:
  - Increases **score**,
  - Optionally triggers a small “bounce” animation on Pea.
- When the timer ends:
  - Pea gains **Fun**,
  - Pea loses some **Energy**,
  - If Energy gets too low, Pea may fall asleep.

#### 2. Flappy Pea 🪽

- A Flappy Bird–style mini–game:
  - Tap to make Pea jump,
  - Pass through gaps between pipes,
  - Avoid hitting pipes or the ground.
- The game tracks:
  - **Current score** (how many pipes you pass),
  - **Best score (high score)** stored in `AsyncStorage`.
- Finishing the game:
  - Increases **Fun**,
  - Decreases **Energy**,
  - Shows a special message if you set a **new high score**.

#### 3. Reflex Game ⚡

- A reaction/attention mini–game:
  - Pea asks for something (e.g. one of a few options),
  - You must tap the correct option **before the time runs out**.
- Each round:
  - Gets slightly harder / faster,
  - Rewards Fun and costs a bit of Energy.

### ✨ Small polish

- Giving **water / sun / soil** shows **0.5 s emoji particles**:
  - 💧 for water
  - ☀️ for sun
  - 🌱 for soil
- Pea has a scale/bounce animation based on **Energy** and interactions.
- Background color changes depending on mood (sleepy / bored / sunny etc.).

### 🧪 Developer Panel (optional)

There is a small **Dev panel** that can be toggled:

- Shows **Water / Sun / Soil / Fun / Energy** numeric values.
- Toggled via a “Show / Hide dev panel” text button.
- Useful while tuning the game balance.

---

## Tech Stack

This project is built with:

- **React Native** (via Expo)
- **Expo** (managed workflow)
- **TypeScript**
- **expo-router** for navigation (`app/(tabs)/index.tsx`)
- **@react-native-async-storage/async-storage**
  - Stores:
    - Last visit timestamp (`PEA_LAST_VISIT`)
    - Flappy Pea high score (`PEA_FLAPPY_HIGHSCORE`)

---

## Project Structure (simplified)

```text
pea-game/
  app/
    (tabs)/
      index.tsx        # Main Pea screen (stats, mood, games overlay)
  components/
    TapGame.tsx        # 15-second tap mini-game
    FlappyPeaGame.tsx  # Flappy Bird style mini-game
    ReflexGame.tsx     # Reflex / reaction mini-game
  assets/
    pea/
      pea_happy.png
      pea_thirsty.png
      pea_needs_sun.png
      pea_needs_soil.png
      pea_sleepy.png
      pea_bored.png
  package.json
  README.md
```

## Getting Started

### 1. Requirements

- Node.js & npm (or Yarn)  
- **Expo CLI** (optional, you can also use `npx expo` directly)  
- A device/emulator:  
  - Expo Go app on **Android** or **iOS**, or  
  - Android Emulator / iOS Simulator  

### 2. Install dependencies

```bash
# clone the repo
git clone https://github.com/<your-username>/pea-game.git
cd pea-game

# install dependencies
npm install
# or
yarn
```

### 3. Run the app

```bash
# using npx
npx expo start

# or if you have a script
npm run start
```

Then:

- Scan the QR code with **Expo Go** on your phone **(same Wi-Fi)**, or  
- Press `a` to open Android emulator, `i` for iOS simulator (if available).

---

## How it works (high level)

- All Pea stats (`water`, `sun`, `soil`, `fun`, `energy`) live in the main screen (`index.tsx`) as React state managed via `useState`.  
- `useEffect` hooks:  
  - Decrease stats over time,  
  - Persist / load data from `AsyncStorage`,  
  - Detect “long away” and trigger a special sleep state.  
- Mini–games (`TapGame`, `FlappyPeaGame`, `ReflexGame`):  
  - Are rendered inside a **full-screen overlay**.  
  - Receive callbacks like `onFinished(score)` to send results back.  
  - The main screen updates Fun/Energy and mood based on the result.  
- Mood is derived from stats via a pure function:  
  - Low water → `thirsty`  
  - Low sun → `needsSun`  
  - Low soil → `needsSoil`  
  - Low energy → `sleepy`  
  - Low fun → `bored`  
  - Otherwise → `happy`  

---

## Roadmap / Ideas

Some ideas for future improvements:

- Add **Pea Coins** as a soft currency (earned via games, spent on cosmetics).  
- Simple **shop** for pots, hats or backgrounds.  
- More mini–games (memory, pattern taps, etc.).  
- Daily login streak rewards.  
- Cloud save / sync.
