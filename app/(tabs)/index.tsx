import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TapGame from '../../components/TapGame';
import FlappyPeaGame from '../../components/FlappyPeaGame';
import ReflexGame from '../../components/ReflexGame';


// Pea'nin ruh halleri
type Mood =
  | 'happy'
  | 'thirsty'
  | 'needsSun'
  | 'needsSoil'
  | 'sleepy'
  | 'playing'
  | 'bored';

type SleepReason = 'none' | 'tiredFromPlay' | 'manual' | 'longAway';
type GameMode = 'menu' | 'tap' | 'flappy' | 'reflex' | null;
type ParticleKind = 'water' | 'sun' | 'soil';


function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}

// Statlardan mood hesaplama
function calculateMood(
  water: number,
  sun: number,
  soil: number,
  fun: number,
  energy: number
): Mood {
  if (water < 30) return 'thirsty';
  if (sun < 30) return 'needsSun';
  if (soil < 30) return 'needsSoil';

  if (energy < 15) return 'sleepy';
  if (fun < 20) return 'bored';

  return 'happy';
}

function hintForMood(mood: Mood) {
  switch (mood) {
    case 'thirsty':
      return 'Pea susamış gibi görünüyor 💧';
    case 'needsSun':
      return 'Biraz güneşe ihtiyacı var ☀️';
    case 'needsSoil':
      return 'Toprağı güçlendirelim 🌱';
    case 'sleepy':
      return 'Çok yorulmuş, uykusu gelmiş 😴';
    case 'playing':
      return 'Şu an çok eğleniyor! 😆';
    case 'bored':
      return 'Biraz oyun oynamak istiyor gibi 🎮';
    case 'happy':
    default:
      return 'Pea şu an mutlu görünüyor 🥰';
  }
}

function backgroundForState(mood: Mood, sun: number) {
  if (mood === 'sleepy') return '#E5E7EB';
  if (mood === 'bored') return '#E0E7FF';
  if (sun > 75) return '#FEF9C3';
  if (sun < 30) return '#E0F2FE';
  return '#EFF8FF';
}

// 🔹 Mood → sprite eşlemesi
// BURADAKİ PATHLERİ KENDİ DOSYA İSİMLERİNE GÖRE GÜNCELLE
const peaSprites: Record<Mood, any> = {
  happy: require('../../assets/pea/pea_happy.png'),
  thirsty: require('../../assets/pea/pea_thirsty.png'),
  needsSun: require('../../assets/pea/pea_needs_sun.png'),
  needsSoil: require('../../assets/pea/pea_needs_soil.png'),
  sleepy: require('../../assets/pea/pea_sleepy.png'),
  playing: require('../../assets/pea/pea_happy.png'), // şimdilik happy ile aynı
  bored: require('../../assets/pea/pea_bored.png'),
};

// Uyku süreleri
const SHORT_SLEEP_MS = 5000;
const TIRED_SLEEP_MS = 20000;
const LONG_AWAY_MINUTES = 30;

const INITIAL_WATER  = 60;
const INITIAL_SUN    = 60;
const INITIAL_SOIL   = 60;
const INITIAL_FUN    = 50;
const INITIAL_ENERGY = 80;

