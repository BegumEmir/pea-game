// components/BubbleGame.tsx
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const DURATION_SECONDS = 30;
const SPAWN_INTERVAL_MS = 900;
const MAX_BUBBLES = 7;

type BubbleData = {
  id: number;
  x: number;
  size: number;
  points: number;
  color: string;
  borderColor: string;
  textColor: string;
  riseAnim: Animated.Value;
  scaleAnim: Animated.Value;
  opacityAnim: Animated.Value;
  popped: boolean;
};

const TIERS = [
  { size: 40, points: 1, color: '#BAE6FD', borderColor: '#38BDF8', textColor: '#0369A1', riseDuration: 3000 },
  { size: 54, points: 2, color: '#BBF7D0', borderColor: '#4ADE80', textColor: '#166534', riseDuration: 3600 },
  { size: 68, points: 3, color: '#FEF08A', borderColor: '#FACC15', textColor: '#854D0E', riseDuration: 4200 },
];

type BubbleGameProps = {
  onFinished: (score: number) => void;
  onClose: () => void;
};

export default function BubbleGame({ onFinished, onClose }: BubbleGameProps) {
  const [timeLeft, setTimeLeft]   = useState(DURATION_SECONDS);
  const [score, setScore]         = useState(0);
  const [gameOver, setGameOver]   = useState(false);
  // bubbleIds drives re-renders; actual animation values live in the Map
  const [bubbleIds, setBubbleIds] = useState<number[]>([]);

  const scoreRef    = useRef(0);
  const nextIdRef   = useRef(0);
  const bubbleMap   = useRef<Map<number, BubbleData>>(new Map());
  const playArea    = useRef({ width: 280, height: 220 });
  const gameOverRef = useRef(false);

  // ⏱ Geri sayım
  useEffect(() => {
    if (gameOver) return;
    if (timeLeft <= 0) {
      gameOverRef.current = true;
      bubbleMap.current.forEach(b => b.riseAnim.stopAnimation());
      bubbleMap.current.clear();
      setBubbleIds([]);
      setGameOver(true);
      return;
    }
    const id = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timeLeft, gameOver]);

  // 🫧 Balon oluşturma
  useEffect(() => {
    if (gameOver) return;

    const spawn = () => {
      if (gameOverRef.current) return;
      if (bubbleMap.current.size >= MAX_BUBBLES) return;

      const tier  = TIERS[Math.floor(Math.random() * TIERS.length)];
      const id    = nextIdRef.current++;
      const { width: areaW, height: areaH } = playArea.current;
      const maxX  = Math.max(0, areaW - tier.size - 8);
      const x     = Math.random() * maxX + 4;

      const bubble: BubbleData = {
        id, x,
        size: tier.size, points: tier.points,
        color: tier.color, borderColor: tier.borderColor, textColor: tier.textColor,
        riseAnim:   new Animated.Value(areaH),
        scaleAnim:  new Animated.Value(1),
        opacityAnim: new Animated.Value(1),
        popped: false,
      };

      bubbleMap.current.set(id, bubble);
      setBubbleIds(ids => [...ids, id]);

      Animated.timing(bubble.riseAnim, {
        toValue: -tier.size,
        duration: tier.riseDuration,
        useNativeDriver: true,
        easing: Easing.linear,
      }).start(({ finished }) => {
        if (finished && !bubble.popped) {
          bubbleMap.current.delete(id);
          setBubbleIds(ids => ids.filter(i => i !== id));
        }
      });
    };

    const intervalId = setInterval(spawn, SPAWN_INTERVAL_MS);
    spawn(); // ilk balon hemen

    return () => clearInterval(intervalId);
  }, [gameOver]);

  const popBubble = (id: number) => {
    const bubble = bubbleMap.current.get(id);
    if (!bubble || bubble.popped || gameOverRef.current) return;
    bubble.popped = true;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    scoreRef.current += bubble.points;
    setScore(s => s + bubble.points);

    bubble.riseAnim.stopAnimation();

    Animated.parallel([
      Animated.timing(bubble.scaleAnim, {
        toValue: 1.55,
        duration: 100,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }),
      Animated.timing(bubble.opacityAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      bubbleMap.current.delete(id);
      setBubbleIds(ids => ids.filter(i => i !== id));
    });
  };

  const handleExit = () => {
    onFinished(scoreRef.current);
    onClose();
  };

  const timerProgress = timeLeft / DURATION_SECONDS;
  const timerBarColor = timerProgress > 0.6 ? '#22C55E' : timerProgress > 0.3 ? '#FBBF24' : '#EF4444';
  const coinsEarned   = Math.max(1, Math.floor(scoreRef.current / 3));

  return (
    <View style={styles.wrapper}>
      <Text style={styles.gameTitle}>Balon Patlatma 🫧</Text>
      <Text style={styles.gameSubtitle}>
        Yükselen balonlara dokun!{' '}
        <Text style={{ fontWeight: '700' }}>Büyük balon = daha çok puan.</Text>
      </Text>

      {/* Zamanlayıcı */}
      <View style={styles.timerBarBg}>
        <View
          style={[
            styles.timerBarFill,
            { width: `${timerProgress * 100}%`, backgroundColor: timerBarColor },
          ]}
        />
      </View>

      <View style={styles.infoRow}>
        <Text style={[styles.infoText, timerProgress <= 0.3 && styles.infoTextUrgent]}>
          {timeLeft} sn
        </Text>
        <Text style={styles.infoText}>Skor: {score}</Text>
      </View>

      {/* Boyut efsanesi */}
      <View style={styles.legendRow}>
        {TIERS.map(tier => (
          <View
            key={tier.points}
            style={[styles.legendBubble, { backgroundColor: tier.color, borderColor: tier.borderColor }]}
          >
            <Text style={[styles.legendText, { color: tier.textColor }]}>{tier.points} pt</Text>
          </View>
        ))}
      </View>

      {/* Oyun alanı / Bitiş ekranı */}
      {!gameOver ? (
        <View
          style={styles.playArea}
          onLayout={e => {
            playArea.current = {
              width:  e.nativeEvent.layout.width,
              height: e.nativeEvent.layout.height,
            };
          }}
        >
          {bubbleIds.map(id => {
            const b = bubbleMap.current.get(id);
            if (!b) return null;
            return (
              <Animated.View
                key={id}
                style={[
                  styles.bubble,
                  {
                    left:         b.x,
                    width:        b.size,
                    height:       b.size,
                    borderRadius: b.size / 2,
                    backgroundColor: b.color,
                    borderColor:  b.borderColor,
                    transform: [
                      { translateY: b.riseAnim },
                      { scale: b.scaleAnim },
                    ],
                    opacity: b.opacityAnim,
                  },
                ]}
              >
                <TouchableOpacity
                  style={styles.bubbleTouchable}
                  onPress={() => popBubble(id)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.bubblePoints, { color: b.textColor, fontSize: b.size * 0.33 }]}>
                    {b.points}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>
      ) : (
        <View style={styles.gameOverCard}>
          <Text style={styles.gameOverTitle}>Süre doldu! ⏰</Text>
          <Text style={styles.gameOverScore}>{score} puan</Text>
          <View style={styles.coinsRow}>
            <Text style={styles.coinsLabel}>Kazanılan:</Text>
            <Text style={styles.coinsValue}>{coinsEarned} 🍃</Text>
          </View>
        </View>
      )}

      <TouchableOpacity style={styles.exitButton} onPress={handleExit}>
        <Text style={styles.exitButtonText}>
          {gameOver ? 'Skoru Kaydet ve Geri Dön' : 'Bitir ve Geri Dön'}
        </Text>
      </TouchableOpacity>
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
    marginBottom: 10,
    paddingHorizontal: 8,
  },
  timerBarBg: {
    width: '100%',
    height: 10,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
    marginBottom: 6,
  },
  timerBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  infoTextUrgent: {
    color: '#EF4444',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  legendBubble: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '700',
  },
  playArea: {
    width: '100%',
    height: 220,
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 10,
  },
  bubble: {
    position: 'absolute',
    borderWidth: 2.5,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    elevation: 3,
  },
  bubbleTouchable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubblePoints: {
    fontWeight: '800',
  },
  gameOverCard: {
    width: '100%',
    height: 220,
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  gameOverTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  gameOverScore: {
    fontSize: 42,
    fontWeight: '800',
    color: '#16A34A',
    marginBottom: 12,
  },
  coinsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    gap: 6,
  },
  coinsLabel: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
  coinsValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#16A34A',
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
