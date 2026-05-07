import { LinearGradient } from 'expo-linear-gradient';
import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView,
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import BugGame from '../../components/BugGame';
import GardenGame from '../../components/GardenGame';
import ShopScreen from '../../components/ShopScreen';
import StatsScreen from '../../components/StatsScreen';
import NameInputScreen from '../../components/NameInputScreen';
import CoinGame from '../../components/CoinGame';
import FlappyPeaGame from '../../components/FlappyPeaGame';
import MemoryGame from '../../components/MemoryGame';
import QuestsScreen from '../../components/QuestsScreen';
import AchievementsScreen from '../../components/AchievementsScreen';
import { usePea, Mood, TIRED_SLEEP_MS, ENERGY_REFUSE_SLEEP } from '../../hooks/usePea';
import { useQuests } from '../../hooks/useQuests';
import { useAchievements } from '../../hooks/useAchievements';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNotificationPermission } from '../../hooks/useNotifications';
import { useStats } from '../../hooks/useStats';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import PeaCard from '../../components/PeaCard';

// ── Component-local types ─────────────────────────────────────────────────────

type GameMode = 'menu' | 'bug' | 'flappy' | 'memory' | 'coin' | 'garden' | null;
type ParticleKind = 'water' | 'sun' | 'soil';

// ── UI helpers ────────────────────────────────────────────────────────────────

function hintForMood(mood: Mood) {
  switch (mood) {
    case 'thirsty':   return 'Pea susamış gibi görünüyor 💧';
    case 'needsSun':  return 'Biraz güneşe ihtiyacı var ☀️';
    case 'needsSoil': return 'Toprağı güçlendirelim 🌱';
    case 'sleepy':    return 'Çok yorulmuş, uykusu gelmiş 😴';
    case 'playing':   return 'Şu an çok eğleniyor! 😆';
    case 'bored':     return 'Biraz oyun oynamak istiyor gibi 🎮';
    case 'happy':
    default:          return 'Pea şu an mutlu görünüyor 🥰';
  }
}

function backgroundForState(mood: Mood, sun: number) {
  if (mood === 'sleepy') return '#E5E7EB';
  if (mood === 'bored')  return '#E0E7FF';
  if (sun > 75) return '#FEF9C3';
  if (sun < 30) return '#E0F2FE';
  return '#EFF8FF';
}

// Mood → sprite mapping
const peaSprites: Record<Mood, any> = {
  happy:     require('../../assets/pea/pea_happy.png'),
  thirsty:   require('../../assets/pea/pea_thirsty.png'),
  needsSun:  require('../../assets/pea/pea_needs_sun.png'),
  needsSoil: require('../../assets/pea/pea_needs_soil.png'),
  sleepy:    require('../../assets/pea/pea_sleepy.png'),
  playing:   require('../../assets/pea/pea_happy.png'),
  bored:     require('../../assets/pea/pea_bored.png'),
};

// ── Share helpers ─────────────────────────────────────────────────────────────

function getDaysPlayed(firstPlayDate: string | null): number {
  if (!firstPlayDate) return 1;
  const diff = Math.floor((Date.now() - new Date(firstPlayDate).getTime()) / 86400000);
  return Math.max(1, diff + 1);
}

function getBestAchievement(
  level: number,
  streak: number,
  totalCoins: number,
  gamesPlayed: number,
  careActions: number,
): string {
  if (level >= 10)         return '🏆 Efsane Pea';
  if (streak >= 30)        return '🔥 Aylık Kahraman';
  if (level >= 7)          return '⭐ Uzman Bahçıvan';
  if (totalCoins >= 1000)  return '💰 Coin Ustası';
  if (streak >= 14)        return '🔥 İki Haftalık Seri';
  if (level >= 5)          return '🌟 Deneyimli Bakıcı';
  if (gamesPlayed >= 50)   return '🎮 Oyun Ustası';
  if (streak >= 7)         return '🔥 Haftalık Seri';
  if (level >= 3)          return '🌱 Gelişen Bahçıvan';
  if (careActions >= 100)  return '💧 Özverili Bakıcı';
  if (totalCoins >= 100)   return '💰 Coin Toplayıcı';
  return '🌿 Yeni Bahçıvan';
}

