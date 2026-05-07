import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type QuestType =
  | 'water'
  | 'sun'
  | 'soil'
  | 'play_game'
  | 'flappy_score'
  | 'sleep'
  | 'bug_catch'
  | 'memory_complete'
  | 'coin_score'
  | 'garden_plants';

interface QuestTemplate {
  id: string;
  type: QuestType;
  title: string;
  target: number;
  coinReward: number;
  xpReward: number;
}

export interface DailyQuest extends QuestTemplate {
  progress: number;
  completed: boolean;
}

const QUEST_POOL: QuestTemplate[] = [
  { id: 'water_3',    type: 'water',           title: "Pea'yı 3 kez sula",                      target: 3,  coinReward: 30, xpReward: 40 },
  { id: 'water_5',    type: 'water',           title: "Pea'yı 5 kez sula",                      target: 5,  coinReward: 50, xpReward: 50 },
  { id: 'sun_3',      type: 'sun',             title: "Pea'ya 3 kez güneş ver",                 target: 3,  coinReward: 30, xpReward: 40 },
  { id: 'sun_5',      type: 'sun',             title: "Pea'ya 5 kez güneş ver",                 target: 5,  coinReward: 45, xpReward: 50 },
  { id: 'soil_3',     type: 'soil',            title: "Pea'ya 3 kez toprak ver",                target: 3,  coinReward: 30, xpReward: 40 },
  { id: 'play_1',     type: 'play_game',       title: "Bir oyun oyna",                          target: 1,  coinReward: 20, xpReward: 30 },
  { id: 'play_3',     type: 'play_game',       title: "3 oyun oyna",                            target: 3,  coinReward: 40, xpReward: 50 },
  { id: 'flappy_5',   type: 'flappy_score',    title: "Flappy Pea'da 5 puan kazan",             target: 5,  coinReward: 40, xpReward: 40 },
  { id: 'flappy_10',  type: 'flappy_score',    title: "Flappy Pea'da 10 puan kazan",            target: 10, coinReward: 50, xpReward: 50 },
  { id: 'sleep_1',    type: 'sleep',           title: "Pea'yı uyut",                            target: 1,  coinReward: 20, xpReward: 30 },
  { id: 'bug_10',     type: 'bug_catch',       title: "Böcek yakala oyununda 10 böcek yakala",  target: 10, coinReward: 40, xpReward: 40 },
  { id: 'bug_5',      type: 'bug_catch',       title: "Böcek yakala oyununda 5 böcek yakala",   target: 5,  coinReward: 25, xpReward: 30 },
  { id: 'memory_1',   type: 'memory_complete', title: "Hafıza oyununu tamamla",                 target: 1,  coinReward: 35, xpReward: 45 },
  { id: 'coin_15',    type: 'coin_score',      title: "Coin yağmurunda 15 coin topla",          target: 15, coinReward: 30, xpReward: 35 },
  { id: 'coin_10',    type: 'coin_score',      title: "Coin yağmurunda 10 coin topla",          target: 10, coinReward: 22, xpReward: 30 },
  { id: 'garden_4',   type: 'garden_plants',   title: "Bahçede 4 bitki kurtar",                 target: 4,  coinReward: 40, xpReward: 40 },
  { id: 'garden_6',   type: 'garden_plants',   title: "Bahçede tüm 6 bitkiyi kurtar",           target: 6,  coinReward: 50, xpReward: 50 },
];

function getTodayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function pickThreeQuests(): DailyQuest[] {
  const shuffled = [...QUEST_POOL].sort(() => Math.random() - 0.5);
  // Ensure variety: pick from different types if possible
  const picked: QuestTemplate[] = [];
  const usedTypes = new Set<QuestType>();
  for (const q of shuffled) {
    if (picked.length >= 3) break;
    if (!usedTypes.has(q.type)) {
      picked.push(q);
      usedTypes.add(q.type);
    }
  }
  // Fill remaining slots if not enough variety
  for (const q of shuffled) {
    if (picked.length >= 3) break;
    if (!picked.includes(q)) picked.push(q);
  }
  return picked.slice(0, 3).map(q => ({ ...q, progress: 0, completed: false }));
}

async function saveQuests(quests: DailyQuest[]): Promise<void> {
  try {
    await AsyncStorage.setItem('PEA_QUESTS', JSON.stringify(quests));
  } catch {
    // ignore
  }
}

export function useQuests() {
  const [quests, setQuests] = useState<DailyQuest[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [dateStr, questsStr] = await Promise.all([
          AsyncStorage.getItem('PEA_QUESTS_DATE'),
          AsyncStorage.getItem('PEA_QUESTS'),
        ]);
        const today = getTodayString();
        if (dateStr === today && questsStr) {
          setQuests(JSON.parse(questsStr));
        } else {
          const fresh = pickThreeQuests();
          setQuests(fresh);
          await AsyncStorage.multiSet([
            ['PEA_QUESTS_DATE', today],
            ['PEA_QUESTS', JSON.stringify(fresh)],
          ]);
        }
      } catch {
        setQuests(pickThreeQuests());
      }
    };
    load();
  }, []);

  const updateProgress = (type: QuestType, amount: number) => {
    setQuests(prev => {
      let changed = false;
      const updated = prev.map(q => {
        if (q.type !== type || q.completed) return q;
        const newProgress = Math.min(q.target, q.progress + amount);
        if (newProgress === q.progress) return q;
        changed = true;
        return { ...q, progress: newProgress, completed: newProgress >= q.target };
      });
      if (!changed) return prev;
      saveQuests(updated);
      return updated;
    });
  };

  return {
    quests,
    trackWater:          () => updateProgress('water', 1),
    trackSun:            () => updateProgress('sun', 1),
    trackSoil:           () => updateProgress('soil', 1),
    trackSleep:          () => updateProgress('sleep', 1),
    trackGamePlayed:     () => updateProgress('play_game', 1),
    trackFlappyScore:    (score: number) => updateProgress('flappy_score', score),
    trackBugCatch:       (count: number) => updateProgress('bug_catch', count),
    trackMemoryComplete: () => updateProgress('memory_complete', 1),
    trackCoinScore:      (score: number) => updateProgress('coin_score', score),
    trackGardenPlants:   (count: number) => updateProgress('garden_plants', count),
  };
}
