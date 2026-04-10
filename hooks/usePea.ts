import { useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

// ── Constants ────────────────────────────────────────────────────────────────

const INITIAL_WATER  = 60;
const INITIAL_SUN    = 60;
const INITIAL_SOIL   = 60;
const INITIAL_FUN    = 50;
const INITIAL_ENERGY = 80;

const LONG_AWAY_MINUTES = 30;

// Exported so HomeScreen can use them for the sleep countdown display
export const SHORT_SLEEP_MS  = 5000;
export const TIRED_SLEEP_MS  = 20000;

// Mood thresholds used in calculateMood and care logic
const LOW_WATER_THRESHOLD  = 30;
const LOW_SUN_THRESHOLD    = 30;
const LOW_SOIL_THRESHOLD   = 30;
const LOW_ENERGY_THRESHOLD = 15;
const LOW_FUN_THRESHOLD    = 20;
const ENERGY_REFUSE_SLEEP  = 50; // Energy level above which manual sleep is refused
const ENERGY_COLLAPSE      = 8;  // Energy level below which Pea falls asleep after a game

// ── Pure helpers ─────────────────────────────────────────────────────────────

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}

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

  // ── Refs ───────────────────────────────────────────────────────────────────

  const hasLoadedStats  = useRef(false);
  const handleWakeRef   = useRef<(early: boolean) => void>(null!);
  // Mirrors of state values read inside the decay interval — avoids restarting the timer on every tick
  const statsRef        = useRef({ water, sun, soil, fun, energy });
  const isSleepingRef   = useRef(isSleeping);
  const isGameOpenRef   = useRef(isGameOpen);

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
      if (early && elapsed < TIRED_SLEEP_MS) {
        setCustomMessage('Daha tam dinlenemedim, biraz daha uyumam lazım… 😴');
        setMood('sleepy');
        return;
      }
      const newEnergy = clamp(energy + 30);
      setEnergy(newEnergy);
      setIsSleeping(false);
      setSleepReason('none');
      setSleepStartTime(null);
      setCustomMessage(null);
      updateMood(water, sun, soil, fun, newEnergy);
      return;
    }

    if (sleepReason === 'manual') {
      let newEnergy: number;
      if (early && elapsed < SHORT_SLEEP_MS) {
        newEnergy = clamp(energy + 10);
        setCustomMessage('Daha yeni uyumuştum ama neyse… 😌');
      } else {
        newEnergy = clamp(energy + 20);
        setCustomMessage('Kendini biraz daha iyi hissediyor gibi 😊');
      }
      setEnergy(newEnergy);
      setIsSleeping(false);
      setSleepReason('none');
      setSleepStartTime(null);
      setMood(calculateMood(water, sun, soil, fun, newEnergy));
      return;
    }

    if (sleepReason === 'longAway') {
      const newEnergy = clamp(energy + 30);
      setEnergy(newEnergy);
      setFun(10);
      setIsSleeping(false);
      setSleepReason('none');
      setSleepStartTime(null);
      setWasLongAway(false);
      setMood('bored');
      setCustomMessage('Sen yokken çok bekledim… Biraz canım sıkıldı. Oyun oynasak mı? 🎮');
      return;
    }

    const newEnergy = clamp(energy + 15);
    setEnergy(newEnergy);
    setIsSleeping(false);
    setSleepReason('none');
    setSleepStartTime(null);
    setCustomMessage(null);
    updateMood(water, sun, soil, fun, newEnergy);
  };

  // Keep refs in sync on every render so interval callbacks never use stale values
  handleWakeRef.current  = handleWake;
  statsRef.current       = { water, sun, soil, fun, energy };
  isSleepingRef.current  = isSleeping;
  isGameOpenRef.current  = isGameOpen;

  // ── Effects ────────────────────────────────────────────────────────────────

  // Load all persisted data on mount
  useEffect(() => {
    const initPea = async () => {
      try {
        const entries = await AsyncStorage.multiGet([
          'PEA_WATER', 'PEA_SUN', 'PEA_SOIL', 'PEA_FUN', 'PEA_ENERGY',
          'PEA_LAST_VISIT', 'PEA_COINS', 'PEA_FLAPPY_HIGHSCORE',
        ]);
        const stored = Object.fromEntries(entries.map(([k, v]) => [k, v]));

        let w  = stored['PEA_WATER']  != null ? Number(stored['PEA_WATER'])  : INITIAL_WATER;
        let s  = stored['PEA_SUN']    != null ? Number(stored['PEA_SUN'])    : INITIAL_SUN;
        let so = stored['PEA_SOIL']   != null ? Number(stored['PEA_SOIL'])   : INITIAL_SOIL;
        let f  = stored['PEA_FUN']    != null ? Number(stored['PEA_FUN'])    : INITIAL_FUN;
        let e  = stored['PEA_ENERGY'] != null ? Number(stored['PEA_ENERGY']) : INITIAL_ENERGY;

        const now = Date.now();
        let longAway = false;
        if (stored['PEA_LAST_VISIT']) {
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

        if (longAway) {
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

        // Mark as loaded BEFORE the last async write so that any re-render
        // triggered by the setters above sees hasLoadedStats.current = true
        // and the saveStats / saveCoins effects don't skip the persisted values.
        hasLoadedStats.current = true;

        await AsyncStorage.setItem('PEA_LAST_VISIT', String(now));
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
      if (isSleepingRef.current || isGameOpenRef.current) return;
      const { water: w, sun: s, soil: so, fun: f, energy: e } = statsRef.current;
      const nw = clamp(w  - 2);
      const ns = clamp(s  - 1);
      const no = clamp(so - 0.5);
      const nf = clamp(f  - 0.3);
      const ne = clamp(e  - 0.2);
      setWater(nw); setSun(ns); setSoil(no); setFun(nf); setEnergy(ne);
      updateMood(nw, ns, no, nf, ne);
    }, 5000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sleep countdown + auto-wake
  useEffect(() => {
    if (!isSleeping || !sleepStartTime) return;
    const id = setInterval(() => {
      const now     = Date.now();
      setSleepNow(now);
      const elapsed = now - sleepStartTime;
      if (sleepReason === 'manual'       && elapsed >= SHORT_SLEEP_MS)  handleWakeRef.current(false);
      if (sleepReason === 'tiredFromPlay' && elapsed >= TIRED_SLEEP_MS) handleWakeRef.current(false);
    }, 1000);
    return () => clearInterval(id);
  }, [isSleeping, sleepReason, sleepStartTime]);

  // ── Care actions ───────────────────────────────────────────────────────────
  // Visual effects (bounce, particles) are added by the component wrapper.

  const giveWater = () => {
    if (isSleeping) return;
    const nw = clamp(water + 25);
    const nf = clamp(fun   + 3);
    setWater(nw);
    setFun(nf);
    updateMood(nw, sun, soil, nf, energy);
  };

  const giveSun = () => {
    if (isSleeping) return;
    const ns = clamp(sun + 25);
    const nf = clamp(fun + 3);
    setSun(ns);
    setFun(nf);
    updateMood(water, ns, soil, nf, energy);
  };

  const giveSoil = () => {
    if (isSleeping) return;
    const no = clamp(soil + 25);
    const nf = clamp(fun  + 3);
    setSoil(no);
    setFun(nf);
    updateMood(water, sun, no, nf, energy);
  };

  const toggleSleep = () => {
    if (isSleeping && mood === 'sleepy') {
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

  const onBubbleGameFinished = (score: number) => {
    if (score === 0) {
      setCustomMessage('Hiç balon patlayamadın, bir dahaki sefere! 😌');
      return;
    }
    const newFun    = clamp(fun    + score * 1.5);
    const newEnergy = clamp(energy - (4 + score * 0.2));
    setFun(newFun);
    setEnergy(newEnergy);

    const coinsEarned = Math.max(1, Math.floor(score / 3));
    setCoins(c => c + coinsEarned);

    if (newEnergy < ENERGY_COLLAPSE) {
      const now = Date.now();
      setIsSleeping(true);
      setSleepReason('tiredFromPlay');
      setSleepStartTime(now);
      setSleepNow(now);
      setMood('sleepy');
      setCustomMessage(`Balonları patlatırken yoruldu, uyuyakaldı 😴 (+${coinsEarned} 🍃)`);
      return;
    }

    setMood(calculateMood(water, sun, soil, newFun, newEnergy));
    setCustomMessage(`Balonları patlatarak ${score} puan topladın! 🫧 (+${coinsEarned} 🍃)`);
  };

  const onReflexFinished = (score: number) => {
    if (score <= 0) {
      setCustomMessage('Refleks oyununda ısınma turu gibi geçti 😌');
      return;
    }
    const newFun    = clamp(fun    + score * 1.2);
    const newEnergy = clamp(energy - score * 0.6);
    setFun(newFun);
    setEnergy(newEnergy);

    const coinsEarned = score;
    setCoins(c => c + coinsEarned);

    setMood(calculateMood(water, sun, soil, newFun, newEnergy));
    setCustomMessage(`Refleks oyununda ${score} doğru yaptın ⚡ (+${coinsEarned} 🍃)`);
  };

  const onFlappyGameResult = async (score: number) => {
    if (score <= 0) {
      setCustomMessage('Flappy Pea denemesi bitti 🪽');
      return;
    }

    let newHigh   = flappyHighScore;
    let isNewHigh = false;
    if (score > flappyHighScore) {
      newHigh   = score;
      isNewHigh = true;
      setFlappyHighScore(score);
      try {
        await AsyncStorage.setItem('PEA_FLAPPY_HIGHSCORE', String(score));
      } catch (e) {
        console.warn('Flappy high score kaydedilemedi:', e);
      }
    }

    const newFun    = clamp(fun    + score * 2);
    const newEnergy = clamp(energy - Math.min(15, score * 1.2));
    setFun(newFun);
    setEnergy(newEnergy);

    const coinsEarned = score;
    setCoins(c => c + coinsEarned);

    setMood(calculateMood(water, sun, soil, newFun, newEnergy));

    if (isNewHigh) {
      setCustomMessage(`Yeni rekor! ${score} boru geçtin 🪽 (Eski: ${flappyHighScore})  +${coinsEarned} 🍃`);
    } else {
      setCustomMessage(`Flappy Pea'de ${score} boru geçtin! 🪽 (+${coinsEarned} 🍃)`);
    }

    void newHigh; // used only for the message above
  };

  // ── Public API ─────────────────────────────────────────────────────────────

  return {
    // State
    water, sun, soil, fun, energy, mood,
    isSleeping, sleepReason, sleepStartTime, sleepNow, wasLongAway,
    customMessage, setCustomMessage,
    coins, flappyHighScore,
    // Care actions
    giveWater, giveSun, giveSoil, toggleSleep,
    // Game helpers
    tryPlay, startPlayingMood,
    // Game result handlers
    onBubbleGameFinished, onReflexFinished, onFlappyGameResult,
  };
}
