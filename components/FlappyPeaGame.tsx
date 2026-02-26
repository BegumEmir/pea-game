import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Image,
  Dimensions,
} from 'react-native';

type FlappyPipe = {
  id: number;
  x: number;
  gapCenter: number;
  passed: boolean;
};

type FlappyPeaGameProps = {
  sprite: any;              // Pea görseli
  highScore?: number;
  onClose: () => void;      // Oyundan çık
  onFinished: (score: number) => void; // Bittiğinde skor bildir
};

// Flappy sabitleri
// Ekran boyutu
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Flappy sabitleri (ekrana göre)
const FLAPPY_AREA_WIDTH = Math.min(SCREEN_WIDTH - 40, 380); // telefonda geniş, tabletlerde 360 sınırı
const FLAPPY_AREA_HEIGHT = FLAPPY_AREA_WIDTH * 1.1;

const FLAPPY_PIPE_WIDTH = 70;
const FLAPPY_GAP_SIZE = 150;

const FLAPPY_PEA_SIZE = 72;
const FLAPPY_PEA_X = FLAPPY_AREA_WIDTH * 0.22;

const FLAPPY_GRAVITY = 0.4;
const FLAPPY_JUMP_VELOCITY = -7;
const FLAPPY_PIPE_SPEED = 2;

// Çimin yüksekliği (style'daki ground ile aynı olmalı)
const FLAPPY_GROUND_HEIGHT = 40;

// Pea'nin düşebileceği min/max seviye
const FLAPPY_MIN_Y = -FLAPPY_AREA_HEIGHT / 2 + 30;

// Biraz tolerans olsun diye +8 ekledim (gözle tam yere değmiş gibi hissetsin)
const FLAPPY_MAX_Y =
  FLAPPY_AREA_HEIGHT / 2 - FLAPPY_PEA_SIZE / 2 - FLAPPY_GROUND_HEIGHT + 8;





function randomGapCenter(): number {
  const min = -40;
  const max = 40;
  return Math.random() * (max - min) + min;
}

