import React, { useState } from 'react';
import { ArrowLeft, Check, Coins, LockKeyhole, ShoppingBag } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { RACKET_ITEMS, SHUTTLE_ITEMS, type GameCosmeticItem } from './gameCosmetics';

interface GameCosmeticsShopProps {
  onBack: () => void;
}

export const GameCosmeticsShop: React.FC<GameCosmeticsShopProps> = ({ onBack }) => {
  const {
    currentUser,
    coinWallets,
    shopPurchases,
    gameLoadouts,
    buyShopItem,
    equipGameItem
  } = useAppStore();
  const [workingItemId, setWorkingItemId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const balance = coinWallets.find((wallet) => wallet.user_id === currentUser.id)?.balance || 0;
  const loadout = gameLoadouts.find((item) => item.user_id === currentUser.id);
  const racketStyle = loadout?.racket_style || 'classic';
  const shuttleStyle = loadout?.shuttle_style || 'classic';
  const ownedItemIds = new Set(
    shopPurchases
      .filter((purchase) => purchase.user_id === currentUser.id)
      .map((purchase) => purchase.item_id)
  );

  const handleItem = async (item: GameCosmeticItem) => {
    setWorkingItemId(item.id);
    setMessage(null);
    if (item.price > 0 && !ownedItemIds.has(item.id)) {
      const purchase = await buyShopItem(item.id);
      if (!purchase.success) {
        setMessage(purchase.message || '購買失敗，請再試一次。');
        setWorkingItemId(null);
        return;
      }
    }
    const equipped = await equipGameItem(item.id);
    setMessage(equipped.success ? `已裝備「${item.name}」` : equipped.message || '裝備失敗。');
    setWorkingItemId(null);
  };

  return (
    <section className="w-full rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-left shadow-2xl shadow-black/30 sm:p-6">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={onBack} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-slate-900 text-slate-300 transition-colors hover:border-white/20 hover:text-white" aria-label="返回遊戲準備畫面">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 shrink-0 text-amber-300" />
              <h2 className="truncate text-base font-black text-white">遊戲裝備商店</h2>
            </div>
            <p className="mt-0.5 text-[11px] text-slate-400">買過永久保留，可不限次數自由替換</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-amber-300">
          <Coins className="h-4 w-4" />
          <span className="text-sm font-black tabular-nums">{balance}</span>
          <span className="text-[9px] font-bold">枚</span>
        </div>
      </div>

      {message && (
        <div className="mt-3 rounded-lg border border-white/10 bg-slate-950/45 px-3 py-2 text-[10px] font-bold text-slate-200">
          {message}
        </div>
      )}

      <CosmeticGroup
        title="球拍樣式"
        items={RACKET_ITEMS}
        equippedStyle={racketStyle}
        ownedItemIds={ownedItemIds}
        balance={balance}
        workingItemId={workingItemId}
        onItem={handleItem}
      />
      <CosmeticGroup
        title="羽球樣式"
        items={SHUTTLE_ITEMS}
        equippedStyle={shuttleStyle}
        ownedItemIds={ownedItemIds}
        balance={balance}
        workingItemId={workingItemId}
        onItem={handleItem}
      />
    </section>
  );
};

const CosmeticGroup: React.FC<{
  title: string;
  items: readonly GameCosmeticItem[];
  equippedStyle: string;
  ownedItemIds: Set<string>;
  balance: number;
  workingItemId: string | null;
  onItem: (item: GameCosmeticItem) => Promise<void>;
}> = ({ title, items, equippedStyle, ownedItemIds, balance, workingItemId, onItem }) => (
  <div className="mt-5">
    <div className="mb-2.5 flex items-center justify-between">
      <h3 className="text-[11px] font-black tracking-wide text-slate-300">{title}</h3>
      <span className="text-[9px] font-bold text-slate-500">點擊商品即可購買或裝備</span>
    </div>
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {items.map((item) => {
        const owned = item.price === 0 || ownedItemIds.has(item.id);
        const equipped = equippedStyle === item.style;
        const affordable = balance >= item.price;
        const working = workingItemId === item.id;
        const effectLabel = item.price >= 10
          ? '傳說特效'
          : item.price >= 5 ? '動態粒子' : item.price > 0 ? '柔光特效' : '原始外觀';
        return (
          <button
            key={item.id}
            type="button"
            disabled={workingItemId !== null || (!owned && !affordable)}
            onClick={() => void onItem(item)}
            className={`relative min-w-0 rounded-2xl border p-2.5 text-left transition-all ${
              equipped
                ? 'border-emerald-400 bg-emerald-400/15 ring-1 ring-emerald-400/40'
                : 'border-white/10 bg-slate-950/35 hover:border-white/25'
            } disabled:cursor-not-allowed disabled:opacity-55`}
            aria-label={`${item.name}，${equipped ? '已裝備' : owned ? '已擁有' : `${item.price} 枚金幣`}`}
          >
            <CosmeticPreview item={item} />
            <span className={`mt-2 inline-flex rounded-full px-1.5 py-0.5 text-[8px] font-black ${
              item.price >= 10
                ? 'bg-amber-300/15 text-amber-200'
                : item.price >= 5 ? 'bg-rose-400/15 text-rose-200' : 'bg-sky-400/10 text-sky-200'
            }`}>{effectLabel}</span>
            <div className="mt-1.5 truncate text-[11px] font-black text-white">{item.name}</div>
            <div className="mt-0.5 truncate text-[9px] text-slate-500">{item.description}</div>
            <div className="mt-1 flex items-center gap-1 text-[9px] font-bold">
              {equipped ? (
                <span className="inline-flex items-center gap-1 text-emerald-300"><Check className="h-3 w-3" />已裝備</span>
              ) : owned ? (
                <span className="text-sky-300">{working ? '切換中…' : item.price === 0 ? '原始裝備' : '已擁有・裝備'}</span>
              ) : affordable ? (
                <span className="inline-flex items-center gap-1 text-amber-300"><Coins className="h-3 w-3" />{working ? '購買中…' : item.price}</span>
              ) : (
                <span className="inline-flex items-center gap-1 text-slate-500"><LockKeyhole className="h-3 w-3" />{item.price}</span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  </div>
);

const CosmeticPreview: React.FC<{ item: GameCosmeticItem }> = ({ item }) => (
  <div className="relative flex h-10 items-center justify-center overflow-hidden rounded-lg bg-slate-900/75">
    <div className="absolute inset-0 opacity-20" style={{ background: `radial-gradient(circle, ${item.colors[0]}, transparent 65%)` }} />
    {item.category === 'racket' ? (
      <div className="relative h-7 w-5 -rotate-12">
        <div className="h-5 w-5 rounded-[50%] border-[3px]" style={{ borderColor: item.colors[0], boxShadow: `0 0 8px ${item.colors[2]}` }} />
        <div className="mx-auto h-3 w-1 rounded-full" style={{ backgroundColor: item.colors[1] }} />
      </div>
    ) : (
      <div className="relative flex rotate-12 items-center">
        <div className="h-5 w-5 rounded-l-full [clip-path:polygon(0_10%,100%_35%,100%_65%,0_90%)]" style={{ backgroundColor: item.colors[0] }} />
        <div className="h-3 w-1.5" style={{ backgroundColor: item.colors[1] }} />
        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.colors[2], boxShadow: `0 0 8px ${item.colors[0]}` }} />
      </div>
    )}
  </div>
);
