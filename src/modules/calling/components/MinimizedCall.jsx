import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PhoneOff, Maximize2, Mic, MicOff, Phone } from 'lucide-react';
import { useCallStore } from '../store';
import { callService } from '../CallService';

export default function MinimizedCall() {
  const { isCalling, isMinimized, setMinimized, remoteUser, callStatus, callDuration, isMuted, toggleMute, isInitiator } = useCallStore();

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const parts = [];
    if (hrs > 0) parts.push(String(hrs).padStart(2, '0'));
    parts.push(String(mins).padStart(2, '0'));
    parts.push(String(secs).padStart(2, '0'));
    return parts.join(':');
  };

  if (!isCalling || !isMinimized) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        className="fixed top-4 left-4 right-4 z-[9999]"
      >
        <div className="bg-[#1A1C23]/90 backdrop-blur-xl rounded-2xl p-3 flex items-center justify-between shadow-2xl border border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7C4DFF] to-[#4DA3FF] flex items-center justify-center text-white font-bold">
              {remoteUser?.name?.[0] || '?'}
            </div>
            <div>
              <p className="text-white text-sm font-bold truncate max-w-[120px]">{remoteUser?.name}</p>
              <p className="text-[#4DA3FF] text-[10px] font-bold uppercase tracking-widest">
                {callStatus === 'connected' ? formatTime(callDuration) : callStatus}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {callStatus === 'connected' && (
              <button 
                onClick={() => toggleMute()}
                className={`p-2 rounded-lg transition-colors ${isMuted ? 'bg-amber-500 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
            )}
            {callStatus === 'ringing' && !isInitiator && (
              <button 
                onClick={() => callService.acceptCall()}
                className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors shadow-lg shadow-green-500/20"
                title="Accept Call"
              >
                <Phone size={20} />
              </button>
            )}
            <button 
              onClick={() => setMinimized(false)}
              className="p-2 text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              title="Maximize"
            >
              <Maximize2 size={20} />
            </button>
            <button 
              onClick={() => callService.endCall()}
              className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20"
              title={callStatus === 'ringing' ? "Reject Call" : "End Call"}
            >
              <PhoneOff size={20} />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
