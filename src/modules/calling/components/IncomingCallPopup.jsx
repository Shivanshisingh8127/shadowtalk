import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff } from 'lucide-react';
import { useCallStore } from '../store';
import { callService } from '../CallService';

export default function IncomingCallPopup() {
  const { showIncomingPopup, remoteUser } = useCallStore();

  // Disabled in favor of full-screen CallModal
  return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0, y: -50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -50, scale: 0.9 }}
        className="fixed top-6 left-1/2 -translate-x-1/2 z-[10001] w-[90%] max-w-md"
      >
        <div className="bg-[#1A1C23] rounded-3xl p-5 flex items-center gap-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10 backdrop-blur-xl">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gradient-to-br from-[#7C4DFF] to-[#4DA3FF] flex items-center justify-center text-white font-bold text-2xl flex-shrink-0 shadow-lg">
            {remoteUser.avatarUrl ? (
              <img src={remoteUser.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              remoteUser.name?.[0] || '?'
            )}
          </div>
          
          <div className="flex-1 overflow-hidden">
            <h4 className="text-white font-bold truncate text-lg">{remoteUser.name || 'Incoming Call'}</h4>
            <p className="text-[#4DA3FF] text-sm font-medium tracking-wide animate-pulse">Incoming Voice Call...</p>
          </div>

          <div className="flex gap-3">
            <button 
              onClick={() => callService.endCall(remoteUser.id)}
              className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center"
              title="Decline"
            >
              <PhoneOff size={24} />
            </button>
            <button 
              onClick={() => callService.acceptCall()}
              className="w-12 h-12 rounded-2xl bg-green-500 text-white hover:bg-green-600 transition-all flex items-center justify-center shadow-lg shadow-green-500/30 animate-bounce"
              title="Accept"
            >
              <Phone size={24} />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
