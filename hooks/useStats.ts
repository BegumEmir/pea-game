import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type GameType = 'bug' | 'memory' | 'flappy' | 'garden' | 'coin';

export type StatsData = {
  firstPlayDate: string | null;
  totalCoins: number;
  totalXP: number;
  gamesPlayed: Record<GameType, number>;
  highScores: Record<GameType, number>;
  careActions: { water: number; sun: number; soil: number };
  streak: number;
};

// ── Keys ──────────────────────────────────────────────────────────────────────

const K = {
  FIRST_PLAY:   'STATS_FIRST_PLAY',
  TOTAL_COINS:  'STATS_TOTAL_COINS',
  TOTAL_XP:     'STATS_TOTAL_XP',
  GAMES_PLAYED: 'STATS_GAMES_PLAYED',
  HIGH_SCORES:  'STATS_HIGH_SCORES',
  CARE_ACTIONS: 'STATS_CARE_ACTIONS',
} as const;

const DEFAULT_GAMES: Record<GameType, number> = { bug: 0, memory: 0, flappy: 0, garden: 0, coin: 0 };
const DEFAULT_CARE  = { water: 0, sun: 0, soil: 0 };

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

async function getNum(key: string): Promise<number> {
  const v = await AsyncStorage.getItem(key);
  return v ? parseInt(v, 10) : 0;
}

async function getJSON<T>(key: string, fallback: T): Promise<T> {
  const v = await AsyncStorage.getItem(key);
  return v ? { ...fallback, ...JSON.parse(v) } : { ...fallback };
}

// ── Standalone async mutators (callable from usePea.ts) ───────────────────────

export async function initStats(): Promise<void> {
  try {
    const firstPlay = await AsyncStorage.getItem(K.FIRST_PLAY);
    if (!firstPlay) await AsyncStorage.setItem(K.FIRST_PLAY, todayStr());
  } catch { /* ignore */ }
}

export async function addTotalCoins(amount: number): Promise<void> {
  if (amount <= 0) return;
  try {
    const prev = await getNum(K.TOTAL_COINS);
    await AsyncStorage.setItem(K.TOTAL_COINS, String(prev + amount));
  } catch { /* ignore */ }
}

export async function addTotalXP(amount: number): Promise<void> {
  if (amount <= 0) return;
  try {
    const prev = await getNum(K.TOTAL_XP);
    await AsyncStorage.setItem(K.TOTAL_XP, String(prev + amount));
  } catch { /* ignore */ }
}

export async function recordGamePlayed(type: GameType, score: number): Promise<void> {
  try {
    const [games, scores] = await Promise.all([
      getJSON(K.GAMES_PLAYED, DEFAULT_GAMES),
      getJSON(K.HIGH_SCORES,  DEFAULT_GAMES),
    ]);
    games[type]  = (games[type]  ?? 0) + 1;
    scores[type] = Math.max(scores[type] ?? 0, score);
    await AsyncStorage.multiSet([
      [K.GAMES_PLAYED, JSON.stringify(games)],
      [K.HIGH_SCORES,  JSON.stringify(scores)],
    ]);
  } catch { /* ignore */ }
}

export async function recordCareAction(type: 'water' | 'sun' | 'soil'): Promise<void> {
  try {
    const care = await getJSON(K.CARE_ACTIONS, DEFAULT_CARE);
    care[type] = (care[type] ?? 0) + 1;
    await AsyncStorage.setItem(K.CARE_ACTIONS, JSON.stringify(care));
  } catch { /* ignore */ }
}

// ── Hook (read-only, used by StatsScreen) ─────────────────────────────────────

export function useStats() {
  const [stats, setStats] = useState<StatsData>({
    firstPlayDate: null,
    totalCoins:    0,
    totalXP:       0,
    gamesPlayed:   { ...DEFAULT_GAMES },
    highScores:    { ...DEFAULT_GAMES },
    careActions:   { ...DEFAULT_CARE },
    streak:        0,
  });

  const reload = async () => {
    try {
      const entries = await AsyncStorage.multiGet([
        K.FIRST_PLAY, K.TOTAL_COINS, K.TOTAL_XP,
        K.GAMES_PLAYED, K.HIGH_SCORES, K.CARE_ACTIONS, 'PEA_STREAK_COUNT',
      ]);
      const m = Object.fromEntries(entries.map(([k, v]) => [k, v]));
      setStats({
        firstPlayDate: m[K.FIRST_PLAY] ?? null,
        totalCoins:    m[K.TOTAL_COINS] ? parseInt(m[K.TOTAL_COINS]!, 10) : 0,
        totalXP:       m[K.TOTAL_XP]   ? parseInt(m[K.TOTAL_XP]!, 10)    : 0,
        gamesPlayed:   m[K.GAMES_PLAYED] ? { ...DEFAULT_GAMES, ...JSON.parse(m[K.GAMES_PLAYED]!) } : { ...DEFAULT_GAMES },
        highScores:    m[K.HIGH_SCORES]  ? { ...DEFAULT_GAMES, ...JSON.parse(m[K.HIGH_SCORES]!)  } : { ...DEFAULT_GAMES },
        careActions:   m[K.CARE_ACTIONS] ? { ...DEFAULT_CARE,  ...JSON.parse(m[K.CARE_ACTIONS]!) } : { ...DEFAULT_CARE  },
        streak:        m['PEA_STREAK_COUNT'] ? parseInt(m['PEA_STREAK_COUNT']!, 10) : 0,
      });
    } catch { /* ignore */ }
  };

  useEffect(() => { reload(); }, []);

  return { stats, reload };
}
