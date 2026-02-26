// components/TapGame.tsx
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

type TapGameProps = {
  durationSeconds: number;          // toplam süre (15 sn)
  onFinished: (score: number) => void; // oyun bittiğinde skor
  onClose: () => void;              // overlay’i kapat
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

  // ⏱ Geri sayım – sadece burası timeLeft’i değiştiriyor
  useEffect(() => {
    if (timeLeft <= 0) {
      // süre bitince otomatik bitir
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
    if (timeLeft <= 0) return; // süre bittiyse tıklama sayma

    scoreRef.current += 1;     // ref güncelle (render beklemiyor)
    setScore(s => s + 1);      // state güncelle (UI için)
    onTap?.();                 // Pea zıpla animasyonu
  };

  const handleExit = () => {
    // erken çıkarsa da skoru gönder, overlay’i kapat
    onFinished(scoreRef.current);
    onClose();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.gameTitle}>Tıklama Oyunu 🎮</Text>
      <Text style={styles.gameSubtitle}>
        {durationSeconds} saniye içinde olabildiğince çok tıkla!
      </Text>

      <Text style={styles.gameInfo}>Kalan süre: {timeLeft} sn</Text>
      <Text style={styles.gameInfo}>Skor: {score}</Text>

      <TouchableOpacity style={styles.gameTapArea} onPress={handleTap}>
        <Text style={styles.gameTapText}>Tıkla! 💚</Text>
      </TouchableOpacity>

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
});
