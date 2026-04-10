// components/TapGame.tsx
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type TapGameProps = {
  durationSeconds: number;          // toplam süre (15 sn)
  onFinished: (score: number) => void; // oyun bittiğinde skor
  onClose: () => void;              // overlay'i kapat
  onTap?: () => void;               // her tıklamada opsiyonel callback (Pea zıplatsın)
};

export default function TapGame({
  durationSeconds,
  onFinished,
  onClose,
  onTap,
}: TapGameProps) {
  const [timeLeft, setTimeLeft] = useState(durationSeconds);
  const [score, setScore] = useState(0);
  // Ref so onFinished always receives the true latest count, not a render-cycle snapshot
  const scoreRef = useRef(0);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // ⏱ Geri sayım – sadece burası timeLeft'i değiştiriyor
  useEffect(() => {
    if (timeLeft <= 0) {
      onFinished(scoreRef.current);
      onClose();
      return;
    }

    const id = setTimeout(() => {
      setTimeLeft(t => t - 1);
    }, 1000);

    return () => clearTimeout(id);
  }, [timeLeft]);

  const handleTap = () => {
    if (timeLeft <= 0) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Tıklama geri bildirimi: büz ve geri zıpla
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 0.85,
        useNativeDriver: true,
        tension: 300,
        friction: 5,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 200,
        friction: 6,
      }),
    ]).start();

    scoreRef.current += 1;
    setScore(s => s + 1);
    onTap?.();
  };

  const handleExit = () => {
    onFinished(scoreRef.current);
    onClose();
  };

  const isUrgent = timeLeft <= 5;
  const timerProgress = durationSeconds > 0 ? timeLeft / durationSeconds : 0;

  return (
    <View style={styles.container}>
      <Text style={styles.gameTitle}>Tıklama Oyunu 🎮</Text>
      <Text style={styles.gameSubtitle}>
        {durationSeconds} saniye içinde olabildiğince çok tıkla!
      </Text>

      {/* Görsel zamanlayıcı */}
      <View style={styles.timerBarBackground}>
        <View
          style={[
            styles.timerBarFill,
            {
              width: `${timerProgress * 100}%`,
              backgroundColor: isUrgent ? '#EF4444' : '#22C55E',
            },
          ]}
        />
      </View>
      <Text style={[styles.timerText, isUrgent && styles.timerTextUrgent]}>
        {timeLeft} sn
      </Text>

      <Text style={styles.gameInfo}>Skor: {score}</Text>

      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          style={[styles.gameTapArea, isUrgent && styles.gameTapAreaUrgent]}
          onPress={handleTap}
          activeOpacity={1}
        >
          <Text style={styles.gameTapText}>{isUrgent ? 'Hızlı! 🔥' : 'Tıkla! 💚'}</Text>
        </TouchableOpacity>
      </Animated.View>

      <TouchableOpacity style={styles.gameExitButton} onPress={handleExit}>
        <Text style={styles.gameExitText}>
          Bitir ve Geri Dön
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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
  timerBarBackground: {
    width: '80%',
    height: 10,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
    marginBottom: 4,
  },
  timerBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  timerText: {
    fontSize: 14,
    color: '#111827',
    marginBottom: 4,
  },
  timerTextUrgent: {
    color: '#EF4444',
    fontWeight: '700',
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
  gameTapAreaUrgent: {
    backgroundColor: '#EF4444',
    shadowColor: '#DC2626',
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
});
