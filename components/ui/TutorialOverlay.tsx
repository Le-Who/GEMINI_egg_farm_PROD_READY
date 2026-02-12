
import React, { useState } from 'react';
import { TUTORIAL_STEPS } from '../../constants';
import { UserState } from '../../types';
import { X, Check } from 'lucide-react';
import { MockBackend } from '../../services/mockBackend';

interface TutorialOverlayProps {
  user: UserState;
  onUpdateUser: (u: UserState) => void;
}

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({ user, onUpdateUser }) => {
  const [isHidden, setIsHidden] = useState(false);

  if (user.completedTutorial || isHidden) return null;

  const step = TUTORIAL_STEPS[user.tutorialStep];
  if (!step) return null;

  const isLastStep = step.trigger === "COMPLETE";

  const handleFinish = async () => {
      if (isLastStep) {
          const u = await MockBackend.triggerTutorial("COMPLETE");
          onUpdateUser(u);
      }
  };

  return (
    <div className="absolute bottom-32 left-1/2 -translate-x-1/2 w-full max-w-lg z-40 pointer-events-none">
      <div 
        onClick={isLastStep ? handleFinish : undefined}
        className={`relative mx-4 bg-orange-100 border-4 border-orange-300 rounded-xl p-4 shadow-2xl flex gap-4 animate-bounce-slight pointer-events-auto group ${isLastStep ? 'cursor-pointer hover:bg-orange-50' : ''}`}
      >
        
        {/* Close Button */}
        <button 
          onClick={(e) => { e.stopPropagation(); setIsHidden(true); }}
          className="absolute top-1 right-1 p-1 text-orange-400 hover:text-orange-600 hover:bg-orange-200 rounded-full transition-colors opacity-0 group-hover:opacity-100"
        >
          <X size={14} />
        </button>

        {/* Grandma Avatar */}
        <div className="shrink-0 w-16 h-16 bg-gray-300 rounded-full border-2 border-white shadow-md overflow-hidden relative">
            <div className="absolute inset-0 bg-gray-400 flex items-center justify-center">
                <span className="text-2xl">👵</span>
            </div>
        </div>

        <div className="flex-1 pr-4">
            <h3 className="font-bold text-orange-900 text-sm uppercase tracking-wider mb-1">Grandma Rose</h3>
            <p className="text-orange-900 font-medium leading-tight">{step.text}</p>
            {isLastStep && (
                <div className="mt-2 flex items-center gap-1 text-xs font-bold text-orange-600 animate-pulse">
                    <Check size={12} /> Click to finish
                </div>
            )}
        </div>

        {/* Triangle tail */}
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-orange-100 border-r-4 border-b-4 border-orange-300 transform rotate-45"></div>
      </div>
    </div>
  );
};
