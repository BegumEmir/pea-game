import { useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { schedulePeaNotification } from './useNotifications';
import { initStats, addTotalCoins, addTotalXP, recordGamePlayed, recordCareAction } from './useStats';

// ── Types ────────────────────────────────────────────────────────────────────

export type Mood =
  | 'happy'
  | 'thirsty'
  | 'needsSun'
  | 'needsSoil'
  | 'sleepy'
  | 'playing'
  | 'bored';

export type SleepReason = 'none' | 'tiredFromPlay' | 'manual' | 'longAway';
export type AccessoryId = 'hat' | 'rainbowAura' | 'goldFrame';

// ── Constants ────────────────────────────────────────────────────────────────

const INITIAL_WATER  = 60;
const INITIAL_SUN    = 60;
const INITIAL_SOIL   = 60;
const INITIAL_FUN    = 50;
const INITIAL_ENERGY = 80;

// ── Shop constants ────────────────────────────────────────────────────────────

export const XP_BOOST_COST          = 50;
export const STAT_BOOST_COST        = 30;
export const AUTO_WATER_COST        = 40;
export const XP_BOOST_DURATION_MS   = 5  * 60 * 1000; // 5 min
export const AUTO_WATER_DURATION_MS = 10 * 60 * 1000; // 10 min
export const ENERGY_DRINK_COST  = 25;
export const LUCKY_BOX_COST     = 20;
export const FOOD_WATER_COST    = 15;
export const FOOD_SUN_COST      = 15;
export const FOOD_SOIL_COST     = 15;
export const FOOD_FUN_COST      = 20;
export const HAT_COST           = 100;
export const RAINBOW_AURA_COST  = 150;
export const GOLD_FRAME_COST    = 120;

// ── XP / Level helpers ────────────────────────────────────────────────────────

// Cumulative XP required to reach each level (index = level - 1)
const XP_THRESHOLDS = [0, 100, 250, 500, 1000];
const XP_PER_EXTRA_LEVEL = 750; // each level beyond 5

export function thresholdForLevel(level: number): number {
  if (level <= 1) return 0;
  const idx = level - 1;
  if (idx < XP_THRESHOLDS.length) return XP_THRESHOLDS[idx];
  return XP_THRESHOLDS[XP_THRESHOLDS.length - 1] +
    (idx - (XP_THRESHOLDS.length - 1)) * XP_PER_EXTRA_LEVEL;
}

export function levelFromXP(xp: number): number {
  let lv = 1;
  while (thresholdForLevel(lv + 1) <= xp) lv++;
  return lv;
}

function xpProgressInLevel(xp: number): { current: number; needed: number } {
  const lv    = levelFromXP(xp);
  const start = thresholdForLevel(lv);
  const end   = thresholdForLevel(lv + 1);
  return { current: xp - start, needed: end - start };
}

const LONG_AWAY_MINUTES = 30;

// tiredFromPlay auto-wake duration (manual sleep is indefinite — no auto-wake)
export const TIRED_SLEEP_MS = 2 * 60 * 1000; // 2 min

// Mood thresholds used in calculateMood and care logic
const LOW_WATER_THRESHOLD  = 30;
const LOW_SUN_THRESHOLD    = 30;
const LOW_SOIL_THRESHOLD   = 30;
const LOW_ENERGY_THRESHOLD = 15;
const LOW_FUN_THRESHOLD    = 20;
export const ENERGY_REFUSE_SLEEP  = 50; // Energy level above which manual sleep is refused
const ENERGY_COLLAPSE      = 8;  // Energy level below which Pea falls asleep after a game

// ── Pure helpers ─────────────────────────────────────────────────────────────

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}

function formatSleepDuration(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  if (totalSecs < 60) return `${totalSecs} saniye`;
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  if (secs === 0) return `${mins} dakika`;
  return `${mins} dakika ${secs} saniye`;
}

// Energy gained for manual sleep, keyed by duration tier
// Tiers: <1 min, 1–3 min, 3–10 min, >10 min
const MANUAL_SLEEP_TIERS = [
  { maxMs: 60_000,         energyGain: 3,  funChange:  0 },
  { maxMs: 3  * 60_000,    energyGain: 8,  funChange:  0 },
  { maxMs: 10 * 60_000,    energyGain: 12, funChange:  0 },
  { maxMs: Infinity,       energyGain: 15, funChange: -8 },
] as const;

export function calculateMood(
  water: number,
  sun: number,
  soil: number,
  fun: number,
  energy: number,
): Mood {
  if (water < LOW_WATER_THRESHOLD)  return 'thirsty';
  if (sun < LOW_SUN_THRESHOLD)      return 'needsSun';
  if (soil < LOW_SOIL_THRESHOLD)    return 'needsSoil';
  if (energy < LOW_ENERGY_THRESHOLD) return 'sleepy';
  if (fun < LOW_FUN_THRESHOLD)      return 'bored';
  return 'happy';
}

// ── Streak helpers ────────────────────────────────────────────────────────────

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isYesterday(dateStr: string, today: Date): boolean {
  const yest = new Date(today);
  yest.setDate(yest.getDate() - 1);
  return dateStr === toDateString(yest);
}

const STREAK_MILESTONES: Record<number, number> = { 3: 30, 7: 100, 14: 250, 30: 500 };

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Owns all Pea state: stats, mood, sleep, coins, persistence.
 *
 * @param isGameOpen - passed from the component so stat decay pauses during games
 */
