import React, { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc';

const PLAYER_IMG_BASE = 'https://futmind.com/images/fifa2027/players';

/** Every address a card's picture might live at (FUTMind names base and special cards differently). */
export function cardImageCandidates(card: any): string[] {
  const list: string[] = [];
  const add = (u?: string | null) => {
    if (u && !list.includes(u)) list.push(u);
  };
  add(card?.avatarUrl);
  if (card?.eaAssetId) {
    add(`${PLAYER_IMG_BASE}/${card.eaAssetId}.png`);
    add(`${PLAYER_IMG_BASE}/p${card.eaAssetId}.png`);
  }
  return list;
}

/** Tries each address in turn and resolves with the first one that really loads. */
export function resolveWorkingImage(urls: string[]): Promise<string | null> {
  return urls.reduce<Promise<string | null>>(
    (chain, url) =>
      chain.then(
        (found) =>
          found ??
          new Promise<string | null>((resolve) => {
            const img = new Image();
            img.referrerPolicy = 'no-referrer';
            img.onload = () => resolve(url);
            img.onerror = () => resolve(null);
            img.src = url;
          })
      ),
    Promise.resolve(null)
  );
}

/** Picture that walks through its candidate addresses until one loads. */
function PickerImage({ card }: { card: any }) {
  const candidates = React.useMemo(() => cardImageCandidates(card), [card?.avatarUrl, card?.eaAssetId]);
  const [idx, setIdx] = useState(0);
  useEffect(() => setIdx(0), [card?.id]);
  const src = candidates[idx];
  if (!src) {
    return <div className="w-full h-full flex items-center justify-center text-2xl opacity-30">👤</div>;
  }
  return (
    <img
      key={src}
      src={src}
      alt=""
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setIdx((i) => i + 1)}
      className="w-full h-full object-cover object-top"
    />
  );
}

interface PickerProps {
  isOpen: boolean;
  onClose: () => void;
  onPick: (card: any) => void;
}