// ── HomeScreen ────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  // Game overlay state — owned here because it controls the UI layer
  const [isGameOpen,         setIsGameOpen]         = useState(false);
  const [gameMode,           setGameMode]           = useState<GameMode>(null);
  const [isShopOpen,         setIsShopOpen]         = useState(false);
  const [isStatsOpen,        setIsStatsOpen]        = useState(false);
  const [isQuestsOpen,       setIsQuestsOpen]       = useState(false);
  const [isAchievementsOpen, setIsAchievementsOpen] = useState(false);
  const [peaName,      setPeaName]     = useState('Pea');
  const [showNameScreen, setShowNameScreen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameInput,  setRenameInput] = useState('');

  // All Pea logic (stats, mood, sleep, persistence, game results)
  const pea = usePea(isGameOpen);

  // Daily quests
  const quests = useQuests();

  // Achievements / badges
  const achievements = useAchievements();

  // Detect newly completed quests and give rewards
  const prevQuestsRef = useRef(quests.quests);
  useEffect(() => {
    const prev = prevQuestsRef.current;
    quests.quests.forEach((q, i) => {
      const p = prev[i];
      if (p && !p.completed && q.completed) {
        pea.addQuestReward(q.coinReward, q.xpReward);
      }
    });
    prevQuestsRef.current = quests.quests;
  }, [quests.quests]); // eslint-disable-line react-hooks/exhaustive-deps

  // Request notification permission on first launch
  useNotificationPermission();

  // Check achievements on mount (after a tick to let AsyncStorage loads settle)
  useEffect(() => {
    const t = setTimeout(() => achievements.checkAndUnlock(), 1200);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { stats, reload: reloadStats } = useStats();

  // Load name on mount; show name screen if first launch
  useEffect(() => {
    AsyncStorage.getItem('PEA_NAME').then(saved => {
      if (saved) {
        setPeaName(saved);
      } else {
        setShowNameScreen(true);
      }
    }).catch(() => setShowNameScreen(true));
  }, []);

  const saveName = async (name: string) => {
    const trimmed = name.trim() || 'Pea';
    setPeaName(trimmed);
    try { await AsyncStorage.setItem('PEA_NAME', trimmed); } catch { /* ignore */ }
  };

  // Visual state
  const peaScaleAnim  = useRef(new Animated.Value(1)).current;
  const baseScale     = 0.9 + (pea.energy / 100) * 0.25;
  const [particles, setParticles] = useState<Array<{ id: number; kind: ParticleKind }>>([]);
  const particleIdRef = useRef(0);
  const [levelUpState, setLevelUpState] = useState<{ level: number; key: number } | null>(null);
  const levelUpKeyRef = useRef(0);
  const [streakModal,  setStreakModal]  = useState<{ streak: number; coins: number } | null>(null);
  const [isShareOpen,  setIsShareOpen]  = useState(false);
  const cardRef = useRef<View>(null);

  useEffect(() => {
    peaScaleAnim.setValue(baseScale);
  }, [baseScale, peaScaleAnim]);

  const { levelUpInfo } = pea;
  useEffect(() => {
    if (!levelUpInfo) return;
    setLevelUpState({ level: levelUpInfo.newLevel, key: levelUpKeyRef.current++ });
    pea.clearLevelUp();
    achievements.checkAndUnlock();
  }, [levelUpInfo]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (pea.streakMilestone === null) return;
    const milestoneCoins: Record<number, number> = { 3: 30, 7: 100, 14: 250, 30: 500 };
    setStreakModal({ streak: pea.streakMilestone, coins: milestoneCoins[pea.streakMilestone] ?? 0 });
    pea.clearStreakMilestone();
    achievements.checkAndUnlock();
  }, [pea.streakMilestone]); // eslint-disable-line react-hooks/exhaustive-deps

  const bouncePea = () => {
    const upScale = baseScale * 1.08;
    Animated.sequence([
      Animated.timing(peaScaleAnim, { toValue: upScale, duration: 80, useNativeDriver: true }),
      Animated.spring(peaScaleAnim, { toValue: baseScale, friction: 3, useNativeDriver: true }),
    ]).start();
  };

  const spawnParticle = (kind: ParticleKind) => {
    const id = particleIdRef.current++;
    setParticles(prev => [...prev, { id, kind }]);
    setTimeout(() => setParticles(prev => prev.filter(p => p.id !== id)), 500);
  };

  // ── Action wrappers — add visual effects on top of hook logic ───────────────

  const giveWater = () => { spawnParticle('water'); pea.giveWater(); bouncePea(); quests.trackWater(); };
  const giveSun   = () => { spawnParticle('sun');   pea.giveSun();   bouncePea(); quests.trackSun(); };
  const giveSoil  = () => { spawnParticle('soil');  pea.giveSoil();  bouncePea(); quests.trackSoil(); };

  const play = () => {
    if (!pea.tryPlay()) return;
    setGameMode('menu');
    setIsGameOpen(true);
    pea.startPlayingMood('Pea hangi oyunu oynayalım diye bakıyor 🎮');
    bouncePea();
  };

  const toggleSleep = () => {
    const willSleep = !pea.isSleeping && pea.energy < ENERGY_REFUSE_SLEEP;
    pea.toggleSleep();
    bouncePea();
    if (willSleep) quests.trackSleep();
  };

  const handleShare = async () => {
    try {
      // Guard: ref must be mounted before capture
      console.log('[Share] cardRef.current:', cardRef.current ? 'set' : 'null');
      if (!cardRef.current) {
        Alert.alert('Hata', 'Kart henüz yüklenmedi, lütfen tekrar dene.');
        return;
      }

      console.log('[Share] calling captureRef...');
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      console.log('[Share] captured URI:', uri);

      const canShare = await Sharing.isAvailableAsync();
      console.log('[Share] isAvailable:', canShare);
      if (!canShare) {
        Alert.alert('Paylaşım kullanılamıyor', 'Bu cihaz paylaşımı desteklemiyor.');
        return;
      }

      // Share the tmpfile URI directly — no FileSystem copy needed
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Pea Kartını Paylaş',
      });
      console.log('[Share] done');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[Share] error:', msg);
      Alert.alert('Paylaşım Hatası', msg);
    }
  };

  // Flappy wrapper: close overlay first, then let hook handle stats
  const handleFlappyFinished = async (score: number) => {
    setIsGameOpen(false);
    setGameMode(null);
    quests.trackGamePlayed();
    if (score > 0) quests.trackFlappyScore(score);
    await pea.onFlappyGameResult(score);
    achievements.checkAndUnlock();
  };

  // ── Computed display values ─────────────────────────────────────────────────


  let hint = pea.customMessage ?? hintForMood(pea.mood);
  if (!pea.customMessage && pea.isSleeping && pea.sleepReason === 'longAway') {
    hint = 'Pea seni beklerken uyuya kalmış gibi görünüyor 😴';
  }

  let sleepCountdownText: string | null = null;
  if (pea.isSleeping && pea.sleepStartTime) {
    const elapsed = pea.sleepNow - pea.sleepStartTime;
    if (pea.sleepReason === 'manual') {
      // Show elapsed time so the user knows how long Pea has been sleeping
      const totalSecs = Math.floor(elapsed / 1000);
      if (totalSecs < 60) {
        sleepCountdownText = `Uyuyor… ${totalSecs} saniye`;
      } else {
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        sleepCountdownText = secs === 0
          ? `Uyuyor… ${mins} dakika`
          : `Uyuyor… ${mins} dk ${secs} sn`;
      }
    } else if (pea.sleepReason === 'tiredFromPlay') {
      const remaining = Math.max(0, TIRED_SLEEP_MS - elapsed);
      const secs = Math.ceil(remaining / 1000);
      if (secs > 0) sleepCountdownText = `Dinleniyor: ${secs} sn`;
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={['#F0FDF4', '#FFFFFF']}
          style={StyleSheet.absoluteFill}
        />
        {/* Floating leaf decorations */}
        <Text style={[styles.leaf, { top: '6%',  left: '4%',  transform: [{ rotate: '-20deg' }] }]}>🍃</Text>
        <Text style={[styles.leaf, { top: '12%', right: '6%', transform: [{ rotate: '30deg'  }] }]}>🍃</Text>
        <Text style={[styles.leaf, { top: '35%', left: '2%',  transform: [{ rotate: '15deg'  }] }]}>🍃</Text>
        <Text style={[styles.leaf, { top: '50%', right: '3%', transform: [{ rotate: '-35deg' }] }]}>🍃</Text>
        <Text style={[styles.leaf, { top: '70%', left: '7%',  transform: [{ rotate: '25deg'  }] }]}>🍃</Text>
        <Text style={[styles.leaf, { top: '80%', right: '5%', transform: [{ rotate: '-10deg' }] }]}>🍃</Text>
      {/* ANA İÇERİK */}
      <View style={styles.mainContent}>
        {/* Üst bar: başlık + coin */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.nameRow}
            onPress={() => { setRenameInput(peaName); setIsRenameOpen(true); }}
            activeOpacity={0.7}
          >
            <Text style={styles.title}>{peaName}</Text>
            <Text style={styles.editNameIcon}>✏️</Text>
          </TouchableOpacity>
          <View style={styles.coinBadge}>
            <Text style={styles.coinEmoji}>💰</Text>
            <Text style={styles.coinText}>{pea.coins}</Text>
          </View>
        </View>

        {/* Aktif boost göstergeleri */}
        {(pea.xpBoostExpiry > Date.now() || pea.autoWaterExpiry > Date.now()) && (
          <View style={styles.boostsRow}>
            {pea.xpBoostExpiry > Date.now() && (
              <View style={styles.boostPill}>
                <Text style={styles.boostPillText}>🌟 2× XP aktif</Text>
              </View>
            )}
            {pea.autoWaterExpiry > Date.now() && (
              <View style={styles.boostPill}>
                <Text style={styles.boostPillText}>💧 Oto su aktif</Text>
              </View>
            )}
          </View>
        )}

        {/* XP ilerleme çubuğu */}
        <View style={styles.xpRow}>
          <Text style={styles.xpLevelLabel}>⭐ {pea.level}</Text>
          <View style={styles.xpBarBg}>
            <View
              style={[
                styles.xpBarFill,
                { width: `${Math.round((pea.xpProgress.current / pea.xpProgress.needed) * 100)}%` },
              ]}
            />
          </View>
          <Text style={styles.xpNumbers}>
            {pea.xpProgress.current}/{pea.xpProgress.needed}
          </Text>
          {pea.streak > 0 && (
            <View style={styles.streakBadge}>
              <Text style={styles.streakText}>🔥 {pea.streak}</Text>
            </View>
          )}
        </View>

        <View style={styles.peaWrapper}>
          {pea.isSleeping && <DreamBubblesLayer />}
          <PeaWithEffects
            level={pea.level}
            sprite={pea.isSleeping ? peaSprites['sleepy'] : peaSprites[pea.mood]}
            scaleAnim={peaScaleAnim}
            accessories={pea.accessories}
          />
        </View>

        <View style={styles.statBarsCard}>
          {([
            { emoji: '💧', label: 'Su',      value: pea.water,  color: '#3B82F6' },
            { emoji: '☀️', label: 'Güneş',   value: pea.sun,    color: '#F59E0B' },
            { emoji: '🌱', label: 'Toprak',  value: pea.soil,   color: '#84CC16' },
            { emoji: '🎮', label: 'Eğlence', value: pea.fun,    color: '#8B5CF6' },
            { emoji: '⚡', label: 'Enerji',  value: pea.energy, color: '#F97316' },
          ] as const).map(({ emoji, label, value, color }) => {
            const filled = Math.max(0, Math.min(100, Math.round(value)));
            const empty  = 100 - filled;
            return (
              <View key={emoji} style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 3 }}>
                <Text style={{ width: 22, fontSize: 13 }}>{emoji}</Text>
                <Text style={{ width: 52, fontSize: 12, color: '#374151', fontWeight: '600' }}>{label}</Text>
                <View style={{ flex: 1, height: 8, flexDirection: 'row', borderRadius: 4, backgroundColor: '#E5E7EB', marginHorizontal: 8 }}>
                  {filled > 0 && <View style={{ flex: filled, height: 8, backgroundColor: color, borderRadius: 4 }} />}
                  {empty  > 0 && <View style={{ flex: empty }} />}
                </View>
                <Text style={{ width: 34, fontSize: 11, fontWeight: '700', color: '#6B7280', textAlign: 'right' }}>{filled}%</Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.hint}>{hint}</Text>

        {sleepCountdownText && (
          <Text style={styles.sleepCountdown}>{sleepCountdownText}</Text>
        )}

        {/* Emoji partikülleri */}
        <View style={styles.particlesLayer} pointerEvents="none">
          {particles.map(p => (
            <EmojiParticle key={p.id} kind={p.kind} />
          ))}
        </View>

        {/* Ana butonlar */}
        <View style={styles.buttonsRow}>
          <ActionButton label="Su Ver 💧" onPress={giveWater} color="#3B82F6" />
          <ActionButton label="Güneş ☀️"  onPress={giveSun}   color="#F59E0B" />
        </View>

        <View style={styles.buttonsRow}>
          <ActionButton label="Toprak 🌱"    onPress={giveSoil} color="#84CC16" />
          <ActionButton label="Oyun Oyna 🎮" onPress={play}     color="#8B5CF6" />
        </View>

        <View style={styles.buttonsRow}>
          <ActionButton
            label={pea.isSleeping ? 'Uyandır 😴➡️😊' : 'Uyut 😴'}
            onPress={toggleSleep}
            color="#6B7280"
          />
          <ActionButton label="Dükkan 🛒" onPress={() => setIsShopOpen(true)} color="#EC4899" />
        </View>

        {/* Seviye atlama kutlaması */}
        {levelUpState !== null && (
          <LevelUpBanner
            key={levelUpState.key}
            level={levelUpState.level}
            onDone={() => setLevelUpState(null)}
          />
        )}
      </View>

      {/* Sabit alt sekme çubuğu */}
      <View style={styles.bottomTabBar}>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setIsQuestsOpen(true)}
          activeOpacity={0.7}
        >
          <View style={styles.tabIconWrap}>
            <Text style={styles.tabIcon}>📋</Text>
            {quests.quests.filter(q => !q.completed).length > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>
                  {quests.quests.filter(q => !q.completed).length}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.tabLabel}>Görevler</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => { reloadStats(); setIsStatsOpen(true); }}
          activeOpacity={0.7}
        >
          <Text style={styles.tabIcon}>📊</Text>
          <Text style={styles.tabLabel}>İstatistik</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setIsAchievementsOpen(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.tabIcon}>🏅</Text>
          <Text style={styles.tabLabel}>Rozetler</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => { reloadStats(); setIsShareOpen(true); }}
          activeOpacity={0.7}
        >
          <Text style={styles.tabIcon}>📸</Text>
          <Text style={styles.tabLabel}>Paylaş</Text>
        </TouchableOpacity>
      </View>
      </SafeAreaView>

      {/* Oyunlar overlay — Modal ile tam ekran, status bar dahil */}
      <Modal
        visible={isGameOpen}
        transparent={false}
        presentationStyle="fullScreen"
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => { setIsGameOpen(false); setGameMode(null); }}
      >
        <View style={styles.gameOverlay}>
            {gameMode === 'menu' && (
              <>
                <View style={styles.gameMenuHeader}>
                  <Text style={styles.gameTitle}>Oyunlar 🎮</Text>
                  <Text style={styles.gameSubtitle}>
                    Pea şu an oyun seçiyor. Hangisini oynayalım?
                  </Text>

                  {pea.flappyHighScore > 0 && (
                    <View style={styles.gameMenuStats}>
                      <Text style={styles.gameMenuStatsLabel}>Flappy Pea rekorun</Text>
                      <Text style={styles.gameMenuStatsValue}>
                        {pea.flappyHighScore} 🪽
                      </Text>
                    </View>
                  )}
                </View>

                {/* Böcek Yakala */}
                <TouchableOpacity
                  style={styles.gameOptionCard}
                  onPress={() => {
                    pea.startPlayingMood('Pea böcek kovalıyor 🪰');
                    setGameMode('bug');
                  }}
                >
                  <View style={styles.gameOptionHeader}>
                    <Text style={styles.gameOptionTitle}>Böcek Yakala 🪰</Text>
                    <Text style={styles.gameOptionTag}>30 saniye</Text>
                  </View>
                  <Text style={styles.gameOptionDesc}>
                    Uçan böceklere dokun, yakala! Arı 🐝 = 3 puan ama çok hızlı. Kaçarsa -1 puan.
                  </Text>
                  <View style={styles.gameOptionStatsRow}>
                    <Text style={styles.gameOptionStatPositive}>Eğlence: ++</Text>
                    <Text style={styles.gameOptionStatNegative}>Enerji: -</Text>
                  </View>
                </TouchableOpacity>

                {/* Hafıza Oyunu */}
                <TouchableOpacity
                  style={styles.gameOptionCard}
                  onPress={() => {
                    pea.startPlayingMood('Pea hafıza oyununa hazırlanıyor 🃏');
                    setGameMode('memory');
                  }}
                >
                  <View style={styles.gameOptionHeader}>
                    <Text style={styles.gameOptionTitle}>Hafıza Oyunu 🃏</Text>
                    <Text style={styles.gameOptionTag}>4×4 Kart</Text>
                  </View>
                  <Text style={styles.gameOptionDesc}>
                    Kartları çevir, eşleşen çiftleri bul! Az hamlede bitirirsen daha çok coin kazanırsın.
                  </Text>
                  <View style={styles.gameOptionStatsRow}>
                    <Text style={styles.gameOptionStatPositive}>Eğlence: ++</Text>
                    <Text style={styles.gameOptionStatNegative}>Enerji: -</Text>
                  </View>
                </TouchableOpacity>

                {/* Flappy Pea */}
                <TouchableOpacity
                  style={styles.gameOptionCard}
                  onPress={() => {
                    pea.startPlayingMood('Pea uçmaya hazırlanıyor! 🪽');
                    setGameMode('flappy');
                  }}
                >
                  <View style={styles.gameOptionHeader}>
                    <Text style={styles.gameOptionTitle}>Flappy Pea 🪽</Text>
                    <Text style={styles.gameOptionTag}>Zorluk: Orta</Text>
                  </View>
                  <Text style={styles.gameOptionDesc}>
                    Ekrana dokunarak Pea'yi uçur, borulara değmeden aralardan geçmeye çalış.
                  </Text>
                  <View style={styles.gameOptionStatsRow}>
                    <Text style={styles.gameOptionStatPositive}>Eğlence: +++</Text>
                    <Text style={styles.gameOptionStatNegative}>Enerji: --</Text>
                  </View>
                </TouchableOpacity>

                {/* Coin Yağmuru */}
                <TouchableOpacity
                  style={styles.gameOptionCard}
                  onPress={() => {
                    pea.startPlayingMood('Pea coin toplamaya hazır! 💰');
                    setGameMode('coin');
                  }}
                >
                  <View style={styles.gameOptionHeader}>
                    <Text style={styles.gameOptionTitle}>Coin Yağmuru 💰</Text>
                    <Text style={styles.gameOptionTag}>30 saniye</Text>
                  </View>
                  <Text style={styles.gameOptionDesc}>
                    Sol/sağ dokun, Pea'yi hareket ettir. Coinleri topla, kaktüslere çarpma!
                  </Text>
                  <View style={styles.gameOptionStatsRow}>
                    <Text style={styles.gameOptionStatPositive}>Eğlence: ++</Text>
                    <Text style={styles.gameOptionStatNegative}>Enerji: -</Text>
                  </View>
                </TouchableOpacity>

                {/* Bahçe Bakımı */}
                <TouchableOpacity
                  style={styles.gameOptionCard}
                  onPress={() => {
                    pea.startPlayingMood('Pea bahçesini sulamaya hazır! 🌿');
                    setGameMode('garden');
                  }}
                >
                  <View style={styles.gameOptionHeader}>
                    <Text style={styles.gameOptionTitle}>Bahçe Bakımı 🌿</Text>
                    <Text style={styles.gameOptionTag}>45 saniye</Text>
                  </View>
                  <Text style={styles.gameOptionDesc}>
                    6 bitkiyi sulaman lazım! Bitkilere bas ve basılı tut. Su barı boşalırsa bitki solar!
                  </Text>
                  <View style={styles.gameOptionStatsRow}>
                    <Text style={styles.gameOptionStatPositive}>Eğlence: +++</Text>
                    <Text style={styles.gameOptionStatNegative}>Enerji: -</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.gameExitButton}
                  onPress={() => { setIsGameOpen(false); setGameMode(null); }}
                >
                  <Text style={styles.gameExitText}>Kapat</Text>
                </TouchableOpacity>
              </>
            )}

            {gameMode === 'bug' && (
              <BugGame
                onFinished={(score) => {
                  quests.trackGamePlayed();
                  if (score > 0) quests.trackBugCatch(score);
                  pea.onBugGameFinished(score);
                  achievements.checkAndUnlock();
                }}
                onClose={() => { setIsGameOpen(false); setGameMode(null); }}
              />
            )}

            {gameMode === 'memory' && (
              <MemoryGame
                onClose={() => { setIsGameOpen(false); setGameMode(null); }}
                onFinished={(score) => {
                  quests.trackGamePlayed();
                  if (score > 0) quests.trackMemoryComplete();
                  pea.onMemoryFinished(score);
                  achievements.checkAndUnlock();
                }}
              />
            )}

            {gameMode === 'flappy' && (
              <FlappyPeaGame
                sprite={peaSprites[pea.mood]}
                highScore={pea.flappyHighScore}
                onClose={() => { setIsGameOpen(false); setGameMode(null); }}
                onFinished={handleFlappyFinished}
              />
            )}

            {gameMode === 'coin' && (
              <CoinGame
                sprite={peaSprites[pea.mood]}
                onFinished={(score) => {
                  quests.trackGamePlayed();
                  if (score > 0) quests.trackCoinScore(score);
                  pea.onCoinGameFinished(score);
                  achievements.checkAndUnlock();
                }}
                onClose={() => { setIsGameOpen(false); setGameMode(null); }}
              />
            )}

            {gameMode === 'garden' && (
              <GardenGame
                onFinished={(score) => {
                  quests.trackGamePlayed();
                  if (score > 0) quests.trackGardenPlants(score);
                  pea.onGardenGameFinished(score);
                  achievements.checkAndUnlock();
                }}
                onClose={() => { setIsGameOpen(false); setGameMode(null); }}
              />
            )}
        </View>
      </Modal>
      {/* Dükkan overlay */}
      <Modal
        visible={isShopOpen}
        transparent={false}
        presentationStyle="fullScreen"
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setIsShopOpen(false)}
      >
        <ShopScreen
          coins={pea.coins}
          xpBoostExpiry={pea.xpBoostExpiry}
          autoWaterExpiry={pea.autoWaterExpiry}
          accessories={pea.accessories}
          onBuyXpBoost={pea.buyXpBoost}
          onBuyStatBoost={pea.buyStatBoost}
          onBuyAutoWater={pea.buyAutoWater}
          onBuyEnergyDrink={pea.buyEnergyDrink}
          onBuyLuckyBox={pea.buyLuckyBox}
          onBuyFoodWater={pea.buyFoodWater}
          onBuyFoodSun={pea.buyFoodSun}
          onBuyFoodSoil={pea.buyFoodSoil}
          onBuyFoodFun={pea.buyFoodFun}
          onBuyHat={pea.buyHat}
          onBuyRainbowAura={pea.buyRainbowAura}
          onBuyGoldFrame={pea.buyGoldFrame}
          onClose={() => setIsShopOpen(false)}
        />
      </Modal>

      {/* İstatistikler overlay */}
      <Modal
        visible={isStatsOpen}
        transparent={false}
        presentationStyle="fullScreen"
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setIsStatsOpen(false)}
      >
        <StatsScreen
          stats={stats}
          onClose={() => setIsStatsOpen(false)}
        />
      </Modal>

      {/* Görevler overlay */}
      <Modal
        visible={isQuestsOpen}
        transparent={false}
        presentationStyle="fullScreen"
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setIsQuestsOpen(false)}
      >
        <QuestsScreen
          quests={quests.quests}
          onClose={() => setIsQuestsOpen(false)}
        />
      </Modal>

      {/* İlk açılış: isim verme ekranı */}
      <Modal
        visible={showNameScreen}
        transparent={false}
        presentationStyle="fullScreen"
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => { saveName('Pea'); setShowNameScreen(false); }}
      >
        <NameInputScreen
          onConfirm={name => { saveName(name); setShowNameScreen(false); }}
        />
      </Modal>

      {/* Seri milestone kutlama modalı */}
      <Modal
        visible={streakModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setStreakModal(null)}
      >
        <View style={styles.streakModalOverlay}>
          <View style={styles.streakModalCard}>
            <Text style={styles.streakModalFire}>🔥</Text>
            <Text style={styles.streakModalDays}>{streakModal?.streak} Günlük Seri!</Text>
            <Text style={styles.streakModalSub}>Tebrikler, her gün geri geldin!</Text>
            <View style={styles.streakModalReward}>
              <Text style={styles.streakModalRewardText}>
                +{streakModal?.coins} 💰 bonus coin kazandın!
              </Text>
            </View>
            <TouchableOpacity
              style={styles.streakModalButton}
              onPress={() => setStreakModal(null)}
            >
              <Text style={styles.streakModalButtonText}>Harika! 🎉</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Pea kartı paylaşım modalı */}
      <Modal
        visible={isShareOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsShareOpen(false)}
      >
        <View style={styles.shareOverlay}>
          <View ref={cardRef} collapsable={false}>
            <PeaCard
              name={peaName}
              level={pea.level}
              streak={pea.streak}
              totalCoins={stats.totalCoins}
              daysPlayed={getDaysPlayed(stats.firstPlayDate)}
              achievement={getBestAchievement(
                pea.level,
                pea.streak,
                stats.totalCoins,
                Object.values(stats.gamesPlayed).reduce((a, b) => a + b, 0),
                stats.careActions.water + stats.careActions.sun + stats.careActions.soil,
              )}
              accessories={pea.accessories}
              sprite={peaSprites[pea.isSleeping ? 'sleepy' : pea.mood]}
            />
          </View>
          <TouchableOpacity style={styles.shareActionButton} onPress={handleShare}>
            <Text style={styles.shareActionText}>Paylaş 📤</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareCloseButton} onPress={() => setIsShareOpen(false)}>
            <Text style={styles.shareCloseText}>Kapat</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Rozetler overlay */}
      <Modal
        visible={isAchievementsOpen}
        transparent={false}
        presentationStyle="fullScreen"
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setIsAchievementsOpen(false)}
      >
        <AchievementsScreen
          badges={achievements.badges}
          onClose={() => setIsAchievementsOpen(false)}
        />
      </Modal>

      {/* Yeni rozet kazanıldı modalı */}
      <Modal
        visible={achievements.newBadge !== null}
        transparent
        animationType="fade"
        onRequestClose={achievements.clearNewBadge}
      >
        <View style={styles.badgeModalOverlay}>
          <View style={styles.badgeModalCard}>
            <Text style={styles.badgeModalEmoji}>{achievements.newBadge?.emoji}</Text>
            <Text style={styles.badgeModalTitle}>Yeni Rozet!</Text>
            <Text style={styles.badgeModalName}>{achievements.newBadge?.name}</Text>
            <Text style={styles.badgeModalDesc}>{achievements.newBadge?.description}</Text>
            <TouchableOpacity
              style={styles.badgeModalButton}
              onPress={achievements.clearNewBadge}
            >
              <Text style={styles.badgeModalButtonText}>Harika! 🎉</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* İsim değiştirme modalı */}
      <Modal
        visible={isRenameOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsRenameOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.renameOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.renameCard}>
            <Text style={styles.renameTitle}>İsmi Değiştir ✏️</Text>
            <TextInput
              style={styles.renameInput}
              value={renameInput}
              onChangeText={setRenameInput}
              maxLength={20}
              placeholder="Yeni isim…"
              placeholderTextColor="#9CA3AF"
              returnKeyType="done"
              onSubmitEditing={() => {
                saveName(renameInput);
                setIsRenameOpen(false);
              }}
              autoFocus
              selectionColor="#22C55E"
            />
            <View style={styles.renameButtons}>
              <TouchableOpacity
                style={styles.renameCancelButton}
                onPress={() => setIsRenameOpen(false)}
              >
                <Text style={styles.renameCancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.renameSaveButton}
                onPress={() => { saveName(renameInput); setIsRenameOpen(false); }}
              >
                <Text style={styles.renameSaveText}>Kaydet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

