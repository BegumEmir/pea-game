import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatsData } from '../hooks/useStats';

// ── Types ─────────────────────────────────────────────────────────────────────

type StatsScreenProps = {
  stats: StatsData;
  onClose: () => void;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const GAME_LABELS: Record<string, { name: string; scoreUnit: string }> = {
  bug:    { name: 'Böcek Yakala 🪰',   scoreUnit: 'böcek' },
  memory: { name: 'Hafıza Oyunu 🃏',   scoreUnit: 'puan'  },
  flappy: { name: 'Flappy Pea 🪽',     scoreUnit: 'boru'  },
  coin:   { name: 'Coin Yağmuru 💰',   scoreUnit: 'coin'  },
  garden: { name: 'Bahçe Bakımı 🌿',   scoreUnit: 'bitki' },
};

const GAME_ORDER = ['bug', 'memory', 'flappy', 'coin', 'garden'] as const;

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('tr-TR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

// ── StatsScreen ───────────────────────────────────────────────────────────────

export default function StatsScreen({ stats, onClose }: StatsScreenProps) {
  const insets = useSafeAreaInsets();

  const totalGames = GAME_ORDER.reduce((sum, t) => sum + stats.gamesPlayed[t], 0);
  const totalCare  = stats.careActions.water + stats.careActions.sun + stats.careActions.soil;

  return (
    <View style={[styles.wrapper, { paddingTop: insets.top }]}>
      <Text style={styles.title}>İstatistikler 📊</Text>
      <Text style={styles.subtitle}>Pea ile birlikte ne kadar yol aldın!</Text>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Genel */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🌿 Genel</Text>
          <StatRow
            label="İlk oyun tarihi"
            value={stats.firstPlayDate ? formatDate(stats.firstPlayDate) : '—'}
          />
          <StatRow
            label="Kaç gündür oynuyor"
            value={stats.firstPlayDate ? `${daysSince(stats.firstPlayDate)} gün` : '—'}
          />
          <View style={styles.divider} />
          <StatRow label="Mevcut seri" value={`${stats.streak} gün 🔥`} />
          <StatRow label="Toplam coin kazanıldı" value={`💰 ${stats.totalCoins}`} />
          <StatRow label="Toplam XP kazanıldı" value={`⭐ ${stats.totalXP}`} />
        </View>

        {/* Bakım */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💧 Bakım</Text>
          <StatRow label="Su verildi"     value={`${stats.careActions.water} kez 💧`} />
          <StatRow label="Güneş verildi"  value={`${stats.careActions.sun} kez ☀️`} />
          <StatRow label="Toprak verildi" value={`${stats.careActions.soil} kez 🌱`} />
          <View style={styles.divider} />
          <StatRow label="Toplam bakım" value={`${totalCare} kez`} />
        </View>

        {/* Oyunlar */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎮 Oyunlar</Text>
          <StatRow label="Toplam oynanan" value={`${totalGames} oyun`} />
          <View style={styles.divider} />
          {GAME_ORDER.map(type => {
            const played = stats.gamesPlayed[type];
            const high   = stats.highScores[type];
            const meta   = GAME_LABELS[type];
            return (
              <View key={type} style={styles.gameEntry}>
                <Text style={styles.gameName}>{meta.name}</Text>
                <View style={styles.gameDetails}>
                  <View style={styles.gamePill}>
                    <Text style={styles.gamePillText}>{played} oyun</Text>
                  </View>
                  <View style={[styles.gamePill, styles.gamePillAccent]}>
                    <Text style={[styles.gamePillText, styles.gamePillTextAccent]}>
                      En iyi: {high} {meta.scoreUnit}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.bottomArea, { paddingBottom: Math.max(20, insets.bottom + 8) }]}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>Kapat</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── StatRow ───────────────────────────────────────────────────────────────────

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

// ── Stiller ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    width: '100%',
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#14532D',
    marginBottom: 2,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#166534',
    textAlign: 'center',
    marginBottom: 12,
  },
  list: {
    flex: 1,
    width: '100%',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 12,
  },
  section: {
    backgroundColor: '#DCFCE7',
    borderRadius: 20,
    padding: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#14532D',
    marginBottom: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#BBF7D0',
    marginVertical: 2,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 13,
    color: '#166534',
    flex: 1,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#14532D',
  },
  gameEntry: {
    gap: 4,
  },
  gameName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#14532D',
  },
  gameDetails: {
    flexDirection: 'row',
    gap: 6,
    paddingLeft: 4,
  },
  gamePill: {
    backgroundColor: '#BBF7D0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  gamePillAccent: {
    backgroundColor: '#15803D',
  },
  gamePillText: {
    fontSize: 11,
    color: '#166534',
    fontWeight: '600',
  },
  gamePillTextAccent: {
    color: '#F0FDF4',
  },
  bottomArea: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 12,
    paddingBottom: 20,
    backgroundColor: '#F0FDF4',
  },
  closeButton: {
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#14532D',
    minWidth: 200,
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F0FDF4',
    textAlign: 'center',
  },
});
