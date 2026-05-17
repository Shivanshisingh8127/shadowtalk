import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Phone, 
  Video, 
  PhoneIncoming, 
  PhoneOutgoing, 
  PhoneMissed, 
  Search, 
  Trash2, 
  MoreVertical,
  ChevronRight,
  ArrowUpRight,
  ArrowDownLeft,
  X
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export default function Calls() {
  const { callLogs, startCall, deleteMessage, showToast, markCallsAsRead } = useAppContext();
  const [filter, setFilter] = useState('all'); // 'all', 'missed'
  const [searchQuery, setSearchQuery] = useState('');

  React.useEffect(() => {
    markCallsAsRead();
  }, []);

  const filteredLogs = useMemo(() => {
    let logs = callLogs;
    if (filter === 'missed') {
      logs = logs.filter(log => log.status === 'missed');
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      logs = logs.filter(log => 
        (log.chatName || '').toLowerCase().includes(q) || 
        (log.text || '').toLowerCase().includes(q)
      );
    }
    return logs;
  }, [callLogs, filter, searchQuery]);

  const handleDelete = (log) => {
    if (window.confirm('Delete this call log?')) {
      deleteMessage(log.chatId, [log.id], false);
      showToast('Call log deleted');
    }
  };

  const handleClearAll = () => {
    if (window.confirm('Clear all call logs?')) {
      const idsByChat = {};
      callLogs.forEach(log => {
        if (!idsByChat[log.chatId]) idsByChat[log.chatId] = [];
        idsByChat[log.chatId].push(log.id);
      });
      
      Object.entries(idsByChat).forEach(([chatId, ids]) => {
        deleteMessage(chatId, ids, false);
      });
      showToast('Call history cleared');
    }
  };

  const getStatusIcon = (log) => {
    const isOutgoing = log.metadata?.direction === 'outgoing' || log.senderId === window.AppContextValue?.user?.id;
    
    if (log.status === 'missed') return <PhoneMissed size={16} className="text-red-500" />;
    if (isOutgoing) return <ArrowUpRight size={16} className="text-green-500" />;
    return <ArrowDownLeft size={16} className="text-blue-500" />;
  };

  const formatCallTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' + 
           date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  return (
    <div className="flex flex-col h-full bg-[#0A0B10] text-white">
      {/* Header */}
      <div className="p-6 pb-2 space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
            Calls
          </h1>
          <button 
            onClick={handleClearAll}
            className="p-2 text-white/40 hover:text-red-500 transition-colors"
            title="Clear All"
          >
            <Trash2 size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-[#00ff88] transition-colors" size={18} />
          <input 
            type="text"
            placeholder="Search calls..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-[#00ff88]/50 focus:bg-white/10 transition-all"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/10">
          <button 
            onClick={() => setFilter('all')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${filter === 'all' ? 'bg-[#00ff88] text-black shadow-[0_0_20px_rgba(0,255,136,0.3)]' : 'text-white/60 hover:text-white'}`}
          >
            All
          </button>
          <button 
            onClick={() => setFilter('missed')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${filter === 'missed' ? 'bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.3)]' : 'text-white/60 hover:text-white'}`}
          >
            Missed
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2 custom-scrollbar">
        <AnimatePresence mode="popLayout">
          {filteredLogs.length > 0 ? (
            filteredLogs.map((log) => (
              <motion.div
                key={log.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="group relative bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl p-4 flex items-center gap-4 transition-all cursor-pointer"
                onClick={() => startCall(log.metadata?.call_type || 'voice', { id: log.chatId, name: log.chatName, avatarUrl: log.chatAvatar })}
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#7C4DFF] to-[#4DA3FF] flex items-center justify-center text-white font-bold text-2xl shadow-lg overflow-hidden">
                    {log.chatAvatar ? (
                      <img src={log.chatAvatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      log.chatName?.[0] || '?'
                    )}
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="text-white font-bold truncate pr-2">
                      {log.chatName}
                    </h3>
                    <span className="text-[10px] text-white/30 font-medium shrink-0">
                      {formatCallTime(log.timestamp)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {getStatusIcon(log)}
                    <p className={`text-xs truncate ${log.status === 'missed' ? 'text-red-400 font-medium' : 'text-white/40'}`}>
                      {log.status === 'completed' && log.duration ? `Answered • ${Math.floor(log.duration/60)}m ${log.duration%60}s` : 
                       log.status === 'missed' ? 'Missed' : 
                       log.status === 'declined' ? 'Declined' : 
                       log.status === 'busy' ? 'Busy' :
                       log.status === 'cancelled' ? 'Cancelled' : 'Outgoing'}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      startCall(log.metadata?.call_type || 'voice', { id: log.chatId, name: log.chatName, avatarUrl: log.chatAvatar });
                    }}
                    className="p-3 rounded-xl bg-[#00ff88]/10 text-[#00ff88] hover:bg-[#00ff88] hover:text-black transition-all"
                  >
                    {log.metadata?.call_type === 'video' ? <Video size={18} /> : <Phone size={18} />}
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(log);
                    }}
                    className="p-3 rounded-xl hover:bg-red-500/10 hover:text-red-500 text-white/10 transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-white/20 space-y-4">
              <Phone size={64} strokeWidth={1} />
              <p className="font-medium text-sm">No call history found</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