// ── LevelUpBanner ─────────────────────────────────────────────────────────────

function LevelUpBanner({ level, onDone }: { level: number; onDone: () => void }) {
  const scale   = useRef(new Animated.Value(0.3)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scale,   { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]),
      Animated.delay(1600),
      Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(() => onDone());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View
      style={[styles.levelUpBanner, { opacity, transform: [{ scale }] }]}
      pointerEvents="none"
    >
      <Text style={styles.levelUpEmoji}>🌟</Text>
      <Text style={styles.levelUpTitle}>Seviye {level}!</Text>
      <Text style={styles.levelUpSub}>Pea büyüdü!</Text>
    </Animated.View>
  );
}

// ── EmojiParticle ─────────────────────────────────────────────────────────────

type EmojiParticleProps = { kind: ParticleKind };

function EmojiParticle({ kind }: EmojiParticleProps) {
  const opacity    = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(10)).current;
  const translateX = useRef(new Animated.Value((Math.random() - 0.5) * 80)).current;
  const scale      = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: -20,  duration: 500, useNativeDriver: true }),
      Animated.timing(opacity,    { toValue: 0,    duration: 500, useNativeDriver: true }),
      Animated.timing(scale,      { toValue: 1.2,  duration: 500, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY, scale]);

  let emoji = '💧';
  if (kind === 'sun')  emoji = '☀️';
  if (kind === 'soil') emoji = '🌱';

  return (
    <Animated.Text
      style={[
        styles.particleEmoji,
        { opacity, transform: [{ translateY }, { translateX }, { scale }] },
      ]}
    >
      {emoji}
    </Animated.Text>
  );
}

