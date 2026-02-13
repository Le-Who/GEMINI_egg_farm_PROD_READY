import React from "react";
import { CROPS } from "../../constants";
import { UserState } from "../../types";
import { X, Lock, Sprout } from "lucide-react";
import { useLanguage } from "../../components/LanguageContext";

interface SeedBagModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlant: (cropId: string) => void;
  user: UserState;
}

export const SeedBagModal: React.FC<SeedBagModalProps> = ({
  isOpen,
  onClose,
  onPlant,
  user,
}) => {
  const { t, tContent } = useLanguage();
  if (!isOpen) return null;

  const cropsList = Object.values(CROPS);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-gray-800 border-2 border-green-800 rounded-xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 bg-green-900/50 border-b border-green-800">
          <div className="flex items-center gap-2 text-green-100">
            <Sprout size={24} />
            <h2 className="text-xl font-bold font-serif">{t("seeds.title")}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-green-200 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
          {cropsList.map((crop) => {
            const isLocked = user.level < crop.levelReq;
            const canAfford = user.coins >= crop.seedPrice;

            return (
              <button
                key={crop.id}
                onClick={() => {
                  if (!isLocked && canAfford) onPlant(crop.id);
                }}
                disabled={isLocked || !canAfford}
                className={`relative flex flex-col p-3 rounded-lg border-2 text-left transition-all ${
                  isLocked
                    ? "bg-gray-900/50 border-gray-700 opacity-70 cursor-not-allowed"
                    : canAfford
                      ? "bg-gray-700 border-gray-600 hover:border-green-400 hover:bg-gray-600 active:scale-95"
                      : "bg-gray-700 border-red-900/50 cursor-not-allowed"
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div
                    className="w-10 h-10 rounded-full shadow-inner flex items-center justify-center"
                    style={{
                      backgroundColor: isLocked
                        ? "#333"
                        : `#${crop.color.toString(16).padStart(6, "0")}`,
                    }}
                  >
                    {isLocked && <Lock size={16} className="text-gray-500" />}
                  </div>
                  <span
                    className={`font-mono text-sm font-bold ${canAfford ? "text-yellow-400" : "text-red-400"}`}
                  >
                    {crop.seedPrice}g
                  </span>
                </div>

                <div className="flex flex-col">
                  <span className="font-bold text-gray-200">
                    {tContent(crop, "name")}
                  </span>
                  <span className="text-xs text-gray-400">
                    {crop.growthTime}s • {crop.xpReward} XP
                  </span>
                </div>

                {isLocked && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-lg backdrop-blur-[1px]">
                    <span className="bg-black/80 px-2 py-1 rounded text-xs text-red-300 font-bold border border-red-900">
                      {t("common.levelShort")} {crop.levelReq}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="p-3 bg-gray-900/80 text-center text-xs text-gray-500">
          {t("seeds.selectToPlant")}
        </div>
      </div>
    </div>
  );
};
