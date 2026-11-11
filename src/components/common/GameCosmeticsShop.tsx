import React, { useState } from 'react';
import { ArrowLeft, Check, Coins, Play, X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import {
  COSMETIC_CATEGORIES, COSMETIC_RARITIES, GAME_COSMETIC_ITEMS, getEquippedStyle,
  type CosmeticCategory, type GameCosmeticItem,
} from './gameCosmetics';

interface GameCosmeticsShopProps {
  onBack: () => void;
  onClose: () => void;
  onTry: (item: GameCosmeticItem) => void;
  initialCategory: CosmeticCategory;
}

export const GameCosmeticsShop: React.FC<GameCosmeticsShopProps> = ({ onBack, onClose, onTry, initialCategory }) => {
  const { currentUser, coinWallets, shopPurchases, gameLoadouts, buyShopItem, equipGameItem } = useAppStore();
  const [category, setCategory] = useState<CosmeticCategory>(initialCategory);
  const [workingItemId, setWorkingItemId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const balance = coinWallets.find((wallet) => wallet.user_id === currentUser.id)?.balance ?? 0;
  const loadout = gameLoadouts.find((item) => item.user_id === currentUser.id);
  const equippedStyle = getEquippedStyle(category, loadout);
  const ownedItemIds = new Set(shopPurchases
    .filter((purchase) => purchase.user_id === currentUser.id)
    .map((purchase) => purchase.item_id));

  const handleItem = async (item: GameCosmeticItem) => {
    if (workingItemId !== null || getEquippedStyle(item.category, loadout) === item.style) return;
    setWorkingItemId(item.id);
    setMessage(null);
    try {
      if (item.price > 0 && !ownedItemIds.has(item.id)) {
        const purchase = await buyShopItem(item.id);
        if (!purchase.success) {
          setMessage(purchase.message || '購買失敗，請再試一次。');
          return;
        }
      }
      const equipped = await equipGameItem(item.id);
      setMessage(equipped.success ? `已裝備「${item.name}」` : equipped.message || '裝備失敗。');
    } finally {
      setWorkingItemId(null);
    }
  };

  return (
    <section aria-label="遊戲裝備商店" className="mx-auto flex h-full w-full max-w-xl flex-col bg-slate-950 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5">
      <header className="flex shrink-0 items-center gap-2">
        <button type="button" onClick={onBack} aria-label="返回遊戲準備畫面" className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-slate-900 text-slate-200 hover:bg-slate-800">
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        </button>
        <h2 className="min-w-0 flex-1 text-base font-black leading-tight text-white sm:text-lg">遊戲裝備商店</h2>
        <div className="flex shrink-0 items-center gap-1.5 rounded-xl border border-amber-300/20 bg-amber-300/10 px-2.5 py-2 text-amber-300" aria-label={`目前有 ${balance} 枚金幣`}>
          <Coins aria-hidden="true" className="h-4 w-4" />
          <span className="text-sm font-black tabular-nums">{balance}</span>
        </div>
        <button type="button" onClick={onClose} aria-label="關閉遊戲" className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-slate-900 text-slate-200 hover:bg-slate-800">
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </header>

      <nav aria-label="裝備分類" className="my-3 grid shrink-0 grid-cols-4 gap-1 rounded-xl border border-white/10 bg-slate-900/70 p-1">
        {COSMETIC_CATEGORIES.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            aria-pressed={category === id}
            onClick={() => { setCategory(id); setMessage(null); }}
            className={`min-h-10 rounded-lg border px-1 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-emerald-300 ${category === id
              ? 'border-emerald-400/50 bg-emerald-400/15 text-emerald-200'
              : 'border-transparent text-slate-300 hover:bg-white/5'}`}
          >
            {label}
          </button>
        ))}
      </nav>

      <div role="status" className="shrink-0 text-xs text-slate-200">
        {message && <p className="mb-2 rounded-lg border border-white/10 bg-slate-900 px-3 py-2">{message}</p>}
      </div>

      <div key={category} className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-3">
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          {GAME_COSMETIC_ITEMS.filter((item) => item.category === category).map((item) => {
            const equipped = equippedStyle === item.style;
            const owned = item.price === 0 || equipped || ownedItemIds.has(item.id);
            const affordable = balance >= item.price;
            const working = workingItemId === item.id;
            return (
              <article key={item.id} className={`min-w-0 rounded-2xl border p-2.5 ${equipped
                ? 'border-emerald-400/75 bg-emerald-950/35'
                : 'border-white/10 bg-slate-900/75'}`}>
                <div className="relative">
                  <CosmeticPreview item={item} />
                  <span className="pointer-events-none absolute left-1 top-1 rounded bg-slate-950/90 px-1.5 py-0.5 text-[11px] font-semibold text-slate-200">
                    {COSMETIC_RARITIES[item.rarity]}
                  </span>
                  <button
                    type="button"
                    aria-label={`${item.name}，動態試用`}
                    onClick={() => onTry(item)}
                    className="absolute bottom-1 right-1 inline-flex min-h-9 items-center gap-1 rounded-lg bg-slate-900/90 px-2 text-xs font-semibold text-slate-100 ring-1 ring-white/15 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-emerald-300"
                  >
                    <Play aria-hidden="true" className="size-3" />
                    試用
                  </button>
                </div>
                <h3 className="mt-2 break-words text-center text-sm font-black leading-tight text-white">{item.name}</h3>
                <button
                  type="button"
                  disabled={equipped || workingItemId !== null || (!owned && !affordable)}
                  onClick={() => void handleItem(item)}
                  aria-label={`${item.name}，${equipped ? '已裝備' : owned ? '裝備' : `購買，${item.price} 枚金幣${affordable ? '' : '，金幣不足'}`}`}
                  className={`mt-2 flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl border px-1.5 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-emerald-300 ${equipped
                    ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
                    : 'border-white/10 bg-slate-800/85 text-slate-100 enabled:hover:border-emerald-400/50'}`}
                >
                  {equipped ? <><Check aria-hidden="true" className="h-4 w-4" />已裝備</>
                    : working ? (owned ? '裝備中…' : '購買中…')
                    : owned ? '裝備'
                    : <><Coins aria-hidden="true" className="h-4 w-4 text-amber-300" /><span className="tabular-nums text-amber-100">{item.price}</span></>}
                </button>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

const CosmeticPreview = ({ item }: { item: GameCosmeticItem }) => (
  <div
    aria-hidden="true"
    className="relative flex h-25 items-center justify-center overflow-hidden rounded-xl bg-slate-950 sm:h-32"
    style={{ backgroundImage: `radial-gradient(ellipse at center, ${item.accent}22, transparent 76%)` }}
  >
    {item.artwork ? (
      <img src={`${import.meta.env.BASE_URL}assets/goodminton/${item.artwork}`} alt="" className="h-full w-full object-contain p-1" />
    ) : (
      <svg viewBox="0 0 110 92" className="h-full max-w-full p-2" style={{ color: item.accent }} fill="none">
        {item.category === 'racket' ? (
          <g transform="rotate(34 53 45)" stroke="currentColor" strokeLinejoin="round">
            <ellipse cx="53" cy="27" rx="19" ry="23" fill="currentColor" fillOpacity=".12" strokeWidth="3" />
            <path d="M44 8v38m9-41v44m9-41v38M38 16h30M34 25h38M36 34h34M42 42h22" opacity=".65" />
            <path d="M53 50v12" strokeWidth="3" />
            <rect x="49" y="61" width="8" height="24" rx="3" fill="currentColor" />
          </g>
        ) : item.category === 'shuttle' ? (
          <g transform="rotate(34 54 46)" stroke="currentColor" strokeWidth="2">
            <path d="M28 13Q54 3 80 13L62 55H45Z" fill="currentColor" fillOpacity=".3" />
            <path d="M39 11l11 44M54 9v46M69 11L58 55" />
            <path d="M44 56h20v7H44z" fill="currentColor" />
            <path d="M44 63h20v6a10 10 0 0 1-20 0Z" fill="#f8fafc" />
          </g>
        ) : (
          <g stroke="currentColor" strokeLinecap="round">
            <path d="M15 67Q42 34 87 29" strokeWidth="6" opacity=".15" />
            <path d="M30 58Q52 34 87 29" strokeWidth="3" opacity=".72" />
            <circle cx="89" cy="28" r="5" fill="currentColor" />
          </g>
        )}
      </svg>
    )}
  </div>
);