export function usePea(isGameOpen: boolean) {
  // ── State ──────────────────────────────────────────────────────────────────

  const [water,  setWater]  = useState(INITIAL_WATER);
  const [sun,    setSun]    = useState(INITIAL_SUN);
  const [soil,   setSoil]   = useState(INITIAL_SOIL);
  const [fun,    setFun]    = useState(INITIAL_FUN);
  const [energy, setEnergy] = useState(INITIAL_ENERGY);

  const [mood, setMood] = useState<Mood>(() =>
    calculateMood(INITIAL_WATER, INITIAL_SUN, INITIAL_SOIL, INITIAL_FUN, INITIAL_ENERGY)
  );

  const [isSleeping,    setIsSleeping]    = useState(false);
  const [sleepReason,   setSleepReason]   = useState<SleepReason>('none');
  const [sleepStartTime, setSleepStartTime] = useState<number | null>(null);
  const [wasLongAway,   setWasLongAway]   = useState(false);
  const [sleepNow,      setSleepNow]      = useState(Date.now());

  const [customMessage, setCustomMessage] = useState<string | null>(null);
  const [coins,         setCoins]         = useState(0);
  const [flappyHighScore, setFlappyHighScore] = useState(0);
  const [xp,              setXP]              = useState(0);
  const [levelUpInfo,     setLevelUpInfo]     = useState<{ newLevel: number } | null>(null);
  const [xpBoostExpiry,   setXpBoostExpiry]   = useState(0);
  const [autoWaterExpiry, setAutoWaterExpiry] = useState(0);
  const [accessories,     setAccessories]     = useState<AccessoryId[]>([]);
  const [streak,          setStreak]          = useState(0);
  const [streakMilestone, setStreakMilestone] = useState<number | null>(null);

  // ── Refs ───────────────────────────────────────────────────────────────────

  const hasLoadedStats  = useRef(false);
  const handleWakeRef   = useRef<(early: boolean) => void>(null!);
  // Mirrors of state values read inside the decay interval — avoids restarting the timer on every tick
  const statsRef        = useRef({ water, sun, soil, fun, energy });
  const isSleepingRef   = useRef(isSleeping);
  const sleepReasonRef  = useRef(sleepReason);
  const isGameOpenRef   = useRef(isGameOpen);
  const xpRef               = useRef(0);
  const xpBoostExpiryRef   = useRef(0);
  const autoWaterExpiryRef = useRef(0);
  // Previous stat values — used to detect threshold crossings for notifications
  const prevStatsRef = useRef({ water: INITIAL_WATER, sun: INITIAL_SUN, soil: INITIAL_SOIL, fun: INITIAL_FUN, energy: INITIAL_ENERGY });

  // ── Private helpers ────────────────────────────────────────────────────────

  const updateMood = (w: number, s: number, so: number, f: number, e: number) => {
    setMood(calculateMood(w, s, so, f, e));
    setCustomMessage(null);
  };

  // ── handleWake ─────────────────────────────────────────────────────────────

  const handleWake = (early: boolean) => {
    if (!isSleeping || !sleepStartTime) return;

    const now     = Date.now();
    const elapsed = now - sleepStartTime;

    if (sleepReason === 'tiredFromPlay') {
      const newEnergy = clamp(energy + 25);
      const newWater  = clamp(water  + 5);
      setEnergy(newEnergy);
      setWater(newWater);
      setIsSleeping(false);
      setSleepReason('none');
      setSleepStartTime(null);
      setCustomMessage(null);
      updateMood(newWater, sun, soil, fun, newEnergy);
      if (!early) schedulePeaNotification('Pea uyandı! 🌿', 'Pea dinlendi ve seni bekliyor!');
      return;
    }

    if (sleepReason === 'manual') {
      if (!early) return; // auto-wake must never fire for manual sleep
      const tier  = MANUAL_SLEEP_TIERS.find(t => elapsed < t.maxMs) ?? MANUAL_SLEEP_TIERS[MANUAL_SLEEP_TIERS.length - 1];
      const durStr = formatSleepDuration(elapsed);
      const newEnergy = clamp(energy + tier.energyGain);
      const newFun    = tier.funChange !== 0 ? clamp(fun + tier.funChange) : fun;
      const newWater  = clamp(water + 5);

      let msg: string;
      if (elapsed < 60_000) {
        msg = `${durStr} uyudu, hâlâ yorgun görünüyor 😴`;
      } else if (elapsed < 3 * 60_000) {
        msg = `Kısa bir şekerleme yaptı (${durStr}) 😊`;
      } else if (elapsed < 10 * 60_000) {
        msg = `İyi uyudu (${durStr}), kendini iyi hissediyor! 🌟`;
      } else {
        msg = `Çok uzun uyudu (${durStr}), biraz sersem 😵`;
      }

      setEnergy(newEnergy);
      setWater(newWater);
      if (tier.funChange !== 0) setFun(newFun);
      setIsSleeping(false);
      setSleepReason('none');
      setSleepStartTime(null);
      setCustomMessage(msg);
      setMood(calculateMood(newWater, sun, soil, newFun, newEnergy));
      schedulePeaNotification('Pea uyandı! 🌿', 'Pea dinlendi ve seni bekliyor!');
      return;
    }

    if (sleepReason === 'longAway') {
      const newEnergy = clamp(energy + 30);
      const newWater  = clamp(water  + 5);
      setEnergy(newEnergy);
      setWater(newWater);
      setFun(10);
      setIsSleeping(false);
      setSleepReason('none');
      setSleepStartTime(null);
      setWasLongAway(false);
      setMood('bored');
      setCustomMessage('Sen yokken çok bekledim… Biraz canım sıkıldı. Oyun oynasak mı? 🎮');
      schedulePeaNotification('Pea uyandı! 🌿', 'Pea seni çok özledi, gel bakım yapalım!');
      return;
    }

  };

  // Keep refs in sync on every render so interval callbacks never use stale values
  handleWakeRef.current      = handleWake;
  statsRef.current           = { water, sun, soil, fun, energy };
  isSleepingRef.current      = isSleeping;
  sleepReasonRef.current     = sleepReason;
  isGameOpenRef.current      = isGameOpen;
  xpBoostExpiryRef.current   = xpBoostExpiry;
  autoWaterExpiryRef.current = autoWaterExpiry;

  // ── Effects ────────────────────────────────────────────────────────────────

  // Load all persisted data on mount
  useEffect(() => {
    const initPea = async () => {
      try {
        const entries = await AsyncStorage.multiGet([
          'PEA_WATER', 'PEA_SUN', 'PEA_SOIL', 'PEA_FUN', 'PEA_ENERGY',
          'PEA_LAST_VISIT', 'PEA_COINS', 'PEA_FLAPPY_HIGHSCORE', 'PEA_XP',
          'PEA_XP_BOOST_EXPIRY', 'PEA_AUTO_WATER_EXPIRY',
          'PEA_SLEEP_REASON', 'PEA_SLEEP_START',
          'PEA_ACCESSORIES',
          'PEA_STREAK_COUNT', 'PEA_STREAK_DATE',
        ]);
        const stored = Object.fromEntries(entries.map(([k, v]) => [k, v]));

        let w  = stored['PEA_WATER']  != null ? Number(stored['PEA_WATER'])  : INITIAL_WATER;
        let s  = stored['PEA_SUN']    != null ? Number(stored['PEA_SUN'])    : INITIAL_SUN;
        let so = stored['PEA_SOIL']   != null ? Number(stored['PEA_SOIL'])   : INITIAL_SOIL;
        let f  = stored['PEA_FUN']    != null ? Number(stored['PEA_FUN'])    : INITIAL_FUN;
        let e  = stored['PEA_ENERGY'] != null ? Number(stored['PEA_ENERGY']) : INITIAL_ENERGY;

        const now = Date.now();
        let longAway = false;
        let offlineSleepMessage: string | null = null;

        const savedSleepReason = stored['PEA_SLEEP_REASON'];
        const savedSleepStart  = stored['PEA_SLEEP_START'];
        const wasManualSleep   = savedSleepReason === 'manual' && !!savedSleepStart;
        let   restoredSleepStart = 0;

        let offlineEnergyGain = 0;
        if (wasManualSleep) {
          restoredSleepStart   = parseInt(savedSleepStart!, 10);
          const offlineMs      = now - restoredSleepStart;
          offlineEnergyGain    = Math.floor(offlineMs / 5000);

          const elapsedSecs = Math.floor(offlineMs / 1000);
          const durStr = elapsedSecs < 60
            ? `${elapsedSecs} saniye`
            : `${Math.floor(elapsedSecs / 60)} dakika`;
          const displayGain = Math.min(100 - e, offlineEnergyGain);
          if (displayGain > 0) {
            offlineSleepMessage = `${durStr} uyudu, +${displayGain} enerji kazandı! 😴`;
          }
        } else if (stored['PEA_LAST_VISIT']) {
          const diffMinutes = (now - parseInt(stored['PEA_LAST_VISIT'], 10)) / 60000;
          if (diffMinutes > LONG_AWAY_MINUTES) {
            longAway = true;
            e  = 15;
            w  = clamp(w  - 10);
            s  = clamp(s  - 10);
            so = clamp(so - 5);
          }
        }

        setWater(w); setSun(s); setSoil(so); setFun(f); setEnergy(e);

        if (wasManualSleep) {
          setIsSleeping(true);
          setSleepReason('manual');
          setSleepStartTime(restoredSleepStart);
          setSleepNow(now);
          setMood('sleepy');
          if (offlineSleepMessage) setCustomMessage(offlineSleepMessage);
          if (offlineEnergyGain > 0) setEnergy(prev => Math.min(100, prev + offlineEnergyGain));
        } else if (longAway) {
          setIsSleeping(true);
          setSleepReason('longAway');
          setSleepStartTime(now);
          setSleepNow(now);
          setWasLongAway(true);
          setMood('sleepy');
        } else {
          setMood(calculateMood(w, s, so, f, e));
        }

        if (stored['PEA_COINS'] != null)       setCoins(Number(stored['PEA_COINS']));
        if (stored['PEA_FLAPPY_HIGHSCORE'])     setFlappyHighScore(Number(stored['PEA_FLAPPY_HIGHSCORE']));
        if (stored['PEA_XP'] != null) {
          const storedXP = Number(stored['PEA_XP']);
          setXP(storedXP);
          xpRef.current = storedXP;
        }
        if (stored['PEA_XP_BOOST_EXPIRY'] != null) {
          const v = Number(stored['PEA_XP_BOOST_EXPIRY']);
          setXpBoostExpiry(v);
          xpBoostExpiryRef.current = v;
        }
        if (stored['PEA_AUTO_WATER_EXPIRY'] != null) {
          const v = Number(stored['PEA_AUTO_WATER_EXPIRY']);
          setAutoWaterExpiry(v);
          autoWaterExpiryRef.current = v;
        }

        if (stored['PEA_ACCESSORIES'] != null) {
          try {
            const parsed = JSON.parse(stored['PEA_ACCESSORIES']);
            if (Array.isArray(parsed)) setAccessories(parsed as AccessoryId[]);
          } catch {}
        }

        // ── Seri hesaplama ─────────────────────────────────────────────────
        const today    = new Date();
        const todayStr = toDateString(today);
        const lastStreakDate = stored['PEA_STREAK_DATE'] ?? '';
        let currentStreak   = stored['PEA_STREAK_COUNT'] != null ? Number(stored['PEA_STREAK_COUNT']) : 0;
        let streakBonusCoins = 0;
        let hitMilestone: number | null = null;

        if (lastStreakDate === todayStr) {
          // Zaten bugün sayıldı
        } else if (lastStreakDate && isYesterday(lastStreakDate, today)) {
          currentStreak += 1;
        } else {
          currentStreak = 1;
        }

        if (STREAK_MILESTONES[currentStreak] !== undefined && lastStreakDate !== todayStr) {
          hitMilestone    = currentStreak;
          streakBonusCoins = STREAK_MILESTONES[currentStreak];
        }

        setStreak(currentStreak);

        // Mark as loaded BEFORE the last async write so that any re-render
        // triggered by the setters above sees hasLoadedStats.current = true
        // and the saveStats / saveCoins effects don't skip the persisted values.
        hasLoadedStats.current = true;

        if (hitMilestone !== null && streakBonusCoins > 0) {
          setCoins(c => c + streakBonusCoins);
          addTotalCoins(streakBonusCoins);
          setStreakMilestone(hitMilestone);
        }

        await AsyncStorage.multiSet([
          ['PEA_LAST_VISIT',    String(now)],
          ['PEA_STREAK_COUNT',  String(currentStreak)],
          ['PEA_STREAK_DATE',   todayStr],
        ]);
        await initStats();
      } catch (err) {
        console.warn('Pea başlatılamadı:', err);
      }
    };

    initPea();
  }, []);

  // Save stats whenever they change (guarded until initial load completes)
  useEffect(() => {
    if (!hasLoadedStats.current) return;
    const save = async () => {
      try {
        await AsyncStorage.multiSet([
          ['PEA_LAST_VISIT', String(Date.now())],
          ['PEA_WATER',      String(water)],
          ['PEA_SUN',        String(sun)],
          ['PEA_SOIL',       String(soil)],
          ['PEA_FUN',        String(fun)],
          ['PEA_ENERGY',     String(energy)],
        ]);
      } catch (e) {
        console.warn('Pea durumu kaydedilemedi:', e);
      }
    };
    save();
  }, [water, sun, soil, fun, energy]);

  // Persist manual sleep state so offline energy gain can be calculated on reopen
  useEffect(() => {
    if (!hasLoadedStats.current) return;
    if (isSleeping && sleepReason === 'manual' && sleepStartTime !== null) {
      AsyncStorage.multiSet([
        ['PEA_SLEEP_REASON', 'manual'],
        ['PEA_SLEEP_START',  String(sleepStartTime)],
      ]).catch(() => {});
    } else {
      AsyncStorage.multiRemove(['PEA_SLEEP_REASON', 'PEA_SLEEP_START']).catch(() => {});
    }
  }, [isSleeping, sleepReason, sleepStartTime]);

  // Save coins whenever they change (guarded until initial load completes)
  useEffect(() => {
    if (!hasLoadedStats.current) return;
    const save = async () => {
      try {
        await AsyncStorage.setItem('PEA_COINS', String(coins));
      } catch (e) {
        console.warn('Pea coins kaydedilemedi:', e);
      }
    };
    save();
  }, [coins]);

  // Slowly decay stats over time; paused while sleeping or in a game.
  // Reads from refs so the interval is created once (deps=[]) and never restarted on each tick.
  useEffect(() => {
    const id = setInterval(() => {
      if (isGameOpenRef.current) return;
      const { water: w, sun: s, soil: so, fun: f, energy: e } = statsRef.current;
      const prev = prevStatsRef.current;
      const sleeping = isSleepingRef.current;
      // Sad Pea neglects herself: 1.5x decay on water/sun/soil when fun is low
      const sadMultiplier = !sleeping && f < 30 ? 1.5 : 1;
      let nw = sleeping ? w : clamp(w - 0.5 * sadMultiplier);
      if (Date.now() < autoWaterExpiryRef.current) nw = clamp(nw + 3);
      const ns = sleeping ? s  : clamp(s  - 0.3 * sadMultiplier);
      const no = sleeping ? so : clamp(so - 0.3 * sadMultiplier);
      const nf = sleeping ? f  : clamp(f  - 0.4);
      // Manual sleep: energy ticks up +1 per interval while sleeping
      // Thriving (awake): all care stats high → energy regenerates instead of decaying
      let ne: number;
      if (sleeping && sleepReasonRef.current === 'manual') {
        ne = clamp(e + 1);
      } else if (!sleeping) {
        const energyDelta = w > 60 && s > 60 && so > 60 ? 0.2 : -0.1;
        ne = clamp(e + energyDelta);
      } else {
        ne = e;
      }
      setWater(nw); setSun(ns); setSoil(no); setFun(nf); setEnergy(ne);
      updateMood(nw, ns, no, nf, ne);

      // Threshold-crossing notifications (fire only when crossing, not every tick)
      if (prev.water >= 30 && nw < 30)
        schedulePeaNotification('Pea susamış! 💧', 'Pea\'nin suyu azaldı, hemen sulaman gerekiyor!');
      if (prev.sun >= 30 && ns < 30)
        schedulePeaNotification('Pea güneş istiyor! ☀️', 'Pea güneş ışığı almadı, ona biraz güneş ver!');
      if (prev.soil >= 30 && no < 30)
        schedulePeaNotification('Pea toprak istiyor! 🌱', 'Pea\'nin toprağı azaldı, beslemeni bekliyor!');
      if (prev.fun >= 30 && nf < 30)
        schedulePeaNotification('Pea sıkıldı! 🎮', 'Pea eğlenmek istiyor, birlikte oyun oynasanıza!');
      if (prev.energy >= 20 && ne < 20)
        schedulePeaNotification('Pea çok yoruldu! 😴', 'Pea\'nin enerjisi tükeniyor, uyuması gerekiyor!');

      prevStatsRef.current = { water: nw, sun: ns, soil: no, fun: nf, energy: ne };
    }, 5000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Tick sleepNow every second so the UI can show elapsed/remaining time.
  // Auto-wake only fires for tiredFromPlay — manual sleep has no auto-wake.
  useEffect(() => {
    if (!isSleeping || !sleepStartTime) return;
    const id = setInterval(() => {
      setSleepNow(Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, [isSleeping, sleepStartTime]);

  // tiredFromPlay auto-wake: fires exactly once after the remaining sleep time.
  // Uses setTimeout so there is no polling and no stale-closure risk.
  useEffect(() => {
    if (!isSleeping || sleepReason !== 'tiredFromPlay' || !sleepStartTime) return;
    const remaining = TIRED_SLEEP_MS - (Date.now() - sleepStartTime);
    if (remaining <= 0) {
      handleWakeRef.current(false);
      return;
    }
    const id = setTimeout(() => handleWakeRef.current(false), remaining);
    return () => clearTimeout(id);
  }, [isSleeping, sleepReason, sleepStartTime]);

  // ── XP helpers ─────────────────────────────────────────────────────────────

  const addXP = (amount: number) => {
    const multiplier   = Date.now() < xpBoostExpiryRef.current ? 2 : 1;
    const actualAmount = amount * multiplier;
    const prev         = xpRef.current;
    const newXP        = prev + actualAmount;
    const oldLevel     = levelFromXP(prev);
    const newLevel     = levelFromXP(newXP);
    xpRef.current      = newXP;
    setXP(newXP);
    if (newLevel > oldLevel) setLevelUpInfo({ newLevel });
    AsyncStorage.setItem('PEA_XP', String(newXP)).catch(() => {});
    addTotalXP(actualAmount);
  };

  const clearLevelUp = () => setLevelUpInfo(null);

  // ── Care actions ───────────────────────────────────────────────────────────
  // Visual effects (bounce, particles) are added by the component wrapper.

  const giveWater = () => {
    if (isSleeping) return;
    const needed = water < LOW_WATER_THRESHOLD;
    const nw = clamp(water + 25);
    const nf = clamp(fun   + 3);
    setWater(nw);
    setFun(nf);
    updateMood(nw, sun, soil, nf, energy);
    if (needed) addXP(5);
    recordCareAction('water');
  };

  const giveSun = () => {
    if (isSleeping) return;
    const needed = sun < LOW_SUN_THRESHOLD;
    const ns = clamp(sun + 25);
    const nf = clamp(fun + 3);
    setSun(ns);
    setFun(nf);
    updateMood(water, ns, soil, nf, energy);
    if (needed) addXP(5);
    recordCareAction('sun');
  };

  const giveSoil = () => {
    if (isSleeping) return;
    const needed = soil < LOW_SOIL_THRESHOLD;
    const no = clamp(soil + 25);
    const nf = clamp(fun  + 3);
    setSoil(no);
    setFun(nf);
    updateMood(water, sun, no, nf, energy);
    if (needed) addXP(5);
    recordCareAction('soil');
  };

  const toggleSleep = () => {
    if (isSleeping) {
      handleWake(true);
      return;
    }
    if (energy >= ENERGY_REFUSE_SLEEP) {
      setMood('bored');
      setCustomMessage('Daha uykum yok, şimdi uyumak istemiyorum 😤');
      return;
    }
    const now = Date.now();
    setIsSleeping(true);
    setSleepReason('manual');
    setSleepStartTime(now);
    setSleepNow(now);
    setMood('sleepy');
    setCustomMessage('Çok yorulmuş, biraz kestiriyor 😴');
  };

  // ── Game helpers ───────────────────────────────────────────────────────────

  /**
   * Called when the player taps "Oyun Oyna". Handles the sleeping-guard
   * messages and returns true if the game menu should open.
   */
  const tryPlay = (): boolean => {
    if (!isSleeping) return true;
    if (sleepReason === 'longAway') {
      setCustomMessage('Şu an uyuyor… Önce onu uyandırman gerekiyor 😴');
    } else if (sleepReason === 'tiredFromPlay') {
      setCustomMessage('Oyun oynarken çok yoruldu, biraz dinlensin sonra tekrar oynarsınız 😴');
    } else {
      setCustomMessage('Şu an uyuyor, oyun oynamak istemiyor 😴');
    }
    return false;
  };

  /** Sets mood to 'playing' and shows a game-start message. */
  const startPlayingMood = (message: string) => {
    setMood('playing');
    setCustomMessage(message);
  };

  // ── Game result handlers ───────────────────────────────────────────────────

  const triggerTiredSleep = (message: string) => {
    const now = Date.now();
    setIsSleeping(true);
    setSleepReason('tiredFromPlay');
    setSleepStartTime(now);
    setSleepNow(now);
    setMood('sleepy');
    setCustomMessage(message);
  };

  const onBugGameFinished = (score: number) => {
    recordGamePlayed('bug', score);
    const energyDrain = Math.min(25, 15 + score * 0.3);
    const newEnergy   = clamp(energy - energyDrain);
    setEnergy(newEnergy);

    if (newEnergy < ENERGY_COLLAPSE) {
      const coinsEarned = score > 0 ? Math.max(2, Math.floor(score / 2)) : 0;
      if (coinsEarned > 0) { setCoins(c => c + coinsEarned); addTotalCoins(coinsEarned); }
      addXP(8 + score);
      triggerTiredSleep(`Böcek kovalayınca yoruldu, uyuyakaldı 😴${coinsEarned > 0 ? ` (+${coinsEarned} 💰)` : ''}`);
      return;
    }

    if (score === 0) {
      setMood(calculateMood(water, sun, soil, fun, newEnergy));
      setCustomMessage('Hiç böcek yakalayamadı, bir dahaki sefere! 😌');
      addXP(5);
      return;
    }

    const newFun      = clamp(fun + score * 1.5);
    const coinsEarned = Math.max(2, Math.floor(score / 2));
    setFun(newFun);
    setCoins(c => c + coinsEarned);
    addTotalCoins(coinsEarned);
    addXP(8 + score);
    setMood(calculateMood(water, sun, soil, newFun, newEnergy));
    setCustomMessage(`${score} böcek yakaladı! 🪰 (+${coinsEarned} 💰)`);
  };

  const onMemoryFinished = (score: number) => {
    recordGamePlayed('memory', score);
    const energyDrain = Math.min(25, 15 + score * 0.3);
    const newEnergy   = clamp(energy - energyDrain);
    setEnergy(newEnergy);

    if (newEnergy < ENERGY_COLLAPSE) {
      const coinsEarned = score > 0 ? score * 2 : 0;
      if (coinsEarned > 0) { setCoins(c => c + coinsEarned); addTotalCoins(coinsEarned); }
      addXP(10 + score * 3);
      triggerTiredSleep(`Hafıza oynarken yoruldu, uyuyakaldı 😴${coinsEarned > 0 ? ` (+${coinsEarned} 💰)` : ''}`);
      return;
    }

    if (score <= 0) {
      setMood(calculateMood(water, sun, soil, fun, newEnergy));
      setCustomMessage('Hafıza oyununu tamamlayamadı ama eğlendi 🃏');
      addXP(5);
      return;
    }

    const newFun      = clamp(fun + score * 1.2);
    const coinsEarned = score * 2;
    setFun(newFun);
    setCoins(c => c + coinsEarned);
    addTotalCoins(coinsEarned);
    addXP(10 + score * 3);
    setMood(calculateMood(water, sun, soil, newFun, newEnergy));
    setCustomMessage(`Hafıza oyununu bitirdi! (+${coinsEarned} 💰) 🃏`);
  };

  const onFlappyGameResult = async (score: number) => {
    recordGamePlayed('flappy', score);
    const energyDrain = Math.min(25, 15 + score * 0.3);
    const newEnergy   = clamp(energy - energyDrain);
    setEnergy(newEnergy);

    if (newEnergy < ENERGY_COLLAPSE) {
      const coinsEarned = score > 0 ? score * 2 : 0;
      if (coinsEarned > 0) { setCoins(c => c + coinsEarned); addTotalCoins(coinsEarned); }
      addXP(8 + score * 3);
      triggerTiredSleep(`Flappy Pea oynarken yoruldu, uyuyakaldı 😴${coinsEarned > 0 ? ` (+${coinsEarned} 💰)` : ''}`);
      return;
    }

    if (score <= 0) {
      setMood(calculateMood(water, sun, soil, fun, newEnergy));
      setCustomMessage('Flappy Pea denemesi bitti 🪽');
      addXP(5);
      return;
    }

    let isNewHigh = false;
    if (score > flappyHighScore) {
      isNewHigh = true;
      setFlappyHighScore(score);
      try {
        await AsyncStorage.setItem('PEA_FLAPPY_HIGHSCORE', String(score));
      } catch (e) {
        console.warn('Flappy high score kaydedilemedi:', e);
      }
    }

    const newFun      = clamp(fun + score * 2);
    const coinsEarned = score * 2;
    setFun(newFun);
    setCoins(c => c + coinsEarned);
    addTotalCoins(coinsEarned);
    addXP(8 + score * 3);
    setMood(calculateMood(water, sun, soil, newFun, newEnergy));

    if (isNewHigh) {
      setCustomMessage(`Yeni rekor! ${score} boru geçtin 🪽 (Eski: ${flappyHighScore})  +${coinsEarned} 💰`);
    } else {
      setCustomMessage(`Flappy Pea'de ${score} boru geçtin! 🪽 (+${coinsEarned} 💰)`);
    }
  };

  const onGardenGameFinished = (score: number) => {
    recordGamePlayed('garden', score);
    // score = number of surviving plants (0–6)
    const energyDrain = Math.min(25, 15 + score * 0.3);
    const newEnergy   = clamp(energy - energyDrain);
    setEnergy(newEnergy);

    if (newEnergy < ENERGY_COLLAPSE) {
      const coinsEarned = score > 0 ? score * 3 : 0;
      if (coinsEarned > 0) { setCoins(c => c + coinsEarned); addTotalCoins(coinsEarned); }
      addXP(12 + score * 4);
      triggerTiredSleep(`Bahçeyi sularken yoruldu, uyuyakaldı 😴${coinsEarned > 0 ? ` (+${coinsEarned} 💰)` : ''}`);
      return;
    }

    if (score === 0) {
      setMood(calculateMood(water, sun, soil, fun, newEnergy));
      setCustomMessage('Tüm bitkiler soldu, bir dahaki sefere! 🥀');
      addXP(5);
      return;
    }

    const newFun      = clamp(fun + score * 3);
    const coinsEarned = score * 3;
    setFun(newFun);
    setCoins(c => c + coinsEarned);
    addTotalCoins(coinsEarned);
    addXP(12 + score * 4);
    setMood(calculateMood(water, sun, soil, newFun, newEnergy));
    setCustomMessage(`Bahçede ${score}/6 bitki kurtarıldı! 🌿 (+${coinsEarned} 💰)`);
  };

  const onCoinGameFinished = (score: number) => {
    recordGamePlayed('coin', score);
    const energyDrain = Math.min(25, 15 + score * 0.3);
    const newEnergy   = clamp(energy - energyDrain);
    setEnergy(newEnergy);

    if (newEnergy < ENERGY_COLLAPSE) {
      const coinsEarned = score > 0 ? score + Math.floor(score / 2) : 0;
      if (coinsEarned > 0) { setCoins(c => c + coinsEarned); addTotalCoins(coinsEarned); }
      addXP(8 + score * 2);
      triggerTiredSleep(`Coin toplarken yoruldu, uyuyakaldı 😴${coinsEarned > 0 ? ` (+${coinsEarned} 💰)` : ''}`);
      return;
    }

    if (score === 0) {
      setMood(calculateMood(water, sun, soil, fun, newEnergy));
      setCustomMessage('Hiç coin toplayamadın, tekrar dene! 😌');
      addXP(5);
      return;
    }

    const newFun      = clamp(fun + score * 1.2);
    const coinsEarned = score + Math.floor(score / 2);
    setFun(newFun);
    setCoins(c => c + coinsEarned);
    addTotalCoins(coinsEarned);
    addXP(8 + score * 2);
    setMood(calculateMood(water, sun, soil, newFun, newEnergy));
    setCustomMessage(`Coin yağmurunda ${score} coin topladın! 💰 (+${coinsEarned} 💰)`);
  };

  // ── New shop actions ──────────────────────────────────────────────────────

  const buyEnergyDrink = () => {
    if (coins < ENERGY_DRINK_COST) return;
    setCoins(c => c - ENERGY_DRINK_COST);
    const ne = clamp(energy + 30);
    setEnergy(ne);
    updateMood(water, sun, soil, fun, ne);
    setCustomMessage('Enerji içeceği içildi! +30 enerji ⚡');
  };

  const buyLuckyBox = () => {
    if (coins < LUCKY_BOX_COST) return;
    setCoins(c => c - LUCKY_BOX_COST);
    const roll = Math.random();
    if (roll < 0.7) {
      const reward = Math.floor(Math.random() * 91) + 10;
      setCoins(c => c + reward);
      addTotalCoins(reward);
      setCustomMessage(`Şanslı kutudan ${reward} coin çıktı! 🍀`);
    } else {
      const base   = Math.max(Date.now(), xpBoostExpiryRef.current);
      const expiry = base + XP_BOOST_DURATION_MS;
      setXpBoostExpiry(expiry);
      xpBoostExpiryRef.current = expiry;
      AsyncStorage.setItem('PEA_XP_BOOST_EXPIRY', String(expiry)).catch(() => {});
      setCustomMessage('Şanslı kutudan XP Boost çıktı! 🍀🌟');
    }
  };

  const buyFoodWater = () => {
    if (coins < FOOD_WATER_COST) return;
    setCoins(c => c - FOOD_WATER_COST);
    const nw = clamp(water + 40);
    setWater(nw);
    updateMood(nw, sun, soil, fun, energy);
    setCustomMessage('Özel su içildi! +40 su 💧');
  };

  const buyFoodSun = () => {
    if (coins < FOOD_SUN_COST) return;
    setCoins(c => c - FOOD_SUN_COST);
    const ns = clamp(sun + 40);
    setSun(ns);
    updateMood(water, ns, soil, fun, energy);
    setCustomMessage('Güneş kremi sürüldü! +40 güneş ☀️');
  };

  const buyFoodSoil = () => {
    if (coins < FOOD_SOIL_COST) return;
    setCoins(c => c - FOOD_SOIL_COST);
    const no = clamp(soil + 40);
    setSoil(no);
    updateMood(water, sun, no, fun, energy);
    setCustomMessage('Süper gübre kullanıldı! +40 toprak 🌱');
  };

  const buyFoodFun = () => {
    if (coins < FOOD_FUN_COST) return;
    setCoins(c => c - FOOD_FUN_COST);
    const nf = clamp(fun + 40);
    setFun(nf);
    updateMood(water, sun, soil, nf, energy);
    setCustomMessage('Eğlence paketi açıldı! +40 eğlence 🎮');
  };

  const buyHat = () => {
    if (coins < HAT_COST || accessories.includes('hat')) return;
    setCoins(c => c - HAT_COST);
    setAccessories(prev => {
      const next = [...prev, 'hat' as AccessoryId];
      AsyncStorage.setItem('PEA_ACCESSORIES', JSON.stringify(next)).catch(() => {});
      return next;
    });
    setCustomMessage('Silindir şapka takıldı! Pea çok şık görünüyor 🎩');
  };

  const buyRainbowAura = () => {
    if (coins < RAINBOW_AURA_COST || accessories.includes('rainbowAura')) return;
    setCoins(c => c - RAINBOW_AURA_COST);
    setAccessories(prev => {
      const next = [...prev, 'rainbowAura' as AccessoryId];
      AsyncStorage.setItem('PEA_ACCESSORIES', JSON.stringify(next)).catch(() => {});
      return next;
    });
    setCustomMessage('Gökkuşağı aura takıldı! Pea gökkuşağıyla parlıyor 🌈');
  };

  const buyGoldFrame = () => {
    if (coins < GOLD_FRAME_COST || accessories.includes('goldFrame')) return;
    setCoins(c => c - GOLD_FRAME_COST);
    setAccessories(prev => {
      const next = [...prev, 'goldFrame' as AccessoryId];
      AsyncStorage.setItem('PEA_ACCESSORIES', JSON.stringify(next)).catch(() => {});
      return next;
    });
    setCustomMessage('Altın çerçeve takıldı! Pea altın gibi parlıyor ⭐');
  };

  const clearStreakMilestone = () => setStreakMilestone(null);

  // ── Quest reward ──────────────────────────────────────────────────────────

  const addQuestReward = (coinsAmount: number, xpAmount: number) => {
    setCoins(c => c + coinsAmount);
    addTotalCoins(coinsAmount);
    addXP(xpAmount);
    setCustomMessage(`Görev tamamlandı! +${coinsAmount} 💰 +${xpAmount} XP 🎉`);
  };

  // ── Shop actions ───────────────────────────────────────────────────────────

  const buyXpBoost = () => {
    if (coins < XP_BOOST_COST) return;
    setCoins(c => c - XP_BOOST_COST);
    const base   = Math.max(Date.now(), xpBoostExpiry);
    const expiry = base + XP_BOOST_DURATION_MS;
    setXpBoostExpiry(expiry);
    xpBoostExpiryRef.current = expiry;
    AsyncStorage.setItem('PEA_XP_BOOST_EXPIRY', String(expiry)).catch(() => {});
    setCustomMessage('XP Boost aktif! 5 dakika boyunca 2x XP kazanıyorsun 🌟');
  };

  const buyStatBoost = () => {
    if (coins < STAT_BOOST_COST) return;
    setCoins(c => c - STAT_BOOST_COST);
    const nw = clamp(water  + 20);
    const ns = clamp(sun    + 20);
    const no = clamp(soil   + 20);
    const nf = clamp(fun    + 20);
    const ne = clamp(energy + 20);
    setWater(nw); setSun(ns); setSoil(no); setFun(nf); setEnergy(ne);
    updateMood(nw, ns, no, nf, ne);
    setCustomMessage('Güç vitamini alındı! Tüm statlar +20 💊');
  };

  const buyAutoWater = () => {
    if (coins < AUTO_WATER_COST) return;
    setCoins(c => c - AUTO_WATER_COST);
    const base   = Math.max(Date.now(), autoWaterExpiry);
    const expiry = base + AUTO_WATER_DURATION_MS;
    setAutoWaterExpiry(expiry);
    autoWaterExpiryRef.current = expiry;
    AsyncStorage.setItem('PEA_AUTO_WATER_EXPIRY', String(expiry)).catch(() => {});
    setCustomMessage('Otomatik su aktif! 10 dakika boyunca su otomatik doluyor 💧');
  };

  // ── Public API ─────────────────────────────────────────────────────────────

  const level      = levelFromXP(xp);
  const xpProgress = xpProgressInLevel(xp);

  return {
    // State
    water, sun, soil, fun, energy, mood,
    isSleeping, sleepReason, sleepStartTime, sleepNow, wasLongAway,
    customMessage, setCustomMessage,
    coins, flappyHighScore,
    // XP / Level
    xp, level, xpProgress, levelUpInfo, clearLevelUp,
    // Shop
    xpBoostExpiry, autoWaterExpiry, buyXpBoost, buyStatBoost, buyAutoWater,
    buyEnergyDrink, buyLuckyBox,
    buyFoodWater, buyFoodSun, buyFoodSoil, buyFoodFun,
    buyHat, buyRainbowAura, buyGoldFrame,
    accessories,
    // Care actions
    giveWater, giveSun, giveSoil, toggleSleep,
    // Game helpers
    tryPlay, startPlayingMood,
    // Game result handlers
    onBugGameFinished, onMemoryFinished, onFlappyGameResult, onCoinGameFinished, onGardenGameFinished,
    // Quest reward
    addQuestReward,
    // Streak
    streak, streakMilestone, clearStreakMilestone,
  };
}
