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
} from 'react-native';
import BubbleGame from '../../components/BubbleGame';
import FlappyPeaGame from '../../components/FlappyPeaGame';
import ReflexGame from '../../components/ReflexGame';
import { usePea, Mood, SHORT_SLEEP_MS, TIRED_SLEEP_MS } from '../../hooks/usePea';

// ── Component-local types ─────────────────────────────────────────────────────

type GameMode = 'menu' | 'bubble' | 'flappy' | 'reflex' | null;
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

// ── HomeScreen ────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  // Game overlay state — owned here because it controls the UI layer
  const [isGameOpen, setIsGameOpen] = useState(false);
  const [gameMode, setGameMode]     = useState<GameMode>(null);

  // All Pea logic (stats, mood, sleep, persistence, game results)
  const pea = usePea(isGameOpen);

  // Visual state
  const peaScaleAnim  = useRef(new Animated.Value(1)).current;
  const baseScale     = 0.9 + (pea.energy / 100) * 0.25;
  const [particles, setParticles] = useState<Array<{ id: number; kind: ParticleKind }>>([]);
  const particleIdRef = useRef(0);
  const [showDevPanel, setShowDevPanel] = useState(false);

  useEffect(() => {
    peaScaleAnim.setValue(baseScale);
  }, [baseScale, peaScaleAnim]);

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

  const giveWater = () => { spawnParticle('water'); pea.giveWater(); bouncePea(); };
  const giveSun   = () => { spawnParticle('sun');   pea.giveSun();   bouncePea(); };
  const giveSoil  = () => { spawnParticle('soil');  pea.giveSoil();  bouncePea(); };

  const play = () => {
    if (!pea.tryPlay()) return;
    setGameMode('menu');
    setIsGameOpen(true);
    pea.startPlayingMood('Pea hangi oyunu oynayalım diye bakıyor 🎮');
    bouncePea();
  };

  const toggleSleep = () => { pea.toggleSleep(); bouncePea(); };

  // Flappy wrapper: close overlay first, then let hook handle stats
  const handleFlappyFinished = async (score: number) => {
    setIsGameOpen(false);
    setGameMode(null);
    await pea.onFlappyGameResult(score);
  };

  // ── Computed display values ─────────────────────────────────────────────────

  const backgroundColor = backgroundForState(pea.mood, pea.sun);

  let hint = pea.customMessage ?? hintForMood(pea.mood);
  if (!pea.customMessage && pea.isSleeping && pea.sleepReason === 'longAway') {
    hint = 'Pea seni beklerken uyuya kalmış gibi görünüyor 😴';
  }

  let sleepCountdownText: string | null = null;
  if (pea.isSleeping && pea.sleepStartTime) {
    let totalMs = 0;
    if (pea.sleepReason === 'manual')        totalMs = SHORT_SLEEP_MS;
    if (pea.sleepReason === 'tiredFromPlay') totalMs = TIRED_SLEEP_MS;
    if (totalMs > 0) {
      const elapsed   = pea.sleepNow - pea.sleepStartTime;
      const remaining = Math.max(0, totalMs - elapsed);
      const secs      = Math.ceil(remaining / 1000);
      if (secs > 0) sleepCountdownText = `Dinleniyor: ${secs} sn`;
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <SafeAreaView style={[styles.container, { backgroundColor }]}>
      {/* ANA İÇERİK */}
      <View style={styles.mainContent}>
        {/* Üst bar: başlık + coin */}
        <View style={styles.topBar}>
          <Text style={styles.title}>Pea • Sanal Bezelye</Text>
          <View style={styles.coinBadge}>
            <Text style={styles.coinEmoji}>🍃</Text>
            <Text style={styles.coinText}>{pea.coins}</Text>
          </View>
        </View>

        <View style={styles.peaWrapper}>
          <Animated.View style={[styles.pea, { transform: [{ scale: peaScaleAnim }] }]}>
            <Image
              source={peaSprites[pea.mood]}
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
              Su: {pea.water.toFixed(0)} | Güneş: {pea.sun.toFixed(0)} | Toprak: {pea.soil.toFixed(0)}
            </Text>
            <Text style={styles.debugLine}>
              Eğlence: {pea.fun.toFixed(0)} | Enerji: {pea.energy.toFixed(0)}
            </Text>
          </View>
        )}

        {/* Ana butonlar */}
        <View style={styles.buttonsRow}>
          <ActionButton label="Su Ver 💧" onPress={giveWater} />
          <ActionButton label="Güneş ☀️"  onPress={giveSun} />
        </View>

        <View style={styles.buttonsRow}>
          <ActionButton label="Toprak 🌱"    onPress={giveSoil} />
          <ActionButton label="Oyun Oyna 🎮" onPress={play} />
        </View>

        <View style={styles.buttonsRow}>
          <ActionButton
            label={pea.mood === 'sleepy' ? 'Uyandır 😴➡️😊' : 'Uyut 😴'}
            onPress={toggleSleep}
          />
        </View>
      </View>
      </SafeAreaView>

      {/* Oyunlar overlay — Modal ile tam ekran, status bar dahil */}
      <Modal
        visible={isGameOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => { setIsGameOpen(false); setGameMode(null); }}
      >
        <View style={styles.gameOverlay}>
          <View
            style={[
              styles.gameCard,
              gameMode === 'flappy' && styles.gameCardFlappy,
            ]}
          >
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

                {/* Balon Patlatma */}
                <TouchableOpacity
                  style={styles.gameOptionCard}
                  onPress={() => {
                    pea.startPlayingMood('Pea balon patlatıyor 🫧');
                    setGameMode('bubble');
                  }}
                >
                  <View style={styles.gameOptionHeader}>
                    <Text style={styles.gameOptionTitle}>Balon Patlatma 🫧</Text>
                    <Text style={styles.gameOptionTag}>30 saniye</Text>
                  </View>
                  <Text style={styles.gameOptionDesc}>
                    Yükselen balonlara dokun, patlat! Büyük balonlar daha çok puan getiriyor.
                  </Text>
                  <View style={styles.gameOptionStatsRow}>
                    <Text style={styles.gameOptionStatPositive}>Eğlence: ++</Text>
                    <Text style={styles.gameOptionStatNegative}>Enerji: -</Text>
                  </View>
                </TouchableOpacity>

                {/* Refleks Oyunu */}
                <TouchableOpacity
                  style={styles.gameOptionCard}
                  onPress={() => {
                    pea.startPlayingMood('Pea refleks oyununa hazırlanıyor ⚡');
                    setGameMode('reflex');
                  }}
                >
                  <View style={styles.gameOptionHeader}>
                    <Text style={styles.gameOptionTitle}>Refleks Oyunu ⚡</Text>
                    <Text style={styles.gameOptionTag}>Zorluk: Artan</Text>
                  </View>
                  <Text style={styles.gameOptionDesc}>
                    Pea'nin istediği şeyi hızlıca seç. Süre her turda biraz daha kısalıyor!
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

                <TouchableOpacity
                  style={styles.gameExitButton}
                  onPress={() => { setIsGameOpen(false); setGameMode(null); }}
                >
                  <Text style={styles.gameExitText}>Kapat</Text>
                </TouchableOpacity>
              </>
            )}

            {gameMode === 'bubble' && (
              <BubbleGame
                onFinished={pea.onBubbleGameFinished}
                onClose={() => { setIsGameOpen(false); setGameMode(null); }}
              />
            )}

            {gameMode === 'reflex' && (
              <ReflexGame
                onClose={() => { setIsGameOpen(false); setGameMode(null); }}
                onFinished={pea.onReflexFinished}
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
          </View>
        </View>
        </View>
      </Modal>
    </>
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

// ── ActionButton ──────────────────────────────────────────────────────────────

type ActionButtonProps = { label: string; onPress: () => void };

function ActionButton({ label, onPress }: ActionButtonProps) {
  return (
    <TouchableOpacity style={styles.button} onPress={onPress}>
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

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
    flex: 1,
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
  gameCardFlappy: {
    width: '100%',
    height: '100%',
    borderRadius: 0,
    paddingHorizontal: 16,
    paddingTop: 32,
    paddingBottom: 24,
    justifyContent: 'flex-start',
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
