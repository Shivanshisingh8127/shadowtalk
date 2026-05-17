import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, Video, X } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export default function CallNotificationToast() {
  const { callNotifications, setCallNotifications } = useAppContext();

  const dismiss = (id) => {
    setCallNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[10002] w-[90%] max-w-md pointer-events-none">
      <AnimatePresence>
        {callNotifications.map((notif) => (
          <motion.div
            key={notif.id}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
            className="pointer-events-auto mb-3"
          >
            <div className="bg-[#1A1C23]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl flex items-center gap-4 relative overflow-hidden group">
              {/* Status Indicator Bar */}
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                notif.type === 'missed' ? 'bg-red-500' : 
                notif.type === 'incoming' ? 'bg-green-500' : 
                'bg-blue-500'
              }`} />

              {/* Avatar */}
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#7C4DFF] to-[#4DA3FF] flex items-center justify-center text-white font-bold text-xl shadow-lg flex-shrink-0">
                {notif.from?.avatarUrl ? (
                  <img src={notif.from.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  notif.from?.name?.[0] || '?'
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-white font-bold truncate text-sm">
                    {notif.from?.name || 'Someone'}
                  </h4>
                  {notif.callType === 'video' ? (
                    <Video size={14} className="text-white/40" />
                  ) : (
                    <Phone size={14} className="text-white/40" />
                  )}
                </div>
                <p className={`text-xs font-medium ${
                  notif.type === 'missed' ? 'text-red-400' : 
                  notif.type === 'incoming' ? 'text-green-400' : 
                  'text-white/60'
                }`}>
                  {notif.type === 'missed' ? 'Missed call' : 
                   notif.type === 'incoming' ? 'Incoming call...' : 
                   notif.type === 'declined' ? 'Call declined' :
                   'Call ended'}
                </p>
              </div>

              <button 
                onClick={() => dismiss(notif.id)}
                className="p-2 text-white/20 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
