import React, { useState } from "react";
import { BillboardEntry, StickerType } from "../../types";
import { X, Send, MessageSquare } from "lucide-react";
import { useLanguage } from "../../components/LanguageContext";

interface GuestbookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (sticker: StickerType, message?: string) => void;
  billboard?: BillboardEntry[];
  ownerName: string;
}

const STICKERS: { type: StickerType; emoji: string }[] = [
  { type: "heart", emoji: "❤️" },
  { type: "star", emoji: "⭐" },
  { type: "thumbsup", emoji: "👍" },
  { type: "sparkle", emoji: "✨" },
  { type: "flower", emoji: "🌸" },
  { type: "wave", emoji: "👋" },
];

export const GuestbookModal: React.FC<GuestbookModalProps> = ({
  isOpen,
  onClose,
  onSend,
  billboard = [],
  ownerName,
}) => {
  const { t } = useLanguage();
  const [selectedSticker, setSelectedSticker] = useState<StickerType | null>(
    null,
  );
  const [message, setMessage] = useState("");

  if (!isOpen) return null;

  const handleSend = () => {
    if (!selectedSticker) return;
    onSend(selectedSticker, message);
    setMessage("");
    setSelectedSticker(null);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-[#f4e4bc] border-8 border-[#8b5a2b] rounded-lg shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] relative animate-fade-in-up">
        {/* Header Board */}
        <div className="bg-[#8b5a2b] p-3 text-center border-b-4 border-[#5d3a1a]">
          <h2 className="text-white font-bold text-xl uppercase tracking-wider drop-shadow-md">
            {t("guestbook.title", { name: ownerName })}
          </h2>
          <button
            onClick={onClose}
            className="absolute top-2 right-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full p-1"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[url('/assets/paper-texture.png')] bg-repeat">
          {billboard.length === 0 ? (
            <div className="text-center text-[#8b5a2b]/60 italic py-8">
              {t("guestbook.noSignatures")}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {[...billboard].reverse().map((entry, idx) => (
                <div
                  key={idx}
                  className="bg-white/60 p-3 rounded shadow-sm border border-[#8b5a2b]/20 relative group hover:bg-white/80 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-[#5d3a1a] text-sm">
                      {entry.fromName}
                    </span>
                    <span className="text-xs text-[#8b5a2b]/60">
                      {new Date(entry.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  {entry.message && (
                    <p className="text-[#5d3a1a] text-sm mt-1 break-words">
                      {entry.message}
                    </p>
                  )}
                  <div className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow-sm text-lg border border-[#8b5a2b]/10 group-hover:scale-110 transition-transform">
                    {STICKERS.find((s) => s.type === entry.sticker)?.emoji ||
                      "❤️"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-[#e6d0a0] border-t-4 border-[#c9b084]">
          <div className="flex flex-col gap-3">
            <div className="flex gap-2 justify-center">
              {STICKERS.map((s) => (
                <button
                  key={s.type}
                  onClick={() => setSelectedSticker(s.type)}
                  className={`text-2xl p-2 rounded-lg transition-all ${
                    selectedSticker === s.type
                      ? "bg-white shadow-inner scale-110 ring-2 ring-[#8b5a2b]"
                      : "hover:bg-white/50 hover:scale-105"
                  }`}
                >
                  {s.emoji}
                </button>
              ))}
            </div>

            <div className="relative">
              <input
                type="text"
                placeholder={t("guestbook.placeholder")}
                value={message}
                onChange={(e) =>
                  setMessage(
                    e.target.value
                      .replace(/[^a-zA-Z0-9\s.,!?]/g, "")
                      .substring(0, 256),
                  )
                }
                className="w-full pl-9 pr-4 py-2 rounded border border-[#c9b084] bg-white/90 text-[#5d3a1a] focus:outline-none focus:ring-2 focus:ring-[#8b5a2b] placeholder-[#8b5a2b]/50"
              />
              <MessageSquare
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b5a2b]/60"
              />
            </div>

            <button
              onClick={handleSend}
              disabled={!selectedSticker}
              className={`w-full py-2 rounded font-bold text-white shadow-md flex items-center justify-center gap-2 transition-all ${
                selectedSticker
                  ? "bg-[#8b5a2b] hover:bg-[#724a23] active:translate-y-0.5"
                  : "bg-gray-400 cursor-not-allowed"
              }`}
            >
              <Send size={16} /> {t("guestbook.sign")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
