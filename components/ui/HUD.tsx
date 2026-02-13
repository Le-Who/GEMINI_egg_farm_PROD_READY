import React from "react";
import { UserState, RoomType } from "../../types";
import { LEVELS } from "../../constants";
import {
  Coins,
  Gem,
  Home,
  ShoppingCart,
  Users,
  Star,
  PawPrint,
  Flower2,
  Trophy,
  Pencil,
  Languages, // Import Languages icon
} from "lucide-react";
import { useLanguage } from "../../components/LanguageContext";

interface HUDProps {
  user: UserState;
  displayUser?: UserState; // For visiting: neighbor's state
  avatarUrl?: string | null; // Discord CDN avatar URL
  onOpenShop: () => void;
  onOpenPets: () => void;
  onOpenQuests: () => void;
  onToggleEdit: () => void;
  onToggleNeighbors: () => void;
  onSwitchRoom: (type: RoomType) => void;
  isEditMode: boolean;
  isNeighborsOpen: boolean;
}

export const HUD: React.FC<HUDProps> = ({
  user,
  displayUser,
  avatarUrl,
  onOpenShop,
  onOpenPets,
  onOpenQuests,
  onToggleEdit,
  onToggleNeighbors,
  onSwitchRoom,
  isEditMode,
  isNeighborsOpen,
}) => {
  const { t, language, setLanguage } = useLanguage();

  if (isEditMode) return null;

  const roomUser = displayUser || user;
  const isVisiting = user.id !== roomUser.id; // Check if visiting

  // XP Progress Calculation
  const currentLevelConfig = LEVELS.find((l) => l.level === user.level);
  const nextLevelConfig = LEVELS.find((l) => l.level === user.level + 1);

  let progressPercent = 0;
  let xpDisplay = "";

  if (currentLevelConfig && nextLevelConfig) {
    const startXP = currentLevelConfig.xpRequired;
    const targetXP = nextLevelConfig.xpRequired;
    const currentXP = user.xp;
    const range = targetXP - startXP;
    if (range > 0)
      progressPercent = Math.min(
        100,
        Math.max(0, ((currentXP - startXP) / range) * 100),
      );
    xpDisplay = `${currentXP} / ${targetXP} XP`;
  } else {
    progressPercent = 100;
    xpDisplay = `${user.xp} XP (Max)`;
  }

  const isGardenUnlocked = roomUser.rooms.garden.unlocked;

  // Sidebar Button Component to ensure consistency
  // Updated with Fantasy Garden Theme
  const SidebarButton = ({
    onClick,
    icon: Icon,
    label,
    active = false,
    colorClass = "text-white",
    pulse = false,
    id,
  }: any) => (
    <button
      id={id}
      onClick={onClick}
      aria-label={label}
      className={`group relative w-12 h-12 rounded-2xl border-2 flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95 backdrop-blur-md ${
        active
          ? "bg-fuchsia-600/90 border-fuchsia-300 text-white shadow-fuchsia-500/30"
          : "bg-emerald-950/60 border-emerald-700/50 hover:bg-emerald-900/80 " +
            colorClass
      } ${pulse ? "animate-bounce ring-4 ring-yellow-400/50 border-yellow-200" : ""}`}
      title={label}
    >
      <Icon size={24} className="drop-shadow-md" />
      <span className="absolute right-14 bg-emerald-950/90 border border-emerald-700 text-white px-3 py-1.5 rounded-xl text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none shadow-xl backdrop-blur-sm font-bold tracking-wide">
        {label}
      </span>
    </button>
  );

  return (
    <>
      {/* Top Left: User Info */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-4">
        {/* User Card */}
        <div className="flex items-center gap-3 bg-emerald-950/80 p-2 pr-5 rounded-3xl border border-emerald-700/50 shadow-xl backdrop-blur-md ring-1 ring-white/10">
          {/* Avatar or Level Badge */}
          <div className="relative">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={user.username}
                className="w-12 h-12 rounded-2xl border-2 border-fuchsia-400 shadow-lg object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-12 h-12 bg-emerald-700 rounded-2xl flex items-center justify-center border-2 border-emerald-500 shadow-lg">
                <span className="text-white font-bold text-xl drop-shadow-md">
                  {user.level}
                </span>
              </div>
            )}
            <div className="absolute -top-1.5 -right-1.5 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full w-6 h-6 flex items-center justify-center border-2 border-white/20 shadow-sm text-[10px] font-black text-white">
              {user.level}
            </div>
          </div>

          {/* Name + XP + Currency */}
          <div className="flex flex-col gap-1 min-w-[130px]">
            <span className="text-white font-bold text-sm leading-none tracking-wide drop-shadow-sm">
              {user.username}
            </span>
            <div
              role="progressbar"
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t("hud.xp")}
              className="w-full h-2.5 bg-gray-900/50 rounded-full overflow-hidden border border-emerald-800/50 relative group"
            >
              <div
                className="h-full bg-gradient-to-r from-fuchsia-500 to-purple-400 transition-all duration-500 ease-out box-shadow-[0_0_10px_rgba(232,121,249,0.5)]"
                style={{ width: `${progressPercent}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                <span className="text-[8px] font-mono font-bold text-white leading-none">
                  {xpDisplay}
                </span>
              </div>
            </div>
            {/* Inline Currency */}
            <div className="flex items-center gap-3 mt-0.5">
              <div className="flex items-center gap-1.5">
                <Coins size={12} className="text-yellow-400 drop-shadow" />
                <span className="text-yellow-100 font-mono font-bold text-xs shadow-black">
                  {user.coins.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Gem size={12} className="text-fuchsia-400 drop-shadow" />
                <span className="text-fuchsia-100 font-mono font-bold text-xs shadow-black">
                  {user.gems.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Room Switcher (Moved to Top Left Column) */}
        {isGardenUnlocked && (
          <div className="flex flex-col gap-2 ml-1 animate-slide-right">
            <button
              onClick={() => onSwitchRoom("interior")}
              aria-label={t("hud.interior")}
              className={`w-full text-left px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-3 transition-all border border-transparent ${
                roomUser.currentRoom === "interior"
                  ? "bg-indigo-600/90 text-white shadow-lg border-indigo-400/50 backdrop-blur-sm"
                  : "bg-gray-900/50 text-gray-300 hover:bg-gray-800/80 hover:text-white backdrop-blur-sm"
              }`}
            >
              <Home size={16} /> {t("hud.interior")}
            </button>
            <button
              onClick={() => onSwitchRoom("garden")}
              aria-label={t("hud.garden")}
              className={`w-full text-left px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-3 transition-all border border-transparent ${
                roomUser.currentRoom === "garden"
                  ? "bg-green-600/90 text-white shadow-lg border-green-400/50 backdrop-blur-sm"
                  : "bg-gray-900/50 text-gray-300 hover:bg-gray-800/80 hover:text-white backdrop-blur-sm"
              }`}
            >
              <Flower2 size={16} /> {t("hud.garden")}
            </button>
          </div>
        )}
      </div>

      {/* Right Sidebar */}
      <div className="absolute top-20 right-4 z-10 flex flex-col gap-3">
        {/* Language Switcher */}
        <SidebarButton
          onClick={() => setLanguage(language === "en" ? "ru" : "en")}
          icon={Languages}
          label={language === "en" ? "EN / RU" : "RU / EN"}
          colorClass="text-cyan-300"
        />

        {/* Edit Button - Hidden when visiting */}
        {!isVisiting && (
          <SidebarButton
            id="btn-edit"
            onClick={onToggleEdit}
            icon={Pencil}
            label={t("hud.editMode")}
            colorClass="text-yellow-300"
            pulse={user.tutorialStep === 2}
          />
        )}

        {/* Shop Button */}
        <SidebarButton
          id="btn-shop"
          onClick={onOpenShop}
          icon={ShoppingCart}
          label={t("hud.shop")}
          colorClass="text-green-300"
          pulse={user.tutorialStep === 0}
        />

        <SidebarButton
          id="btn-pets"
          onClick={onOpenPets}
          icon={PawPrint}
          label={t("hud.pets")}
          colorClass="text-purple-300"
        />
        <SidebarButton
          id="btn-quests"
          onClick={onOpenQuests}
          icon={Trophy}
          label={t("hud.quests")}
          colorClass="text-amber-300"
        />
        <SidebarButton
          onClick={onToggleNeighbors}
          icon={Users}
          label={t("hud.neighbors")}
          active={isNeighborsOpen}
          colorClass="text-blue-300"
        />
      </div>
    </>
  );
};