// ── PeaWithEffects ────────────────────────────────────────────────────────────
//
// Layout (column, centred):
//
//   ┌─ crownArea (240×40, always present) ─┐
//   │  👑 visible here when level >= 4     │
//   └───────────────────────────────────────┘
//   ┌─ peaStage (240×240, NO elevation) ───┐
//   │  • Pea Animated.View (has elevation) │
//   │  • ✨ sparkles (absolute, level 2+)  │
//   │  • rainbow ring inside pea view      │
//   └───────────────────────────────────────┘

type PeaWithEffectsProps = {
  level: number;
  sprite: ReturnType<typeof require>;
  scaleAnim: Animated.Value;
  accessories: string[];
};

function PeaWithEffects({ level, sprite, scaleAnim, accessories }: PeaWithEffectsProps) {
  const rainbowAnim = useRef(new Animated.Value(0)).current;

  const showRainbow = level >= 5 || accessories.includes('rainbowAura');

  useEffect(() => {
    if (!showRainbow) { rainbowAnim.setValue(0); return; }
    const loop = Animated.loop(
      Animated.timing(rainbowAnim, { toValue: 1, duration: 2500, useNativeDriver: false })
    );
    loop.start();
    return () => loop.stop();
  }, [level, accessories]); // eslint-disable-line react-hooks/exhaustive-deps

  const rainbowColor = rainbowAnim.interpolate({
    inputRange:  [0, 1/6, 2/6, 3/6, 4/6, 5/6, 1],
    outputRange: ['#FF6B6B', '#FFB347', '#FFD700', '#90EE90', '#87CEEB', '#DDA0DD', '#FF6B6B'],
  });

  const glowStyle = (level >= 3 || accessories.includes('goldFrame'))
    ? { shadowColor: '#F59E0B', shadowOpacity: 0.9, shadowRadius: 24,
        shadowOffset: { width: 0, height: 0 } as const, elevation: 24 }
    : { shadowColor: '#000',    shadowOpacity: 0.2, shadowRadius: 8,
        shadowOffset: { width: 0, height: 6 } as const, elevation: 8 };

  return (
    <View style={styles.peaColumn}>
      {/* ── Crown area: always 40px tall ── */}
      <View style={styles.crownArea}>
        <View style={styles.crownRow}>
          {accessories.includes('hat') && <HatBob />}
          {level >= 4 && <Crown />}
        </View>
      </View>

      {/* ── Stage: fixed 240×240, no elevation → sparkles never clipped ── */}
      <View style={styles.peaStage}>
        {/* Pea has elevation; only children that stay inside its bounds */}
        <Animated.View style={[styles.pea, glowStyle, { transform: [{ scale: scaleAnim }] }]}>
          {/* Altın çerçeve (dış halka) */}
          {accessories.includes('goldFrame') && (
            <View pointerEvents="none" style={styles.goldFrame} />
          )}
          {/* Gökkuşağı aura (iç halka, animasyonlu) */}
          {showRainbow && (
            <Animated.View
              pointerEvents="none"
              style={[styles.rainbowRing, { borderColor: rainbowColor }]}
            />
          )}
          <Image source={sprite} style={styles.peaImage} resizeMode="contain" />
        </Animated.View>

        {/* Sparkles: absolute within peaStage — safe from elevation clipping */}
        {level >= 2 && <Sparkle style={styles.sparkleTopLeft}     phaseMs={0}    />}
        {level >= 2 && <Sparkle style={styles.sparkleTopRight}    phaseMs={350}  />}
        {level >= 2 && <Sparkle style={styles.sparkleMidLeft}     phaseMs={700}  />}
        {level >= 2 && <Sparkle style={styles.sparkleMidRight}    phaseMs={1050} />}
      </View>
    </View>
  );
}

