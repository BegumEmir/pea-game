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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

// Ekran boyutu
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Flappy sabitleri (ekrana göre)
const FLAPPY_AREA_WIDTH  = Math.min(SCREEN_WIDTH - 40, 380);
// Default height used for initialization; overridden by onLayout once the
// canvas is mounted and measured.
const FLAPPY_AREA_HEIGHT_DEFAULT = FLAPPY_AREA_WIDTH * 1.1;

const FLAPPY_PIPE_WIDTH  = 70;
const FLAPPY_GAP_SIZE    = 150;

const FLAPPY_PEA_SIZE    = 72;
const FLAPPY_PEA_X       = FLAPPY_AREA_WIDTH * 0.22;

const FLAPPY_GRAVITY     = 0.4;
const FLAPPY_JUMP_VELOCITY = -7;
const FLAPPY_PIPE_SPEED  = 2;

const FLAPPY_GROUND_HEIGHT = 40;

function randomGapCenter(): number {
  return Math.random() * 80 - 40;
}

export default function FlappyPeaGame({
  sprite,
  highScore,
  onClose,
  onFinished,
}: FlappyPeaGameProps) {
  const insets = useSafeAreaInsets();

  const [flappyPeaY, setFlappyPeaY]         = useState(0);
  const flappyVelRef                          = useRef(0);
  const flappyYRef                            = useRef(0);

  const [flappyStarted, setFlappyStarted]     = useState(false);
  const [flappyGameOver, setFlappyGameOver]   = useState(false);
  const [flappyScore, setFlappyScore]         = useState(0);
  const flappyScoreRef                        = useRef(0);
  const flappyStartedRef                      = useRef(false);
  const flappyGameOverRef                     = useRef(false);

  // Canvas height — updated by onLayout so physics always use real dimensions
  const [areaHeight, setAreaHeight]           = useState(FLAPPY_AREA_HEIGHT_DEFAULT);
  const areaHeightRef                         = useRef(FLAPPY_AREA_HEIGHT_DEFAULT);

  const [flappyPipes, setFlappyPipes] = useState<FlappyPipe[]>(() => [
    { id: 0, x: FLAPPY_AREA_WIDTH + 80, gapCenter: randomGapCenter(), passed: false },
  ]);
  const flappyPipeIdRef = useRef(1);

  // Sync refs every render so the RAF loop never reads stale values
  flappyStartedRef.current  = flappyStarted;
  flappyGameOverRef.current = flappyGameOver;

  // Yerçekimi + boru hareketi + çarpışma + skor
  useEffect(() => {
    let rafId: number;
    let lastTimestamp: number | null = null;

    const loop = (timestamp: number) => {
      if (lastTimestamp === null) {
        lastTimestamp = timestamp;
        rafId = requestAnimationFrame(loop);
        return;
      }

      const rawDelta = timestamp - lastTimestamp;
      lastTimestamp  = timestamp;
      const delta    = Math.min(rawDelta / 16.667, 3);

      if (!flappyGameOverRef.current) {
        if (flappyStartedRef.current) {
          flappyVelRef.current += FLAPPY_GRAVITY * delta;
          flappyYRef.current   += flappyVelRef.current * delta;

          // Bounds derived from current canvas height via ref
          const h      = areaHeightRef.current;
          const minY   = -h / 2 + 30;
          const maxY   = h / 2 - FLAPPY_PEA_SIZE / 2 - FLAPPY_GROUND_HEIGHT + 8;

          if (flappyYRef.current > maxY) {
            flappyYRef.current = maxY;
            setFlappyGameOver(true);
          }
          if (flappyYRef.current < minY) {
            flappyYRef.current   = minY;
            flappyVelRef.current = 0;
          }

          setFlappyPeaY(flappyYRef.current);
        }

        const peaCenterY = areaHeightRef.current / 2 + flappyYRef.current;
        const peaRadius  = FLAPPY_PEA_SIZE / 2;
        const peaCenterX = FLAPPY_PEA_X + peaRadius;
        const hitRadius  = peaRadius * 0.7;

        setFlappyPipes(prev => {
          if (!flappyStartedRef.current) return prev;

          let newScore = flappyScoreRef.current;
          let gameOver = flappyGameOverRef.current;

          const updated = prev
            .map(pipe => {
              const newX      = pipe.x - FLAPPY_PIPE_SPEED * delta;
              const gapCenter = pipe.gapCenter;
              const h         = areaHeightRef.current;
              const gapTop    = h / 2 + gapCenter - FLAPPY_GAP_SIZE / 2;
              const gapBottom = h / 2 + gapCenter + FLAPPY_GAP_SIZE / 2;
              const pipeLeft  = newX;
              const pipeRight = newX + FLAPPY_PIPE_WIDTH;

              let passed = pipe.passed;
              if (!passed && pipeRight < peaCenterX - hitRadius) {
                passed = true;
                newScore += 1;
              }

              const horizontallyOverlaps =
                peaCenterX + hitRadius > pipeLeft &&
                peaCenterX - hitRadius < pipeRight;

              const GAP_MARGIN = 8;
              const verticallyOutsideGap =
                peaCenterY - hitRadius < gapTop    - GAP_MARGIN ||
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
          if (gameOver && !flappyGameOverRef.current) {
            setFlappyGameOver(true);
          }

          return updated;
        });
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (!flappyStarted) setFlappyStarted(true);
    flappyVelRef.current = FLAPPY_JUMP_VELOCITY;
  };

  const restartFlappy = () => {
    flappyScoreRef.current = 0;
    setFlappyScore(0);
    setFlappyGameOver(false);
    setFlappyStarted(false);
    flappyVelRef.current = 0;
    flappyYRef.current   = 0;
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
    <View style={[styles.screen, { paddingTop: insets.top }]}>
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

      {/* ORTA: Oyun alanı — flex:1 ile kalan alanı doldurur */}
      <TouchableWithoutFeedback onPress={flap}>
        <View
          style={styles.flappyArea}
          onLayout={e => {
            const h = e.nativeEvent.layout.height;
            areaHeightRef.current = h;
            setAreaHeight(h);
          }}
        >
          <View style={styles.flappySky}>
            {/* Borular */}
            {flappyPipes.map(pipe => {
              const gapTop    = areaHeight / 2 + pipe.gapCenter - FLAPPY_GAP_SIZE / 2;
              const gapBottom = areaHeight / 2 + pipe.gapCenter + FLAPPY_GAP_SIZE / 2;
              const topHeight    = Math.max(0, gapTop);
              const bottomHeight = Math.max(0, areaHeight - gapBottom);

              return (
                <View key={pipe.id} style={[styles.flappyPipe, { left: pipe.x }]}>
                  <View style={[styles.flappyPipeSegment, { height: topHeight }]} />
                  <View style={{ height: FLAPPY_GAP_SIZE }} />
                  <View style={[styles.flappyPipeSegment, { height: bottomHeight }]} />
                </View>
              );
            })}

            {/* Pea — top is dynamic so must be inline */}
            <View
              style={[
                styles.flappyPea,
                {
                  top: areaHeight / 2 - FLAPPY_PEA_SIZE / 2,
                  transform: [{ translateY: flappyPeaY }],
                },
              ]}
            >
              <Image source={sprite} style={styles.flappyPeaImage} resizeMode="contain" />
            </View>

            <View style={styles.flappyGround} />
          </View>
        </View>
      </TouchableWithoutFeedback>

      {/* ALT: Butonlar */}
      <View style={styles.bottomButtons}>
        {flappyGameOver && (
          <TouchableOpacity style={styles.gameMenuButton} onPress={restartFlappy}>
            <Text style={styles.gameMenuButtonText}>Yeniden Oyna 🔁</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.gameExitButton} onPress={handleExit}>
          <Text style={styles.gameExitText}>Çık ve Geri Dön</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingBottom: 32,
    alignItems: 'center',
    justifyContent: 'flex-start',
    backgroundColor: '#F9FAFB',
  },
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
    flex: 1,                    // fills remaining height after header + buttons
    width: FLAPPY_AREA_WIDTH,
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
    // top is intentionally omitted here — applied inline using areaHeight state
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