/** "Choose player image": Popular / Search tabs and a grid of cards. */
function PlayerImagePicker({ isOpen, onClose, onPick }: PickerProps) {
  const [tab, setTab] = useState<'popular' | 'search'>('popular');
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setQuery(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);

  const results = trpc.scout.cards.search.useQuery(
    { query: tab === 'search' && query ? query : undefined, limit: 30 },
    { enabled: isOpen && (tab === 'popular' || query.length >= 2) }
  );

  if (!isOpen) return null;
  const cards: any[] = results.data ?? [];

  return (
    <div className="fixed inset-0 z-[70] flex justify-center bg-black/85 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[#080B14] flex flex-col h-full border-x border-[#26334A]">
        <div className="flex items-center justify-between p-3 bg-[#0D1220] border-b border-[#26334A]">
          <h3 className="text-sm font-black text-[#F4F7FB] uppercase tracking-widest" style={{ fontFamily: "'Orbitron', sans-serif" }}>
            Choose player image
          </h3>
          <button onClick={onClose} className="text-[#8E9AAF] hover:text-[#F4F7FB] p-1.5 text-lg leading-none">✕</button>
        </div>

        <div className="p-3 space-y-2.5 bg-[#0D1220] border-b border-[#26334A]">
          <div className="flex gap-1.5">
            {(['popular', 'search'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border ${
                  tab === t
                    ? 'bg-[#192235] text-[#21E6A4] border-[#21E6A4]/50'
                    : 'bg-[#131A2A] text-[#8E9AAF] border-transparent'
                }`}
              >
                {t === 'popular' ? 'Popular' : 'Search'}
              </button>
            ))}
          </div>
          {tab === 'search' && (
            <input
              autoFocus
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Search a player (e.g. Rooney)..."
              className="w-full bg-[#131A2A] border border-[#26334A] focus:border-[#4D8DFF] rounded-xl px-3 py-2 text-xs text-[#F4F7FB] placeholder-[#59657A] outline-none"
            />
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 hide-scrollbar">
          {results.isLoading || results.isFetching ? (
            <div className="text-center text-xs text-[#8E9AAF] py-12">Loading cards...</div>
          ) : tab === 'search' && query.length < 2 ? (
            <div className="text-center text-xs text-[#8E9AAF] py-12">Type at least 2 letters to search.</div>
          ) : cards.length === 0 ? (
            <div className="text-center text-xs text-[#8E9AAF] py-12">No cards found.</div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {cards.map((card) => (
                <button
                  key={card.id}
                  onClick={() => onPick(card)}
                  className="text-left bg-[#0D1220] hover:bg-[#131A2A] border border-[#26334A] hover:border-[#4D8DFF]/60 rounded-xl overflow-hidden transition-colors"
                >
                  <div className="h-24 bg-gradient-to-b from-[#facc15]/15 to-[#192235]">
                    <PickerImage card={card} />
                  </div>
                  <div className="p-1.5">
                    <div className="text-[10px] font-black text-[#F4F7FB] truncate">{card.name}</div>
                    <div className="text-[9px] text-[#8E9AAF] truncate">
                      {card.overall} • {card.rarity}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface EditorProps {
  isOpen: boolean;
  onClose: () => void;
  playerName: string;
  setPlayerName: (v: string) => void;
  playerImage: string | null;
  setPlayerImage: (v: string | null) => void;
  position: string;
  setPosition: (v: string) => void;
  positions: string[];
  /** The FUT card the build was matched from (if any) */
  matchedCard?: any | null;
}

/** Edit the player card: name, position and picture. */
export function PlayerCardEditor({
  isOpen,
  onClose,
  playerName,
  setPlayerName,
  playerImage,
  setPlayerImage,
  position,
  setPosition,
  positions,
  matchedCard,
}: EditorProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  if (!isOpen) return null;

  const pick = async (card: any) => {
    const url = await resolveWorkingImage(cardImageCandidates(card));
    if (url) {
      setPlayerImage(url);
      setToast('Card appearance updated');
      setPickerOpen(false);
    } else {
      setToast('No image available for that card');
    }
  };

  const useMatched = async () => {
    if (!matchedCard) return;
    const url = await resolveWorkingImage(cardImageCandidates(matchedCard));
    if (url) {
      setPlayerImage(url);
      setToast('Card appearance updated');
    } else {
      setToast('No image available for that card');
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[60] flex justify-center bg-black/80 backdrop-blur-sm">
        <div className="w-full max-w-lg bg-[#080B14] flex flex-col h-full border-x border-[#26334A]">
          <div className="flex items-center justify-between p-3 bg-[#0D1220] border-b border-[#26334A]">
            <h3 className="text-sm font-black text-[#F4F7FB] uppercase tracking-widest" style={{ fontFamily: "'Orbitron', sans-serif" }}>
              Edit player card
            </h3>
            <button onClick={onClose} className="text-[#8E9AAF] hover:text-[#F4F7FB] p-1.5 text-lg leading-none">✕</button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 hide-scrollbar">
            {/* Picture */}
            <div className="bg-[#131A2A] border border-[#26334A] rounded-xl p-3 flex items-center gap-3">
              <div className="w-20 h-24 rounded-lg overflow-hidden bg-gradient-to-b from-[#facc15]/15 to-[#192235] border border-[#facc15]/30 shrink-0">
                {playerImage ? (
                  <img src={playerImage} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover object-top" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl opacity-30">👤</div>
                )}
              </div>
              <div className="flex-1 grid gap-1.5">
                <button
                  onClick={() => setPickerOpen(true)}
                  className="py-2 rounded-lg bg-[#192235] border border-[#4D8DFF]/40 text-[#4D8DFF] text-[11px] font-black uppercase tracking-wider hover:bg-[#4D8DFF] hover:text-[#080B14] transition-colors"
                >
                  Player image
                </button>
                {matchedCard && (
                  <button
                    onClick={useMatched}
                    className="py-1.5 rounded-lg bg-[#131A2A] border border-[#26334A] text-[#F4F7FB] text-[10px] font-bold hover:border-[#4D8DFF]/50"
                  >
                    Use matched card ({matchedCard.name})
                  </button>
                )}
                {playerImage && (
                  <button
                    onClick={() => {
                      setPlayerImage(null);
                      setToast('Card appearance updated');
                    }}
                    className="py-1.5 rounded-lg text-[#8E9AAF] text-[10px] font-bold hover:text-red-300"
                  >
                    Remove image
                  </button>
                )}
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="block text-[11px] font-bold text-[#8E9AAF] mb-1">Player name</label>
              <input
                type="text"
                value={playerName}
                maxLength={24}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Your Pro"
                className="w-full bg-[#131A2A] border border-[#26334A] focus:border-[#4D8DFF] rounded-xl px-3 py-2.5 text-sm font-bold text-[#F4F7FB] placeholder-[#59657A] outline-none"
              />
            </div>

            {/* Position */}
            <div>
              <label className="block text-[11px] font-bold text-[#8E9AAF] mb-1">Position</label>
              <div className="flex flex-wrap gap-1.5">
                {positions.map((pos) => (
                  <button
                    key={pos}
                    onClick={() => setPosition(pos)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border ${
                      position === pos
                        ? 'bg-[#4caf50] text-white border-[#4caf50]'
                        : 'bg-[#131A2A] text-[#8E9AAF] border-[#26334A] hover:text-[#F4F7FB]'
                    }`}
                  >
                    {pos}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="p-3 border-t border-[#26334A] bg-[#0D1220]">
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#4D8DFF] to-[#21E6A4] text-[#080B14] font-black text-xs uppercase tracking-widest"
            >
              Done
            </button>
          </div>

          {toast && (
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-[#21E6A4] text-[#080B14] text-[11px] font-black shadow-lg">
              {toast}
            </div>
          )}
        </div>
      </div>

      <PlayerImagePicker isOpen={pickerOpen} onClose={() => setPickerOpen(false)} onPick={pick} />
    </>
  );
}