// ── Crown ─────────────────────────────────────────────────────────────────────

function Crown() {
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, { toValue: -5, duration: 700, useNativeDriver: true }),
        Animated.timing(translateY, { toValue:  0, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, [translateY]);

  return (
    <Animated.Text style={[styles.peaCrown, { transform: [{ translateY }] }]}>
      {'👑'}
    </Animated.Text>
  );
}

// ── HatBob ────────────────────────────────────────────────────────────────────

function HatBob() {
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, { toValue: -4, duration: 800, useNativeDriver: true }),
        Animated.timing(translateY, { toValue:  0, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [translateY]);

  return (
    <Animated.Text style={[styles.peaHat, { transform: [{ translateY }] }]}>
      {'🎩'}
    </Animated.Text>
  );
}

// ── Sparkle ───────────────────────────────────────────────────────────────────

type SparkleProps = { style: object; phaseMs: number };

function Sparkle({ style, phaseMs }: SparkleProps) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity    = useRef(new Animated.Value(0.5)).current;
  const scale      = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    const t = setTimeout(() => {
      loop = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(translateY, { toValue: -13, duration: 850, useNativeDriver: true }),
            Animated.timing(opacity,    { toValue: 1,   duration: 425, useNativeDriver: true }),
            Animated.timing(scale,      { toValue: 1.3, duration: 850, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(translateY, { toValue: 0,   duration: 850, useNativeDriver: true }),
            Animated.timing(opacity,    { toValue: 0.4, duration: 425, useNativeDriver: true }),
            Animated.timing(scale,      { toValue: 0.7, duration: 850, useNativeDriver: true }),
          ]),
        ])
      );
      loop.start();
    }, phaseMs);
    return () => {
      clearTimeout(t);
      loop?.stop();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.Text
      pointerEvents="none"
      style={[styles.sparkle, style, { opacity, transform: [{ translateY }, { scale }] }]}
    >
      ✨
    </Animated.Text>
  );
}

