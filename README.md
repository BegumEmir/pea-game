<div align="center">

# 🌿 Pea Game

**[Türkçe](#-türkçe)** &nbsp;|&nbsp; **[English](#-english)**

Sanal bezelyeni büyüt, besle, oynasın ve her gün ona bak!  
*A virtual pet tamagotchi built with React Native & Expo.*

<br/>

[![Platform](https://img.shields.io/badge/platform-iOS%20%7C%20Android-brightgreen?style=flat-square)](https://expo.dev/)
[![Expo SDK](https://img.shields.io/badge/Expo-SDK%2053-000000?style=flat-square&logo=expo)](https://expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![React Native](https://img.shields.io/badge/React%20Native-0.79-61dafb?style=flat-square&logo=react)](https://reactnative.dev/)
[![License](https://img.shields.io/badge/license-MIT-brightgreen?style=flat-square)](./LICENSE)

</div>

---

## 📸 Ekran Görüntüleri / Screenshots

<p align="center">
  <em>Yakında eklenecek &nbsp;/&nbsp; Coming soon</em>
</p>

<!--
<p align="center">
  <img src="./assets/screenshots/home.png"         width="19%" alt="Ana ekran" />
  <img src="./assets/screenshots/games.png"        width="19%" alt="Oyun menüsü" />
  <img src="./assets/screenshots/shop.png"         width="19%" alt="Dükkan" />
  <img src="./assets/screenshots/quests.png"       width="19%" alt="Görevler" />
  <img src="./assets/screenshots/achievements.png" width="19%" alt="Rozetler" />
</p>
-->

---

## 🇹🇷 Türkçe

### 📖 Proje Hakkında

**Pea Game**, küçük bir bezelyenin sahibi olduğun sevimli bir Tamagotchi uygulamasıdır.  
Bezelyeni her gün sula, güneşe çıkar, toprak ver ve birlikte mini oyunlar oyna. İhmal edersen susar, sıkılır ya da uykuya dalar — ama iyi bakılırsa seviyesi yükselir, aksesuarlar kazanır ve arkadaşlarınla paylaşabileceğin özel bir kart oluşturur.

### ✨ Özellikler

#### 🥚 Temel Bakım
- **5 İstatistik:** Su 💧, Güneş ☀️, Toprak 🌱, Eğlence 🎮, Enerji ⚡
- **7 Ruh Hali:** Mutlu, Susuz, Güneş İstiyor, Toprak İstiyor, Uykulu, Oynuyor, Sıkılmış
- İstatistikler zamanla azalır; üst düzey bakım enerjinin yenilenmesini sağlar
- İsim özelleştirme — bezelyene istediğin ismi ver ✏️

#### 😴 Uyku Sistemi
- **Manuel uyutma** — istediğinde uyut, uyandır
- **Yorgunluktan uyuma** — oyun sonrası enerji çok düşünce otomatik uyur, 2 dk sonra kalkar
- **Uzun ayrılık uykusu** — uygulamayı 30+ dakika açmadıysan Pea uyumuştur
- **Çevrimdışı enerji hesaplama** — uygulama kapalıyken uyuyan Pea enerji kazanmaya devam eder (5 saniye = 1 enerji)

#### 🎮 Mini Oyunlar

| Oyun | Süre | Açıklama |
|------|------|----------|
| Böcek Yakala 🪰 | 30 sn | Uçan böceklere dokun; arı 3 puan ama hızlı! |
| Hafıza Oyunu 🃏 | Süresiz | 4×4 kartları çevir, eşleşen çiftleri bul |
| Flappy Pea 🪽 | Süresiz | Boruların arasından geç; skor arttıkça güçleşir |
| Coin Yağmuru 💰 | 30 sn | Sol/sağ dok, coin topla, kaktüslerden kaçın |
| Bahçe Bakımı 🌿 | 45 sn | 6 bitkiyi basılı tutarak sula, solar |

#### 🛒 Dükkan
**Güçlendirmeler**
- 🌟 XP Boost — 5 dk boyunca 2× XP
- 💊 Güç Vitamini — tüm statlar +20
- 💧 Otomatik Su — 10 dk otomatik dolar
- ⚡ Enerji İçeceği — anında +30 enerji
- 🍀 Şanslı Kutu — rastgele coin veya XP Boost

**Yiyecekler** (tek kullanımlık stat dolumu)
- Özel Su, Güneş Kremi, Süper Gübre, Eğlence Paketi

**Kalıcı Aksesuarlar**
- 🎩 Silindir Şapka · 🌈 Gökkuşağı Aura · ⭐ Altın Çerçeve

#### 📋 Günlük Görevler
- Her gece yarısı 3 yeni görev oluşur (havuzdan rastgele seçilir)
- Tamamlandığında otomatik coin + XP ödülü
- Gece yarısına kalan süre gösterilir

#### 🏅 Rozetler (Başarımlar)

| Rozet | Koşul |
|-------|-------|
| 🌱 İlk Adım | İlk oyunu oyna |
| 🔥 Ateşli | 7 günlük seri |
| 👑 Kral | Seviye 5'e ulaş |
| 💰 Zengin | 500 coin kazan |
| 🎮 Oyun Tutkunu | 50 oyun oyna |
| 🌿 Bahçıvan | Bahçe oyununu 10 kez oyna |
| ⚡ Hızlı | Böcek oyununda 20+ puan |
| 🏆 Şampiyon | Diğer tüm rozetleri kazan |

#### 📊 Diğer
- **Seviye & XP sistemi** — seviye atladıkça 👑 taç ve ✨ kıvılcımlar belirir
- **Günlük seri** — 3 / 7 / 14 / 30 günlük ziyarette bonus coin ödülü
- **İstatistik ekranı** — tüm zamanların oyunları, bakım sayıları, seriler
- **Pea Kartı** — bezelyenin profil kartını kamera rulonla paylaş 📸
- **Push bildirimleri** — Pea su, güneş veya oyuna ihtiyaç duyduğunda uyarır
- **Dokunsal geri bildirim** — her bakım aksiyonunda hafif titreşim

---

## 🇬🇧 English

### 📖 About

**Pea Game** is a Tamagotchi-style virtual pet app where you raise a little pea 🌿.  
Water it, give it sunshine and soil, let it sleep, and play mini-games together every day. Neglect it and it gets thirsty, bored, or falls asleep — care for it well and it levels up, earns accessories, and generates a shareable profile card.

### ✨ Features

#### 🥚 Core Care
- **5 Stats:** Water 💧, Sun ☀️, Soil 🌱, Fun 🎮, Energy ⚡
- **7 Moods:** Happy, Thirsty, Needs Sun, Needs Soil, Sleepy, Playing, Bored
- Stats decay over time; high-care conditions slowly regenerate energy
- Name customisation — give your pea any name ✏️

#### 😴 Sleep System
- **Manual sleep** — put Pea to sleep and wake it when ready
- **Tired-from-play** — energy collapses after a game; Pea auto-wakes after 2 min
- **Long-away sleep** — Pea dozes off if the app hasn't been opened in 30+ min
- **Offline energy calc** — sleeping Pea keeps gaining energy while the app is closed (1 energy per 5 seconds of elapsed time)

#### 🎮 Mini-Games

| Game | Duration | Description |
|------|----------|-------------|
| Bug Catch 🪰 | 30 s | Tap flying bugs; bees are 3 pts but fast |
| Memory Game 🃏 | Untimed | Flip 4×4 cards and find matching pairs |
| Flappy Pea 🪽 | Untimed | Navigate pipes; gap shrinks and speed rises with score |
| Coin Rain 💰 | 30 s | Tap left/right, collect coins, dodge cacti |
| Garden Care 🌿 | 45 s | Hold-press to water 6 plants before they wilt |

#### 🛒 Shop
**Boosts** — XP Boost (2× for 5 min), Stat Boost (all +20), Auto-Water (10 min), Energy Drink (+30 energy), Lucky Box (random coin or XP Boost)

**Food** (single-use stat refills) — Water pack, Sun cream, Fertiliser, Fun pack

**Permanent Accessories** — 🎩 Top Hat · 🌈 Rainbow Aura · ⭐ Gold Frame

#### 📋 Daily Quests
- 3 fresh quests generated each midnight from a randomised pool
- Automatically grants coin + XP rewards on completion
- Progress persists across app restarts

#### 🏅 Badges (Achievements)
8 unlockable badges — First Step, Hot Streak, King, Rich, Gamer, Gardener, Speedy, Champion — with unlock date tracking.

#### 📊 More
- **XP & Level system** — level up to earn a floating 👑 crown and ✨ sparkles
- **Streak system** — bonus coins at 3 / 7 / 14 / 30-day milestones
- **Stats screen** — lifetime totals, game high scores, care action counts
- **Pea Card** — capture and share a styled profile card 📸
- **Push notifications** — alerts when Pea needs water, sun, or play time
- **Haptic feedback** — light impact on every care action

---

## 🛠 Tech Stack

| Category | Technology |
|----------|-----------|
| Framework | [React Native 0.79](https://reactnative.dev/) + [Expo SDK 53](https://expo.dev/) (Managed Workflow) |
| Language | [TypeScript 5](https://www.typescriptlang.org/) |
| Navigation | [Expo Router v4](https://expo.github.io/router/) — file-based routing |
| Persistence | [@react-native-async-storage/async-storage](https://github.com/react-native-async-storage/async-storage) |
| Animations | React Native `Animated` API (native driver) |
| Gradients | [expo-linear-gradient](https://docs.expo.dev/versions/latest/sdk/linear-gradient/) |
| Haptics | [expo-haptics](https://docs.expo.dev/versions/latest/sdk/haptics/) |
| Notifications | [expo-notifications](https://docs.expo.dev/versions/latest/sdk/notifications/) |
| Screenshot / Share | [react-native-view-shot](https://github.com/gre/react-native-view-shot) + [expo-sharing](https://docs.expo.dev/versions/latest/sdk/sharing/) |
| Safe Area | [react-native-safe-area-context](https://github.com/th3rdwave/react-native-safe-area-context) |
| Architecture | React New Architecture + React Compiler (both enabled) |

---

## 🚀 Running Locally

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Expo Go](https://expo.dev/client) on your iOS or Android device

### Setup

```bash
# 1. Clone
git clone https://github.com/BegumEmir/pea-game.git
cd pea-game

# 2. Install dependencies
npm install

# 3. Start dev server
npm start
```

### Platform shortcuts

```bash
npm start          # Start Expo dev server — scan QR with Expo Go
npm run android    # Open on Android emulator
npm run ios        # Open on iOS simulator (macOS only)
npm run web        # Open in browser
npm run lint       # Run ESLint
```

> **Note:** Push notifications and haptic feedback require a **physical device** — they are no-ops in simulators.

---

## 📁 Project Structure

```
pea-game/
├── app/
│   ├── _layout.tsx              # Root navigator (expo-router Stack)
│   └── (tabs)/
│       └── index.tsx            # Main screen — UI, overlays, state wiring
│
├── hooks/
│   ├── usePea.ts                # Core state machine: stats, mood, sleep, XP, coins
│   ├── useQuests.ts             # Daily quest pool, progress tracking, persistence
│   ├── useAchievements.ts       # Badge unlock conditions & AsyncStorage sync
│   ├── useStats.ts              # Lifetime statistics (async writers + read hook)
│   └── useNotifications.ts      # Permission request & notification scheduling
│
├── components/
│   ├── FlappyPeaGame.tsx        # Flappy Bird-style game (physics loop via setInterval)
│   ├── BugGame.tsx              # Tap-the-bug game
│   ├── MemoryGame.tsx           # Card-matching game
│   ├── CoinGame.tsx             # Coin-rain dodge game
│   ├── GardenGame.tsx           # Hold-to-water garden game
│   ├── ShopScreen.tsx           # Tabbed shop (boosts / food / accessories)
│   ├── StatsScreen.tsx          # Lifetime stats display
│   ├── QuestsScreen.tsx         # Daily quests list with progress bars
│   ├── AchievementsScreen.tsx   # Badge collection grid
│   ├── PeaCard.tsx              # Shareable profile card component
│   └── NameInputScreen.tsx      # First-launch name picker
│
└── assets/
    ├── pea/                     # Pea sprite PNGs — one per mood state
    └── images/                  # App icon, splash screen, adaptive icon layers
```

### Key Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **Single state owner** | All Pea stats live in `usePea.ts`; `index.tsx` owns UI overlay state. No global store or Context needed. |
| **Ref-mirrored intervals** | The 5-second decay loop reads mutable refs instead of closing over state, so the interval is created once and never restarted. |
| **Offline sleep energy** | `PEA_SLEEP_START` is persisted; on reopen `Math.floor(elapsedMs / 5000)` ticks are applied via a functional `setEnergy` updater to guarantee correct React 18 batching order. |
| **Single streak source of truth** | `PEA_STREAK_COUNT` is the only streak counter (written by `usePea`). `useStats` reads it directly — eliminates the dual-counter divergence bug. |
| **Mood as pure function** | `calculateMood(water, sun, soil, fun, energy)` is side-effect-free and called whenever stats change, making mood deterministic and testable. |

---

## 🗂 AsyncStorage Keys

| Key | Value | Description |
|-----|-------|-------------|
| `PEA_NAME` | string | Pet name |
| `PEA_WATER` … `PEA_ENERGY` | 0–100 | Live stat values |
| `PEA_COINS` | number | Coin balance |
| `PEA_XP` | number | Cumulative XP |
| `PEA_SLEEP_REASON` | `'manual'` | Present only while manually sleeping |
| `PEA_SLEEP_START` | ms timestamp | Sleep start — used for offline energy calc |
| `PEA_LAST_VISIT` | ms timestamp | Detects long-away (> 30 min) |
| `PEA_STREAK_COUNT` | number | Current daily login streak |
| `PEA_STREAK_DATE` | `YYYY-MM-DD` | Date streak was last incremented |
| `PEA_FLAPPY_HIGHSCORE` | number | Flappy Pea personal best |
| `PEA_ACCESSORIES` | JSON array | Owned accessory IDs |
| `PEA_XP_BOOST_EXPIRY` | ms timestamp | Active XP boost expiry (0 = none) |
| `PEA_AUTO_WATER_EXPIRY` | ms timestamp | Active auto-water expiry (0 = none) |
| `STATS_*` | various | Lifetime stats (games played, high scores, care counts, coins, XP) |
| `ACHIEVEMENTS_UNLOCKED` | JSON object | `{ badgeId: isoDateString }` |
| `PEA_QUESTS` / `PEA_QUESTS_DATE` | JSON / ISO date | Today's quest list |

---

## 👩‍💻 Developer

<div align="center">

**Begüm Emir**

[![GitHub](https://img.shields.io/badge/GitHub-BegumEmir-181717?style=flat-square&logo=github)](https://github.com/BegumEmir)

*Built with 💚 using React Native & Expo*

</div>

---

<div align="center">
  <sub>Made with love for Pea 🌿</sub>
</div>