export default function HomeScreen() {
  const [water, setWater] = useState(INITIAL_WATER);
  const [sun, setSun] = useState(INITIAL_SUN);
  const [soil, setSoil] = useState(INITIAL_SOIL);
  const [fun, setFun] = useState(INITIAL_FUN);
  const [flappyHighScore, setFlappyHighScore] = useState(0);
  const [energy, setEnergy] = useState(INITIAL_ENERGY);
  const [coins, setCoins] = useState(0);

  const [mood, setMood] = useState<Mood>(() =>
    calculateMood(
      INITIAL_WATER,
      INITIAL_SUN,
      INITIAL_SOIL,
      INITIAL_FUN,
      INITIAL_ENERGY
    )
  );

  const [isSleeping, setIsSleeping] = useState(false);
  const [sleepReason, setSleepReason] = useState<SleepReason>('none');
  const [sleepStartTime, setSleepStartTime] = useState<number | null>(null);
  const [wasLongAway, setWasLongAway] = useState(false);

  const [customMessage, setCustomMessage] = useState<string | null>(null);
  const [sleepNow, setSleepNow] = useState(Date.now());

  // Oyun durumu
  const [isGameOpen, setIsGameOpen] = useState(false);
  const [gameMode, setGameMode] = useState<GameMode>(null);


  // Pea için ölçek animasyonu
  const peaScaleAnim = useRef(new Animated.Value(1)).current;
  const baseScale = 0.9 + (energy / 100) * 0.25;

  const [particles, setParticles] = useState<Array<{ id: number; kind: ParticleKind }>>([]);
  const particleIdRef = useRef(0);
  // Guard: prevents the save effect from writing initial values over real saved data on startup
  const hasLoadedStats = useRef(false);

  const [showDevPanel, setShowDevPanel] = useState(false);


  useEffect(() => {
    peaScaleAnim.setValue(baseScale);
  }, [baseScale, peaScaleAnim]);

  const bouncePea = () => {
    const upScale = baseScale * 1.08;
    Animated.sequence([
      Animated.timing(peaScaleAnim, {
        toValue: upScale,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(peaScaleAnim, {
        toValue: baseScale,
        friction: 3,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const updateMood = (
    newWater: number,
    newSun: number,
    newSoil: number,
    newFun: number,
    newEnergy: number
  ) => {
    const nextMood = calculateMood(
      newWater,
      newSun,
      newSoil,
      newFun,
      newEnergy
    );
    setMood(nextMood);
    setCustomMessage(null);
  };

  const spawnParticle = (kind: ParticleKind) => {
  const id = particleIdRef.current++;
  setParticles(prev => [...prev, { id, kind }]);

  // 0.5 sn sonra state’ten sil
  setTimeout(() => {
    setParticles(prev => prev.filter(p => p.id !== id));
  }, 500);
};


  const handleWake = (early: boolean) => {
    if (!isSleeping || !sleepStartTime) return;

    const now = Date.now();
    const elapsed = now - sleepStartTime;

    if (sleepReason === 'tiredFromPlay') {
      if (early && elapsed < TIRED_SLEEP_MS) {
        setCustomMessage(
          'Daha tam dinlenemedim, biraz daha uyumam lazım… 😴'
        );
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

      const moodAfter = calculateMood(water, sun, soil, fun, newEnergy);

      setEnergy(newEnergy);
      setIsSleeping(false);
      setSleepReason('none');
      setSleepStartTime(null);
      setMood(moodAfter);

      return;
    }

    if (sleepReason === 'longAway') {
      const newEnergy = clamp(energy + 30);
      const newFun = 10;

      setEnergy(newEnergy);
      setFun(newFun);
      setIsSleeping(false);
      setSleepReason('none');
      setSleepStartTime(null);
      setWasLongAway(false);

      setMood('bored');
      setCustomMessage(
        'Sen yokken çok bekledim… Biraz canım sıkıldı. Oyun oynasak mı? 🎮'
      );
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

  
  // APP başladığında tüm kayıtlı verileri tek seferde yükle
  useEffect(() => {
    const initPea = async () => {
      try {
        const entries = await AsyncStorage.multiGet([
          'PEA_WATER', 'PEA_SUN', 'PEA_SOIL', 'PEA_FUN', 'PEA_ENERGY',
          'PEA_LAST_VISIT', 'PEA_COINS', 'PEA_FLAPPY_HIGHSCORE',
        ]);
        const stored = Object.fromEntries(entries.map(([k, v]) => [k, v]));

        // Kayıtlı stat yoksa başlangıç değerlerini kullan
        let w  = stored['PEA_WATER']  != null ? Number(stored['PEA_WATER'])  : INITIAL_WATER;
        let s  = stored['PEA_SUN']    != null ? Number(stored['PEA_SUN'])    : INITIAL_SUN;
        let so = stored['PEA_SOIL']   != null ? Number(stored['PEA_SOIL'])   : INITIAL_SOIL;
        let f  = stored['PEA_FUN']    != null ? Number(stored['PEA_FUN'])    : INITIAL_FUN;
        let e  = stored['PEA_ENERGY'] != null ? Number(stored['PEA_ENERGY']) : INITIAL_ENERGY;

        // Uzun süre geri gelmedik mi? Penaltıyı yüklenen statlara uygula
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

        setWater(w);
        setSun(s);
        setSoil(so);
        setFun(f);
        setEnergy(e);

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

        if (stored['PEA_COINS'] != null)         setCoins(Number(stored['PEA_COINS']));
        if (stored['PEA_FLAPPY_HIGHSCORE'])       setFlappyHighScore(Number(stored['PEA_FLAPPY_HIGHSCORE']));

        await AsyncStorage.setItem('PEA_LAST_VISIT', String(now));
      } catch (err) {
        console.warn('Pea başlatılamadı:', err);
      } finally {
        hasLoadedStats.current = true;
      }
    };

    initPea();
  }, []);


  // Zamanla statların azalması
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (isSleeping || isGameOpen) return;

      const newWater = clamp(water - 2);
      const newSun = clamp(sun - 1);
      const newSoil = clamp(soil - 0.5);
      const newFun = clamp(fun - 0.3);
      const newEnergy = clamp(energy - 0.2);

      setWater(newWater);
      setSun(newSun);
      setSoil(newSoil);
      setFun(newFun);
      setEnergy(newEnergy);

      updateMood(newWater, newSun, newSoil, newFun, newEnergy);
    }, 5000);

    return () => clearInterval(intervalId);
  }, [water, sun, soil, fun, energy, isSleeping, isGameOpen]);

  // Statlar değişince kaydet — ilk yükleme bitene kadar çalışmaz
  useEffect(() => {
    if (!hasLoadedStats.current) return;
    const saveStats = async () => {
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
    saveStats();
  }, [water, sun, soil, fun, energy]);

    useEffect(() => {
      const saveCoins = async () => {
        try {
          await AsyncStorage.setItem('PEA_COINS', String(coins));
        } catch (e) {
          console.warn('Pea coins kaydedilemedi:', e);
        }
      };

      saveCoins();
    }, [coins]);


  // Uyku sırasında sayaç + otomatik uyanma
  useEffect(() => {
    if (!isSleeping || !sleepStartTime) return;

    const intervalId = setInterval(() => {
      const now = Date.now();
      setSleepNow(now);

      const elapsed = now - sleepStartTime;

      if (sleepReason === 'manual' && elapsed >= SHORT_SLEEP_MS) {
        handleWake(false);
      } else if (
        sleepReason === 'tiredFromPlay' &&
        elapsed >= TIRED_SLEEP_MS
      ) {
        handleWake(false);
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [isSleeping, sleepReason, sleepStartTime]);

  const handleTapFinished = (score: number) => {
    // TapGame bitince overlay zaten onClose ile kapanıyor,
    // burada sadece statları güncelliyoruz.

    if (score === 0) {
      setCustomMessage('Hiç tıklamadın, bir dahaki sefere deneriz 😌');
      return;
    }

    // FUN & ENERGY
    const finalFun = clamp(fun + score * 1.5);
    const finalEnergy = clamp(energy - (4 + score * 0.2));

    setFun(finalFun);
    setEnergy(finalEnergy);

    // COINS: her 3 tık ≈ 1 coin (min 1)
    const coinsEarned = Math.max(1, Math.floor(score / 3));
    setCoins(c => c + coinsEarned);

    // Çok yorulduysa uykuya geç
    if (finalEnergy < 8) {
      const now = Date.now();
      setIsSleeping(true);
      setSleepReason('tiredFromPlay');
      setSleepStartTime(now);
      setSleepNow(now);
      setMood('sleepy');
      setCustomMessage(
        `Oyun oynarken çok yoruldu ve uyuyakaldı 😴 (+${coinsEarned} 🍃)`
      );
      return;
    }

    const moodAfter = calculateMood(water, sun, soil, finalFun, finalEnergy);
    setMood(moodAfter);
    setCustomMessage(
      `Oyun bitti! ${score} puan topladın 🎮 (+${coinsEarned} 🍃)`
    );
  };




  const handleReflexFinished = (score: number) => {
    if (score <= 0) {
      setCustomMessage('Refleks oyununda ısınma turu gibi geçti 😌');
      return;
    }

    // FUN & ENERGY
    const funGain = score * 1.2;
    const energyLoss = score * 0.6;

    const newFun = clamp(fun + funGain);
    const newEnergy = clamp(energy - energyLoss);

    setFun(newFun);
    setEnergy(newEnergy);

    // COINS: her doğru cevap ≈ 1 coin
    const coinsEarned = score;
    setCoins(c => c + coinsEarned);

    const moodAfter = calculateMood(water, sun, soil, newFun, newEnergy);
    setMood(moodAfter);
    setCustomMessage(
      `Refleks oyununda ${score} doğru yaptın ⚡ (+${coinsEarned} 🍃)`
    );
  };





    const handleFlappyFinished = async (score: number) => {
      setIsGameOpen(false);
      setGameMode(null);

      if (score <= 0) {
        setCustomMessage('Flappy Pea denemesi bitti 🪽');
        return;
      }

      // High score kontrolü
      let newHigh = flappyHighScore;
      let isNewHigh = false;
      if (score > flappyHighScore) {
        newHigh = score;
        isNewHigh = true;
        setFlappyHighScore(score);
        try {
          await AsyncStorage.setItem('PEA_FLAPPY_HIGHSCORE', String(score));
        } catch (e) {
          console.warn('Flappy high score kaydedilemedi:', e);
        }
      }

      // FUN & ENERGY
      const funGain = score * 2;
      const energyLoss = Math.min(15, score * 1.2);

      const newFun = clamp(fun + funGain);
      const newEnergy = clamp(energy - energyLoss);

      setFun(newFun);
      setEnergy(newEnergy);

      // COINS: her geçen boru = 1 coin
      const coinsEarned = score;
      setCoins(c => c + coinsEarned);

      const moodAfter = calculateMood(water, sun, soil, newFun, newEnergy);
      setMood(moodAfter);

      if (isNewHigh) {
        setCustomMessage(
          `Yeni rekor! ${score} boru geçtin 🪽 (Eski: ${flappyHighScore})  +${coinsEarned} 🍃`
        );
      } else {
        setCustomMessage(
          `Flappy Pea’de ${score} boru geçtin! 🪽 (+${coinsEarned} 🍃)`
        );
      }
    };



  // BUTONLAR
  const giveWater = () => {
    if (isSleeping) return;
    spawnParticle('water');
    const newWater = clamp(water + 25);
    const newFun = clamp(fun + 3);
    const newEnergy = energy;
    setWater(newWater);
    setFun(newFun);
    updateMood(newWater, sun, soil, newFun, newEnergy);
    bouncePea();
  };

  const giveSun = () => {
    if (isSleeping) return;
    spawnParticle('sun');
    const newSun = clamp(sun + 25);
    const newFun = clamp(fun + 3);
    const newEnergy = energy;
    setSun(newSun);
    setFun(newFun);
    updateMood(water, newSun, soil, newFun, newEnergy);
    bouncePea();
  };

  const giveSoil = () => {
    if (isSleeping) return;
    spawnParticle('soil');
    const newSoil = clamp(soil + 25);
    const newFun = clamp(fun + 3);
    const newEnergy = energy;
    setSoil(newSoil);
    setFun(newFun);
    updateMood(water, sun, newSoil, newFun, newEnergy);
    bouncePea();
  };

  // Oyunlar menüsünü aç
  const play = () => {
    if (isSleeping) {
      if (sleepReason === 'longAway') {
        setCustomMessage('Şu an uyuyor… Önce onu uyandırman gerekiyor 😴');
      } else if (sleepReason === 'tiredFromPlay') {
        setCustomMessage(
          'Oyun oynarken çok yoruldu, biraz dinlensin sonra tekrar oynarsınız 😴'
        );
      } else {
        setCustomMessage('Şu an uyuyor, oyun oynamak istemiyor 😴');
      }
      return;
    }

    setGameMode('menu');
    setIsGameOpen(true);
    setCustomMessage('Pea hangi oyunu oynayalım diye bakıyor 🎮');
    bouncePea();
  };

  const toggleSleep = () => {
    if (isSleeping && mood === 'sleepy') {
      handleWake(true);
      bouncePea();
      return;
    }

    if (energy >= 50) {
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
    bouncePea();
  };

  const backgroundColor = backgroundForState(mood, sun);

  let hint = customMessage ?? hintForMood(mood);
  if (!customMessage && isSleeping && sleepReason === 'longAway') {
    hint = 'Pea seni beklerken uyuya kalmış gibi görünüyor 😴';
  }

  // Uyku sayaç metni
  let sleepCountdownText: string | null = null;
  if (isSleeping && sleepStartTime) {
    let totalMs = 0;
    if (sleepReason === 'manual') totalMs = SHORT_SLEEP_MS;
    if (sleepReason === 'tiredFromPlay') totalMs = TIRED_SLEEP_MS;

    if (totalMs > 0) {
      const elapsed = sleepNow - sleepStartTime;
      const remaining = Math.max(0, totalMs - elapsed);
      const secs = Math.ceil(remaining / 1000);
      if (secs > 0) {
        sleepCountdownText = `Dinleniyor: ${secs} sn`;
      }
    }
  }

  

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      {/* ANA İÇERİK */}
      <View style={[styles.mainContent, isGameOpen && { opacity: 0.15 }]}>
        {/* Üst bar: başlık + coin */}
        <View style={styles.topBar}>
          <Text style={styles.title}>Pea • Sanal Bezelye</Text>

          <View style={styles.coinBadge}>
            <Text style={styles.coinEmoji}>🍃</Text>
            <Text style={styles.coinText}>{coins}</Text>
          </View>
        </View>

        <View style={styles.peaWrapper}>
          <Animated.View
            style={[
              styles.pea,
              { transform: [{ scale: peaScaleAnim }] },
            ]}
          >
            <Image
              source={peaSprites[mood]}
              style={styles.peaImage}
              resizeMode="contain"
            />
          </Animated.View>
        </View>

        <Text style={styles.hint}>{hint}</Text>

        <TouchableOpacity
          onPress={() => setShowDevPanel(v => !v)}
          style={styles.devToggleButton}
        >
          <Text style={styles.devToggleText}>
            {showDevPanel ? 'Dev panelini gizle' : 'Dev panelini göster'}
          </Text>
        </TouchableOpacity>


        {sleepCountdownText && (
          <Text style={styles.sleepCountdown}>{sleepCountdownText}</Text>
        )}

        {/* Emoji partikülleri */}
        <View style={styles.particlesLayer} pointerEvents="none">
          {particles.map(p => (
            <EmojiParticle key={p.id} kind={p.kind} />
          ))}
        </View>


        {/* Dev stat paneli */}
        {showDevPanel && (
          <View style={styles.debugPanel}>
            <Text style={styles.debugTitle}>Pea Durumu (Dev)</Text>
            <Text style={styles.debugLine}>
              Su: {water.toFixed(0)} | Güneş: {sun.toFixed(0)} | Toprak:{' '}
              {soil.toFixed(0)}
            </Text>
            <Text style={styles.debugLine}>
              Eğlence: {fun.toFixed(0)} | Enerji: {energy.toFixed(0)}
            </Text>
          </View>
        )}


        {/* Ana butonlar */}
        <View style={styles.buttonsRow}>
          <ActionButton label="Su Ver 💧" onPress={giveWater} />
          <ActionButton label="Güneş ☀️" onPress={giveSun} />
        </View>

        <View style={styles.buttonsRow}>
          <ActionButton label="Toprak 🌱" onPress={giveSoil} />
          <ActionButton label="Oyun Oyna 🎮" onPress={play} />
        </View>

        <View style={styles.buttonsRow}>
          <ActionButton
            label={mood === 'sleepy' ? 'Uyandır 😴➡️😊' : 'Uyut 😴'}
            onPress={toggleSleep}
          />
        </View>
      </View>

      {/* Oyunlar overlay */}
      {isGameOpen && (
        <View style={styles.gameOverlay}>
          <View
          style={[
            styles.gameCard,
            gameMode === 'flappy' && styles.gameCardFlappy, // ⬅️ flappy’de full-screen kart
          ]}
        >
            {gameMode === 'menu' && (
              <>
                {/* Başlık + mini açıklama */}
                <View style={styles.gameMenuHeader}>
                  <Text style={styles.gameTitle}>Oyunlar 🎮</Text>
                  <Text style={styles.gameSubtitle}>
                    Pea şu an oyun seçiyor. Hangisini oynayalım?
                  </Text>

                  {flappyHighScore > 0 && (
                    <View style={styles.gameMenuStats}>
                      <Text style={styles.gameMenuStatsLabel}>
                        Flappy Pea rekorun
                      </Text>
                      <Text style={styles.gameMenuStatsValue}>
                        {flappyHighScore} 🪽
                      </Text>
                    </View>
                  )}
                </View>

                {/* 1️⃣ Tıklama Oyunu kartı */}
                <TouchableOpacity
                  style={styles.gameOptionCard}
                  onPress={() => {
                    setMood('playing');
                    setCustomMessage('Pea tıklama oyunu oynuyor 🎮');
                    setGameMode('tap');
                  }}
                >
                  <View style={styles.gameOptionHeader}>
                    <Text style={styles.gameOptionTitle}>Tıklama Oyunu 💚</Text>
                    <Text style={styles.gameOptionTag}>Hızlı refleks</Text>
                  </View>
                  <Text style={styles.gameOptionDesc}>
                    15 saniye içinde olabildiğince hızlı dokun, Pea’nin
                    eğlencesi patlasın!
                  </Text>
                  <View style={styles.gameOptionStatsRow}>
                    <Text style={styles.gameOptionStatPositive}>Eğlence: ++</Text>
                    <Text style={styles.gameOptionStatNegative}>Enerji: -</Text>
                  </View>
                </TouchableOpacity>

                {/* Refleks Oyunu kartı */}
                <TouchableOpacity
                  style={styles.gameOptionCard}
                  onPress={() => {
                    setMood('playing');
                    setCustomMessage('Pea refleks oyununa hazırlanıyor ⚡');
                    setGameMode('reflex');
                  }}
                >
                  <View style={styles.gameOptionHeader}>
                    <Text style={styles.gameOptionTitle}>Refleks Oyunu ⚡</Text>
                    <Text style={styles.gameOptionTag}>Zorluk: Artan</Text>
                  </View>
                  <Text style={styles.gameOptionDesc}>
                    Pea’nin istediği şeyi hızlıca seç. Süre her turda biraz daha kısalıyor!
                  </Text>
                  <View style={styles.gameOptionStatsRow}>
                    <Text style={styles.gameOptionStatPositive}>Eğlence: ++</Text>
                    <Text style={styles.gameOptionStatNegative}>Enerji: -</Text>
                  </View>
                </TouchableOpacity>

                {/* 3️⃣ Flappy Pea kartı */}
                <TouchableOpacity
                  style={styles.gameOptionCard}
                  onPress={() => {
                    setMood('playing');
                    setCustomMessage('Pea uçmaya hazırlanıyor! 🪽');
                    setGameMode('flappy');
                  }}
                >
                  <View style={styles.gameOptionHeader}>
                    <Text style={styles.gameOptionTitle}>Flappy Pea 🪽</Text>
                    <Text style={styles.gameOptionTag}>Zorluk: Orta</Text>
                  </View>
                  <Text style={styles.gameOptionDesc}>
                    Ekrana dokunarak Pea’yi uçur, borulara değmeden aralardan
                    geçmeye çalış.
                  </Text>
                  <View style={styles.gameOptionStatsRow}>
                    <Text style={styles.gameOptionStatPositive}>Eğlence: +++</Text>
                    <Text style={styles.gameOptionStatNegative}>Enerji: --</Text>
                  </View>
                </TouchableOpacity>



                {/* Kapat butonu */}
                <TouchableOpacity
                  style={styles.gameExitButton}
                  onPress={() => {
                    setIsGameOpen(false);
                    setGameMode(null);
                  }}
                >
                  <Text style={styles.gameExitText}>Kapat</Text>
                </TouchableOpacity>
              </>
            )}

            {gameMode === 'tap' && (
              <TapGame
                durationSeconds={15}
                onFinished={handleTapFinished}
                onClose={() => {
                  setIsGameOpen(false);
                  setGameMode(null);
                }}
                onTap={bouncePea}   // her tıklamada Pea hafif zıplasın istiyorsan
              />
            )}

            {gameMode === 'reflex' && (
              <ReflexGame
                onClose={() => {
                  setIsGameOpen(false);
                  setGameMode(null);
                }}
                onFinished={handleReflexFinished}
              />
            )}




            {gameMode === 'flappy' && (
              <FlappyPeaGame
                sprite={peaSprites[mood]}
                highScore={flappyHighScore}
                onClose={() => {
                  setIsGameOpen(false);
                  setGameMode(null);
                }}
                onFinished={handleFlappyFinished}
              />
            )}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
type EmojiParticleProps = {
  kind: ParticleKind;
};

function EmojiParticle({ kind }: EmojiParticleProps) {
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(10)).current;
  const translateX = useRef(
    new Animated.Value((Math.random() - 0.5) * 80)
  ).current;
  const scale = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -20,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1.2,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY, scale]);

  let emoji = '💧';
  if (kind === 'sun') emoji = '☀️';
  if (kind === 'soil') emoji = '🌱';

  return (
    <Animated.Text
      style={[
        styles.particleEmoji,
        {
          opacity,
          transform: [{ translateY }, { translateX }, { scale }],
        },
      ]}
    >
      {emoji}
    </Animated.Text>
  );
}

// ----- BUTON BİLEŞENİ -----
type ActionButtonProps = {
  label: string;
  onPress: () => void;
};

function ActionButton({ label, onPress }: ActionButtonProps) {
  return (
    <TouchableOpacity style={styles.button} onPress={onPress}>
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
}

// ----- STYLES -----
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EFF8FF',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 32,
  },
  mainContent: {
    flex: 1,
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
    backgroundColor: '#1D4ED8',
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
  debugPanel: {
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#DBEAFE',
  },
  debugTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E3A8A',
    marginBottom: 2,
    textAlign: 'center',
  },
  debugLine: {
    fontSize: 12,
    color: '#1F2937',
    textAlign: 'center',
  },
  gameOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15,23,42,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gameCard: {
    width: '86%',
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderRadius: 24,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
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
  gameInfo: {
    fontSize: 14,
    color: '#111827',
    marginVertical: 2,
  },
  gameTapArea: {
    marginTop: 12,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#16A34A',
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 10,
    elevation: 6,
  },
  gameTapText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ECFDF5',
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
    backgroundColor: '#DCFCE7', // açık yeşil
    color: '#166534',
    fontSize: 11,
    fontWeight: '600',
  },
  gameOptionStatNegative: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#FEE2E2', // açık kırmızı
    color: '#B91C1C',
    fontSize: 11,
    fontWeight: '600',
  },
  gameCardFlappy: {
    width: '100%',
    height: '100%',
    borderRadius: 0,
    paddingHorizontal: 16,
    paddingTop: 32,
    paddingBottom: 24,
    justifyContent: 'flex-start',
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
    devToggleButton: {
    marginTop: 4,
    marginBottom: 2,
  },
  devToggleText: {
    fontSize: 12,
    color: '#2563EB',
    textAlign: 'center',
    textDecorationLine: 'underline',
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



});