export default function FlappyPeaGame({
  sprite,
  highScore,
  onClose,
  onFinished,
}: FlappyPeaGameProps) {
  const [flappyPeaY, setFlappyPeaY] = useState(0);
  const flappyVelRef = useRef(0);
  const flappyYRef = useRef(0);

  const [flappyStarted, setFlappyStarted] = useState(false);
  const [flappyGameOver, setFlappyGameOver] = useState(false);
  const [flappyScore, setFlappyScore] = useState(0);
  // Ref so the game loop always reads the current score without needing it in the effect deps
  const flappyScoreRef = useRef(0);

  const [flappyPipes, setFlappyPipes] = useState<FlappyPipe[]>(() => [
    {
      id: 0,
      x: FLAPPY_AREA_WIDTH + 80,
      gapCenter: randomGapCenter(),
      passed: false,
    },
  ]);
  const flappyPipeIdRef = useRef(1);

  // Yerçekimi + boru hareketi + çarpışma + skor
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (flappyGameOver) return;

      // Yerçekimi
      if (flappyStarted) {
        flappyVelRef.current += FLAPPY_GRAVITY;
        flappyYRef.current += flappyVelRef.current;

        if (flappyYRef.current > FLAPPY_MAX_Y) {
          flappyYRef.current = FLAPPY_MAX_Y;
          setFlappyGameOver(true);
        }
        if (flappyYRef.current < FLAPPY_MIN_Y) {
          flappyYRef.current = FLAPPY_MIN_Y;
          flappyVelRef.current = 0;
        }

        setFlappyPeaY(flappyYRef.current);
      }

      const peaCenterY = FLAPPY_AREA_HEIGHT / 2 + flappyYRef.current;
      const peaRadius = FLAPPY_PEA_SIZE / 2;
      const peaCenterX = FLAPPY_PEA_X + peaRadius;

      // Pea ekranda daha küçük “vurulabilir alan” olsun
      const hitRadius = peaRadius * 0.7;

      setFlappyPipes(prev => {
        if (!flappyStarted) return prev;

        let newScore = flappyScoreRef.current;
        let gameOver = flappyGameOver;

        const updated = prev
          .map(pipe => {
            const newX = pipe.x - FLAPPY_PIPE_SPEED;
            const gapCenter = pipe.gapCenter;
            const gapTop =
              FLAPPY_AREA_HEIGHT / 2 +
              gapCenter -
              FLAPPY_GAP_SIZE / 2;
            const gapBottom =
              FLAPPY_AREA_HEIGHT / 2 +
              gapCenter +
              FLAPPY_GAP_SIZE / 2;

            const pipeLeft = newX;
            const pipeRight = newX + FLAPPY_PIPE_WIDTH;

            let passed = pipe.passed;
            if (!passed && pipeRight < peaCenterX - hitRadius) {
              passed = true;
              newScore += 1;
            }

            const horizontallyOverlaps =
              peaCenterX + hitRadius > pipeLeft &&
              peaCenterX - hitRadius < pipeRight;

            const GAP_MARGIN = 8; // Çarpma için ufak tolerans

            const verticallyOutsideGap =
            peaCenterY - hitRadius < gapTop - GAP_MARGIN ||
            peaCenterY + hitRadius > gapBottom + GAP_MARGIN;

            if (!gameOver && horizontallyOverlaps && verticallyOutsideGap) {
              gameOver = true;
            }

            return { ...pipe, x: newX, passed };
          })
          .filter(pipe => pipe.x > -FLAPPY_PIPE_WIDTH - 30);

        if (newScore !== flappyScoreRef.current) {
          flappyScoreRef.current = newScore;
          setFlappyScore(newScore);
        }
        if (gameOver && !flappyGameOver) {
          setFlappyGameOver(true);
        }

        return updated;
      });
    }, 16);

    return () => clearInterval(intervalId);
  }, [flappyStarted, flappyGameOver]);

  // Boru spawn
  useEffect(() => {
    if (!flappyStarted || flappyGameOver) return;

    const spawnId = setInterval(() => {
      setFlappyPipes(prev => [
        ...prev,
        {
          id: flappyPipeIdRef.current++,
          x: FLAPPY_AREA_WIDTH + 20,
          gapCenter: randomGapCenter(),
          passed: false,
        },
      ]);
    }, 1600);

    return () => clearInterval(spawnId);
  }, [flappyStarted, flappyGameOver]);

  const flap = () => {
    if (flappyGameOver) return;

    if (!flappyStarted) {
      setFlappyStarted(true);
    }

    flappyVelRef.current = FLAPPY_JUMP_VELOCITY;
  };

  const restartFlappy = () => {
    flappyScoreRef.current = 0;
    setFlappyScore(0);
    setFlappyGameOver(false);
    setFlappyStarted(false);
    flappyVelRef.current = 0;
    flappyYRef.current = 0;
    setFlappyPeaY(0);
    setFlappyPipes([
      {
        id: flappyPipeIdRef.current++,
        x: FLAPPY_AREA_WIDTH + 80,
        gapCenter: randomGapCenter(),
        passed: false,
      },
    ]);
  };

  const handleExit = () => {
    onFinished(flappyScoreRef.current);
    onClose();
  };

  return (
    <View style={styles.screen}>
      {/* ÜST: Başlık + açıklamalar */}
      <View style={styles.header}>
        <Text style={styles.gameTitle}>Flappy Pea 🪽</Text>
        <Text style={styles.gameSubtitle}>
          Ekrana dokununca Pea zıplıyor. Borulara çarpmadan geçmeye çalış!
        </Text>
        <Text style={styles.gameInfo}>Skor: {flappyScore}</Text>
        {typeof highScore === 'number' && highScore > 0 && (
          <Text style={styles.gameInfo}>En iyi skor: {highScore}</Text>
        )}
        {flappyGameOver && (
          <Text style={styles.gameInfo}>Çarptın! 😅</Text>
        )}
      </View>

      {/* ORTA: Oyun alanı */}
      <TouchableWithoutFeedback onPress={flap}>
        <View style={styles.flappyArea}>
          <View style={styles.flappySky}>
            {/* Borular */}
            {flappyPipes.map(pipe => {
              const gapCenter = pipe.gapCenter;
              const gapTop =
                FLAPPY_AREA_HEIGHT / 2 +
                gapCenter -
                FLAPPY_GAP_SIZE / 2;
              const gapBottom =
                FLAPPY_AREA_HEIGHT / 2 +
                gapCenter +
                FLAPPY_GAP_SIZE / 2;

              const topHeight = Math.max(0, gapTop);
              const bottomHeight = Math.max(
                0,
                FLAPPY_AREA_HEIGHT - gapBottom
              );

              return (
                <View
                  key={pipe.id}
                  style={[styles.flappyPipe, { left: pipe.x }]}
                >
                  <View
                    style={[
                      styles.flappyPipeSegment,
                      { height: topHeight },
                    ]}
                  />
                  <View style={{ height: FLAPPY_GAP_SIZE }} />
                  <View
                    style={[
                      styles.flappyPipeSegment,
                      { height: bottomHeight },
                    ]}
                  />
                </View>
              );
            })}

            {/* Pea */}
            <View
              style={[
                styles.flappyPea,
                { transform: [{ translateY: flappyPeaY }] },
              ]}
            >
              <Image
                source={sprite}
                style={styles.flappyPeaImage}
                resizeMode="contain"
              />
            </View>

            <View style={styles.flappyGround} />
          </View>
        </View>
      </TouchableWithoutFeedback>

      {/* ALT: Butonlar */}
      <View style={styles.bottomButtons}>
        {flappyGameOver && (
          <TouchableOpacity
            style={styles.gameMenuButton}
            onPress={restartFlappy}
          >
            <Text style={styles.gameMenuButtonText}>
              Yeniden Oyna 🔁
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.gameExitButton}
          onPress={handleExit}
        >
          <Text style={styles.gameExitText}>Çık ve Geri Dön</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: 24,      // yazıları status bar’dan biraz aşağı indir
    paddingBottom: 32,
    alignItems: 'center',
    justifyContent: 'flex-start',
    backgroundColor: '#F9FAFB', // varsa ana ekranla aynı renk
  },

  // YENİ: header bloğu
  header: {
    alignItems: 'center',
    marginBottom: 8,
  },
  gameTitle: {
    fontSize: 24,
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
  },
  gameInfo: {
    fontSize: 14,
    color: '#111827',
    marginVertical: 2,
    textAlign: 'center',
  },
  bottomButtons: {
    marginTop: 16,
    width: '100%',
    paddingHorizontal: 32,
    alignItems: 'center',
    gap: 8,
  },
  gameMenuButton: {
    width: '100%',
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#22C55E',
  },
  gameMenuButtonText: {
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
    color: '#ECFDF5',
  },
  gameExitButton: {
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#111827',
    alignSelf: 'center',
    minWidth: 180,
  },
  gameExitText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F9FAFB',
    textAlign: 'center',
  },
  flappyArea: {
    width: FLAPPY_AREA_WIDTH,
    height: FLAPPY_AREA_HEIGHT,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: '#BFDBFE',
    marginTop: 8,
    alignSelf: 'center',
  },
  flappySky: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  flappyGround: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: FLAPPY_GROUND_HEIGHT,
    backgroundColor: '#4ADE80',
  },
  flappyPea: {
    position: 'absolute',
    left: FLAPPY_PEA_X,
    top: FLAPPY_AREA_HEIGHT / 2 - FLAPPY_PEA_SIZE / 2,
    width: FLAPPY_PEA_SIZE,
    height: FLAPPY_PEA_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flappyPeaImage: {
    width: FLAPPY_PEA_SIZE,
    height: FLAPPY_PEA_SIZE,
  },
  flappyPipe: {
    position: 'absolute',
    top: 0,
    bottom: 40,
    width: FLAPPY_PIPE_WIDTH,
    alignItems: 'center',
  },
  flappyPipeSegment: {
    width: '100%',
    backgroundColor: '#16A34A',
    borderRadius: 8,
  },
});
