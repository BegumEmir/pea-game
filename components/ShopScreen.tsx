import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AUTO_WATER_COST,
  ENERGY_DRINK_COST,
  FOOD_FUN_COST,
  FOOD_SOIL_COST,
  FOOD_SUN_COST,
  FOOD_WATER_COST,
  GOLD_FRAME_COST,
  HAT_COST,
  LUCKY_BOX_COST,
  RAINBOW_AURA_COST,
  STAT_BOOST_COST,
  XP_BOOST_COST,
} from '../hooks/usePea';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRemaining(ms: number): string {
  const totalSecs = Math.ceil(ms / 1000);
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  return m > 0 ? `${m}dk ${s}sn` : `${s}sn`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Category = 'guclendir' | 'yiyecek' | 'aksesuar';

type ShopScreenProps = {
  coins: number;
  xpBoostExpiry: number;
  autoWaterExpiry: number;
  accessories: string[];
  onBuyXpBoost: () => void;
  onBuyStatBoost: () => void;
  onBuyAutoWater: () => void;
  onBuyEnergyDrink: () => void;
  onBuyLuckyBox: () => void;
  onBuyFoodWater: () => void;
  onBuyFoodSun: () => void;
  onBuyFoodSoil: () => void;
  onBuyFoodFun: () => void;
  onBuyHat: () => void;
  onBuyRainbowAura: () => void;
  onBuyGoldFrame: () => void;
  onClose: () => void;
};

// ── ShopScreen ────────────────────────────────────────────────────────────────

export default function ShopScreen({
  coins,
  xpBoostExpiry,
  autoWaterExpiry,
  accessories,
  onBuyXpBoost,
  onBuyStatBoost,
  onBuyAutoWater,
  onBuyEnergyDrink,
  onBuyLuckyBox,
  onBuyFoodWater,
  onBuyFoodSun,
  onBuyFoodSoil,
  onBuyFoodFun,
  onBuyHat,
  onBuyRainbowAura,
  onBuyGoldFrame,
  onClose,
}: ShopScreenProps) {
  const insets = useSafeAreaInsets();
  const [now,      setNow]      = useState(Date.now());
  const [category, setCategory] = useState<Category>('guclendir');

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const xpBoostActive   = xpBoostExpiry   > now;
  const autoWaterActive = autoWaterExpiry > now;
  const xpBoostMs       = Math.max(0, xpBoostExpiry   - now);
  const autoWaterMs     = Math.max(0, autoWaterExpiry - now);

  const TABS: { id: Category; label: string }[] = [
    { id: 'guclendir', label: '💊 Güçlendirme' },
    { id: 'yiyecek',   label: '🍎 Yiyecek' },
    { id: 'aksesuar',  label: '🎀 Aksesuar' },
  ];

  return (
    <View style={[styles.wrapper, { paddingTop: insets.top }]}>
      {/* Başlık */}
      <Text style={styles.title}>Dükkan 🛒</Text>
      <Text style={styles.subtitle}>Coinlerini harca, Pea'ne güç ver!</Text>

      <View style={styles.coinsRow}>
        <Text style={styles.coinsLabel}>Bakiye</Text>
        <View style={styles.coinsBadge}>
          <Text style={styles.coinsBadgeText}>💰 {coins}</Text>
        </View>
      </View>

      {/* Kategori sekmeleri */}
      <View style={styles.tabs}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, category === tab.id && styles.tabActive]}
            onPress={() => setCategory(tab.id)}
          >
            <Text style={[styles.tabText, category === tab.id && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Ürün listesi */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Güçlendirmeler ─────────────────────────────────────────────────── */}
        {category === 'guclendir' && (
          <>
            <ItemCard
              emoji="🌟"
              name="XP Boost"
              desc="5 dakika boyunca 2× XP kazan"
              cost={XP_BOOST_COST}
              coins={coins}
              activeLabel={xpBoostActive ? `✓ Aktif — ${formatRemaining(xpBoostMs)} kaldı` : null}
              cardBg="#DCFCE7"
              onBuy={onBuyXpBoost}
            />
            <ItemCard
              emoji="💊"
              name="Güç Vitamini"
              desc="Tüm statlar anında +20 artar"
              cost={STAT_BOOST_COST}
              coins={coins}
              cardBg="#DCFCE7"
              onBuy={onBuyStatBoost}
            />
            <ItemCard
              emoji="💧"
              name="Otomatik Su"
              desc="10 dakika boyunca su otomatik dolar"
              cost={AUTO_WATER_COST}
              coins={coins}
              activeLabel={autoWaterActive ? `✓ Aktif — ${formatRemaining(autoWaterMs)} kaldı` : null}
              cardBg="#DCFCE7"
              onBuy={onBuyAutoWater}
            />
            <ItemCard
              emoji="⚡"
              name="Enerji İçeceği"
              desc="Anında +30 enerji kazanırsın"
              cost={ENERGY_DRINK_COST}
              coins={coins}
              cardBg="#DCFCE7"
              onBuy={onBuyEnergyDrink}
            />
            <ItemCard
              emoji="🍀"
              name="Şanslı Kutu"
              desc="Rastgele ödül: 10–100 coin veya XP Boost!"
              cost={LUCKY_BOX_COST}
              coins={coins}
              cardBg="#DCFCE7"
              onBuy={onBuyLuckyBox}
            />
          </>
        )}

        {/* ── Yiyecek ────────────────────────────────────────────────────────── */}
        {category === 'yiyecek' && (
          <>
            <CategoryHeader emoji="🍎" title="Tek kullanımlık — statı anında artırır" />
            <ItemCard
              emoji="💧"
              name="Özel Su"
              desc="Su +40 artar"
              cost={FOOD_WATER_COST}
              coins={coins}
              cardBg="#FEF3C7"
              onBuy={onBuyFoodWater}
            />
            <ItemCard
              emoji="☀️"
              name="Güneş Kremi"
              desc="Güneş +40 artar"
              cost={FOOD_SUN_COST}
              coins={coins}
              cardBg="#FEF3C7"
              onBuy={onBuyFoodSun}
            />
            <ItemCard
              emoji="🌱"
              name="Süper Gübre"
              desc="Toprak +40 artar"
              cost={FOOD_SOIL_COST}
              coins={coins}
              cardBg="#FEF3C7"
              onBuy={onBuyFoodSoil}
            />
            <ItemCard
              emoji="🎮"
              name="Eğlence Paketi"
              desc="Eğlence +40 artar"
              cost={FOOD_FUN_COST}
              coins={coins}
              cardBg="#FEF3C7"
              onBuy={onBuyFoodFun}
            />
          </>
        )}

        {/* ── Aksesuarlar ────────────────────────────────────────────────────── */}
        {category === 'aksesuar' && (
          <>
            <CategoryHeader emoji="🎀" title="Kalıcı görünüm değişiklikleri" />
            <ItemCard
              emoji="🎩"
              name="Silindir Şapka"
              desc="Pea'nın üstünde görünür"
              cost={HAT_COST}
              coins={coins}
              owned={accessories.includes('hat')}
              cardBg="#EDE9FE"
              onBuy={onBuyHat}
            />
            <ItemCard
              emoji="🌈"
              name="Gökkuşağı Aura"
              desc="Pea'nın etrafında animasyonlu renk efekti"
              cost={RAINBOW_AURA_COST}
              coins={coins}
              owned={accessories.includes('rainbowAura')}
              cardBg="#EDE9FE"
              onBuy={onBuyRainbowAura}
            />
            <ItemCard
              emoji="⭐"
              name="Altın Çerçeve"
              desc="Pea'nın etrafında altın halka"
              cost={GOLD_FRAME_COST}
              coins={coins}
              owned={accessories.includes('goldFrame')}
              cardBg="#EDE9FE"
              onBuy={onBuyGoldFrame}
            />
          </>
        )}
      </ScrollView>

      {/* Alt kapat butonu */}
      <View style={[styles.bottomArea, { paddingBottom: Math.max(20, insets.bottom + 8) }]}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>Kapat</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── CategoryHeader ────────────────────────────────────────────────────────────

function CategoryHeader({ emoji, title }: { emoji: string; title: string }) {
  return (
    <View style={styles.catHeader}>
      <Text style={styles.catHeaderEmoji}>{emoji}</Text>
      <Text style={styles.catHeaderText}>{title}</Text>
    </View>
  );
}

// ── ItemCard ──────────────────────────────────────────────────────────────────

type ItemCardProps = {
  emoji: string;
  name: string;
  desc: string;
  cost: number;
  coins: number;
  activeLabel?: string | null;
  owned?: boolean;
  cardBg: string;
  onBuy: () => void;
};

function ItemCard({ emoji, name, desc, cost, coins, activeLabel, owned, cardBg, onBuy }: ItemCardProps) {
  const canAfford  = coins >= cost;
  const isAccessory = cardBg === '#EDE9FE';
  const buyBg      = isAccessory ? '#7C3AED' : '#15803D';

  return (
    <View style={[styles.card, { backgroundColor: cardBg }]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardEmoji}>{emoji}</Text>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{name}</Text>
          <Text style={styles.cardDesc}>{desc}</Text>
        </View>
        <View style={[styles.costBadge, isAccessory && styles.costBadgeAccessory]}>
          <Text style={[styles.costText, isAccessory && styles.costTextAccessory]}>
            💰 {cost}
          </Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        {owned ? (
          <View style={styles.ownedBadge}>
            <Text style={styles.ownedBadgeText}>✓ Sahipsin</Text>
          </View>
        ) : activeLabel ? (
          <View style={styles.activeBadge}>
            <Text style={styles.activeBadgeText}>{activeLabel}</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.buyButton, { backgroundColor: buyBg }, !canAfford && styles.buyButtonDisabled]}
            onPress={onBuy}
            disabled={!canAfford}
          >
            <Text style={styles.buyButtonText}>
              {canAfford ? 'Satın Al' : 'Yetersiz coin'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
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
    marginBottom: 10,
  },
  coinsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  coinsLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#166534',
  },
  coinsBadge: {
    backgroundColor: '#FACC15',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  coinsBadgeText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  // ── Kategori sekmeleri ────────────────────────────────────────────────────
  tabs: {
    flexDirection: 'row',
    width: '100%',
    paddingHorizontal: 16,
    gap: 6,
    marginBottom: 10,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
  },
  tabActive: {
    backgroundColor: '#15803D',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
    textAlign: 'center',
  },
  tabTextActive: {
    color: '#F0FDF4',
  },
  // ── Liste ─────────────────────────────────────────────────────────────────
  list: {
    flex: 1,
    width: '100%',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 12,
  },
  // ── Kategori başlığı ──────────────────────────────────────────────────────
  catHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
    marginBottom: -4,
  },
  catHeaderEmoji: {
    fontSize: 16,
  },
  catHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  // ── Kart ──────────────────────────────────────────────────────────────────
  card: {
    borderRadius: 20,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  cardEmoji: {
    fontSize: 32,
    lineHeight: 40,
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#14532D',
    marginBottom: 2,
  },
  cardDesc: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
  costBadge: {
    backgroundColor: '#BBF7D0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  costBadgeAccessory: {
    backgroundColor: '#DDD6FE',
  },
  costText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#14532D',
  },
  costTextAccessory: {
    color: '#5B21B6',
  },
  cardFooter: {
    alignItems: 'flex-start',
  },
  ownedBadge: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  ownedBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  activeBadge: {
    backgroundColor: '#86EFAC',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  activeBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#14532D',
  },
  buyButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 999,
  },
  buyButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  buyButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F0FDF4',
  },
  // ── Alt alan ──────────────────────────────────────────────────────────────
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
