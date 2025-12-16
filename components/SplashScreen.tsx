import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import Character from './Character';

interface SplashScreenProps {
  onFinish: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  useEffect(() => {
    // Show splash for 3 seconds then finish
    const timer = setTimeout(onFinish, 3000);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <motion.div 
      className="fixed inset-0 z-50 bg-slate-50 flex flex-col items-center justify-center overflow-hidden"
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="relative w-72 h-72 flex items-center justify-center">
        {/* Background Circle */}
        <div className="absolute inset-0 bg-indigo-50 rounded-full scale-75 animate-pulse"></div>

        {/* Blue Character - Bumping from Left */}
        <motion.div
          className="absolute w-28 h-28 z-10"
          initial={{ x: -80, rotate: -5 }}
          animate={{ 
            x: [-80, -30, -80], 
            rotate: [-5, 10, -5],
            scale: [1, 0.9, 1]
          }}
          transition={{ 
            duration: 0.6, 
            repeat: Infinity, 
            repeatType: "reverse",
            ease: "easeInOut"
          }}
        >
          <Character player={1} />
        </motion.div>

        {/* Red Character - Bumping from Right */}
        <motion.div
          className="absolute w-28 h-28 z-10"
          initial={{ x: 80, rotate: 5 }}
          animate={{ 
            x: [80, 30, 80], 
            rotate: [5, -10, 5],
            scale: [1, 0.9, 1]
          }}
          transition={{ 
            duration: 0.6, 
            repeat: Infinity, 
            repeatType: "reverse",
            ease: "easeInOut",
            delay: 0.05 // Slight offset for natural feel
          }}
        >
          <Character player={2} />
        </motion.div>

        {/* Impact Effects */}
        <motion.div
            className="absolute z-20 text-3xl"
            animate={{ 
              opacity: [0, 1, 0], 
              scale: [0.5, 1.5, 0.8], 
              rotate: [0, -20, 20]
            }}
            transition={{ duration: 0.6, repeat: Infinity, times: [0.4, 0.5, 0.6] }}
        >
            💥
        </motion.div>

         {/* Sweat Drops (Cute struggle) */}
        <motion.div
            className="absolute -top-4 right-1/4 text-2xl"
            animate={{ opacity: [0, 1, 0], y: [0, -20] }}
            transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
        >
            💦
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="text-center z-10 mt-4"
      >
        <h1 className="text-4xl font-black text-slate-800 tracking-wider">
          SUPER<br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-rose-500 text-5xl inline-block mt-2">
            GERM BATTLE
          </span>
        </h1>
        <p className="text-slate-400 font-bold mt-4 text-xs uppercase tracking-[0.2em] animate-pulse">
          Loading...
        </p>
      </motion.div>
    </motion.div>
  );
};

export default SplashScreen;