import React from "react";
import { UserState, QuestConfig, QuestProgress } from "../../types";
import { QUESTS } from "../../constants";
import { ChevronRight, Trophy, CheckCircle2, Clock, Star } from "lucide-react";

interface QuestsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserState;
}

export const QuestsPanel: React.FC<QuestsPanelProps> = ({
  isOpen,
  onClose,
  user,
}) => {
  const allQuests = Object.values(QUESTS) as QuestConfig[];
  const userQuests = user.quests || [];

  // Filter quests visible to this user (meet level requirements)
  const visibleQuests = allQuests.filter((q) => {
    if (q.requirements?.minLevel && user.level < q.requirements.minLevel)
      return false;
    if (q.requirements?.maxLevel && user.level > q.requirements.maxLevel)
      return false;
    // Hide completed non-repeatable
    const progress = userQuests.find((p) => p.questId === q.id);
    if (progress?.completed && !q.repeatable) return true; // Still show as completed
    return true;
  });

  const completedQuests = visibleQuests.filter((q) => {
    const p = userQuests.find((p) => p.questId === q.id);
    return p?.completed;
  });

  const activeQuests = visibleQuests.filter((q) => {
    const p = userQuests.find((p) => p.questId === q.id);
    return !p?.completed;
  });

  return (
    <>
      {/* Backdrop */}
      <div
        className={`absolute inset-0 z-40 bg-black/40 transition-opacity duration-300 ${isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />

      {/* Slide Panel */}
      <div
        className={`absolute top-0 right-0 h-full z-50 w-[85%] max-w-[400px] transition-transform duration-300 ease-out ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="h-full bg-gray-800/95 backdrop-blur-md border-l-2 border-amber-600/40 flex flex-col shadow-2xl">
          {/* Header */}
          <div className="flex justify-between items-center p-4 bg-amber-900/30 border-b border-amber-800/40 shrink-0">
            <div className="flex items-center gap-2 text-amber-100">
              <Trophy size={22} className="text-amber-400" />
              <h2 className="text-lg font-bold">Quests</h2>
              <span className="text-xs bg-amber-600/50 px-2 py-0.5 rounded-full font-mono">
                {completedQuests.length}/{visibleQuests.length}
              </span>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-700/80 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-3 min-h-0">
            {visibleQuests.length === 0 && (
              <div className="text-gray-400 text-center py-12 flex flex-col items-center gap-3">
                <Trophy size={40} className="text-gray-600" />
                <p className="font-bold">No Quests Available</p>
                <p className="text-sm text-gray-500">
                  Level up to unlock new quests!
                </p>
              </div>
            )}

            {/* Active Quests */}
            {activeQuests.length > 0 && (
              <div className="mb-4">
                <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2 px-1">
                  Active
                </h3>
                <div className="flex flex-col gap-2">
                  {activeQuests.map((quest) => {
                    const progress = userQuests.find(
                      (p) => p.questId === quest.id,
                    );
                    const current = progress?.progress || 0;
                    const total = quest.condition.count;
                    const pct = Math.min(100, (current / total) * 100);

                    return (
                      <div
                        key={quest.id}
                        className="bg-gray-700/60 rounded-lg p-3 border border-gray-600/50"
                      >
                        <div className="flex items-start justify-between mb-1">
                          <div>
                            <h4 className="font-bold text-white text-sm">
                              {quest.title}
                            </h4>
                            <p className="text-xs text-gray-400">
                              {quest.description}
                            </p>
                          </div>
                          <Clock
                            size={14}
                            className="text-amber-400 mt-1 shrink-0"
                          />
                        </div>

                        {/* Progress bar */}
                        <div className="mt-2 bg-gray-900/60 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex justify-between mt-1">
                          <span className="text-[10px] text-gray-400">
                            {current}/{total}
                          </span>
                          <div className="flex items-center gap-2">
                            {quest.rewards.coins && (
                              <span className="text-[10px] text-yellow-400 font-mono">
                                {quest.rewards.coins}G
                              </span>
                            )}
                            {quest.rewards.gems && (
                              <span className="text-[10px] text-purple-400 font-mono">
                                {quest.rewards.gems}💎
                              </span>
                            )}
                            {quest.rewards.xp && (
                              <span className="text-[10px] text-green-400 font-mono">
                                {quest.rewards.xp}XP
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Completed Quests */}
            {completedQuests.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-green-400 uppercase tracking-wider mb-2 px-1">
                  Completed
                </h3>
                <div className="flex flex-col gap-1.5">
                  {completedQuests.map((quest) => (
                    <div
                      key={quest.id}
                      className="bg-gray-700/30 rounded-lg p-2.5 border border-green-800/30 flex items-center gap-2.5"
                    >
                      <CheckCircle2
                        size={16}
                        className="text-green-400 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-300 text-sm">
                          {quest.title}
                        </h4>
                        <p className="text-[10px] text-gray-500">
                          {quest.description}
                        </p>
                      </div>
                      <Star size={12} className="text-amber-400 shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
