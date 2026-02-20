import React, { useEffect, useState } from "react";
import { Users, ExternalLink, RefreshCw, X } from "lucide-react";
import { NeighborProfile } from "../../types";
import { GameEngine } from "../../services/gameEngine";
import { useLanguage } from "../../components/LanguageContext";

interface NeighborsPanelProps {
  onVisit: (neighborId: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const NeighborsPanel: React.FC<NeighborsPanelProps> = ({
  onVisit,
  isOpen,
  onToggle,
}) => {
  const { t } = useLanguage();
  const [neighbors, setNeighbors] = useState<NeighborProfile[]>([]);
  const [loading, setLoading] = useState(false);

  const loadNeighbors = async () => {
    setLoading(true);
    const data = await GameEngine.getNeighbors();
    setNeighbors(data);
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadNeighbors();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    // Moved right-20 to avoid covering the sidebar (which is right-4)
    <div className="absolute right-20 top-20 mt-32 w-64 bg-gray-900/95 border border-gray-700 rounded-xl p-4 shadow-xl backdrop-blur-sm animate-slide-in-right z-30">
      <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
        <div className="flex items-center gap-2 text-blue-400">
          <Users size={20} />
          <span className="font-bold">{t("hud.neighbors")}</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadNeighbors}
            className="text-gray-400 hover:text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={onToggle}
            className="text-gray-400 hover:text-white transition-colors bg-gray-800 rounded-full p-1"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
        {neighbors.map((n) => (
          <div
            key={n.id}
            className="flex items-center justify-between bg-gray-800 p-2 rounded-lg hover:bg-gray-750 transition-colors border border-gray-700"
          >
            <div className="flex items-center gap-3">
              {/* Avatar */}
              {n.avatarUrl ? (
                <img
                  src={n.avatarUrl}
                  alt={n.username}
                  className="w-8 h-8 rounded-full border border-gray-600"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-xs font-bold text-gray-300">
                  {n.username.charAt(0)}
                </div>
              )}

              <div className="flex flex-col">
                <span className="font-bold text-gray-200 text-sm truncate max-w-[80px]">
                  {n.username}
                </span>
                <span className="text-xs text-gray-500">
                  {t("common.levelShort")} {n.level}
                </span>
              </div>
            </div>
            <button
              onClick={() => onVisit(n.id)}
              className="p-2 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white rounded-md transition-colors"
              title="Visit"
            >
              <ExternalLink size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