// ── DreamBubbles ──────────────────────────────────────────────────────────────

const DREAM_EMOJIS = ['🌈', '⭐', '🍕', '🎮', '🌸', '🦋', '🍉', '🎠'];

type DreamBubbleItem = { id: number; emoji: string; offsetX: number };

function DreamBubblesLayer() {
  const [bubbles, setBubbles] = useState<DreamBubbleItem[]>([]);
  const nextId = useRef(0);

  useEffect(() => {
    const spawn = () => {
      const emoji   = DREAM_EMOJIS[Math.floor(Math.random() * DREAM_EMOJIS.length)];
      const offsetX = (Math.random() - 0.5) * 64; // –32 … +32 px from center
      setBubbles(prev => [...prev, { id: nextId.current++, emoji, offsetX }]);
    };
    spawn();
    const id = setInterval(spawn, 1500);
    return () => clearInterval(id);
  }, []);

  const remove = (id: number) => setBubbles(prev => prev.filter(b => b.id !== id));

  return (
    <View style={[StyleSheet.absoluteFill, styles.dreamLayer]} pointerEvents="none">
      {bubbles.map(b => (
        <DreamBubble key={b.id} item={b} onDone={() => remove(b.id)} />
      ))}
    </View>
  );
}

function DreamBubble({ item, onDone }: { item: DreamBubbleItem; onDone: () => void }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const scale      = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.sequence([
      // Pop in
      Animated.parallel([
        Animated.spring(scale,   { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 350,            useNativeDriver: true }),
      ]),
      // Float up, then fade out
      Animated.parallel([
        Animated.timing(translateY, { toValue: -180, duration: 3200, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(1200),
          Animated.timing(opacity, { toValue: 0, duration: 2000, useNativeDriver: true }),
        ]),
      ]),
    ]).start(() => onDone());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Animated.View
      style={[
        styles.dreamBubble,
        { transform: [{ translateX: item.offsetX }, { translateY }, { scale }], opacity },
      ]}
    >
      {/* Main circle */}
      <View style={styles.dreamCircle}>
        <Text style={styles.dreamEmoji}>{item.emoji}</Text>
      </View>
      {/* Speech-bubble tail: three circles leading down toward Pea */}
      <View style={styles.dreamDot1} />
      <View style={styles.dreamDot2} />
      <View style={styles.dreamDot3} />
    </Animated.View>
  );
}

