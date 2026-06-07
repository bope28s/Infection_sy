import React, { useEffect } from 'react';
import { motion } from 'framer-motion';

interface SplashScreenProps {
  onFinish: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  useEffect(() => {
    const timer = setTimeout(onFinish, 3000);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <motion.div 
      className="fixed inset-0 z-50 bg-slate-50 flex flex-col items-center justify-center overflow-hidden px-6"
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <motion.img
        src="/screenshot/GermBattle.png"
        alt="Super Germ Battle"
        className="w-full max-w-sm object-contain drop-shadow-xl"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="text-center z-10 mt-6"
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
