// components/ReflexGame.tsx
import * as Haptics from 'expo-haptics';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

type Need = 'water' | 'sun' | 'soil';

type ReflexGameProps = {
  onClose: () => void;            // Oyundan çık
  onFinished: (score: number) => void; // Bittiğinde skor bildir
};

const NEEDS: { key: Need; label: string; emoji: string }[] = [
  { key: 'water', label: 'Su', emoji: '💧' },
  { key: 'sun', label: 'Güneş', emoji: '☀️' },
  { key: 'soil', label: 'Toprak', emoji: '🌱' },
];

// Her ihtiyacın rengi
const NEED_COLORS: Record<Need, { bg: string; text: string }> = {
  water: { bg: '#DBEAFE', text: '#1D4ED8' },
  sun:   { bg: '#FEF9C3', text: '#92400E' },
  soil:  { bg: '#D1FAE5', text: '#166534' },
};

// Oyun ayarları
const INITIAL_TIME_MS = 1600;          // 1. tur zamanı
const MIN_TIME_MS = 750;              // en hızlı tur
const TIME_DECREASE_PER_ROUND = 70;   // tur başına kısalma
const MAX_LIVES = 3;

export default function ReflexGame({ onClose, onFinished }: ReflexGameProps) {
  const [currentNeed, setCurrentNeed] = useState<Need>('water');
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [timeLeftMs, setTimeLeftMs] = useState(INITIAL_TIME_MS);
  const [roundTimeMs, setRoundTimeMs] = useState(INITIAL_TIME_MS);
  const [isActive, setIsActive] = useState(false);
  const [statusText, setStatusText] = useState(
    'Doğru ihtiyacı hızlı seç, süre bitmeden dokun! ⚡'
  );
  const [gameOver, setGameOver] = useState(false);
  // Doğru cevabı yanlış/süre dolduğunda kısa süre parlatmak için
  const [flashNeed, setFlashNeed] = useState<Need | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Refs mirror state so interval callbacks can read/write current values without stale closures
  const timeLeftMsRef = useRef(INITIAL_TIME_MS);
  const livesRef = useRef(MAX_LIVES);
  const currentNeedRef = useRef<Need>('water');

  const hearts = '❤️'.repeat(lives) + '🤍'.repeat(MAX_LIVES - lives);

  const randomNeed = (): Need => {
    const idx = Math.floor(Math.random() * NEEDS.length);
    return NEEDS[idx].key;
  };

  // Her "round" değiştiğinde yeni tur başlat
  useEffect(() => {
    if (gameOver) return;

    // round'a göre süreyi ayarla
    const baseTime =
      INITIAL_TIME_MS - (round - 1) * TIME_DECREASE_PER_ROUND;
    const thisRoundTime = Math.max(MIN_TIME_MS, baseTime);

    setRoundTimeMs(thisRoundTime);
    setTimeLeftMs(thisRoundTime);
    timeLeftMsRef.current = thisRoundTime;

    const newNeed = randomNeed();
    setCurrentNeed(newNeed);
    currentNeedRef.current = newNeed;

    setIsActive(true);
    setStatusText('Doğru ihtiyacı hızlı seç! ⚡');

    // Önceki timer'ı temizle
    if (timerRef.current) clearInterval(timerRef.current);

    // Yeni timer — side effects run directly in the callback, not inside a state updater
    timerRef.current = setInterval(() => {
      timeLeftMsRef.current -= 100;
      if (timeLeftMsRef.current <= 0) {
        timeLeftMsRef.current = 0;
        setTimeLeftMs(0);
        clearInterval(timerRef.current!);
        timerRef.current = null;
        handleTimeout();
      } else {
        setTimeLeftMs(timeLeftMsRef.current);
      }
    }, 100);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, gameOver]);

  const handleTimeout = () => {
    if (gameOver) return;
    setIsActive(false);
    setStatusText('Süre bitti! ⏰');

    // Doğru cevabı göster
    setFlashNeed(currentNeedRef.current);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

    const newLives = livesRef.current - 1;
    livesRef.current = newLives;
    setLives(newLives);

    setTimeout(() => {
      setFlashNeed(null);
      if (newLives <= 0) {
        setGameOver(true);
      } else {
        setRound(r => r + 1);
      }
    }, 600);
  };

  const handlePress = (need: Need) => {
    if (!isActive || gameOver) return;

    // Cevap verildiğinde timer dursun
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsActive(false);

    if (need === currentNeed) {
      // DOĞRU
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setScore(s => s + 1);
      setStatusText('Doğru! ✨');

      setTimeout(() => {
        setRound(r => r + 1);
      }, 300);
    } else {
      // YANLIŞ — doğru cevabı göster
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setStatusText('Yanlış seçim! ❌');
      setFlashNeed(currentNeed);

      const newLives = livesRef.current - 1;
      livesRef.current = newLives;
      setLives(newLives);

      setTimeout(() => {
        setFlashNeed(null);
        if (newLives <= 0) {
          setGameOver(true);
        } else {
          setRound(r => r + 1);
        }
      }, 600);
    }
  };

  const handleExit = () => {
    onFinished(score);
    onClose();
  };

  const currentNeedMeta = NEEDS.find(n => n.key === currentNeed) ?? NEEDS[0];
  const progress =
    roundTimeMs > 0 ? Math.max(0, timeLeftMs / roundTimeMs) : 0;

  // Zamanlayıcı rengi: yeşil → sarı → kırmızı
  const timerBarColor =
    progress > 0.6 ? '#22C55E' : progress > 0.3 ? '#FBBF24' : '#EF4444';

  return (
    <View style={styles.wrapper}>
      <Text style={styles.gameTitle}>Refleks Oyunu ⚡</Text>
      <Text style={styles.gameSubtitle}>
        Doğru ihtiyaca <Text style={{ fontWeight: '700' }}>hızlıca</Text> dokun.
        Süre bitmeden karar ver!
      </Text>

      <View style={styles.infoRow}>
        <Text style={styles.infoText}>Tur: {round}</Text>
        <Text style={styles.infoText}>Skor: {score}</Text>
      </View>

      <Text style={styles.livesText}>{hearts}</Text>

      {/* Zaman barı — yeşil→sarı→kırmızı */}
      <View style={styles.timerBarBackground}>
        <View
          style={[
            styles.timerBarFill,
            {
              width: `${progress * 100}%`,
              backgroundColor: timerBarColor,
            },
          ]}
        />
      </View>

      <View style={styles.needBubble}>
        <Text style={styles.needEmoji}>{currentNeedMeta.emoji}</Text>
        <Text style={styles.needText}>
          Pea şu an <Text style={styles.needHighlight}>{currentNeedMeta.label}</Text> istiyor!
        </Text>
      </View>

      <Text style={styles.statusText}>{statusText}</Text>

      {/* Butonlar — her ihtiyacın kendi rengi var */}
      <View style={styles.buttonsRowBig}>
        {NEEDS.map(n => {
          const isFlashing = flashNeed === n.key;
          const bgColor = isFlashing
            ? '#4ADE80'
            : isActive
              ? NEED_COLORS[n.key].bg
              : '#E5E7EB';
          const textColor = isFlashing
            ? '#166534'
            : isActive
              ? NEED_COLORS[n.key].text
              : '#111827';

          return (
            <TouchableOpacity
              key={n.key}
              style={[styles.needButton, { backgroundColor: bgColor }]}
              onPress={() => handlePress(n.key)}
              activeOpacity={0.8}
            >
              <Text style={styles.needButtonEmoji}>{n.emoji}</Text>
              <Text style={[styles.needButtonLabel, { color: textColor }]}>{n.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.bottomButtons}>
        {gameOver && (
          <Text style={styles.gameOverText}>
            Oyun bitti! Toplam doğru: {score}
          </Text>
        )}

        <TouchableOpacity
          style={styles.exitButton}
          onPress={handleExit}
        >
          <Text style={styles.exitButtonText}>
            {gameOver ? 'Skoru Kaydet ve Geri Dön' : 'Bitir ve Geri Dön'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    alignItems: 'center',
  },
  gameTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
    color: '#111827',
    textAlign: 'center',
  },
  gameSubtitle: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '80%',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    color: '#111827',
  },
  livesText: {
    marginTop: 4,
    fontSize: 18,
    marginBottom: 8,
  },
  timerBarBackground: {
    width: '80%',
    height: 10,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
    marginBottom: 12,
  },
  timerBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  needBubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#DCFCE7',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  needEmoji: {
    fontSize: 22,
    marginRight: 6,
  },
  needText: {
    fontSize: 14,
    color: '#111827',
  },
  needHighlight: {
    fontWeight: '700',
    color: '#16A34A',
  },
  statusText: {
    fontSize: 13,
    color: '#4B5563',
    marginBottom: 12,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  buttonsRowBig: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '86%',
    marginBottom: 12,
  },
  needButton: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 10,
    borderRadius: 16,
    alignItems: 'center',
  },
  needButtonEmoji: {
    fontSize: 22,
    marginBottom: 2,
  },
  needButtonLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  bottomButtons: {
    width: '86%',
    alignItems: 'center',
    marginTop: 4,
  },
  gameOverText: {
    fontSize: 14,
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  exitButton: {
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#111827',
    minWidth: 200,
  },
  exitButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F9FAFB',
    textAlign: 'center',
  },
});