// ── ActionButton ──────────────────────────────────────────────────────────────

type ActionButtonProps = { label: string; onPress: () => void; color: string };

function ActionButton({ label, onPress, color }: ActionButtonProps) {
  return (
    <TouchableOpacity style={[styles.button, { backgroundColor: color }]} onPress={onPress}>
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 32,
  },
  leaf: {
    position: 'absolute',
    fontSize: 22,
    opacity: 0.3,
    pointerEvents: 'none',
  },
  mainContent: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
  },
  peaWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pea: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 8,
    elevation: 8,
  },
  peaImage: {
    width: 200,
    height: 200,
  },
  statBarsCard: {
    width: '88%',
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 7,
    marginBottom: 10,
  },
  statBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statBarEmoji: {
    fontSize: 14,
    width: 20,
    textAlign: 'center',
  },
  statBarLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
    width: 44,
  },
  statBarTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
  },
  statBarFill: {
    height: 8,
    borderRadius: 999,
  },
  statBarValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    width: 32,
    textAlign: 'right',
  },
  hint: {
    fontSize: 16,
    textAlign: 'center',
    marginHorizontal: 24,
    marginBottom: 4,
  },
  sleepCountdown: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
    color: '#374151',
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    marginHorizontal: 4,
    marginVertical: 4,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  gameOverlay: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  gameTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
    color: '#111827',
  },
  gameSubtitle: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 12,
  },
  gameExitButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#111827',
  },
  gameExitText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F9FAFB',
    textAlign: 'center',
  },
  gameMenuHeader: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  gameMenuStats: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#EEF2FF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gameMenuStatsLabel: {
    fontSize: 13,
    color: '#4F46E5',
    fontWeight: '500',
  },
  gameMenuStatsValue: {
    fontSize: 14,
    color: '#1D4ED8',
    fontWeight: '700',
  },
  gameOptionCard: {
    width: '100%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  gameOptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  gameOptionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  gameOptionTag: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  gameOptionDesc: {
    fontSize: 13,
    color: '#4B5563',
  },
  gameOptionStatsRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  gameOptionStatPositive: {
    marginRight: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#DCFCE7',
    color: '#166534',
    fontSize: 11,
    fontWeight: '600',
  },
  gameOptionStatNegative: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#FEE2E2',
    color: '#B91C1C',
    fontSize: 11,
    fontWeight: '600',
  },
  particlesLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  particleEmoji: {
    position: 'absolute',
    fontSize: 28,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  statsButton: {
    backgroundColor: '#15803D',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 999,
    marginHorizontal: 4,
    marginVertical: 4,
  },
  statsButtonText: {
    color: '#F0FDF4',
    fontWeight: '600',
    fontSize: 14,
  },
  questsButton: {
    backgroundColor: '#16A34A',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    marginHorizontal: 4,
    marginVertical: 4,
  },
  questsButtonText: {
    color: '#F0FDF4',
    fontWeight: '600',
    fontSize: 14,
  },
  questsBadge: {
    color: '#BBF7D0',
    fontWeight: '700',
  },
  topBar: {
    width: '100%',
    paddingHorizontal: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  coinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FACC15',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  coinEmoji: {
    fontSize: 14,
    marginRight: 4,
  },
  coinText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  boostsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
    paddingHorizontal: 24,
  },
  boostPill: {
    backgroundColor: '#BBF7D0',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  boostPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#14532D',
  },
  xpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 24,
    marginBottom: 6,
    gap: 8,
  },
  xpLevelLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1D4ED8',
    minWidth: 42,
  },
  xpBarBg: {
    flex: 1,
    height: 7,
    backgroundColor: '#DBEAFE',
    borderRadius: 99,
    overflow: 'hidden',
  },
  xpBarFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 99,
  },
  xpNumbers: {
    fontSize: 11,
    color: '#6B7280',
    minWidth: 48,
    textAlign: 'right',
  },
  levelUpBanner: {
    position: 'absolute',
    alignSelf: 'center',
    top: '32%',
    backgroundColor: '#FEF3C7',
    borderRadius: 24,
    paddingHorizontal: 32,
    paddingVertical: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 16,
    zIndex: 100,
  },
  levelUpEmoji: {
    fontSize: 44,
    marginBottom: 4,
  },
  levelUpTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#92400E',
  },
  levelUpSub: {
    fontSize: 14,
    color: '#B45309',
    marginTop: 2,
  },
  // Column wrapper: crownArea on top, peaStage below
  peaColumn: {
    alignItems: 'center',
  },
  // Always 40px tall so the pea doesn't jump when the crown appears
  crownArea: {
    width: 240,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  // Crown text: no absolute positioning — lives in normal flow inside crownArea
  peaCrown: {
    fontSize: 28,
    textAlign: 'center',
  },
  peaHat: {
    fontSize: 26,
    textAlign: 'center',
  },
  // Fixed-size container with no elevation so sparkles are never clipped
  peaStage: {
    width: 240,
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rainbowRing: {
    position: 'absolute',
    width: 208,
    height: 208,
    borderRadius: 104,
    borderWidth: 4,
  },
  goldFrame: {
    position: 'absolute',
    width: 218,
    height: 218,
    borderRadius: 109,
    borderWidth: 3,
    borderColor: '#F59E0B',
  },
  sparkleTopLeft:  { position: 'absolute', fontSize: 18, top: 12,  left:  18 },
  sparkleTopRight: { position: 'absolute', fontSize: 18, top: 12,  right: 18 },
  sparkleMidLeft:  { position: 'absolute', fontSize: 18, top: 108, left:  4  },
  sparkleMidRight: { position: 'absolute', fontSize: 18, top: 108, right: 4  },
  sparkle: {
    position: 'absolute',
    fontSize: 18,
  },
  // ── Streak ────────────────────────────────────────────────────────────────
  streakBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  streakText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  streakModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  streakModalCard: {
    backgroundColor: '#FFF7ED',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 16,
    width: '100%',
  },
  streakModalFire: {
    fontSize: 56,
    marginBottom: 8,
  },
  streakModalDays: {
    fontSize: 26,
    fontWeight: '800',
    color: '#92400E',
    marginBottom: 4,
    textAlign: 'center',
  },
  streakModalSub: {
    fontSize: 15,
    color: '#B45309',
    textAlign: 'center',
    marginBottom: 16,
  },
  streakModalReward: {
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#F59E0B',
  },
  streakModalRewardText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#92400E',
    textAlign: 'center',
  },
  streakModalButton: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 999,
    minWidth: 180,
  },
  streakModalButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  dreamLayer: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 130, // start bubbles just above Pea's head
  },
  dreamBubble: {
    position: 'absolute',
    bottom: 130,
    alignItems: 'center',
  },
  dreamCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: 'rgba(255,255,255,0.93)',
    borderWidth: 1.5,
    borderColor: 'rgba(200,220,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#B0C4DE',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  dreamEmoji: {
    fontSize: 30,
  },
  dreamDot1: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(200,220,255,0.6)',
    marginTop: 5,
  },
  dreamDot2: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(200,220,255,0.5)',
    marginTop: 4,
  },
  dreamDot3: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(200,220,255,0.4)',
    marginTop: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editNameIcon: {
    fontSize: 14,
    opacity: 0.7,
  },
  renameOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  renameCard: {
    width: '100%',
    backgroundColor: '#F0FDF4',
    borderRadius: 20,
    padding: 24,
    gap: 16,
  },
  renameTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#14532D',
    textAlign: 'center',
  },
  renameInput: {
    backgroundColor: '#DCFCE7',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#14532D',
    borderWidth: 2,
    borderColor: '#22C55E',
    textAlign: 'center',
  },
  renameButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  renameCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
  },
  renameCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  renameSaveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#15803D',
    alignItems: 'center',
  },
  renameSaveText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F0FDF4',
  },
  // ── Achievements ───────────────────────────────────────────────────────────
  achievementsButton: {
    backgroundColor: '#D97706',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    marginHorizontal: 4,
    marginVertical: 4,
  },
  achievementsButtonText: {
    color: '#FFFBEB',
    fontWeight: '700',
    fontSize: 14,
  },
  achievementsBadgeCount: {
    color: '#FEF3C7',
    fontWeight: '700',
  },
  badgeModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  badgeModalCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
    elevation: 20,
    width: '100%',
    borderWidth: 2,
    borderColor: '#FDE68A',
  },
  badgeModalEmoji: {
    fontSize: 64,
    marginBottom: 10,
  },
  badgeModalTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B45309',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  badgeModalName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#92400E',
    marginBottom: 8,
    textAlign: 'center',
  },
  badgeModalDesc: {
    fontSize: 15,
    color: '#B45309',
    textAlign: 'center',
    marginBottom: 24,
  },
  badgeModalButton: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 36,
    paddingVertical: 13,
    borderRadius: 999,
    minWidth: 180,
  },
  badgeModalButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  // ── Share ──────────────────────────────────────────────────────────────────
  shareButton: {
    backgroundColor: '#059669',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 999,
    marginHorizontal: 4,
    marginVertical: 4,
  },
  shareButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  shareOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 18,
  },
  shareActionButton: {
    backgroundColor: '#15803D',
    paddingHorizontal: 36,
    paddingVertical: 13,
    borderRadius: 999,
  },
  shareActionText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  shareCloseButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  shareCloseText: {
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '600',
    fontSize: 14,
  },
  // ── Bottom tab bar ─────────────────────────────────────────────────────────
  bottomTabBar: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#D1D5DB',
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: -3 },
    shadowRadius: 8,
    elevation: 12,
    paddingTop: 8,
    paddingBottom: 6,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  tabIconWrap: {
    position: 'relative',
    marginBottom: 2,
  },
  tabIcon: {
    fontSize: 22,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#374151',
  },
  tabBadge: {
    position: 'absolute',
    top: -5,
    right: -10,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  tabBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
});
