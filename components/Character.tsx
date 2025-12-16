import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

interface CharacterProps {
  player: 1 | 2;
  isNew?: boolean; // For spawn animation
  isSelected?: boolean;
}

const Character: React.FC<CharacterProps> = ({ player, isNew, isSelected }) => {
  const isP1 = player === 1;

  // Generate random animation parameters once per mount
  const animationParams = useMemo(() => ({
    yDuration: 2 + Math.random(),
    yDelay: Math.random() * 2,
    blinkDelay: Math.random() * 5
  }), []);

  // 3D Gradients and Colors
  // P1 (Blue): Cyan/Teal mix
  // P2 (Red): Rose/Red mix
  const bodyClass = isP1 
    ? 'bg-[radial-gradient(circle_at_30%_30%,_#67e8f9_0%,_#06b6d4_50%,_#0e7490_100%)] shadow-[inset_-4px_-4px_6px_rgba(0,0,0,0.2)]'
    : 'bg-[radial-gradient(circle_at_30%_30%,_#fda4af_0%,_#f43f5e_50%,_#be123c_100%)] shadow-[inset_-4px_-4px_6px_rgba(0,0,0,0.2)]';

  const shadowColor = isP1 ? 'bg-cyan-900/20' : 'bg-rose-900/20';

  return (
    <motion.div
      className="relative w-full h-full flex items-center justify-center z-10"
      initial={isNew ? { scale: 0 } : { scale: 1 }}
      animate={{ 
        scale: isSelected ? 1.15 : 1,
        y: isSelected ? -8 : [0, -4, 0],
        rotate: isSelected ? [0, -5, 5, 0] : 0
      }}
      transition={{ 
        scale: { type: "spring", stiffness: 300, damping: 15 },
        rotate: { repeat: isSelected ? Infinity : 0, duration: 0.4, ease: "easeInOut" },
        y: { 
          repeat: isSelected ? 0 : Infinity, 
          duration: animationParams.yDuration, 
          ease: "easeInOut",
          delay: animationParams.yDelay
        },
        default: { duration: 0.3 }
      }}
    >
      {/* Shadow Blob (Grounding) */}
      <motion.div 
        className={`absolute bottom-0 w-2/3 h-1.5 rounded-full ${shadowColor} blur-[2px]`}
        animate={{ scaleX: [0.8, 1, 0.8], opacity: [0.5, 0.8, 0.5] }}
        transition={{ repeat: Infinity, duration: animationParams.yDuration, delay: animationParams.yDelay }}
        style={{ transform: 'translateY(150%)' }}
      />

      {/* Main Body Container - Simplified without appendages */}
      <div className="relative w-[75%] h-[75%]">
        
        {/* The Sphere */}
        <div className={`relative w-full h-full rounded-full ${bodyClass} z-10 overflow-hidden border-2 border-white/10 ring-1 ring-black/5`}>
           
           {/* Specular Highlight (Gloss) - Made slightly softer */}
           <div className="absolute top-[15%] left-[15%] w-[40%] h-[25%] bg-white/40 rounded-full blur-[2px] rotate-[-45deg]"></div>
           <div className="absolute top-[20%] left-[20%] w-[15%] h-[10%] bg-white/70 rounded-full blur-[1px]"></div>

           {/* Face */}
           <div className="absolute inset-0 flex flex-col items-center justify-center pt-1 pointer-events-none">
             {/* Eyes */}
             <div className="flex gap-1.5 z-20">
               <Eye delay={animationParams.blinkDelay} />
               <Eye delay={animationParams.blinkDelay + 0.1} />
             </div>
             
             {/* Mouth */}
             <div className="mt-1">
                {isSelected ? (
                  <div className="w-3 h-2 bg-slate-900 rounded-b-full overflow-hidden">
                    <div className="w-full h-1.5 bg-rose-400 mt-1 rounded-t-full"></div>
                  </div>
                ) : (
                  <div className="w-3 h-1 bg-slate-900/70 rounded-full"></div>
                )}
             </div>
           </div>

        </div>

        {/* Selection Text/Icon */}
        {isSelected && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.5 }}
            animate={{ opacity: 1, y: -25, scale: 1 }}
            className="absolute -top-4 left-1/2 -translate-x-1/2 bg-white text-slate-900 text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg border border-slate-100 whitespace-nowrap z-50"
          >
            PICK ME!
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

// Sub-component for blinking eyes
const Eye = ({ delay }: { delay: number }) => (
  <div className="w-3.5 h-4 bg-white rounded-full relative shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)] border border-slate-100 flex items-center justify-center overflow-hidden">
    {/* Pupil */}
    <div className="w-2 h-2 bg-slate-900 rounded-full relative">
      {/* Reflection in eye */}
      <div className="absolute top-0.5 right-0.5 w-0.5 h-0.5 bg-white rounded-full"></div>
    </div>
    
    {/* Eyelid for blinking */}
    <motion.div 
       className="absolute inset-0 bg-slate-800 z-10 origin-top"
       initial={{ scaleY: 0 }}
       animate={{ scaleY: [0, 1, 0] }}
       transition={{ 
         repeat: Infinity, 
         repeatDelay: 3 + Math.random() * 3, 
         duration: 0.2, 
         delay: delay 
       }}
    />
  </div>
);

export default Character;
