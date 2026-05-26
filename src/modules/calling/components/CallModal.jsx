import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, Minimize2 } from 'lucide-react';
import { useCallStore } from '../store';
import { callService } from '../CallService';

export default function CallModal() {
  const { 
    isCalling, 
    isMinimized,
    callStatus, 
    remoteUser, 
    isInitiator,
    isMuted,
    isSpeakerOn,
    toggleMute,
    toggleSpeaker,
    setMinimized,
    showIncomingPopup,
    callDuration
  } = useCallStore();

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

  const ringtoneRef = useRef(null);

  // Handle ringtones
  React.useEffect(() => {
    if (isCalling && callStatus === 'ringing') {
      const url = isInitiator 
        ? 'https://assets.mixkit.co/active_storage/sfx/1359/1359-preview.mp3'
        : 'https://assets.mixkit.co/active_storage/sfx/1358/1358-preview.mp3';
      
      ringtoneRef.current = new Audio(url);
      ringtoneRef.current.loop = true;
      ringtoneRef.current.play().catch(() => {});
    } else {
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current = null;
      }
    }

    return () => {
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current = null;
      }
    };
  }, [isCalling, callStatus, isInitiator]);

  // Don't show if minimized, or if just showing the incoming popup
  if (!isCalling || showIncomingPopup || isMinimized) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[10000] bg-[#0A0B10] flex flex-col items-center justify-between p-8 pb-16 overflow-hidden"
      >
        {/* Background Glows */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-[#7C4DFF] opacity-10 blur-[150px] animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-[#4DA3FF] opacity-10 blur-[150px] animate-pulse" />
        </div>

        {/* Top Header */}
        <div className="relative w-full flex justify-between items-center text-white/40">
          <button onClick={() => setMinimized(true)} className="p-2 hover:text-white transition-colors">
            <Minimize2 size={24} />
          </button>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
            <div className={`w-2 h-2 rounded-full ${callStatus === 'connected' ? 'bg-green-500' : (callStatus === 'connecting' ? 'bg-blue-500' : 'bg-yellow-500')} animate-pulse`} />
            <span className="text-xs font-bold uppercase tracking-widest">{callStatus}</span>
          </div>
          <div className="w-10" /> {/* Spacer */}
        </div>

        {/* Remote User Profile */}
        <div className="relative flex flex-col items-center gap-8">
          <motion.div 
            animate={callStatus === 'ringing' ? { scale: [1, 1.05, 1] } : {}}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-48 h-48 rounded-[40px] bg-gradient-to-br from-[#7C4DFF] to-[#4DA3FF] flex items-center justify-center text-white text-7xl font-bold shadow-[0_0_80px_rgba(124,77,255,0.3)] border-4 border-white/10 overflow-hidden"
          >
            {remoteUser?.avatarUrl ? (
              <img src={remoteUser.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              remoteUser?.name?.[0] || '?'
            )}
          </motion.div>

          <div className="text-center space-y-2">
            <h2 className="text-4xl font-extrabold text-white tracking-tight">{remoteUser?.name || 'Someone'}</h2>
            <p className="text-[#4DA3FF] font-medium tracking-[0.2em] uppercase text-sm">
              {callStatus === 'ringing' ? (isInitiator ? 'Calling...' : 'Ringing...') : 
               (callStatus === 'connecting' ? 'Connecting...' : 
                (callStatus === 'connected' ? formatTime(callDuration) : 'Connected'))}
            </p>
          </div>
        </div>

        {/* Audio Waveform Animation (Simulated) */}
        {callStatus === 'connected' && (
          <div className="flex items-end gap-1 h-12">
            {[...Array(15)].map((_, i) => (
              <motion.div
                key={i}
                animate={{ height: [10, 48, 10] }}
                transition={{ duration: 0.5 + Math.random(), repeat: Infinity }}
                className="w-1.5 bg-gradient-to-t from-[#7C4DFF] to-[#4DA3FF] rounded-full opacity-40"
              />
            ))}
          </div>
        )}

        {/* Action Controls */}
        <div className="relative w-full max-w-sm flex items-center justify-center gap-8 px-6 py-6 rounded-[40px] bg-white/5 backdrop-blur-3xl border border-white/10 shadow-2xl">
          {callStatus === 'ringing' && !isInitiator ? (
            <>
              <button 
                onClick={() => callService.endCall()}
                className="p-6 rounded-3xl bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-lg"
              >
                <PhoneOff size={32} />
              </button>
              <button 
                onClick={() => callService.acceptCall()}
                className="p-8 rounded-[35px] bg-green-500 text-white hover:bg-green-600 transition-all shadow-[0_20px_40px_rgba(34,197,94,0.4)] animate-bounce"
              >
                <Phone size={36} />
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMute();
                }}
                className={`p-5 rounded-3xl transition-all ${isMuted ? 'bg-amber-500 text-white shadow-[0_0_30px_rgba(245,158,11,0.4)]' : 'bg-white/10 text-white hover:bg-white/20'}`}
              >
                {isMuted ? <MicOff size={28} /> : <Mic size={28} />}
              </button>

              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  callService.endCall();
                }}
                className="p-7 rounded-[35px] bg-red-600 text-white hover:bg-red-700 transition-all shadow-[0_20px_40px_rgba(220,38,38,0.4)] active:scale-90"
              >
                <PhoneOff size={36} />
              </button>

              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSpeaker();
                }}
                className={`p-5 rounded-3xl transition-all ${!isSpeakerOn ? 'bg-yellow-500/20 text-yellow-500' : 'bg-white/10 text-white hover:bg-white/20'}`}
              >
                {isSpeakerOn ? <Volume2 size={28} /> : <VolumeX size={28} />}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
