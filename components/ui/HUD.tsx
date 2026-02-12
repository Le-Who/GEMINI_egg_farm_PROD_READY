
import React from 'react';
import { UserState, RoomType } from '../../types';
import { LEVELS } from '../../constants';
import { Coins, Gem, Home, ShoppingCart, Users, Star, PawPrint, Flower2 } from 'lucide-react';

interface HUDProps {
  user: UserState;
  onOpenShop: () => void;
  onOpenPets: () => void;
  onToggleEdit: () => void;
  onToggleNeighbors: () => void;
  onSwitchRoom: (type: RoomType) => void;
  isEditMode: boolean;
  isNeighborsOpen: boolean;
}

export const HUD: React.FC<HUDProps> = ({ 
  user, 
  onOpenShop,
  onOpenPets,
  onToggleEdit, 
  onToggleNeighbors,
  onSwitchRoom,
  isEditMode,
  isNeighborsOpen 
}) => {
  if (isEditMode) return null; 

  // XP Progress Calculation
  const currentLevelConfig = LEVELS.find(l => l.level === user.level);
  const nextLevelConfig = LEVELS.find(l => l.level === user.level + 1);

  let progressPercent = 0;
  let xpDisplay = "";

  if (currentLevelConfig && nextLevelConfig) {
    const startXP = currentLevelConfig.xpRequired;
    const targetXP = nextLevelConfig.xpRequired;
    const currentXP = user.xp;
    const range = targetXP - startXP;
    if (range > 0) progressPercent = Math.min(100, Math.max(0, ((currentXP - startXP) / range) * 100));
    xpDisplay = `${currentXP} / ${targetXP} XP`;
  } else {
    progressPercent = 100;
    xpDisplay = `${user.xp} XP (Max)`;
  }

  const isGardenUnlocked = user.rooms.garden.unlocked;

  // Sidebar Button Component to ensure consistency
  const SidebarButton = ({ onClick, icon: Icon, label, active = false, colorClass = "text-white", pulse = false }: any) => (
    <button 
      onClick={onClick} 
      className={`group relative w-12 h-12 rounded-xl border-2 flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95 ${
        active 
          ? 'bg-blue-600 border-blue-400 text-white' 
          : 'bg-gray-800 border-gray-600 hover:bg-gray-700 ' + colorClass
      } ${pulse ? 'animate-bounce ring-4 ring-yellow-400 border-yellow-200' : ''}`}
      title={label}
    >
      <Icon size={24} />
      <span className="absolute right-14 bg-black text-white px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
        {label}
      </span>
    </button>
  );

  return (
    <>
      {/* Top Left: User Info & Level */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-3 bg-gray-900/90 p-2 pr-6 rounded-2xl border border-gray-700 shadow-xl backdrop-blur-sm">
        <div className="relative">
             <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center border-2 border-indigo-400 shadow-lg transform rotate-3">
                <span className="text-white font-bold text-xl drop-shadow-md">{user.level}</span>
             </div>
             <div className="absolute -top-2 -right-2 bg-yellow-500 rounded-full p-1 border border-yellow-300 shadow-sm">
                 <Star size={10} className="text-white fill-white" />
             </div>
        </div>

        <div className="flex flex-col gap-1 min-w-[120px]">
          <span className="text-white font-bold text-sm leading-none tracking-wide">{user.username}</span>
          <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden border border-gray-600 relative group">
            <div className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-500 ease-out" style={{ width: `${progressPercent}%` }} />
             <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                <span className="text-[9px] font-mono font-bold text-white leading-none">{xpDisplay}</span>
             </div>
          </div>
          <span className="text-[10px] text-gray-400 font-mono pl-1">{xpDisplay}</span>
        </div>
      </div>

      {/* Top Right: Currency */}
      <div className="absolute top-4 right-20 z-10 flex gap-4">
        <div className="flex items-center gap-2 bg-gray-900/80 px-3 py-1 rounded-lg border border-gray-700 text-yellow-400 shadow-lg backdrop-blur-sm">
          <Coins size={16} />
          <span className="font-bold font-mono">{user.coins.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-2 bg-gray-900/80 px-3 py-1 rounded-lg border border-gray-700 text-purple-400 shadow-lg backdrop-blur-sm">
          <Gem size={16} />
          <span className="font-bold font-mono">{user.gems.toLocaleString()}</span>
        </div>
      </div>

      {/* Room Switcher (Bottom Center) */}
      {isGardenUnlocked && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex gap-2 p-1 bg-gray-900/80 rounded-full border border-gray-600 backdrop-blur-md">
              <button 
                onClick={() => onSwitchRoom('interior')}
                className={`px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2 transition-colors ${
                    user.currentRoom === 'interior' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
                }`}
              >
                  <Home size={16} /> House
              </button>
              <button 
                onClick={() => onSwitchRoom('garden')}
                className={`px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2 transition-colors ${
                    user.currentRoom === 'garden' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
                }`}
              >
                  <Flower2 size={16} /> Garden
              </button>
          </div>
      )}

      {/* Right Sidebar */}
      <div className="absolute top-20 right-4 z-10 flex flex-col gap-3">
        {/* Tutorial Step 2: Place Item -> Pulse Edit Button */}
        <SidebarButton 
            onClick={onToggleEdit} 
            icon={Home} 
            label="Edit House" 
            pulse={user.tutorialStep === 2}
        />
        
        {/* Tutorial Step 0: Open Shop -> Pulse Shop Button */}
        <SidebarButton 
            onClick={onOpenShop} 
            icon={ShoppingCart} 
            label="Shop" 
            colorClass="text-green-400" 
            pulse={user.tutorialStep === 0}
        />
        
        <SidebarButton onClick={onOpenPets} icon={PawPrint} label="Pets" colorClass="text-purple-400" />
        <SidebarButton onClick={onToggleNeighbors} icon={Users} label="Neighbors" active={isNeighborsOpen} colorClass="text-blue-400" />
      </div>
    </>
  );
};
