import React, { useState } from "react";
import { StickerType, BillboardEntry } from "../../types";
import { X } from "lucide-react";
import { useLanguage } from "../../components/LanguageContext";

interface StickerPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (sticker: StickerType, message?: string) => void;
  billboard?: BillboardEntry[];
  ownerName: string;
}

const STICKERS: { type: StickerType; emoji: string; label: string }[] = [
  { type: "heart", emoji: "❤️", label: "Love it!" },
  { type: "star", emoji: "⭐", label: "Amazing!" },
  { type: "thumbsup", emoji: "👍", label: "Nice work!" },
  { type: "sparkle", emoji: "✨", label: "Magical!" },
  { type: "flower", emoji: "🌸", label: "Beautiful!" },
  { type: "wave", emoji: "👋", label: "Hi there!" },
];

const STICKER_EMOJI: Record<string, string> = {
  heart: "❤️",
  star: "⭐",
  thumbsup: "👍",
  sparkle: "✨",
  flower: "🌸",
  wave: "👋",
};

export const StickerPicker: React.FC<StickerPickerProps> = ({
  isOpen,
  onClose,
  onSend,
  billboard = [],
  ownerName,
}) => {
  const { t } = useLanguage();
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");

  if (!isOpen) return null;

  const handleSend = async (sticker: StickerType) => {
    setSending(true);
    await onSend(sticker, message);
    setSending(false);
    setMessage(""); // Reset
  };

  const recentStickers = billboard.slice(-10).reverse();

  return (
    <>
      {/* Backdrop */}
      <div
        className="absolute inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[320px] max-h-[500px] bg-gray-800/95 backdrop-blur-md rounded-2xl border border-gray-600 shadow-2xl flex flex-col overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex justify-between items-center p-3 border-b border-gray-700 bg-gray-900/60">
          <span className="text-white font-bold text-sm">
            📋 {t("sticker.title", { name: ownerName })}
          </span>
          <button
            onClick={onClose}
            aria-label={t("common.close")}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Sticker Buttons */}
        <div className="p-3 border-b border-gray-700 space-y-3">
          <div>
            <p className="text-xs text-gray-400 mb-2">
              {t("sticker.leaveSticker")}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {STICKERS.map((s) => (
                <button
                  key={s.type}
                  onClick={() => handleSend(s.type)}
                  disabled={sending}
                  className="flex flex-col items-center gap-1 p-2 rounded-xl bg-gray-700/60 hover:bg-gray-600 border border-gray-600 hover:border-gray-500 transition-all active:scale-95 disabled:opacity-50"
                >
                  <span className="text-2xl">{s.emoji}</span>
                  <span className="text-[10px] text-gray-400">
                    {t(`sticker.label.${s.type}`)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("sticker.placeholder")}
              maxLength={64}
              className="w-full bg-gray-900/50 border border-gray-600 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-green-500 transition-colors"
            />
          </div>
        </div>

        {/* Recent Stickers Feed */}
        <div className="flex-1 overflow-y-auto p-3 min-h-0">
          {recentStickers.length === 0 ? (
            <p className="text-gray-500 text-xs text-center italic py-4">
              {t("sticker.noStickers")}
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {recentStickers.map((entry, i) => (
                <div
                  key={`${entry.fromId}-${entry.timestamp}`}
                  className="flex flex-col gap-1 bg-gray-700/40 px-2.5 py-1.5 rounded-lg border border-gray-600/30"
                >
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-lg">
                      {STICKER_EMOJI[entry.sticker] || "✨"}
                    </span>
                    <span className="text-gray-300 font-medium">
                      {entry.fromName}
                    </span>
                    <span className="text-gray-500 ml-auto text-[10px]">
                      {formatTimeAgo(entry.timestamp)}
                    </span>
                  </div>
                  {entry.message && (
                    <div className="pl-8 text-[11px] text-gray-400 italic leading-tight">
                      "{entry.message}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
