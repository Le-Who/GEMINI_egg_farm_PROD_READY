
import React from 'react';
import { UserState } from '../../types';
import { PETS } from '../../constants';
import { X, PawPrint, Star, Trophy } from 'lucide-react';

interface PetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEquip: (petId: string) => void;
  user: UserState;
}

export const PetsModal: React.FC<PetsModalProps> = ({ isOpen, onClose, onEquip, user }) => {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-gray-800 border-2 border-indigo-600 rounded-xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 bg-indigo-900/50 border-b border-indigo-800">
          <div className="flex items-center gap-2 text-indigo-100">
            <PawPrint size={24} />
            <h2 className="text-xl font-bold font-serif">Pet Collection</h2>
          </div>
          <button onClick={onClose} className="text-indigo-200 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col gap-3 max-h-[60vh] overflow-y-auto">
          {user.pets.length === 0 && (
            <div className="text-gray-400 text-center py-8">
              <p>You haven't hatched any pets yet.</p>
              <p className="text-sm mt-2">Buy an Incubator and an Egg from the shop!</p>
            </div>
          )}

          {user.pets.map((pet) => {
            const config = PETS[pet.configId];
            const isEquipped = user.equippedPetId === pet.id;
            
            return (
              <div 
                key={pet.id}
                className={`flex items-center p-3 rounded-lg border-2 transition-all ${
                  isEquipped 
                    ? 'bg-indigo-900/30 border-indigo-500 shadow-lg' 
                    : 'bg-gray-700 border-gray-600 hover:bg-gray-600'
                }`}
              >
                {/* Pet Icon/Avatar */}
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center mr-4 shrink-0"
                  style={{ backgroundColor: `#${config.color.toString(16).padStart(6, '0')}` }}
                >
                  <PawPrint size={20} className="text-white opacity-80" />
                </div>

                {/* Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white">{pet.name}</h3>
                    {isEquipped && (
                      <span className="text-[10px] bg-indigo-500 text-white px-2 py-0.5 rounded-full font-bold">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-300 flex items-center gap-1">
                    <Star size={10} className="text-yellow-400" />
                    Lvl {pet.level} • {config.bonusDescription}
                  </p>
                </div>

                {/* Action */}
                {!isEquipped && (
                  <button
                    onClick={() => onEquip(pet.id)}
                    className="px-3 py-1.5 bg-gray-600 hover:bg-indigo-600 text-white text-xs font-bold rounded transition-colors"
                  >
                    Equip
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
