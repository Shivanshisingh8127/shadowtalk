import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { supabase, supabaseUrl, supabaseAnonKey } from '../supabaseClient';
import { Download as DownloadIcon } from 'lucide-react';
import { callService } from '../modules/calling/CallService';
import { useCallStore } from '../modules/calling/store';
import { shareContent } from '../utils/shareHelper';
import io from 'socket.io-client';

const AppContext = createContext();

export const useAppContext = () => useContext(AppContext);

// Default empty user for fallback
const DEFAULT_USER = {
  id: '',
  name: '',
  phrase: ''
};

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('shadowtalk_user');
      return (saved && saved !== 'undefined') ? JSON.parse(saved) : null;
    } catch (e) {
      console.warn('[ShadowTalk] User parse error:', e);
      return null;
    }
  });
  const [theme, setTheme] = useState(() => localStorage.getItem('shadowtalk_theme') || 'dark');
  const [themeVariant, setThemeVariant] = useState(() => localStorage.getItem('shadowtalk_themeVariant') || 'classic');
  const [primaryColor, setPrimaryColor] = useState(() => localStorage.getItem('shadowtalk_primaryColor') || '#00ff88');
  const [globalWallpaper, setGlobalWallpaper] = useState(() => localStorage.getItem('shadowtalk_globalWallpaper') || '');
  const [followSystem, setFollowSystem] = useState(() => localStorage.getItem('shadowtalk_followSystem') === 'true');

  useEffect(() => {
    localStorage.setItem('shadowtalk_theme', theme);
    localStorage.setItem('shadowtalk_themeVariant', themeVariant);
    localStorage.setItem('shadowtalk_primaryColor', primaryColor);
    localStorage.setItem('shadowtalk_globalWallpaper', globalWallpaper);
    localStorage.setItem('shadowtalk_followSystem', followSystem);
  }, [theme, themeVariant, primaryColor, globalWallpaper, followSystem]);
  const [chats, setChats] = useState([]);
  const chatsRef = useRef(chats);
  const userRef = useRef(user);
  const lastSyncRef = useRef(0);
  useEffect(() => { chatsRef.current = chats; }, [chats]);
  useEffect(() => { 
    userRef.current = user; 
    if (user?.id) {
      if ('caches' in window) {
        caches.open('shadowtalk-user').then(cache => {
          cache.put('/user-id', new Response(user.id.toLowerCase()));
          console.log('[ShadowTalk] Cached active user ID for background service worker:', user.id);
        }).catch(err => console.warn('[ShadowTalk] Cache update failed:', err));
      }
    } else {
      if ('caches' in window) {
        caches.delete('shadowtalk-user').then(() => {
          console.log('[ShadowTalk] Cleared cached user ID on logout');
        }).catch(err => console.warn('[ShadowTalk] Cache clear failed:', err));
      }
    }
  }, [user]);

  const [requests, setRequests] = useState([]);
  const chatSubRef = useRef(null);
  const downloadCacheRef = useRef(new Map());
  const [typingUsers, setTypingUsers] = useState({}); // { chatId: { userId: isTyping } }
  const [confirmConfig, setConfirmConfig] = useState(null); // { title, message, onConfirm, onCancel, icon }
  const [callNotifications, setCallNotifications] = useState([]); // Real-time call toasts

  const [activeChatId, setActiveChatId] = useState(null);
  const activeChatIdRef = useRef(null);
  useEffect(() => { activeChatIdRef.current = activeChatId; }, [activeChatId]);

  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const onlineUsersRef = useRef(new Set());
  useEffect(() => { onlineUsersRef.current = onlineUsers; }, [onlineUsers]);

  // Helper to update our own self presence globally (Note to Self chat)
  const updateSelfPresence = async (isClosing = false) => {
    if (!userRef.current?.id) return;
    const myIdLower = userRef.current.id.toLowerCase();
    const lastSeenTime = Date.now();
    
    // Find our own self-chat in our local chats list
    const currentChats = chatsRef.current || [];
    const localSelfChat = currentChats.find(c => c && c.owner_id === myIdLower && c.chat_id === myIdLower);
    
    let selfChat = null;
    if (localSelfChat && localSelfChat.chat_data) {
      selfChat = JSON.parse(JSON.stringify(localSelfChat.chat_data));
    }
    
    if (!selfChat) {
      selfChat = {
        id: myIdLower,
        type: 'direct',
        status: 'direct',
        contact: {
          id: myIdLower,
          name: userRef.current.name,
          shadowId: userRef.current.shadowId,
          avatarUrl: userRef.current.avatarUrl || null
        },
        messages: [],
        lastActivity: lastSeenTime
      };
    }
    
    if (!selfChat.contact) selfChat.contact = {};
    selfChat.contact.lastSeen = lastSeenTime;
    selfChat.lastActivity = lastSeenTime;
    
    // Update local state immediately so local UI displays correctly
    setChats(prev => prev.map(c => {
      if (c.owner_id === myIdLower && c.chat_id === myIdLower) {
        return {
          ...c,
          chat_data: selfChat
        };
      }
      return c;
    }));
    
    // Update database
    if (isClosing) {
      const url = `${supabaseUrl}/rest/v1/chats`;
      const payload = {
        owner_id: myIdLower,
        chat_id: myIdLower,
        chat_data: selfChat
      };
      
      try {
        console.log('[ShadowTalk] Sending closing self presence update via native keepalive fetch...');
        fetch(url, {
          method: 'POST',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify(payload),
          keepalive: true
        });
      } catch (err) {
        console.warn('[ShadowTalk] Keepalive presence update failed:', err);
      }
    } else {
      try {
        await supabase.from('chats').upsert({
          owner_id: myIdLower,
          chat_id: myIdLower,
          chat_data: selfChat
        }, { onConflict: 'owner_id, chat_id' });
        console.log('[ShadowTalk] Self presence updated globally:', lastSeenTime);
      } catch (err) {
        console.warn('[ShadowTalk] standard presence update failed:', err);
      }
    }
  };

  // Helper to fetch the latest global lastSeen values of all direct contacts
  const syncContactsLastSeen = async (currentChatsList) => {
    if (!userRef.current?.id || !currentChatsList || currentChatsList.length === 0) return;
    const myIdLower = userRef.current.id.toLowerCase();
    
    const directChats = currentChatsList.filter(c => c && c.type === 'direct' && c.id?.toLowerCase() !== myIdLower);
    if (directChats.length === 0) return;
    
    const contactIds = directChats.map(c => (c.contact?.id || c.id).toLowerCase());
    
    try {
      console.log('[ShadowTalk] Background-syncing lastSeen for contacts:', contactIds);
      
      const { data: selfChats, error } = await supabase
        .from('chats')
        .select('owner_id, chat_id, chat_data')
        .in('owner_id', contactIds)
        .in('chat_id', contactIds);
        
      if (error || !selfChats) {
        console.warn('[ShadowTalk] Failed to fetch self-chats for lastSeen:', error);
        return;
      }
      
      const lastSeenMap = {};
      selfChats.forEach(row => {
        if (row.owner_id && row.chat_id && row.owner_id.toLowerCase() === row.chat_id.toLowerCase()) {
          const freshLastSeen = row.chat_data?.contact?.lastSeen || row.chat_data?.lastActivity;
          if (freshLastSeen) {
            lastSeenMap[row.owner_id.toLowerCase()] = freshLastSeen;
          }
        }
      });
      
      setChats(prev => {
        let changed = false;
        const updated = prev.map(chat => {
          if (chat.type === 'direct' && chat.contact) {
            const cId = (chat.contact.id || chat.id)?.toLowerCase();
            const freshLastSeen = lastSeenMap[cId];
            
            // Fallback: Check last message timestamp sent by them
            let bestLastSeen = freshLastSeen || chat.contact.lastSeen || 0;
            if (chat.messages && chat.messages.length > 0) {
              chat.messages.forEach(msg => {
                if (msg.senderId && msg.senderId.toLowerCase() === cId) {
                  if (msg.timestamp > bestLastSeen) {
                    bestLastSeen = msg.timestamp;
                  }
                }
              });
            }
            
            if (bestLastSeen > 0 && chat.contact.lastSeen !== bestLastSeen) {
              changed = true;
              
              const updatedChatData = {
                ...chat,
                contact: {
                  ...chat.contact,
                  lastSeen: bestLastSeen
                }
              };
              
              supabase.from('chats').upsert({
                owner_id: myIdLower,
                chat_id: cId,
                chat_data: updatedChatData
              }, { onConflict: 'owner_id, chat_id' }).then();
              
              return updatedChatData;
            }
          }
          return chat;
        });
        
        return changed ? updated : prev;
      });
    } catch (err) {
      console.warn('[ShadowTalk] syncContactsLastSeen failed:', err);
    }
  };

  // Real-time Presence Tracking
  const presenceChannelRef = useRef(null);
  const offlineTimeoutRef = useRef({});
  const heartbeatTimestampsRef = useRef({});
  const pingIntervalRef = useRef(null);
  const monitorIntervalRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!user?.id) return;
    const myIdLower = user.id.toLowerCase();

    // Connect Socket.io client to backend server for message_seen events
    const signalingUrl = import.meta.env.VITE_SIGNALING_URL || 'http://localhost:3001';
    console.log('[ShadowTalk] Connecting socket.io to', signalingUrl);
    const socket = io(signalingUrl, {
      auth: { token: user.id }
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[ShadowTalk] Socket.io connected:', socket.id);
    });

    socket.on('message_seen', (data) => {
      const { messageIds, chatId, receiverId } = data;
      console.log('[ShadowTalk] Received message_seen socket event:', data);
      
      // Update local state to mark these messages as seen
      setChats(prev => prev.map(chat => {
        const cid = chatId.toLowerCase();
        const isMatch = chat.id.toLowerCase() === cid ||
                        (chat.contact?.id && chat.contact.id.toLowerCase() === cid) ||
                        (chat.contact?.shadowId && chat.contact.shadowId.toLowerCase() === cid);
        if (isMatch) {
          return {
            ...chat,
            messages: (chat.messages || []).map(m =>
              messageIds.includes(m.id) ? { ...m, status: 'seen', read: true } : m
            )
          };
        }
        return chat;
      }));
    });

    socket.on('disconnect', () => {
      console.log('[ShadowTalk] Socket.io disconnected');
    });

    const initPresence = () => {
      // Connect socket if disconnected
      if (supabase.realtime && typeof supabase.realtime.connect === 'function') {
        console.log('[ShadowTalk] Connecting realtime socket...');
        supabase.realtime.connect();
      }

      if (presenceChannelRef.current) return;
      console.log('[ShadowTalk] Initializing Presence Channel');
      
      const channel = supabase.channel('online-status', {
        config: {
          presence: {
            key: myIdLower,
          },
        },
      });

      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          const activeIds = new Set();
          const now = Date.now();
          
          Object.entries(state).forEach(([key, presenceItems]) => {
            const keyLower = key.toLowerCase();
            let newestOnlineAt = 0;
            
            if (Array.isArray(presenceItems)) {
              presenceItems.forEach(item => {
                if (item.online_at) {
                  const t = new Date(item.online_at).getTime();
                  if (t > newestOnlineAt) newestOnlineAt = t;
                }
              });
            }
            
            const lastBeat = heartbeatTimestampsRef.current[keyLower];
            const isStale = lastBeat && lastBeat > 1 && (now - lastBeat) > 30000;
            const isRecentJoin = newestOnlineAt && (now - newestOnlineAt) < 15000;
            
            if (isRecentJoin || (!isStale && lastBeat !== 1)) {
              activeIds.add(keyLower);
              if (!heartbeatTimestampsRef.current[keyLower] || isRecentJoin) {
                heartbeatTimestampsRef.current[keyLower] = now;
              }
            }

            if (Array.isArray(presenceItems)) {
              presenceItems.forEach(item => {
                if (item.shadowId) {
                  const shadowLower = item.shadowId.toLowerCase();
                  const shadowLastBeat = heartbeatTimestampsRef.current[shadowLower];
                  const shadowIsStale = shadowLastBeat && shadowLastBeat > 1 && (now - shadowLastBeat) > 30000;
                  
                  if (isRecentJoin || (!shadowIsStale && shadowLastBeat !== 1)) {
                    activeIds.add(shadowLower);
                    if (!heartbeatTimestampsRef.current[shadowLower] || isRecentJoin) {
                      heartbeatTimestampsRef.current[shadowLower] = now;
                    }
                  }
                }
              });
            }
          });

          // Clear any pending offline timeouts for users who are currently active/online
          activeIds.forEach(id => {
            const lowerId = id.toLowerCase();
            if (offlineTimeoutRef.current[lowerId]) {
              clearTimeout(offlineTimeoutRef.current[lowerId]);
              delete offlineTimeoutRef.current[lowerId];
            }
          });

          console.log('[ShadowTalk] Presence Sync - active user IDs:', Array.from(activeIds));
          setOnlineUsers(activeIds);

          setChats(prev => prev.map(chat => {
            if (chat.type === 'direct' && chat.contact) {
              const contactIdLower = chat.contact.id?.toLowerCase();
              const contactShadowIdLower = chat.contact.shadowId?.toLowerCase();
              const isContactOnline = (contactIdLower && activeIds.has(contactIdLower)) ||
                                      (contactShadowIdLower && activeIds.has(contactShadowIdLower));
              if (chat.contact.isOnline !== isContactOnline) {
                const updated = {
                  ...chat,
                  contact: { ...chat.contact, isOnline: isContactOnline }
                };
                if (!isContactOnline) {
                  updated.contact.lastSeen = Date.now();
                }
                return updated;
              }
            }
            return chat;
          }));
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
          console.log('[ShadowTalk] Presence Leave for key:', key, leftPresences);
          if (!user?.id) return;
          const myIdLower = user.id.toLowerCase();
          
          if (key.toLowerCase() !== myIdLower) {
            const keyLower = key.toLowerCase();
            
            // Clear any existing leave timeout for this user
            if (offlineTimeoutRef.current[keyLower]) {
              clearTimeout(offlineTimeoutRef.current[keyLower]);
            }
            
            // Process offline immediately to eliminate UI delay and status fluctuation
            const lastSeenTime = Date.now();
            heartbeatTimestampsRef.current[keyLower] = 1; // Mark as stale
            
            setOnlineUsers(prev => {
              const updated = new Set(prev);
              updated.delete(keyLower);
              // Also remove any shadow IDs associated with this key
              leftPresences?.forEach(p => {
                if (p.shadowId) {
                  const shadowLower = p.shadowId.toLowerCase();
                  updated.delete(shadowLower);
                  heartbeatTimestampsRef.current[shadowLower] = 1;
                }
              });
              return updated;
            });
            
            setChats(prev => prev.map(chat => {
              if (chat.type === 'direct' && chat.contact) {
                const contactIdLower = chat.contact.id?.toLowerCase();
                const contactShadowIdLower = chat.contact.shadowId?.toLowerCase();
                const isMatch = (contactIdLower === keyLower) ||
                                (contactShadowIdLower === keyLower) ||
                                (leftPresences?.some(p => p.shadowId?.toLowerCase() === contactShadowIdLower));
                
                if (isMatch) {
                  return {
                    ...chat,
                    contact: { ...chat.contact, isOnline: false, lastSeen: lastSeenTime }
                  };
                }
              }
              return chat;
            }));

            const currentChats = chatsRef.current || [];
            const targetChat = currentChats.find(chat => {
              if (chat.type === 'direct' && chat.contact) {
                const contactIdLower = chat.contact.id?.toLowerCase();
                const contactShadowIdLower = chat.contact.shadowId?.toLowerCase();
                return (contactIdLower === keyLower) || 
                       (contactShadowIdLower === keyLower) ||
                       (leftPresences?.some(p => p.shadowId?.toLowerCase() === contactShadowIdLower));
              }
              return false;
            });

            if (targetChat) {
              const updatedChatData = {
                ...targetChat,
                contact: {
                  ...targetChat.contact,
                  isOnline: false,
                  lastSeen: lastSeenTime
                }
              };
              supabase.from('chats').upsert({
                owner_id: myIdLower,
                chat_id: targetChat.id.toLowerCase(),
                chat_data: updatedChatData
              }, { onConflict: 'owner_id, chat_id' })
              .then(({ error }) => {
                if (error) console.error('[ShadowTalk] Error saving last seen:', error);
              });
            }
          }
        });

      channel.on('broadcast', { event: 'ping' }, (payload) => {
        if (!payload.payload) return;
        const { userId, shadowId } = payload.payload;
        const now = Date.now();
        if (userId) heartbeatTimestampsRef.current[userId.toLowerCase()] = now;
        if (shadowId) heartbeatTimestampsRef.current[shadowId.toLowerCase()] = now;
      });

      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            online_at: new Date().toISOString(),
            shadowId: user.shadowId?.toLowerCase()
          });
          // Update our own self presence when we come online
          updateSelfPresence(false);

          const sendPing = () => {
            if (presenceChannelRef.current && navigator.onLine) {
              presenceChannelRef.current.send({
                type: 'broadcast',
                event: 'ping',
                payload: { userId: myIdLower, shadowId: user.shadowId }
              }).catch(() => {});
            }
          };
          sendPing(); // Send immediately on connect
          if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = setInterval(sendPing, 10000);
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          const offlineTime = Date.now();
          setOnlineUsers(new Set());
          setChats(prev => prev.map(chat => {
            if (chat.type === 'direct' && chat.contact && chat.contact.isOnline) {
              return { ...chat, contact: { ...chat.contact, isOnline: false, lastSeen: offlineTime } };
            }
            return chat;
          }));
        }
      });

      presenceChannelRef.current = channel;
    };

    const destroyPresence = async (isClosing = false) => {
      if (presenceChannelRef.current) {
        console.log('[ShadowTalk] Destroying Presence Channel');
        try {
          supabase.removeChannel(presenceChannelRef.current);
        } catch (e) {
          console.warn('[ShadowTalk] Error removing presence channel:', e);
        }
        presenceChannelRef.current = null;
      }
      
      // Update self presence to reflect exactly when we went offline
      await updateSelfPresence(isClosing);

      if (supabase.realtime && typeof supabase.realtime.disconnect === 'function') {
        console.log('[ShadowTalk] Disconnecting realtime socket...');
        supabase.realtime.disconnect();
      }
    };

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'hidden') {
        await destroyPresence(true);
      } else {
        initPresence();
        syncContactsLastSeen(chatsRef.current);
      }
    };

    const handleUnload = () => {
      destroyPresence(true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handleUnload);
    window.addEventListener('beforeunload', handleUnload);

    // Initial load
    initPresence();
    syncContactsLastSeen(chatsRef.current);

    if (monitorIntervalRef.current) clearInterval(monitorIntervalRef.current);
    monitorIntervalRef.current = setInterval(() => {
      const now = Date.now();
      let changedIds = [];
      const currentOnline = new Set(onlineUsersRef.current);
      
      currentOnline.forEach(id => {
        const lastBeat = heartbeatTimestampsRef.current[id];
        // Stale if no heartbeat for 30s and has not been marked stale (value 1) yet
        if (lastBeat && lastBeat > 1 && (now - lastBeat) > 30000) {
          changedIds.push(id);
          heartbeatTimestampsRef.current[id] = 1; // Mark as stale
        }
      });

      if (changedIds.length > 0) {
        setOnlineUsers(prev => {
          const updated = new Set(prev);
          changedIds.forEach(id => updated.delete(id));
          return updated;
        });
        
        setChats(prev => prev.map(chat => {
          if (chat.type === 'direct' && chat.contact) {
            const contactIdLower = chat.contact.id?.toLowerCase();
            const contactShadowIdLower = chat.contact.shadowId?.toLowerCase();
            if ((contactIdLower && changedIds.includes(contactIdLower)) ||
                (contactShadowIdLower && changedIds.includes(contactShadowIdLower))) {
              if (chat.contact.isOnline) {
                return { ...chat, contact: { ...chat.contact, isOnline: false, lastSeen: now } };
              }
            }
          }
          return chat;
        }));
      }
    }, 5000);

    // Run a periodic heartbeat every 60 seconds to refresh our self presence
    const heartbeat = setInterval(() => {
      updateSelfPresence(false);
    }, 60000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handleUnload);
      window.removeEventListener('beforeunload', handleUnload);
      clearInterval(heartbeat);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (monitorIntervalRef.current) clearInterval(monitorIntervalRef.current);
      destroyPresence(false);
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [user?.id]);

  // Handle Browser Coming Online/Offline Sweep
  useEffect(() => {
    const handleOnline = () => {
      console.log('[ShadowTalk] Browser came online, syncing data...');
      setIsOffline(false);
      syncMissedMessages();
      retryPendingMessages();
    };
    const handleOffline = () => {
      console.log('[ShadowTalk] Browser went offline');
      setIsOffline(true);
      
      const offlineTime = Date.now();
      
      // Attempt to update our own self presence locally (and send keepalive if possible)
      updateSelfPresence(true);

      // Clear online users and set all contacts to offline
      setOnlineUsers(new Set());
      
      setChats(prev => prev.map(chat => {
        if (chat.type === 'direct' && chat.contact && chat.contact.isOnline) {
          return {
            ...chat,
            contact: {
              ...chat.contact,
              isOnline: false,
              lastSeen: offlineTime
            }
          };
        }
        return chat;
      }));
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Settings
  const [settings, setSettingsState] = useState(() => {
    const defaultSettings = {
      notifications: true,
      readReceipts: true,
      typingIndicators: false,
      autoTrim: false,
      sendWithEnter: false,
      autoplayAudio: true,
      voiceVideo: true,
      lockApp: false,
      appPin: '1234',
      commRequests: false
    };
    try {
      const saved = localStorage.getItem('shadowtalk_settings');
      return (saved && saved !== 'undefined') ? JSON.parse(saved) : defaultSettings;
    } catch (e) {
      console.warn('[ShadowTalk] Settings parse error:', e);
      return defaultSettings;
    }
  });

  const setSettings = (newSettingsOrFn) => {
    setSettingsState(prev => {
      const next = typeof newSettingsOrFn === 'function' ? newSettingsOrFn(prev) : newSettingsOrFn;
      
      // Also persist to localStorage
      localStorage.setItem('shadowtalk_settings', JSON.stringify(next));

      // Sync to Supabase if user is logged in
      const uid = userRef.current?.id || user?.id;
      if (uid) {
        const uidLower = uid.toLowerCase();
        console.log('[ShadowTalk] Syncing privacy settings to DB:', next);
        supabase.from('chats').upsert({
          owner_id: uidLower,
          chat_id: 'settings_privacy',
          chat_data: { 
            readReceipts: next.readReceipts !== false, 
            voiceVideo: next.voiceVideo !== false, 
            typingIndicators: next.typingIndicators !== false, 
            lastUpdated: Date.now() 
          }
        }, { onConflict: 'owner_id, chat_id' }).then(({ error }) => {
          if (error) console.error('[ShadowTalk] Failed to sync settings to DB:', error);
        });
      }
      
      return next;
    });
  };

  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);


  const [toast, setToast] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const playNotificationSound = () => {
    try {
      const context = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, context.currentTime);
      oscillator.connect(gainNode);
      gainNode.connect(context.destination);

      gainNode.gain.setValueAtTime(0, context.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.5, context.currentTime + 0.05);
      gainNode.gain.linearRampToValueAtTime(0, context.currentTime + 0.3);

      oscillator.start(context.currentTime);
      oscillator.stop(context.currentTime + 0.3);
    } catch (e) {
      console.warn('[ShadowTalk] Failed to play sound:', e);
    }
  };

  // Persistence effects
  useEffect(() => {
    if (user) {
      localStorage.setItem('shadowtalk_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('shadowtalk_user');
    }
  }, [user]);

  useEffect(() => {
    localStorage.setItem('shadowtalk_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (user?.id) {
      localStorage.setItem(`shadowtalk_chats_${user.id.toLowerCase()}`, JSON.stringify(chats));
    }
  }, [chats, user?.id]);

  useEffect(() => {
    if (!settings.typingIndicators) {
      setTypingUsers({});
    }
  }, [settings.typingIndicators]);

  // Initialization
  useEffect(() => {
    const init = async () => {
      try {
        const storedUser = localStorage.getItem('shadowtalk_user');
        if (storedUser) {
          const u = JSON.parse(storedUser);
          if (u && u.id) {
            // Load cached chats first for immediate UI restore
            const cachedChats = localStorage.getItem(`shadowtalk_chats_${u.id.toLowerCase()}`);
            if (cachedChats) {
              setChats(JSON.parse(cachedChats));
            }
            await loginMockUser(u.name, u.id, u.phrase);
          }
        }
      } catch (err) {
        console.error('[ShadowTalk] Init error:', err);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  const callLogs = React.useMemo(() => {
    const logs = [];
    chats.forEach(chat => {
      if (!chat || !chat.messages) return;
      chat.messages.forEach(msg => {
        if (msg.type === 'call') {
          logs.push({
            ...msg,
            chatId: chat.id,
            chatName: chat.type === 'direct' ? (chat.contact?.name || chat.name) : chat.name,
            chatAvatar: chat.type === 'direct' ? (chat.contact?.avatarUrl || chat.avatarUrl) : chat.avatarUrl,
            chatType: chat.type
          });
        }
      });
    });
    return logs.sort((a, b) => b.timestamp - a.timestamp);
  }, [chats]);

  const unreadMissedCalls = React.useMemo(() => {
    return callLogs.filter(log => log.status === 'missed' && !log.read).length;
  }, [callLogs]);

  const addCallNotification = (notif) => {
    const id = Date.now();
    setCallNotifications(prev => [{ ...notif, id }, ...prev]);
    setTimeout(() => {
      setCallNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  const markCallsAsRead = () => {
    setChats(prev => prev.map(chat => {
      let changed = false;
      const newMsgs = chat.messages.map(msg => {
        if (msg.type === 'call' && msg.status === 'missed' && !msg.read) {
          changed = true;
          return { ...msg, read: true };
        }
        return msg;
      });
      if (changed) {
        const updatedChat = { ...chat, messages: newMsgs };
        // Background persistence
        supabase.from('chats').upsert({
          owner_id: userRef.current.id.toLowerCase(),
          chat_id: chat.id.toLowerCase(),
          chat_data: updatedChat
        }, { onConflict: 'owner_id, chat_id' }).then();
        return updatedChat;
      }
      return chat;
    }));
  };

  const updateChatTheme = async (chatId, themeData) => {
    setChats(prev => prev.map(chat => {
      const cid = String(chat.id).toLowerCase().trim();
      const target = String(chatId).toLowerCase().trim();
      if (cid === target) {
        const updatedChat = { ...chat, theme: themeData };
        // Background persistence
        supabase.from('chats').upsert({
          owner_id: userRef.current.id.toLowerCase(),
          chat_id: cid,
          chat_data: updatedChat
        }, { onConflict: 'owner_id, chat_id' }).then(({ error }) => {
          if (error) console.error('[ShadowTalk] Theme sync error:', error);
        });
        return updatedChat;
      }
      return chat;
    }));
  };

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  window.showToast = showToast;


  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-variant', themeVariant);
    document.documentElement.style.setProperty('--accent-primary', primaryColor);

    if (globalWallpaper) {
      document.documentElement.style.setProperty('--global-bg-image', `url(${globalWallpaper})`);
    } else {
      document.documentElement.style.removeProperty('--global-bg-image');
    }

    // Auto update secondary accent for subtle glow effects
    const secondaryColor = primaryColor + 'cc'; // Add some transparency
    document.documentElement.style.setProperty('--accent-secondary', secondaryColor);
  }, [theme, themeVariant, primaryColor, globalWallpaper]);

  useEffect(() => {
    if (followSystem) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e) => setTheme(e.matches ? 'dark' : 'light');

      setTheme(mediaQuery.matches ? 'dark' : 'light');
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [followSystem]);

  // Firebase Messaging Setup
  useEffect(() => {
    if (!user?.id) return;

    if (window.firebase) {
      const firebaseConfig = {
        apiKey: "AIzaSyDIe2XGP_yBqcpuPlTldKogDPSZco1QPpo",
        authDomain: "shadowtalk-f916f.firebaseapp.com",
        projectId: "shadowtalk-f916f",
        storageBucket: "shadowtalk-f916f.firebasestorage.app",
        messagingSenderId: "1050613936240",
        appId: "1:1050613936240:web:c6eddc78ada268f4f044b5",
        measurementId: "G-K2N5039J04"
      };

      let app;
      if (!window.firebase.apps.length) {
        app = window.firebase.initializeApp(firebaseConfig);
      } else {
        app = window.firebase.app();
      }

      const messaging = window.firebase.messaging();

      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          console.log('[ShadowTalk] Notification permission granted.');
          messaging.getToken({ vapidKey: 'BHqti3ueSZHa2GIY9D1z9rGUzVlPJdujbSfKHZ-Nts85Y6NK6kjWDEoppwxhudJL8KyoTXUkbu0Ki8zXBZNIDkA' })
            .then((currentToken) => {
              if (currentToken) {
                console.log('[ShadowTalk] FCM Token:', currentToken);
                localStorage.setItem('shadowtalk_fcm_token', currentToken);
              } else {
                console.log('[ShadowTalk] No registration token available.');
              }
            }).catch((err) => {
              console.log('[ShadowTalk] Error retrieving token: ', err);
            });
        }
      });

      messaging.onMessage((payload) => {
        console.log('[ShadowTalk] Message received in foreground: ', payload);
        playNotificationSound();
        showToast(`New message: ${payload.notification?.body || 'Check chats'}`, 'info');
        
        // Also show in the notification tray of the Android system
        if (Notification.permission === 'granted') {
          const notificationTitle = payload.notification?.title || 'New Message';
          const notificationOptions = {
            body: payload.notification?.body || 'You received a new message.',
            icon: '/favicon.svg'
          };

          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then((registration) => {
              registration.showNotification(notificationTitle, notificationOptions);
            }).catch(err => {
              console.error('[ShadowTalk] Failed to show notification via Service Worker:', err);
              new Notification(notificationTitle, notificationOptions);
            });
          } else {
            new Notification(notificationTitle, notificationOptions);
          }
        }
      });
    }
  }, [user?.id]);

  // Listen for Service Worker messages (sound ping)
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const handleMessage = (event) => {
        if (event.data && event.data.type === 'PLAY_SOUND') {
          console.log('[ShadowTalk] Received sound ping from SW');
          playNotificationSound();
        }
      };
      navigator.serviceWorker.addEventListener('message', handleMessage);
      return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
    }
  }, []);

  // Real-time subscriptions
  useEffect(() => {
    if (!user?.id) return;

    // Real-time updates: Subscribe to both Database ID and Shadow ID to ensure we catch all messages
    // Real-time filters can be sensitive to spaces, so we use multiple channels if needed.
    const subId1 = user.id;
    const subId2 = user.shadowId && user.shadowId !== user.id ? user.shadowId : null;

    // Initialize CallService with user's JWT or ID if mock login
    supabase.auth.getSession().then(({ data }) => {
      const token = data?.session?.access_token || user.id;
      // Ensure we use HTTPS for signaling in production to avoid security warnings/red pages
      callService.setEncryptor(encrypt);
      callService.initialize(user.id, user.shadowId);
    });

    const chatSub = supabase.channel('db_changes');
    chatSubRef.current = chatSub;
    // Subscribe for Database ID
    chatSub.on('postgres_changes', {
      event: '*', schema: 'public', table: 'chats',
      filter: `owner_id=eq.${user.id.toLowerCase()}`
    }, (payload) => {
      console.log('[ShadowTalk] Chat table update detected:', payload.eventType);
      
      // Merge logic from legacy metadata sync
      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        const newChatRecord = payload.new;
        if (newChatRecord && String(newChatRecord.chat_id).toLowerCase().trim() === 'settings_privacy') {
          console.log('[ShadowTalk] Realtime Privacy settings update received:', newChatRecord.chat_data);
          setSettingsState(prev => ({
            ...prev,
            readReceipts: newChatRecord.chat_data.readReceipts !== false,
            voiceVideo: newChatRecord.chat_data.voiceVideo !== false,
            typingIndicators: newChatRecord.chat_data.typingIndicators !== false
          }));
          return;
        }

        if (newChatRecord && newChatRecord.chat_data) {
          const decodedChat = decryptChat(newChatRecord.chat_data);
          if (!decodedChat.id) decodedChat.id = newChatRecord.chat_id;

          setChats(prev => {
            const existingIndex = prev.findIndex(c =>
              String(c.id).toLowerCase().trim() === String(newChatRecord.chat_id).toLowerCase().trim()
            );

            if (existingIndex >= 0) {
              const updatedChats = [...prev];
              const existingChat = prev[existingIndex];
              const newIntervals = decodedChat.membershipIntervals || [];

              const filteredMessages = (existingChat.messages || []).filter(m => {
                const msgTime = new Date(m.created_at || m.timestamp).getTime();
                if (newIntervals.length > 0) {
                  return newIntervals.some(inv =>
                    msgTime >= inv.joinedAt && (!inv.removedAt || msgTime <= inv.removedAt)
                  );
                }
                if (decodedChat.status === 'removed' && decodedChat.removedAt) {
                  return msgTime <= decodedChat.removedAt;
                }
                if (decodedChat.deletedForMe?.includes(m.id)) {
                  return false;
                }
                return true;
              });

              updatedChats[existingIndex] = { ...decodedChat, messages: filteredMessages };
              return updatedChats;
            } else {
              return [...prev, decodedChat];
            }
          });
          markIncomingMessagesAsDelivered([decodedChat], userRef.current?.id);
        }
      } else if (payload.eventType === 'DELETE') {
        setChats(prev => prev.filter(c =>
          String(c.id).toLowerCase().trim() !== String(payload.old.chat_id).toLowerCase().trim()
        ));
      } else {
        loginMockUser(user.name, user.id, user.phrase, true);
      }
    });

    chatSub.on('postgres_changes', {
      event: '*', schema: 'public', table: 'requests',
      filter: `receiver_id=eq.${subId1}`
    }, () => loginMockUser(user.name, user.id, user.phrase, true));

    chatSub.on('postgres_changes', {
      event: '*', schema: 'public', table: 'requests',
      filter: `sender_id=eq.${subId1}`
    }, () => loginMockUser(user.name, user.id, user.phrase, true));

    // Subscribe for Shadow ID if different
    if (subId2) {
      chatSub.on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'chats',
        filter: `owner_id=eq.${subId2}`
      }, (payload) => {
        console.log('[ShadowTalk] New chat detected (ID2):', payload.new?.chat_id);
        loginMockUser(user.name, user.id, user.phrase, false);
      });

      chatSub.on('postgres_changes', {
        event: '*', schema: 'public', table: 'requests',
        filter: `receiver_id=eq.${subId2}`
      }, () => loginMockUser(user.name, user.id, user.phrase, true));

      chatSub.on('postgres_changes', {
        event: '*', schema: 'public', table: 'requests',
        filter: `sender_id=eq.${subId2}`
      }, () => loginMockUser(user.name, user.id, user.phrase, true));
    }

    // 4. Listen to updates on my sent messages (so I get real-time delivery double-ticks)
    chatSub.on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'messages',
      filter: `sender_id=eq.${subId1.toLowerCase()}`
    }, (payload) => {
      console.log('[ShadowTalk] My sent message updated in real-time:', payload);
      const updatedMessage = payload.new;
      if (updatedMessage && updatedMessage.content) {
        const msgId = updatedMessage.id;
        const cid = updatedMessage.chat_id.toLowerCase();
        
        let decryptedMsgContent;
        try {
          const content = typeof updatedMessage.content === 'string' ? JSON.parse(updatedMessage.content) : updatedMessage.content;
          const decryptedText = decrypt(content.text, updatedMessage.chat_id.toLowerCase());
          decryptedMsgContent = {
            ...content,
            id: updatedMessage.id,
            senderId: updatedMessage.sender_id,
            timestamp: new Date(updatedMessage.created_at || Date.now()).getTime(),
            deleteAt: updatedMessage.delete_at,
            text: decryptedText,
            dbChatId: updatedMessage.chat_id,
            media: content.media || null,
            replyTo: content.replyTo ? {
              ...content.replyTo,
              text: decrypt(content.replyTo.text, updatedMessage.chat_id.toLowerCase())
            } : null
          };
        } catch (e) {
          console.warn('[ShadowTalk] Decrypt error on sent message update:', e);
          return;
        }

        setChats(prev => {
          let changed = false;
          const myId = subId1.toLowerCase();
          const myShadowId = subId2?.toLowerCase();
          const newChats = prev.map(chat => {
            // Note to Self Safety Guard
            const isSelfChat = chat.isSelf === true || chat.id.toLowerCase() === myId || (myShadowId && chat.id.toLowerCase() === myShadowId);
            if (isSelfChat) {
              const isMsgToSelf = updatedMessage.sender_id.toLowerCase() === myId &&
                                  (updatedMessage.chat_id.toLowerCase() === myId || (myShadowId && updatedMessage.chat_id.toLowerCase() === myShadowId));
              if (!isMsgToSelf) return chat;
            }

            const isMatch = chat.id.toLowerCase() === cid ||
                            (chat.contact?.id && chat.contact.id.toLowerCase() === cid) ||
                            (chat.contact?.shadowId && chat.contact.shadowId.toLowerCase() === cid);
            if (isMatch) {
              const msgs = chat.messages || [];
              const idx = msgs.findIndex(m => m.id === msgId);
              if (idx >= 0) {
                const currentMsg = msgs[idx];
                const statusChanged = currentMsg.status !== decryptedMsgContent.status || currentMsg.read !== decryptedMsgContent.read;
                const deliveredChanged = JSON.stringify(currentMsg.deliveredTo) !== JSON.stringify(decryptedMsgContent.deliveredTo) ||
                                         JSON.stringify(currentMsg.seenBy) !== JSON.stringify(decryptedMsgContent.seenBy);
                const reactionsChanged = JSON.stringify(currentMsg.reactions || {}) !== JSON.stringify(decryptedMsgContent.reactions || {});
                if (statusChanged || deliveredChanged || reactionsChanged) {
                  changed = true;
                  const newMsgs = [...msgs];
                  newMsgs[idx] = { ...currentMsg, ...decryptedMsgContent };
                  return { ...chat, messages: newMsgs };
                }
              }
            }
            return chat;
          });
          
          if (changed) {
            const updatedChat = newChats.find(c => 
              c.id.toLowerCase() === cid ||
              (c.contact?.id && c.contact.id.toLowerCase() === cid)
            );
            if (updatedChat) {
              const chatMetadata = { ...updatedChat, messages: [] };
              supabase.from('chats').upsert({
                owner_id: subId1.toLowerCase(),
                chat_id: cid,
                chat_data: chatMetadata
              }, { onConflict: 'owner_id, chat_id' }).then();
            }
          }
          return changed ? newChats : prev;
        });
      }
    });

    if (subId2) {
      chatSub.on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'messages',
        filter: `sender_id=eq.${subId2.toLowerCase()}`
      }, (payload) => {
        console.log('[ShadowTalk] My shadow-sent message updated in real-time:', payload);
        const updatedMessage = payload.new;
        if (updatedMessage && updatedMessage.content) {
          const msgId = updatedMessage.id;
          const cid = updatedMessage.chat_id.toLowerCase();
          
          let decryptedMsgContent;
          try {
            const content = typeof updatedMessage.content === 'string' ? JSON.parse(updatedMessage.content) : updatedMessage.content;
            const decryptedText = decrypt(content.text, updatedMessage.chat_id.toLowerCase());
            decryptedMsgContent = {
              ...content,
              id: updatedMessage.id,
              senderId: updatedMessage.sender_id,
              timestamp: new Date(updatedMessage.created_at || Date.now()).getTime(),
              deleteAt: updatedMessage.delete_at,
              text: decryptedText,
              dbChatId: updatedMessage.chat_id,
              media: content.media || null,
              replyTo: content.replyTo ? {
                ...content.replyTo,
                text: decrypt(content.replyTo.text, updatedMessage.chat_id.toLowerCase())
              } : null
            };
          } catch (e) {
            console.warn('[ShadowTalk] Decrypt error on sent message update:', e);
            return;
          }

          setChats(prev => {
            let changed = false;
            const myId = subId1.toLowerCase();
            const myShadowId = subId2?.toLowerCase();
            const newChats = prev.map(chat => {
              // Note to Self Safety Guard
              const isSelfChat = chat.isSelf === true || chat.id.toLowerCase() === myId || (myShadowId && chat.id.toLowerCase() === myShadowId);
              if (isSelfChat) {
                const isMsgToSelf = updatedMessage.sender_id.toLowerCase() === myId &&
                                    (updatedMessage.chat_id.toLowerCase() === myId || (myShadowId && updatedMessage.chat_id.toLowerCase() === myShadowId));
                if (!isMsgToSelf) return chat;
              }

              const isMatch = chat.id.toLowerCase() === cid ||
                              (chat.contact?.id && chat.contact.id.toLowerCase() === cid) ||
                              (chat.contact?.shadowId && chat.contact.shadowId.toLowerCase() === cid);
              if (isMatch) {
                const msgs = chat.messages || [];
                const idx = msgs.findIndex(m => m.id === msgId);
                if (idx >= 0) {
                  const currentMsg = msgs[idx];
                  const statusChanged = currentMsg.status !== decryptedMsgContent.status || currentMsg.read !== decryptedMsgContent.read;
                  const deliveredChanged = JSON.stringify(currentMsg.deliveredTo) !== JSON.stringify(decryptedMsgContent.deliveredTo) ||
                                           JSON.stringify(currentMsg.seenBy) !== JSON.stringify(decryptedMsgContent.seenBy);
                  const reactionsChanged = JSON.stringify(currentMsg.reactions || {}) !== JSON.stringify(decryptedMsgContent.reactions || {});
                  if (statusChanged || deliveredChanged || reactionsChanged) {
                    changed = true;
                    const newMsgs = [...msgs];
                    newMsgs[idx] = { ...currentMsg, ...decryptedMsgContent };
                    return { ...chat, messages: newMsgs };
                  }
                }
              }
              return chat;
            });
            
            if (changed) {
              const updatedChat = newChats.find(c => 
                c.id.toLowerCase() === cid ||
                (c.contact?.id && c.contact.id.toLowerCase() === cid)
              );
              if (updatedChat) {
                const chatMetadata = { ...updatedChat, messages: [] };
                supabase.from('chats').upsert({
                  owner_id: subId1.toLowerCase(),
                  chat_id: cid,
                  chat_data: chatMetadata
                }, { onConflict: 'owner_id, chat_id' }).then();
              }
            }
            return changed ? newChats : prev;
          });
        }
      });
    }

    // 1. Listen for Typing Indicators
    chatSub.on('broadcast', { event: 'TYPING' }, (payload) => {
      if (!settings.typingIndicators) return;
      const { chatId, userId, isTyping, targetUserId } = payload.payload;
      if (userId === userRef.current?.id) return;

      const myId = userRef.current?.id?.toLowerCase();
      const isGroup = String(chatId).toLowerCase().startsWith('group_');

      // Filter direct chats: only show if I am the intended recipient
      if (!isGroup && targetUserId?.toLowerCase() !== myId) return;
      
      if (isGroup) {
        const groupChat = (chatsRef.current || []).find(c => String(c.id).toLowerCase() === String(chatId).toLowerCase());
        const isParticipant = groupChat && (groupChat.members || []).some(m => m && (String(m.id).toLowerCase() === myId || (userRef.current?.shadowId && m.shadowId && String(m.shadowId).toLowerCase() === String(userRef.current?.shadowId).toLowerCase())));
        if (!groupChat || groupChat.status === 'removed' || !isParticipant) return;
      }

      // For direct chats, the local chatId is the sender's ID (userId)
      // For group chats, the local chatId is the group ID (chatId)
      const localChatId = isGroup ? chatId : userId;

      setTypingUsers(prev => ({
        ...prev,
        [localChatId]: {
          ...(prev[localChatId] || {}),
          [userId]: isTyping
        }
      }));
    });

    chatSub.on('broadcast', { event: 'MESSAGE_STATUS_UPDATE' }, (payload) => {
      const { chatId, messageIds, status, readerId } = payload.payload;
      console.log('[ShadowTalk] Status broadcast:', status, messageIds);
      setChats(prev => prev.map(chat => {
        const cid = chatId.toLowerCase();
        const isMatch = chat.id.toLowerCase() === cid ||
                        (chat.contact?.id && chat.contact.id.toLowerCase() === cid) ||
                        (chat.contact?.shadowId && chat.contact.shadowId.toLowerCase() === cid);
        if (isMatch) {
          return {
            ...chat,
            messages: (chat.messages || []).map(m => {
              if (messageIds.includes(m.id)) {
                if (chat.type === 'group' && readerId) {
                  const rId = readerId.toLowerCase();
                  const arrName = status === 'seen' ? 'seenBy' : 'deliveredTo';
                  const currentArr = m[arrName] || [];
                  const newArr = Array.from(new Set([...currentArr, rId]));
                  
                  const otherArrName = status === 'seen' ? 'deliveredTo' : 'seenBy';
                  const otherArr = m[otherArrName] || [];
                  const finalOther = status === 'seen' ? Array.from(new Set([...otherArr, rId])) : otherArr;
                  
                  return { ...m, [arrName]: newArr, [otherArrName]: finalOther };
                } else {
                  return { ...m, status, read: status === 'seen' };
                }
              }
              return m;
            })
          };
        }
        return chat;
      }));
    });

    chatSub.on('broadcast', { event: 'MESSAGE_DELETED' }, (payload) => {
      const { messageIds } = payload.payload;
      console.log('[ShadowTalk] Global broadcast deletion:', messageIds);
      setChats(prev => prev.map(chat => ({
        ...chat,
        messages: (chat.messages || []).filter(m => !messageIds.includes(m.id))
      })));
    });

    chatSub.on('broadcast', { event: 'REACTION_TOGGLE' }, (payload) => {
      const { chatId, messageId, emoji, userId } = payload.payload;
      console.log('[ShadowTalk] Reaction broadcast received:', { chatId, messageId, emoji, userId });
      const myId = userRef.current?.id?.toLowerCase();
      if (!myId) return;

      // Skip if this is our own broadcast — we already updated local state in toggleReaction
      if (userId.toLowerCase() === myId) return;

      // Determine local gid (chat ID in our local state)
      const isGroup = String(chatId).toLowerCase().startsWith('group_');
      const gid = isGroup ? chatId.toLowerCase() : userId.toLowerCase();

      setChats(prev => prev.map(chat => {
        if (chat.id.toLowerCase() === gid) {
          return {
            ...chat,
            messages: (chat.messages || []).map(m => {
              if (m.id === messageId) {
                const reactions = { ...(m.reactions || {}) };
                const users = reactions[emoji] || [];
                const uIdx = users.findIndex(u => u.toLowerCase() === userId.toLowerCase());

                let updatedUsers;
                if (uIdx >= 0) {
                  updatedUsers = users.filter((_, i) => i !== uIdx);
                } else {
                  updatedUsers = [...users, userId.toLowerCase()];
                }

                const newReactions = { ...reactions };
                if (updatedUsers.length === 0) {
                  delete newReactions[emoji];
                } else {
                  newReactions[emoji] = updatedUsers;
                }
                return { ...m, reactions: newReactions };
              }
              return m;
            })
          };
        }
        return chat;
      }));
    });

    // 1.2 Group Membership Sync Broadcast
    chatSub.on('broadcast', { event: 'GROUP_SYNC' }, (payload) => {
      const { groupId, members, lastActivity, type } = payload.payload;
      setChats(prev => prev.map(chat => {
        if (String(chat.id).toLowerCase() === String(groupId).toLowerCase()) {
          const amIInGroup = members.some(m => m && (String(m.id).toLowerCase() === String(user.id).toLowerCase() || (user.shadowId && m.shadowId && String(m.shadowId).toLowerCase() === String(user.shadowId).toLowerCase())));
          
          const updatedChat = { ...chat, members: members, lastActivity: lastActivity || Date.now() };

          if (!amIInGroup && chat.status !== 'removed') {
            updatedChat.status = 'removed';
            updatedChat.exitType = 'removed';
            updatedChat.removedAt = lastActivity || Date.now();
            
            let intervals = [...(updatedChat.membershipIntervals || [])];
            if (intervals.length > 0 && !intervals[intervals.length - 1].removedAt) {
              intervals[intervals.length - 1].removedAt = updatedChat.removedAt;
            }
            updatedChat.membershipIntervals = intervals;

            // Self-update DB row asynchronously
            supabase.from('chats').upsert({
              owner_id: user.id.toLowerCase(),
              chat_id: groupId,
              chat_data: updatedChat
            }, { onConflict: 'owner_id, chat_id' }).then(() => {
              console.log('[ShadowTalk] Self-updated DB row to removed status via GROUP_SYNC');
            });
          } else if (amIInGroup && type === 'member_added' && chat.status === 'removed') {
            // I was added back to the group!
            updatedChat.status = 'active';
            updatedChat.removedAt = null;
            let intervals = [...(updatedChat.membershipIntervals || [])];
            // Ensure previous interval is closed
            if (intervals.length > 0 && !intervals[intervals.length - 1].removedAt) {
              intervals[intervals.length - 1].removedAt = lastActivity || Date.now();
            }
            intervals.push({ joinedAt: lastActivity || Date.now(), removedAt: null });
            updatedChat.membershipIntervals = intervals;

            // Self-update DB row asynchronously
            supabase.from('chats').upsert({
              owner_id: user.id.toLowerCase(),
              chat_id: groupId,
              chat_data: updatedChat
            }, { onConflict: 'owner_id, chat_id' }).then(() => {
              console.log('[ShadowTalk] Self-updated DB row to active status via GROUP_SYNC');
            });
          }

          return updatedChat;
        }
        return chat;
      }));
    });

    // 1.3 Group Deletion Broadcast
    chatSub.on('broadcast', { event: 'GROUP_DELETED' }, (payload) => {
      const { groupId } = payload.payload;
      console.log(`[ShadowTalk] Real-time group deletion received for ${groupId}`);

      const canonicalGroupId = String(groupId).toLowerCase().trim();

      // Remove group from all members' chat lists/dashboards
      setChats(prev => prev.filter(c => String(c.id).toLowerCase().trim() !== canonicalGroupId));

      // Safe redirection for users currently on the chat or settings screen
      const currentActiveChatId = activeChatIdRef.current || activeChatId;
      if (currentActiveChatId && String(currentActiveChatId).toLowerCase().trim() === canonicalGroupId) {
        setActiveChatId(null);
        showToast('This group was deleted by the admin', 'info');
        window.location.hash = '#/chats';
      } else {
        const currentHash = window.location.hash.toLowerCase();
        if (currentHash.includes(canonicalGroupId)) {
          showToast('This group was deleted by the admin', 'info');
          window.location.hash = '#/chats';
        }
      }
    });

    // 1.5 Global Privacy Broadcast Listener (Merged into main chatSub)
    chatSub.on('broadcast', { event: 'profile_update' }, (payload) => {
        const { userId, shadowId, updates } = payload.payload;
        console.log('[ShadowTalk] Real-time profile update received:', { userId, shadowId, updates });

        const myId = userRef.current?.id?.toLowerCase();
        // 1. If it's MY profile, update the user state too (for multi-tab sync)
        if (userId?.toLowerCase() === myId || (shadowId && shadowId.toLowerCase() === userRef.current?.shadowId?.toLowerCase())) {
          setUser(prev => ({ ...prev, ...updates }));
        }

        setChats(prev => prev.map(chat => {
          const tid = userId?.toLowerCase();
          const sid = shadowId?.toLowerCase();

          const isMatch = (tid && (chat.id?.toLowerCase() === tid || chat.contact?.id?.toLowerCase() === tid || chat.contact?.shadowId?.toLowerCase() === tid)) ||
            (sid && (chat.id?.toLowerCase() === sid || chat.contact?.id?.toLowerCase() === sid || chat.contact?.shadowId?.toLowerCase() === sid));

          if (isMatch) {
            console.log('[ShadowTalk] Matching chat found for profile update:', chat.id);
            const updatedContact = { ...chat.contact, ...updates };
            // Ensure avatarUrl/avatar_url and name consistency
            if (updates.avatarUrl) updatedContact.avatar_url = updates.avatarUrl;
            if (updates.avatar_url) updatedContact.avatarUrl = updates.avatar_url;
            if (updates.name) updatedContact.name = updates.name;

            const updatedChat = { ...chat, contact: updatedContact };

            // If it's a direct chat, also update the top-level name if it exists
            if (chat.type === 'direct' && updates.name) {
              updatedChat.name = updates.name;
            }

            // Persist to DB so it survives refresh
            supabase.from('chats')
              .update({ chat_data: updatedChat })
              .match({ owner_id: userRef.current?.id?.toLowerCase(), chat_id: chat.id.toLowerCase() })
              .then(({ error }) => {
                if (error) console.error('[ShadowTalk] Profile persist error:', error);
              });

            return updatedChat;
          }

          // Also check if this user is a member of a group
          if (chat.type === 'group' && chat.members) {
            const hasMember = chat.members.some(m => (tid && m.id?.toLowerCase() === tid) || (sid && m.id?.toLowerCase() === sid));
            if (hasMember) {
              console.log('[ShadowTalk] Updating group member profile:', chat.id);
              const updatedMembers = chat.members.map(m => {
                const mMatch = (tid && m.id?.toLowerCase() === tid) || (sid && m.id?.toLowerCase() === sid);
                return mMatch ? { ...m, ...updates } : m;
              });
              const updatedChat = { ...chat, members: updatedMembers };

              // Persist to DB
              supabase.from('chats')
                .update({ chat_data: updatedChat })
                .match({ owner_id: userRef.current?.id?.toLowerCase(), chat_id: chat.id.toLowerCase() })
                .then(({ error }) => {
                  if (error) console.error('[ShadowTalk] Group member persist error:', error);
                });

              return updatedChat;
            }
          }

          return chat;
        }));
      })
      .on('broadcast', { event: 'group_metadata_update' }, (payload) => {
        const { groupId, updates } = payload.payload;
        console.log('[ShadowTalk] Real-time group update received:', groupId, updates);

        setChats(prev => prev.map(chat => {
          if (String(chat.id).toLowerCase() === String(groupId).toLowerCase()) {
            const updatedChat = { ...chat, ...updates, lastActivity: Date.now() };

            // Persist to DB
            lastSyncRef.current = Date.now(); // Prevent race condition with loginMockUser
            supabase.from('chats')
              .update({ chat_data: updatedChat })
              .match({ owner_id: userRef.current?.id?.toLowerCase(), chat_id: chat.id.toLowerCase() })
              .then(({ error }) => {
                if (error) console.error('[ShadowTalk] Group metadata persist error:', error);
                else console.log('[ShadowTalk] Group metadata persist success for:', chat.id);
              });

            return updatedChat;
          }
          return chat;
        }));
      })
      .on('broadcast', { event: 'status_change' }, (payload) => {
        const { userId, status, isBlocked } = payload.payload;
        console.log('[ShadowTalk] Real-time privacy update:', { userId, status, isBlocked });

        setChats(prev => prev.map(chat => {
          const targetId = userId?.toLowerCase();
          const targetShadowId = payload.payload.shadowId?.toLowerCase();
          const isMatch = chat.id?.toLowerCase() === targetId ||
            chat.contact?.id?.toLowerCase() === targetId ||
            (targetShadowId && chat.id?.toLowerCase() === targetShadowId) ||
            (targetShadowId && chat.contact?.id?.toLowerCase() === targetShadowId);

          if (isMatch) {
            const isBlockedByOther = isBlocked === true;
            if (isBlockedByOther) {
              showToast('You have been blocked by this contact', 'error');
              const currentCall = useCallStore.getState();
              if (currentCall.isCalling && currentCall.remoteUser?.id?.toLowerCase() === targetId) {
                endCall();
              }
            } else if (isBlocked === false) {
              showToast('This contact has unblocked you', 'success');
            }

            if (status === 'pending_received') {
              showToast('New connection request received!', 'info');
            }

            const updatedChat = {
              ...chat,
              isDeletedByMe: (status === 'pending_received' || status === 'pending_sent') ? false : chat.isDeletedByMe,
              isDeletedByOther: (status === 'deleted' || status === 'rejected') ? true : (status === 'pending_received' || status === 'pending_sent' ? false : chat.isDeletedByOther),
              isBlockedByOther: isBlockedByOther,
              disappearingConfig: payload.payload.disappearingConfig !== undefined ? payload.payload.disappearingConfig : chat.disappearingConfig,
              status: status === 'rejected' ? 'rejected' :
                (status === 'connected' ? 'direct' :
                  (status === 'pending_received' ? 'pending_received' :
                    (status === 'pending_sent' ? 'pending_sent' : chat.status)))
            };

            // 🔐 Persist privacy change to DB so it survives refresh
            lastSyncRef.current = Date.now(); // Set cooldown to prevent race condition with loginMockUser
            supabase.from('chats')
              .update({ chat_data: updatedChat })
              .eq('owner_id', userRef.current?.id?.toLowerCase())
              .eq('chat_id', chat.id.toLowerCase())
              .then(({ error }) => {
                if (error) console.error('[ShadowTalk] Privacy persist error:', error);
                else console.log('[ShadowTalk] Privacy persist success for:', chat.id, updatedChat.disappearingConfig);
              });

            return updatedChat;
          }
          return chat;
        }));

        // 🆕 If the chat didn't exist in our list, we MUST add it!
        const targetId = userId?.toLowerCase();
        const exists = (chatsRef.current || []).some(chat =>
          chat.id?.toLowerCase() === targetId ||
          chat.contact?.id?.toLowerCase() === targetId
        );

        if (!exists && (status === 'pending_received' || status === 'pending_sent')) {
          console.log('[ShadowTalk] Adding missing chat from broadcast:', targetId);
          loginMockUser(userRef.current?.name, userRef.current?.id, userRef.current?.phrase, true);
        }
      })
      .on('broadcast', { event: 'CALL_STATUS_UPDATE' }, (payload) => {
        const { messageId, status, text, duration } = payload.payload;
        console.log('[ShadowTalk] Real-time CALL_STATUS_UPDATE received:', messageId, status);

        const callStore = useCallStore.getState();
        if (callStore.isCalling) {
           const currentStatus = String(status).toUpperCase();
           if (['MISSED', 'CANCELLED', 'REJECTED', 'ENDED', 'BUSY', 'DECLINED'].includes(currentStatus)) {
              if (callService.callSessionId === messageId || !callService.callSessionId) {
                 console.log('[ShadowTalk] Terminating call due to broadcast terminal status:', currentStatus);
                 callService.cleanup();
              }
           }
        }

        setChats(prev => prev.map(chat => ({
          ...chat,
          messages: (chat.messages || []).map(m => {
            if (m.id === messageId) {
              // 🛡️ TERMINAL STATE GUARD: Don't allow a call to move out of a finished state
              const curStatus = String(m.status || m.metadata?.status || '').toUpperCase();
              if (['REJECTED', 'ENDED', 'MISSED', 'CANCELLED'].includes(curStatus) && status.toUpperCase() === 'CALLING') {
                return m;
              }

              return { 
                ...m, 
                status, 
                text: text || m.text, 
                duration: duration !== undefined ? duration : m.duration,
                metadata: { ...(m.metadata || {}), status },
                lastActivity: Date.now() 
              };
            }
            return m;
          })
        })));
      })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'messages'
      }, async (payload) => {
      // 1. Handle Deletions first
      if (payload.eventType === 'DELETE') {
        const deletedId = payload.old?.id;
        if (!deletedId) return;

        console.log('[ShadowTalk] Global real-time deletion:', deletedId);
        setChats(prev => prev.map(chat => ({
          ...chat,
          messages: (chat.messages || []).filter(m => m.id !== deletedId)
        })));
        return;
      }

      const msg = payload.new || payload.old;
      if (!msg) return;

      console.log(`[ShadowTalk] REAL-TIME EVENT: ${payload.eventType} on message ${msg.id}`, {
        chat_id: msg.chat_id,
        sender_id: msg.sender_id,
        payload_new: payload.new
      });

      const chatId = msg.chat_id;
      const senderId = msg.sender_id;
      const myId = userRef.current?.id?.toLowerCase();
      const myShadowId = userRef.current?.shadowId?.toLowerCase();

      if (!myId) {
        console.warn('[ShadowTalk] Real-time event ignored: My user ID is not yet set.');
        return;
      }

      // [CRITICAL PRIVACY FIX]
      // Determine if this message is actually intended for me.
      const isGroup = chatId?.toLowerCase()?.startsWith('group_');
      let isForMe = false;

      if (isGroup) {
        // Group: Check if I am a member of this group
        const currentGroupChat = (chatsRef.current || []).find(c => String(c.id).toLowerCase() === chatId.toLowerCase());
        isForMe = currentGroupChat &&
          currentGroupChat.status !== 'removed' &&
          (currentGroupChat.adminId?.toLowerCase() === myId || (currentGroupChat.members || []).some(m => m && (String(m.id).toLowerCase() === myId || (myShadowId && m.shadowId && String(m.shadowId).toLowerCase() === myShadowId))));
      } else {
        // Direct: I must be either the sender or the recipient
        isForMe = senderId.toLowerCase() === myId ||
          chatId.toLowerCase() === myId ||
          (myShadowId && chatId.toLowerCase() === myShadowId);
      }

      if (!isForMe) {
        console.log('[ShadowTalk] Event dropped: Message is not for me.', { chatId, senderId, myId });
        return;
      }

      // [FIX] Determine the correct local chat ID for routing.
      // For direct chats, the DB chat_id is always the RECIPIENT.
      // If we are the recipient, the local chat ID is the SENDER.
      // For system messages, extract partnerId if available in the content.
      let systemGid = chatId.toLowerCase();
      if (senderId === 'system') {
        try {
          const parsed = msg.content ? (typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content) : null;
          if (parsed?.partnerId) {
            systemGid = parsed.partnerId.toLowerCase();
          }
        } catch (e) {
          console.warn('[ShadowTalk] Failed to parse system message content for routing:', e);
        }
      }

      const gid = isGroup ? chatId.toLowerCase() :
        (senderId.toLowerCase() === myId ? chatId.toLowerCase() :
          (senderId === 'system' ? systemGid : senderId.toLowerCase()));

      // 1. BLOCKING CHECK: Ignore messages from blocked contacts
      const currentChat = (chatsRef.current || []).find(c => String(c.id).toLowerCase() === gid);


      if (currentChat && senderId !== userRef.current?.id) {
        const isDeleted = currentChat.status === 'deleted' || currentChat.chat_data?.status === 'deleted';
        const isBlocked = currentChat.isBlocked || currentChat.chat_data?.isBlocked;
        const isBlockedByOther = currentChat.isBlockedByOther || currentChat.chat_data?.isBlockedByOther;

        if (isBlocked || isBlockedByOther || isDeleted) {
          console.log('[ShadowTalk] Ignoring message from blocked or deleted contact:', senderId);
          return;
        }
      }

      // 2. GROUP MEMBERSHIP CHECK
      if (chatId.startsWith('group_')) {
        const isParticipant = currentChat && (
          currentChat.status !== 'removed' &&
          (currentChat.members || []).some(m => m && (String(m.id).toLowerCase() === userRef.current?.id?.toLowerCase() || (userRef.current?.shadowId && m.shadowId && String(m.shadowId).toLowerCase() === String(userRef.current?.shadowId).toLowerCase())))
        );

        const isRemoved = currentChat?.status === 'removed';
        const removedAt = currentChat?.removedAt;
        const msgTime = new Date(msg.created_at).getTime();

        if (isRemoved && removedAt && msgTime > removedAt + 1000) {
          console.log('[ShadowTalk] Ignoring group message: User has left', chatId);
          return;
        }

        if (!isParticipant && currentChat?.adminId !== userRef.current?.id) {
          // If not a participant and not the admin, check if this is a join/leave notification
          const content = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;
          if (content?.type !== 'notification') {
            console.log('[ShadowTalk] Ignoring group message: Not a participant in', chatId);
            // Trigger a background refresh to see if we were just added
            const now = Date.now();
            if (!lastSyncRef.current || now - lastSyncRef.current > 10000) {
              lastSyncRef.current = now;
              loginMockUser(userRef.current?.name, userRef.current?.id, userRef.current?.phrase, true); // 🚀 SILENT: Discovery refresh
            }
            return;
          }
        }
      }

      // Parse content early to avoid issues with string/object mismatch from Supabase
      const msgContent = msg.content ? (typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content) : null;
      const isCallUpdate = payload.eventType === 'UPDATE' && msgContent?.type === 'call';

      if ((payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') && msgContent) {
        const content = msgContent;
        const metadata = content.metadata;

        // Handle Metadata Updates (Name/Photo/Pins) via Broadcast
        if (metadata?.isMetadataUpdate && metadata.updates) {
          const updates = metadata.updates;
          const gid = msg.chat_id;
          const targetChatId = (metadata.partnerId && msg.sender_id.toLowerCase() !== userRef.current?.id?.toLowerCase())
            ? metadata.partnerId.toLowerCase()
            : gid.toLowerCase();

          // Update local state immediately
          setChats(prev => prev.map(c => {
            const cid = String(c.id).toLowerCase().trim();
            const g_id = String(gid).toLowerCase().trim();
            const t_id = String(targetChatId).toLowerCase().trim();
            
            if (cid === g_id || cid === t_id) {
              console.log('[ShadowTalk] Metadata sync applying to:', c.id, updates);
              return { ...c, ...updates, lastActivity: Date.now() };
            }
            return c;
          }));

          // 🔐 Save to DB if it's a metadata update or discovery
          // Use metadata.partnerId if available, otherwise fallback to gid
          const currentChat = (chatsRef.current || []).find(c => c && c.id?.toLowerCase() === targetChatId);

          if (currentChat) {
            console.log('[ShadowTalk] Received metadata sync, applying locally (DB sync handled by sender):', targetChatId, updates);
            // We NO LONGER blind-upsert the entire chat object here!
            // The sender already updated the chats table for everyone.
            // Blindly upserting our local state here causes race conditions that overwrite recent member additions!
          }
        }

        // 3. New Member Discovery from System Message
        if (msg.sender_id === 'system' || content?.senderId === 'system') {
          const isAddedMe = content?.addedId?.toLowerCase() === userRef.current?.id?.toLowerCase() ||
            content?.addedId?.toLowerCase() === userRef.current?.shadowId?.toLowerCase();

          if (isAddedMe && content?.groupMetadata) {
            console.log('[ShadowTalk] Auto-discovering group from join message:', msg.chat_id);
            const metadata = content.groupMetadata;
            setChats(prev => {
              if (prev.some(c => c.id.toLowerCase() === msg.chat_id.toLowerCase())) return prev;
              const newGroup = { ...metadata, messages: [msg] };

              // Save to DB immediately
              supabase.from('chats').upsert({
                owner_id: userRef.current?.id.toLowerCase(),
                chat_id: msg.chat_id.toLowerCase(),
                chat_data: newGroup
              }, { onConflict: 'owner_id, chat_id' });

              return [newGroup, ...prev];
            });
          } else if (content?.groupMetadata && content?.groupMetadata?.members) {
            // If someone ELSE was added, sync our local members array to match the admin's!
            setChats(prev => prev.map(c => {
              if (c.id.toLowerCase() === msg.chat_id.toLowerCase()) {
                const updatedChat = { ...c, members: content.groupMetadata.members };
                // Also auto-heal our DB record so it has the full members list
                supabase.from('chats').upsert({
                  owner_id: userRef.current?.id.toLowerCase(),
                  chat_id: msg.chat_id.toLowerCase(),
                  chat_data: updatedChat
                }, { onConflict: 'owner_id, chat_id' });
                return updatedChat;
              }
              return c;
            }));
          }
        }

        // Handle Notifications
        if (msg.sender_id !== userRef.current?.id) {
          if (msg.sender_id === 'system') return; // Silent for system notifications

          // CRITICAL: Only notify if the message is explicitly FOR ME 
          const isDirect = !chatId.startsWith('group_');
          let isForMe = false;

          if (isDirect) {
            isForMe = chatId.toLowerCase() === userRef.current?.id.toLowerCase() ||
              chatId.toLowerCase() === userRef.current?.shadowId.toLowerCase();
          } else {
            // Group: Only notify if we are still a participant
            isForMe = currentChat &&
              currentChat.status !== 'removed' &&
              (currentChat.adminId?.toLowerCase() === userRef.current?.id.toLowerCase() || (currentChat.members || []).some(m => m && (String(m.id).toLowerCase() === userRef.current?.id.toLowerCase() || (userRef.current?.shadowId && m.shadowId && String(m.shadowId).toLowerCase() === String(userRef.current?.shadowId).toLowerCase()))));
          }

          if (!isForMe) return;

          if (currentChat) {
            const type = currentChat.notificationType || 'All Messages';
            const isMuted = currentChat.muteUntil && currentChat.muteUntil > Date.now();
            const isIndefiniteMute = type === 'Mute' && !currentChat.muteUntil;

            if (!isMuted && !isIndefiniteMute) {
              let shouldNotify = false;
              if (type === 'All Messages') {
                shouldNotify = true;
              } else if (type === 'Mentions Only') {
                try {
                  const text = decrypt(content.text, chatId);
                  const mentionTag = `@${userRef.current?.name}`;
                  if (text && text.includes(mentionTag)) {
                    shouldNotify = true;
                  }
                } catch (e) {
                  console.error('Mention check error:', e);
                }
              }

              if (shouldNotify) {
                // Try multiple sources for the name to avoid 'undefined'
                const senderName = currentChat.name ||
                  currentChat.contact?.name ||
                  currentChat.chat_data?.name ||
                  currentChat.chat_data?.contact?.name ||
                  'Someone';

                let notifyText = 'New message';
                const isCall = msg.content?.type === 'call';

                if (isCall && payload.eventType === 'INSERT' && msg.sender_id !== userRef.current?.id) {
                  const store = useCallStore.getState();
                  if (!store.isCalling) {
                    const callerInfo = {
                      id: msg.sender_id,
                      name: senderName,
                      avatarUrl: currentChat?.avatarUrl || currentChat?.contact?.avatarUrl
                    };
                    callService.handleIncomingCall({
                      from: msg.sender_id,
                      channelName: msg.content.metadata?.channelName || `call_${msg.sender_id}_fallback`,
                      callType: msg.content.metadata?.call_type || 'audio',
                      callSessionId: msg.id,
                      callerInfo: callerInfo
                    });
                  }
                }

                if (isCallUpdate || isCall) {
                  const status = String(msg.content.status || msg.content.metadata?.status || '').toUpperCase();
                  if (status === 'MISSED') notifyText = 'Missed call';
                  else if (status === 'DECLINED' || status === 'BUSY' || status === 'REJECTED') notifyText = 'Declined call';
                  else if (status === 'RINGING' || status === 'CALLING') notifyText = 'Incoming audio call';
                  else if (status === 'ONGOING' || status === 'ACCEPTED') notifyText = 'Call started';
                  else if (status === 'COMPLETED' || status === 'ENDED') notifyText = 'Call ended';
                  else if (status === 'CANCELLED') notifyText = 'Cancelled call';
                  else if (isCall) notifyText = 'Incoming audio call';
                  else return;

                  if (isCallUpdate) {
                     const termStates = ['MISSED', 'CANCELLED', 'REJECTED', 'ENDED', 'BUSY', 'DECLINED', 'COMPLETED'];
                     if (termStates.includes(status)) {
                        const store = useCallStore.getState();
                        if (store.isCalling) {
                           console.log('[ShadowTalk] Terminating call due to DB terminal status:', status);
                           callService.cleanup();
                        }
                     }
                  }
                } else {
                  notifyText = 'New message';
                }

                const callStore = useCallStore.getState();
                if (!(isCallUpdate && callStore.isCalling)) {
                  showToast(`${notifyText} from ${senderName}`, 'info');
                }
              }
            }
          }
        }

        // Handle Profile/Metadata Sync via Message (Seamless Real-time)
        if (content?.type === 'profile_sync' || (metadata?.isMetadataUpdate && metadata.updates)) {
          const syncId = content?.userId || metadata?.userId;
          const syncUpdates = content?.updates || metadata?.updates;
          const syncShadowId = content?.shadowId || metadata?.shadowId;

          if (syncId && syncUpdates) {
            const tid = syncId.toLowerCase();
            const sid = syncShadowId?.toLowerCase();
            const myId = userRef.current?.id?.toLowerCase();

            // Sync MY profile if it's me (multi-tab)
            if (tid === myId || (sid && sid === userRef.current?.shadowId?.toLowerCase())) {
              setUser(prev => ({ ...prev, ...syncUpdates }));
            }

            setChats(prev => prev.map(chat => {
              const isMatch = (tid && (chat.id?.toLowerCase() === tid || chat.contact?.id?.toLowerCase() === tid || chat.contact?.shadowId?.toLowerCase() === tid)) ||
                (sid && (chat.id?.toLowerCase() === sid || chat.contact?.id?.toLowerCase() === sid || chat.contact?.shadowId?.toLowerCase() === sid));

              if (isMatch) {
                const updatedContact = { ...chat.contact, ...syncUpdates };
                if (syncUpdates.name) updatedContact.name = syncUpdates.name;
                if (syncUpdates.avatarUrl) updatedContact.avatar_url = syncUpdates.avatarUrl;

                const updatedChat = { ...chat, contact: updatedContact };
                if (chat.type === 'direct' && syncUpdates.name) updatedChat.name = syncUpdates.name;

                supabase.from('chats').update({ chat_data: updatedChat })
                  .match({ owner_id: userRef.current?.id?.toLowerCase(), chat_id: chat.id.toLowerCase() });

                return updatedChat;
              }

              if (chat.type === 'group' && chat.members) {
                const hasMember = chat.members.some(m => (tid && m.id?.toLowerCase() === tid) || (sid && m.id?.toLowerCase() === sid));
                if (hasMember) {
                  const updatedMembers = chat.members.map(m => {
                    const mMatch = (tid && m.id?.toLowerCase() === tid) || (sid && m.id?.toLowerCase() === sid);
                    return mMatch ? { ...m, ...syncUpdates } : m;
                  });
                  const updatedChat = { ...chat, members: updatedMembers };
                  supabase.from('chats').update({ chat_data: updatedChat })
                    .match({ owner_id: userRef.current?.id?.toLowerCase(), chat_id: chat.id.toLowerCase() });
                  return updatedChat;
                }
              }
              return chat;
            }));
          }
          return; // Don't process as a regular message
        }
      }

      // Handle Regular Message Insertion/Update
      if (msgContent && !msgContent.metadata?.isMetadataUpdate) {
        let decryptedMsg;
        try {
          decryptedMsg = {
            ...msgContent,
            id: msg.id,
            senderId: msg.sender_id,
            status: msgContent.status || msgContent.metadata?.status || msg.status, // Priority to content status
            timestamp: new Date(msg.created_at).getTime(),
            deleteAt: msg.delete_at,
            text: decrypt(msgContent.text, msg.chat_id.toLowerCase()),
            dbChatId: msg.chat_id.toLowerCase()
          };

          // Decrypt reply reference if present
          // Decrypt reply reference if present
          if (decryptedMsg.replyTo && decryptedMsg.replyTo.text) {
            decryptedMsg.replyTo.text = decrypt(decryptedMsg.replyTo.text, msg.chat_id.toLowerCase());
          }

          // [EFFECTIVE DISAPPEARANCE] If message has no deleteAt but chat has a policy, apply it locally
          if (!decryptedMsg.deleteAt && currentChat?.disappearingConfig?.type === 'Disappear after send') {
            const duration = parseTimer(currentChat.disappearingConfig.timer);
            if (duration > 0) {
              decryptedMsg.deleteAt = decryptedMsg.timestamp + duration;
            }
          }
          if (currentChat?.disappearingConfig?.type === 'Disappear after read') {
            decryptedMsg.deleteAfterRead = true;
            decryptedMsg.disappearDuration = parseTimer(currentChat.disappearingConfig.timer);
          }
        } catch (e) {
          decryptedMsg = { ...messageContent, id: msg.id, senderId: msg.sender_id, timestamp: Date.now() };
        }

        // Live Ticks Auto-Seen & Auto-Delivered on INSERT
        if (payload.eventType === 'INSERT' && msg.sender_id?.toLowerCase() !== myId?.toLowerCase()) {
          const activeChat = (chatsRef.current || chats || []).find(c =>
            String(c.id).toLowerCase() === String(activeChatIdRef.current).toLowerCase() ||
            (c.contact?.id && String(c.contact.id).toLowerCase() === String(activeChatIdRef.current).toLowerCase()) ||
            (c.contact?.shadowId && String(c.contact.shadowId).toLowerCase() === String(activeChatIdRef.current).toLowerCase())
          );
          const isViewingThisChat = activeChat && document.visibilityState === 'visible' && (
            activeChat.id.toLowerCase() === gid ||
            (activeChat.contact?.id && activeChat.contact.id.toLowerCase() === gid) ||
            (activeChat.contact?.shadowId && activeChat.contact.shadowId.toLowerCase() === gid)
          );
          if (!isGroup) {
            if (isViewingThisChat) {
              if (decryptedMsg.status !== 'seen') {
                decryptedMsg.status = 'seen';
                decryptedMsg.read = true;
                if (decryptedMsg.deleteAfterRead && !decryptedMsg.deleteAt) {
                  decryptedMsg.deleteAt = Date.now() + (decryptedMsg.disappearDuration || 3600000);
                }

                const targetStatus = (settingsRef.current?.readReceipts !== false) ? 'seen' : 'delivered';
                const keyToUse = decryptedMsg.dbChatId || gid;
                const dbContent = {
                  ...decryptedMsg,
                  status: targetStatus,
                  read: (targetStatus === 'seen'),
                  text: encrypt(decryptedMsg.text, keyToUse),
                  replyTo: decryptedMsg.replyTo ? {
                    ...decryptedMsg.replyTo,
                    text: encrypt(decryptedMsg.replyTo.text, keyToUse)
                  } : null
                };
                supabase.from('messages').update({ content: dbContent }).eq('id', msg.id).catch(() => {});
                supabase.rpc('append_message_status', { msg_id: msg.id, user_id: myId, status_type: targetStatus }).catch(() => {});

                // Broadcast status back to the sender
                if (chatSubRef.current) {
                  chatSubRef.current.send({
                    type: 'broadcast',
                    event: 'MESSAGE_STATUS_UPDATE',
                    payload: {
                      chatId: myId,
                      readerId: myId,
                      messageIds: [msg.id],
                      status: targetStatus
                    }
                  });
                }

                // Emit "message_seen" socket event to socket.io if read receipts are ON
                if (settingsRef.current?.readReceipts !== false && socketRef.current && socketRef.current.connected) {
                  socketRef.current.emit('message_seen', {
                    messageIds: [msg.id],
                    chatId: gid,
                    senderId: msg.sender_id,
                    receiverId: myId
                  });
                }
              }
            } else {
              if (decryptedMsg.status === 'sent') {
                decryptedMsg.status = 'delivered';
                const keyToUse = decryptedMsg.dbChatId || gid;
                const dbContent = {
                  ...decryptedMsg,
                  text: encrypt(decryptedMsg.text, keyToUse),
                  replyTo: decryptedMsg.replyTo ? {
                    ...decryptedMsg.replyTo,
                    text: encrypt(decryptedMsg.replyTo.text, keyToUse)
                  } : null
                };
                supabase.from('messages').update({ content: dbContent }).eq('id', msg.id).catch(() => {});
                supabase.rpc('append_message_status', { msg_id: msg.id, user_id: myId, status_type: targetStatus }).catch(() => {});

                // Broadcast delivered status back to the sender
                if (chatSubRef.current) {
                  chatSubRef.current.send({
                    type: 'broadcast',
                    event: 'MESSAGE_STATUS_UPDATE',
                    payload: {
                      chatId: myId,
                      readerId: myId,
                      messageIds: [msg.id],
                      status: 'delivered'
                    }
                  });
                }
              }
            }
          } else {
            // Group Chat Live Ticks
            if (isViewingThisChat) {
              console.log(`[ShadowTalk] Marking group message ${msg.id} as seen (live)`);
              const targetStatus = (settingsRef.current?.readReceipts !== false) ? 'seen' : 'delivered';
              supabase.rpc('append_message_status', {
                msg_id: msg.id,
                user_id: myId,
                status_type: targetStatus
              }).then();
            } else {
              console.log(`[ShadowTalk] Marking group message ${msg.id} as delivered (live)`);
              supabase.rpc('append_message_status', {
                msg_id: msg.id,
                user_id: myId,
                status_type: 'delivered'
              }).then();
            }
          }
        }

        setChats(prev => {
          let updated = false;
          const newChats = prev.map(chat => {
            // Note to Self Safety Guard: A chat representing "Note to Self" must only match messages
            // that the user sent to themselves. It should never receive messages from other users or from 'system'.
            const isSelfChat = chat.isSelf === true || chat.id.toLowerCase() === myId || (myShadowId && chat.id.toLowerCase() === myShadowId);
            if (isSelfChat) {
              const isMsgToSelf = senderId.toLowerCase() === myId &&
                                  (chatId.toLowerCase() === myId || (myShadowId && chatId.toLowerCase() === myShadowId));
              if (!isMsgToSelf) return chat;
            }

            const isMatch = chat.id.toLowerCase() === gid ||
                            (chat.contact?.id && chat.contact.id.toLowerCase() === gid) ||
                            (chat.contact?.shadowId && chat.contact.shadowId.toLowerCase() === gid);
            if (isMatch) {
              // [PRIVACY] Filter out if message was deleted for me
              if (chat.deletedForMe?.includes(msg.id)) return chat;

              updated = true;
              const existingMsgs = chat.messages || [];
              const idx = existingMsgs.findIndex(m => m.id === msg.id);

              let updatedMessages;
              if (idx >= 0) {
                console.log(`[ShadowTalk] Updating existing message ${msg.id} in chat ${gid}. New status: ${decryptedMsg.status}`);
                updatedMessages = [...existingMsgs];
                updatedMessages[idx] = {
                  ...updatedMessages[idx],
                  ...decryptedMsg,
                  reactions: decryptedMsg.reactions || updatedMessages[idx].reactions || {}
                };
              } else {
                console.log(`[ShadowTalk] Adding new message ${msg.id} to chat ${gid}`);
                updatedMessages = [...existingMsgs, decryptedMsg];
              }

              updatedMessages.sort((a, b) => a.timestamp - b.timestamp);

              const newChat = {
                ...chat,
                status: chat.status === 'deleted' ? (chat.type === 'group' ? null : 'direct') : chat.status,
                messages: updatedMessages,
                lastActivity: Math.max(chat.lastActivity || 0, decryptedMsg.timestamp),
                unreadCount: (msg.sender_id !== userRef.current?.id && idx < 0) ? (chat.unreadCount || 0) + 1 : (chat.unreadCount || 0)
              };

              // Persist to DB for this user (async)
              supabase.from('chats').upsert({
                owner_id: userRef.current?.id.toLowerCase(),
                chat_id: gid,
                chat_data: { ...newChat, messages: [] } // Don't store full messages array in blob
              }, { onConflict: 'owner_id, chat_id' });

              return newChat;
            }
            return chat;
          });
          return newChats;
        });
      }
    })
    .subscribe();


    return () => {
      supabase.removeChannel(chatSub);
    };
  }, [user]);

  // Fallback Polling (Every 5 seconds)
  useEffect(() => {
    if (!user?.id) return;

    const interval = setInterval(() => {
      if (userRef.current && navigator.onLine) {
        loginMockUser(userRef.current.name, userRef.current.id, userRef.current.phrase, true);
      }
    }, 30000); // Check every 30 seconds instead of 5s

    return () => clearInterval(interval);
  }, [user?.id]);

  // --- End-to-End Encryption Helpers ---
  const getChatKey = (chatId) => {
    // For direct chats, the key is derived from the sorted IDs of both users
    // For groups, it's the group ID itself. This is a simplified E2EE simulation.
    return chatId;
  };

  const encrypt = (text, key) => {
    if (!text) return text;
    try {
      const prefix = "🔐e2ee_";
      // UTF-8 friendly Base64 encoding
      const utf8Text = unescape(encodeURIComponent(text));
      const encoded = btoa(utf8Text);
      return prefix + encoded;
    } catch (e) {
      console.error('[ShadowTalk] Encryption error:', e);
      return text;
    }
  };

  const decrypt = (text, key) => {
    if (!text || typeof text !== 'string' || !text.startsWith("🔐e2ee_")) return text;
    try {
      const encoded = text.replace("🔐e2ee_", "");
      const utf8Text = atob(encoded);
      return decodeURIComponent(escape(utf8Text));
    } catch (e) {
      console.error('[ShadowTalk] Decryption error:', e);
      return "[Decryption Error]";
    }
  };

  const decryptChat = (chat) => {
    if (!chat || !chat.messages) return chat;
    return {
      ...chat,
      messages: chat.messages.map(m => ({
        ...m,
        text: decrypt(m.text, chat.id),
        media: m.media || null, // Explicitly preserve media
        replyTo: m.replyTo ? {
          ...m.replyTo,
          text: decrypt(m.replyTo.text, chat.id)
        } : null
      }))
    };
  };
  const chatWithEncryptedMessages = (chat) => {
    if (!chat || !chat.messages) return chat;
    return {
      ...chat,
      messages: chat.messages.map(m => ({
        ...m,
        text: encrypt(m.text, chat.id),
        replyTo: m.replyTo ? {
          ...m.replyTo,
          text: encrypt(m.replyTo.text, chat.id)
        } : null
      }))
    };
  };
  // ---------------------------------------

  // ---------------------------------------
  // ---------------------------------------

  const parseTimer = (timerStr) => {
    if (!timerStr || timerStr === 'Off') return 0;
    const val = parseInt(timerStr);
    if (isNaN(val)) return 0; // 🛡️ Safety: handle non-numeric inputs
    if (timerStr.includes('minute')) return val * 60000;
    if (timerStr.includes('hour')) return val * 3600000;
    if (timerStr.includes('day')) return val * 86400000;
    if (timerStr.includes('week')) return val * 604800000;
    return 0;
  };

  // Background cleanup for disappearing messages
  useEffect(() => {
    if (!user?.id || chats.length === 0) return;

    const interval = setInterval(async () => {
      const now = Date.now();
      let anyChanged = false;
      const newChats = [];

      for (const chat of chats) {
        const expiredMessages = chat.messages.filter(m => m.deleteAt && m.deleteAt <= now);
        if (expiredMessages.length > 0) {
          anyChanged = true;

          // Delete from atomic messages table
          const messageIds = expiredMessages.map(m => m.id);
          supabase.from('messages').delete().in('id', messageIds).catch(err => console.error('Disappear delete error:', err));

          const updatedChat = {
            ...chat,
            messages: chat.messages.filter(m => !(m.deleteAt && m.deleteAt <= now))
          };
          newChats.push(updatedChat);
        } else {
          newChats.push(chat);
        }
      }

      if (anyChanged) {
        setChats(newChats);
      }
    }, 2000); // Check every 2 seconds for smooth UI updates

    return () => clearInterval(interval);
  }, [user?.id, chats]);

  // Global Auto-Unmute Loop
  useEffect(() => {
    if (!user?.id || chats.length === 0) return;

    const interval = setInterval(() => {
      const now = Date.now();
      let anyChanged = false;
      const updatedChats = chats.map(chat => {
        if (chat.muteUntil && chat.muteUntil <= now) {
          anyChanged = true;
          const updated = {
            ...chat,
            notificationType: 'All Messages',
            muteUntil: null,
            lastActivity: Date.now()
          };

          // Persistence (Async)
          updateChatSettings(chat.id, { notificationType: 'All Messages', muteUntil: null });
          return updated;
        }
        return chat;
      });

      if (anyChanged) {
        setChats(updatedChats);
      }
    }, 5000); // Check every 5 seconds for efficiency

    return () => clearInterval(interval);
  }, [user?.id, chats]);

  const generateRecoveryPhrase = () => {
    const wordList = ['abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract', 'absurd', 'abuse', 'access', 'account', 'accuse', 'achieve', 'acid', 'acoustic', 'acquire', 'across', 'act', 'action', 'actor', 'actress', 'actual', 'adapt', 'add', 'addict', 'address', 'adjust', 'admit', 'adult', 'advance', 'advice', 'aerobic', 'affair', 'afford', 'afraid', 'again', 'age', 'agent', 'agree', 'ahead', 'aim', 'air', 'airport', 'aisle', 'alarm', 'album', 'alcohol', 'alert', 'alien', 'all', 'alley', 'allow', 'almost', 'alone', 'alpha', 'already', 'also', 'alter', 'always', 'amaze', 'ambush', 'amount', 'amuse', 'analogy', 'analyze', 'anchor', 'ancient', 'anger', 'angle', 'angry', 'animal', 'ankle', 'announce', 'annual', 'another', 'answer', 'antenna', 'antique', 'anxiety', 'any', 'apart', 'apology', 'appear', 'apple', 'approve', 'april', 'arch', 'arctic', 'area', 'arena', 'argue', 'arm', 'armed', 'armor', 'army', 'around', 'arrange', 'arrest', 'arrive', 'arrow', 'art', 'artefact', 'artist', 'artwork', 'ask', 'aspect', 'assault', 'asset', 'assist', 'assume', 'asthma', 'athlete', 'atom', 'attack', 'attend', 'attitude', 'attract', 'auction', 'audit', 'august', 'aunt', 'author', 'auto', 'autumn', 'average', 'avocado', 'avoid', 'awake', 'aware', 'away', 'awesome', 'awful', 'awkward', 'axis', 'baby', 'bachelor', 'bacon', 'badge', 'bag', 'balance', 'balcony', 'ball', 'bamboo', 'banana', 'banner', 'bar', 'bare', 'bargain', 'barrel', 'base', 'basic', 'basket', 'battle', 'beach', 'bean', 'beauty', 'because', 'become', 'beef', 'before', 'begin', 'behave', 'behind', 'believe', 'below', 'belt', 'bench', 'benefit', 'best', 'betray', 'better', 'between', 'beyond', 'bicycle', 'bid', 'bike', 'bind', 'biology', 'bird', 'birth', 'bitter', 'black', 'blade', 'blame', 'blanket', 'blast', 'bleak', 'bless', 'blind', 'blood', 'blossom', 'blouse', 'blue', 'blur', 'blush', 'board', 'boat', 'body', 'boil', 'bomb', 'bone', 'bonus', 'book', 'boost', 'border', 'boring', 'borrow', 'boss', 'bottom', 'bounce', 'box', 'boy', 'bracket', 'brain', 'brand', 'brass', 'brave', 'bread', 'breeze', 'brick', 'bridge', 'brief', 'bright', 'bring', 'brisk', 'broccoli', 'broken', 'bronze', 'broom', 'brother', 'brown', 'brush', 'bubble', 'buddy', 'budget', 'buffalo', 'build', 'bulb', 'bulk', 'bullet', 'bundle', 'bunker', 'burden', 'burger', 'burst', 'bus', 'business', 'busy', 'butter', 'buyer', 'buzz', 'cabbage', 'cabin', 'cable', 'cactus', 'cage', 'cake', 'call', 'calm', 'camera', 'camp', 'can', 'canal', 'cancel', 'candy', 'cannon', 'canoe', 'canvas', 'canyon', 'capable', 'capital', 'captain', 'caption', 'car', 'carbon', 'card', 'cargo', 'carpet', 'carry', 'cart', 'case', 'cash', 'casino', 'castle', 'casual', 'cat', 'catalog', 'catch', 'category', 'cattle', 'caught', 'cause', 'caution', 'cave', 'ceiling', 'celery', 'cement', 'census', 'century', 'cereal', 'certain', 'chair', 'chalk', 'champion', 'change', 'chaos', 'chapter', 'charge', 'chase', 'chat', 'cheap', 'check', 'cheese', 'chef', 'cherry', 'chest', 'chicken', 'chief', 'child', 'chimney', 'choice', 'choose', 'chronic', 'chuckle', 'chunk', 'churn', 'cigar', 'cinema', 'circle', 'citizen', 'city', 'civil', 'claim', 'clap', 'clarify', 'claw', 'clay', 'clean', 'clerk', 'clever', 'click', 'client', 'cliff', 'climb', 'clinic', 'clip', 'clock', 'clog', 'close', 'cloth', 'cloud', 'clown', 'club', 'clump', 'cluster', 'clutch', 'coach', 'coast', 'coconut', 'code', 'coffee', 'coil', 'coin', 'collect', 'color', 'column', 'combine', 'come', 'comfort', 'comic', 'common', 'company', 'compass', 'compete', 'confirm', 'congo', 'connect', 'consider', 'control', 'convince', 'cook', 'cool', 'copper', 'copy', 'coral', 'core', 'corn', 'correct', 'cost', 'cotton', 'couch', 'country', 'couple', 'course', 'cousin', 'cover', 'coyote', 'crack', 'cradle', 'craft', 'cram', 'crane', 'crash', 'crater', 'crawl', 'crazy', 'cream', 'credit', 'creek', 'crew', 'cricket', 'crime', 'crisp', 'critic', 'crocodile', 'romance', 'rough', 'route', 'royal', 'rubber', 'rude', 'rugby', 'rule', 'run', 'runway', 'rural', 'sad', 'saddle', 'sadness', 'safe', 'sail', 'salad', 'salmon', 'salon', 'salt', 'salute', 'same', 'sample', 'sand', 'satisfy', 'satoshi', 'sauce', 'sausage', 'save', 'say', 'scale', 'scan', 'scare', 'scatter', 'scene', 'scheme', 'school', 'science', 'scissors', 'scorpion', 'scout', 'scrap', 'screen', 'script', 'scrub', 'sea', 'search', 'season', 'seat', 'second', 'secret', 'section', 'security', 'seed', 'seek', 'segment', 'select', 'sell', 'seminar', 'senior', 'sense', 'sentence', 'series', 'service', 'session', 'settle', 'setup', 'seven', 'shadow', 'shaft', 'shallow', 'share', 'shed', 'shell', 'sheriff', 'shield', 'shift', 'shine', 'ship', 'shiver', 'shock', 'shoe', 'shoot', 'shop', 'short', 'shoulder', 'shove', 'shrimp', 'shrug', 'shuffle', 'shy', 'sibling', 'sick', 'side', 'siege', 'sight', 'sign', 'silent', 'silk', 'silly', 'silver', 'similar', 'simple', 'since', 'sing', 'siren', 'sister', 'situate', 'six', 'size', 'skate', 'sketch', 'ski', 'skill', 'skin', 'skirt', 'skull', 'slab', 'slam', 'sleep', 'slender', 'slice', 'slide', 'slight', 'slim', 'slogan', 'slot', 'slow', 'slush', 'small', 'smart', 'smile', 'smoke', 'smooth', 'snack', 'snake', 'snap', 'sniff', 'snow', 'soap', 'soccer', 'social', 'sock', 'soda', 'soft', 'solar', 'soldier', 'solid', 'solution', 'solve', 'someone', 'song', 'soon', 'sorry', 'sort', 'soul', 'sound', 'soup', 'source', 'south', 'space', 'spare', 'spatial', 'spawn', 'speak', 'special', 'speed', 'spell', 'spend', 'sphere', 'spice', 'spider', 'spike', 'spin', 'spirit', 'split', 'spoil', 'sponsor', 'spoon', 'sport', 'spot', 'spray', 'spread', 'spring', 'spy', 'square', 'squeeze', 'squirrel', 'stable', 'stadium', 'staff', 'stage', 'stairs', 'stamp', 'stand', 'start', 'state', 'stay', 'steak', 'steel', 'stem', 'step', 'stereo', 'stick', 'still', 'sting', 'stock', 'stomach', 'stone', 'stool', 'story', 'stove', 'strategy', 'street', 'strike', 'strong', 'struggle', 'student', 'stuff', 'stumble', 'style', 'subject', 'submit', 'subway', 'success', 'such', 'sudden', 'suffer', 'sugar', 'suggest', 'suit', 'summer', 'sun', 'sunny', 'sunset', 'super', 'supply', 'support', 'sure', 'surf', 'surge', 'surprise', 'surround', 'survey', 'suspect', 'sustain', 'swallow', 'swamp', 'swap', 'swarm', 'swear', 'sweet', 'swift', 'swim', 'swing', 'switch', 'sword', 'symbol', 'symptom', 'syrup', 'system', 'table', 'tackle', 'tag', 'tail', 'talent', 'talk', 'tank', 'tape', 'target', 'task', 'taste', 'tattoo', 'taxi', 'teach', 'team', 'tell', 'ten', 'tenant', 'tennis', 'tent', 'term', 'test', 'text', 'thank', 'that', 'theme', 'then', 'theory', 'there', 'they', 'thing', 'this', 'thought', 'three', 'thrive', 'throw', 'thumb', 'thunder', 'ticket', 'tide', 'tiger', 'tilt', 'timber', 'time', 'tiny', 'tip', 'tired', 'tissue', 'title', 'toast', 'tobacco', 'today', 'toddler', 'toe', 'together', 'toilet', 'token', 'tomato', 'tomorrow', 'tone', 'tongue', 'tonight', 'tool', 'tooth', 'top', 'topic', 'topple', 'torch', 'tornado', 'tortoise', 'toss', 'total', 'tourist', 'toward', 'tower', 'town', 'toy', 'track', 'trade', 'traffic', 'tragic', 'train', 'transfer', 'trap', 'trash', 'travel', 'tray', 'treat', 'tree', 'trend', 'trial', 'tribe', 'trick', 'trigger', 'trim', 'triple', 'tripod', 'triumph', 'troop', 'tropical', 'trouble', 'truck', 'true', 'truly', 'trumpet', 'trust', 'truth', 'try', 'tube', 'tuition', 'tumble', 'tuna', 'tunnel', 'turkey', 'turn', 'turtle', 'twelve', 'twenty', 'twice', 'twin', 'twist', 'two', 'type', 'typical', 'ugly', 'umbrella', 'unable', 'unaware', 'uncle', 'uncover', 'under', 'undo', 'unfair', 'unfold', 'unhappy', 'uniform', 'unique', 'unit', 'universe', 'unknown', 'unlock', 'until', 'unusual', 'unveil', 'update', 'upgrade', 'uphold', 'upon', 'upper', 'upset', 'urban', 'urge', 'usage', 'use', 'used', 'useful', 'useless', 'usual', 'utility', 'vacant', 'vacuum', 'vague', 'valid', 'valley', 'valve', 'van', 'vanish', 'vapor', 'various', 'vast', 'vault', 'vector', 'vegetable', 'vehicle', 'velvet', 'vendor', 'venture', 'venue', 'verb', 'verify', 'version', 'very', 'vessel', 'veteran', 'viable', 'vibrant', 'vicious', 'victory', 'video', 'view', 'village', 'vintage', 'violin', 'virtual', 'virus', 'visa', 'visit', 'visual', 'vital', 'vivid', 'vocal', 'voice', 'void', 'volcano', 'volume', 'vote', 'voyage', 'wage', 'wagon', 'wait', 'walk', 'wall', 'walnut', 'want', 'warfare', 'warm', 'warrior', 'wash', 'wasp', 'waste', 'water', 'wave', 'way', 'wealth', 'weapon', 'wear', 'weasel', 'weather', 'web', 'wedding', 'weekend', 'weekly', 'weigh', 'weird', 'welcome', 'west', 'wet', 'whale', 'what', 'wheat', 'wheel', 'when', 'where', 'whip', 'whisper', 'wide', 'width', 'wife', 'wild', 'will', 'win', 'window', 'wine', 'wing', 'wink', 'winner', 'winter', 'wire', 'wisdom', 'wise', 'wish', 'witness', 'wolf', 'woman', 'wonder', 'wood', 'wool', 'word', 'work', 'world', 'worry', 'worth', 'wrap', 'wreck', 'wrestle', 'wrist', 'write', 'wrong', 'yard', 'year', 'yellow', 'you', 'young', 'youth', 'zebra', 'zero', 'zone', 'zoo'];
    let phrase = [];
    for (let i = 0; i < 12; i++) {
      const randomIndex = Math.floor(Math.random() * wordList.length);
      phrase.push(wordList[randomIndex]);
    }
    return phrase.join(' ');
  };
  const markIncomingMessagesAsDelivered = async (chatsList, currentUserId = null) => {
    const userId = currentUserId || userRef.current?.id;
    if (!userId) return;
    const myIdLower = userId.toLowerCase();
    
    const promises = [];
    const statusMap = {}; // { chat_id: { seen: [ids], delivered: [ids] } }

    chatsList.forEach(chat => {
      // Direct Chats
      if (chat.type === 'direct' && chat.messages && chat.messages.length > 0) {
        const incomingMessages = chat.messages.filter(m => 
          m.senderId?.toLowerCase() !== myIdLower && 
          (m.status === 'sent' || m.status === 'delivered')
        );
        
        incomingMessages.forEach(m => {
          const isViewingThisChat = activeChatIdRef.current && document.visibilityState === 'visible' && (
            String(activeChatIdRef.current).toLowerCase() === chat.id.toLowerCase() ||
            (chat.contact?.id && String(activeChatIdRef.current).toLowerCase() === chat.contact.id.toLowerCase()) ||
            (chat.contact?.shadowId && String(activeChatIdRef.current).toLowerCase() === chat.contact.shadowId.toLowerCase())
          );
          
          let finalStatus = m.status;
          let shouldUpdateDb = false;
          let dbStatus = m.status;

          if (isViewingThisChat) {
            finalStatus = 'seen';
            if (settingsRef.current?.readReceipts !== false) {
              dbStatus = 'seen';
              shouldUpdateDb = (m.status !== 'seen');
            } else {
              if (m.status === 'sent') {
                dbStatus = 'delivered';
                shouldUpdateDb = true;
              }
            }
          } else {
            if (m.status === 'sent') {
              finalStatus = 'delivered';
              dbStatus = 'delivered';
              shouldUpdateDb = true;
            }
          }
          
          // Only update if status changes
          if (finalStatus !== m.status) {
            const finalRead = finalStatus === 'seen';
            const cid = chat.id.toLowerCase();
            if (!statusMap[cid]) statusMap[cid] = { seen: [], delivered: [] };
            
            if (finalStatus === 'seen' && settingsRef.current?.readReceipts !== false) {
              statusMap[cid].seen.push(m.id);
            } else if (finalStatus === 'delivered') {
              statusMap[cid].delivered.push(m.id);
            } else if (finalStatus === 'seen' && settingsRef.current?.readReceipts === false && m.status === 'sent') {
              statusMap[cid].delivered.push(m.id);
            }
   
            console.log(`[ShadowTalk] Local marking message ${m.id} as ${finalStatus} (DB Status: ${dbStatus})`);
          }

          if (shouldUpdateDb && dbStatus !== m.status) {
            if (chat.type === 'group') {
              promises.push(
                supabase.rpc('append_message_status', {
                  msg_id: m.id,
                  user_id: userId,
                  status_type: dbStatus
                })
              );
            } else {
              promises.push(
                supabase.rpc('append_message_status', {
                  msg_id: m.id,
                  user_id: userId,
                  status_type: dbStatus
                }).catch(() => {})
              );
              
              const dbRead = dbStatus === 'seen';
              const updatedContent = { ...m, status: dbStatus, read: dbRead };
              if (dbRead && m.deleteAfterRead && !m.deleteAt) {
                updatedContent.deleteAt = Date.now() + (m.disappearDuration || 3600000);
              }
              
              const keyToUse = m.dbChatId || chat.id.toLowerCase();
              const encrypted = {
                ...updatedContent,
                text: encrypt(updatedContent.text, keyToUse),
                replyTo: updatedContent.replyTo ? {
                  ...updatedContent.replyTo,
                  text: encrypt(updatedContent.replyTo.text, keyToUse)
                } : null
              };
              promises.push(
                supabase.from('messages').update({ content: encrypted }).eq('id', m.id).catch(() => {})
              );
            }

            // Socket.io emit if B marks message as seen
            if (dbStatus === 'seen' && settingsRef.current?.readReceipts !== false && socketRef.current && socketRef.current.connected) {
              const senderId = chat.contact?.id || chat.id;
              socketRef.current.emit('message_seen', {
                messageIds: [m.id],
                chatId: chat.id,
                senderId: senderId,
                receiverId: userId
              });
            }
          }
        });
      }

      // Group Chats
      if (chat.type === 'group' && chat.messages && chat.messages.length > 0) {
        const incomingMessages = chat.messages.filter(m => 
          m.senderId?.toLowerCase() !== myIdLower &&
          m.type !== 'notification' // Ignore notifications
        );
        
        incomingMessages.forEach(m => {
          const isViewingThisChat = activeChatIdRef.current && document.visibilityState === 'visible' && (
            String(activeChatIdRef.current).toLowerCase() === chat.id.toLowerCase()
          );
          
          // Check if already marked
          const isDelivered = m.deliveredTo && m.deliveredTo.includes(myIdLower);
          const isSeen = m.seenBy && m.seenBy.includes(myIdLower);
          
          if (isViewingThisChat && !isSeen) {
            console.log(`[ShadowTalk] Marking group message ${m.id} as seen`);
            const targetStatus = (settingsRef.current?.readReceipts !== false) ? 'seen' : 'delivered';
            if (targetStatus === 'seen' || !isDelivered) {
              promises.push(
                supabase.rpc('append_message_status', {
                  msg_id: m.id,
                  user_id: myIdLower,
                  status_type: targetStatus
                })
              );
            }
          } else if (!isViewingThisChat && !isDelivered && !isSeen) {
            console.log(`[ShadowTalk] Marking group message ${m.id} as delivered`);
            promises.push(
              supabase.rpc('append_message_status', {
                msg_id: m.id,
                user_id: myIdLower,
                status_type: 'delivered'
              })
            );
          }
        });
      }
    });
    
    // Send status broadcast to senders
    Object.entries(statusMap).forEach(([cid, data]) => {
      const targetChat = chatsList.find(c => c.id.toLowerCase() === cid);
      if (data.seen.length > 0 && chatSubRef.current) {
        chatSubRef.current.send({
          type: 'broadcast',
          event: 'MESSAGE_STATUS_UPDATE',
          payload: {
            chatId: targetChat?.type === 'group' ? cid : myIdLower,
            readerId: myIdLower,
            messageIds: data.seen,
            status: 'seen'
          }
        });
      }
      if (data.delivered.length > 0 && chatSubRef.current) {
        chatSubRef.current.send({
          type: 'broadcast',
          event: 'MESSAGE_STATUS_UPDATE',
          payload: {
            chatId: targetChat?.type === 'group' ? cid : myIdLower,
            readerId: myIdLower,
            messageIds: data.delivered,
            status: 'delivered'
          }
        });
      }
    });
 
    // Update local setChats directly so receiver's UI is immediate
    setChats(prev => prev.map(chat => {
      const cid = chat.id.toLowerCase();
      return {
        ...chat,
        messages: (chat.messages || []).map(m => {
          const isFromMe = m.senderId?.toLowerCase() === myIdLower;
          if (isFromMe) return m;

          const isViewingThisChat = activeChatIdRef.current && document.visibilityState === 'visible' && (
            String(activeChatIdRef.current).toLowerCase() === chat.id.toLowerCase() ||
            (chat.contact?.id && String(activeChatIdRef.current).toLowerCase() === chat.contact.id.toLowerCase()) ||
            (chat.contact?.shadowId && String(activeChatIdRef.current).toLowerCase() === chat.contact.shadowId.toLowerCase())
          );

          if (isViewingThisChat) {
            const targetStatus = settingsRef.current?.readReceipts !== false ? 'seen' : 'delivered';
            return { ...m, status: targetStatus, read: targetStatus === 'seen' };
          } else {
            if (m.status === 'sent') {
              return { ...m, status: 'delivered', read: false };
            }
          }
          return m;
        })
      };
    }));

    if (promises.length > 0) {
      try {
        await Promise.all(promises);
        console.log(`[ShadowTalk] Processed ${promises.length} messages status updates on startup.`);
      } catch (err) {
        console.error('[ShadowTalk] Error delivering/seen messages on startup:', err);
      }
    }
  };

  const loginMockUser = async (customName, customId, customPhrase, silent = false) => {
    if (!silent) {
      // Full login: clear all previous session state immediately so no data
      // from the old account leaks into the new one during the async load.
      setChats([]);
      chatsRef.current = [];
      setRequests([]);
      setTypingUsers({});
      setIsLoading(true);
    }
    const inputId = (customId || '').trim().toLowerCase();
    try {
      if (!navigator.onLine) {
        console.log('[ShadowTalk] Offline mode detected in loginMockUser');
        const storedUser = localStorage.getItem('shadowtalk_user');
        if (storedUser) {
          const u = JSON.parse(storedUser);
          if (u && (u.id === inputId || u.shadowId === inputId)) {
            setUser(u);
            setIsLoading(false);
            return true;
          }
        }
      }
      // Search by DB id OR shadow_id OR name to be flexible
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .or(`id.eq."${inputId}",shadow_id.eq."${inputId}"`)
        .single();

      if (error || !data) {
        setIsLoading(false);
        return false;
      }

      console.log('[ShadowTalk] loginMockUser starting for:', inputId);
      // Use the DB id as the short alias, shadow_id as the display hex
      // NO migration — the short alias (id) is the permanent DB PK
      const shortId = (data?.id || inputId).toLowerCase();
      const shadowHex = (data?.shadow_id || inputId).toLowerCase();
      console.log('[ShadowTalk] Identified user session:', { shortId, shadowHex });

      setUser({
        id: shortId,         // The actual DB primary key (e.g., 'shivanshi', 'm1')
        shortId: shortId,    // Same — kept for compatibility
        shadowId: shadowHex, // The long hex for display / QR code
        name: data?.name || customName || 'Anonymous User',
        phrase: data?.recovery_key || customPhrase || generateRecoveryPhrase(),
        avatarUrl: data?.avatar_url || null
      });

      // Reset app lock for new session
      setSettings(prev => ({ ...prev, lockApp: false }));


      // Fetch previous chats from Supabase using both short alias and full Shadow ID
      // We include inputId (raw case) to ensure we find records created with mixed-case aliases
      const { data: chatData, error: chatError } = await supabase
        .from('chats')
        .select('*')
        .or(`owner_id.eq."${shortId}",owner_id.eq."${shadowHex}",owner_id.eq."${inputId}"`);

      if (chatError) {
        console.error('[ShadowTalk] Chat fetch error:', chatError);
      }
      console.log('[ShadowTalk] Chats found in DB:', chatData?.length || 0);

      if (chatData && chatData.length > 0) {
        // Intercept settings_privacy
        const settingsRow = chatData.find(item => String(item.chat_id).toLowerCase().trim() === 'settings_privacy');
        if (settingsRow && settingsRow.chat_data) {
          console.log('[ShadowTalk] Privacy settings loaded from DB:', settingsRow.chat_data);
          setSettingsState(prev => ({
            ...prev,
            readReceipts: settingsRow.chat_data.readReceipts !== false,
            voiceVideo: settingsRow.chat_data.voiceVideo !== false,
            typingIndicators: settingsRow.chat_data.typingIndicators !== false
          }));
        } else {
          // If no settings row is found, we should upsert a default row to persist it initially!
          console.log('[ShadowTalk] No privacy settings row found. Creating default in DB...');
          supabase.from('chats').upsert({
            owner_id: shortId.toLowerCase(),
            chat_id: 'settings_privacy',
            chat_data: { readReceipts: true, voiceVideo: true, typingIndicators: true, lastUpdated: Date.now() }
          }, { onConflict: 'owner_id, chat_id' }).then();
        }

        const chatsMap = new Map();

        // Group by chat_id to identify duplicates and filter out settings_privacy
        chatData.forEach(item => {
          if (item.chat_data) {
            const cid = (item.chat_id || item.chat_data.id || '').toString().toLowerCase().trim();
            if (cid && cid !== 'settings_privacy') {
              if (!chatsMap.has(cid)) {
                chatsMap.set(cid, []);
              }
              chatsMap.get(cid).push(item);
            }
          }
        });

        const mergedChats = [];
        const contactIds = new Set();

        for (const [cid, records] of chatsMap.entries()) {
          let chatToMerge;
          if (records.length > 1) {
            // Rule 13: Sort by activity but prioritize records that actually HAVE members
            // Rule: Prioritize status (pending wins) and then lastActivity
            records.sort((a, b) => {
              const statusWeight = (s) => (s === 'pending_sent' || s === 'pending_received') ? 2 : (s === 'direct' ? 1 : 0);
              const weightA = statusWeight(a.chat_data?.status);
              const weightB = statusWeight(b.chat_data?.status);
              if (weightA !== weightB) return weightB - weightA;
              return (b.chat_data?.lastActivity || 0) - (a.chat_data?.lastActivity || 0);
            });
            chatToMerge = { ...records[0].chat_data, dbRowId: records[0].id };

            chatToMerge = { ...records[0].chat_data, dbRowId: records[0].id };
          } else {
            chatToMerge = { ...records[0].chat_data, dbRowId: records[0].id };
          }
          if (chatToMerge) {
            const chatFinal = decryptChat(chatToMerge);
            if (!chatFinal.id) chatFinal.id = cid; // Ensure ID is present

            // Ensure avatar properties are cross-mapped
            if (chatFinal.avatar_url && !chatFinal.avatarUrl) chatFinal.avatarUrl = chatFinal.avatar_url;
            if (chatFinal.avatarUrl && !chatFinal.avatar_url) chatFinal.avatar_url = chatFinal.avatarUrl;

            mergedChats.push(chatFinal);
          }

          const chatFinal = mergedChats[mergedChats.length - 1];
          if (chatFinal?.status === 'removed') {
            console.log('[AppContext] Merging removed chat:', {
              id: chatFinal.id,
              status: chatFinal.status,
              type: chatFinal.type
            });
          }

          // Collect contact IDs for profile sync
          const chat = mergedChats[mergedChats.length - 1];
          if (chat.type === 'direct') {
            contactIds.add(chat.id);
          } else if (chat.members && Array.isArray(chat.members)) {
            chat.members.forEach(m => m && m.id && contactIds.add(m.id));
          }
        }

        // Sync with latest user profiles
        if (contactIds.size > 0) {
          const idList = Array.from(contactIds).filter(cid => !!cid && typeof cid === 'string');
          const idStr = `("${idList.join('","')}")`;
          const { data: latestProfiles } = await supabase
            .from('users')
            .select('id, name, avatar_url, shadow_id')
            .or(`id.in.${idStr},shadow_id.in.${idStr}`);

          if (latestProfiles) {
            mergedChats.forEach(chat => {
              if (chat.type === 'direct') {
                const profile = latestProfiles.find(p => p.id === chat.id || p.shadow_id === chat.id);
                if (profile) {
                  chat.id = profile.id; // CRITICAL: Normalize chat ID to database ID
                  chat.contact = {
                    ...chat.contact,
                    id: profile.id,
                    name: profile.name,
                    avatarUrl: profile.avatar_url,
                    shadowId: profile.shadow_id
                  };
                }
              } else if (chat.type === 'group' && Array.isArray(chat.members)) {
                chat.members = chat.members.map(m => {
                  if (!m) return m;
                  const profile = latestProfiles.find(p => p.id === m.id || p.shadow_id === m.id);
                  return profile ? {
                    ...m,
                    id: profile.id, // Normalize
                    name: profile.name,
                    avatarUrl: profile.avatar_url,
                    shadowId: profile.shadow_id
                  } : m;
                });
              }
            });
          }
        }

        // Ensure "Note to Self" exists
        if (!mergedChats.some(c => c.id === shortId)) {
          const selfChat = {
            id: shortId,
            type: 'direct',
            status: 'direct',
            isSelf: true,
            contact: { id: shortId, name: 'Note to Self', shadowId: shadowHex, avatarUrl: data?.avatar_url || null },
            messages: [],
            lastActivity: Date.now()
          };
          mergedChats.push(selfChat);
          // Persist it
          supabase.from('chats').upsert({
            owner_id: shortId,
            chat_id: shortId,
            chat_data: selfChat
          }, { onConflict: 'owner_id, chat_id' }).then();
        }

        // 📦 FETCH ATOMIC MESSAGES
        const myIdLower = shortId.toLowerCase();

        // Optimization: Only fetch messages for groups we are actually in
        const myGroupIds = mergedChats.filter(c => c && c.type === 'group').map(c => c.id?.toLowerCase() || '');
        const groupFilter = myGroupIds.length > 0
          ? `chat_id.in.("${myGroupIds.join('","')}")`
          : 'chat_id.is.null';

        const { data: allMsgData } = await supabase
          .from('messages')
          .select('*')
          .or(`chat_id.eq."${shortId}",sender_id.eq."${shortId}",${groupFilter}`)
          .order('created_at', { ascending: true });

        const msgMap = new Map();
        (allMsgData || []).forEach(m => {
          if (!m.id?.endsWith('_rec')) msgMap.set(m.id, m);
        });
        const combinedMsgs = Array.from(msgMap.values())
          .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        if (combinedMsgs.length > 0) {
          const now = Date.now();
          mergedChats.forEach(chat => {
            const chatIdLower = (chat.id || '').toLowerCase();
            let chatMsgs;

            if (chatIdLower === myIdLower) {
              // Note to Self: strictly only messages I sent to myself
              chatMsgs = combinedMsgs.filter(m =>
                m.chat_id?.toLowerCase() === myIdLower &&
                m.sender_id?.toLowerCase() === myIdLower
              );
            } else if (chat.type === 'direct') {
              // If the contact was deleted, show NO messages — the user wiped this relationship.
              // Messages sent by the contact AFTER deletion should be invisible until they reconnect.
              if (chat.status === 'deleted') {
                chatMsgs = [];
              } else {
                // Direct chat: messages I sent (chat_id = contactId) OR received (chat_id = myId, sender = contactId)
                chatMsgs = combinedMsgs.filter(m => {
                  const content = typeof m.content === 'string' ? JSON.parse(m.content) : m.content;
                  const partnerIdInContent = content?.partnerId?.toLowerCase();

                  // Special logic for system messages: they must match the partnerId if present
                  const isSystemMessage = m.sender_id === 'system';
                  const systemMatch = isSystemMessage && (!partnerIdInContent || partnerIdInContent === chatIdLower);

                  const isMatch = (m.chat_id?.toLowerCase() === chatIdLower && (m.sender_id?.toLowerCase() === myIdLower || systemMatch)) ||
                    (m.chat_id?.toLowerCase() === myIdLower && (m.sender_id?.toLowerCase() === chatIdLower || systemMatch));
                  if (!isMatch) return false;

                  if (chat.clearedAt) {
                    const msgTime = new Date(m.created_at).getTime();
                    return msgTime >= chat.clearedAt;
                  }
                  return true;
                });
              }
            } else {
              // Group chats: Filter by membership intervals (WhatsApp model)
              const intervals = chat.membershipIntervals || [];
              chatMsgs = combinedMsgs.filter(m => {
                const isMatch = m.chat_id?.toLowerCase() === chatIdLower;
                if (!isMatch) return false;

                const msgTime = new Date(m.created_at).getTime();
                if (chat.clearedAt && msgTime < chat.clearedAt) return false;

                if (intervals.length > 0) {
                  // Show only messages that fall within any of the user's membership periods
                  return intervals.some(inv =>
                    msgTime >= (inv.joinedAt - 5000) && (!inv.removedAt || msgTime <= (inv.removedAt + 5000))
                  );
                }

                // Fallback for legacy chats without intervals
                if (chat.status === 'removed' && chat.removedAt) {
                  return msgTime <= (chat.removedAt + 5000);
                }
                return true;
              });
            }

            chat.messages = chatMsgs
              .map(m => {
                let content;
                try {
                  content = typeof m.content === 'string' ? JSON.parse(m.content) : m.content;
                } catch (e) {
                  content = { text: '[Message Error]' };
                }

                // Inject DB status arrays for tick logic bypassing RLS
                if (m.seen_by && m.seen_by.length > 0) content.seenBy = m.seen_by;
                if (m.delivered_to && m.delivered_to.length > 0) content.deliveredTo = m.delivered_to;

                const decryptKey = m.chat_id;
                const decryptedText = decrypt(content.text, decryptKey);

                return {
                  ...content, // This preserves the 'media' object!
                  id: m.id,
                  senderId: m.sender_id,
                  timestamp: new Date(m.created_at).getTime(),
                  deleteAt: m.delete_at,
                  text: decryptedText,
                  dbChatId: decryptKey,
                  media: content.media || null, // Explicitly ensure media is mapped
                  replyTo: content.replyTo ? {
                    ...content.replyTo,
                    text: decrypt(content.replyTo.text, decryptKey)
                  } : null
                };
              })
              .filter(m => {
                if (m.deleteAt && m.deleteAt <= now) return false;
                if (chat.deletedForMe?.includes(m.id)) return false;
                return true;
              });

            // Apply historical group metadata updates from the decrypted messages
            if (chat.type === 'group' && chat.messages) {
              let hasMetadataUpdate = false;
              chat.messages.forEach(msg => {
                if (msg.metadata?.isMetadataUpdate && msg.metadata?.updates) {
                  console.log(`[ShadowTalk] Applying historical metadata update for group ${chat.id}:`, msg.metadata.updates);
                  Object.assign(chat, msg.metadata.updates);
                  hasMetadataUpdate = true;
                }
              });

              if (hasMetadataUpdate) {
                // Silently update the user's DB row so the settings are persisted
                supabase.from('chats').upsert({
                  owner_id: shortId.toLowerCase(),
                  chat_id: chatIdLower,
                  chat_data: chat
                }, { onConflict: 'owner_id, chat_id' }).then(({ error }) => {
                  if (error) console.error('[ShadowTalk] Offline metadata sync DB save error:', error);
                });
              }
            }

            // 🛡️ SMART MERGE: Preserve local messages not yet seen on server
            // This prevents messages from "disappearing" for the sender during a refresh race condition.
            // Skip for deleted chats — no old messages should leak back in.
            if (chat.status !== 'deleted') {
              const currentChat = (chatsRef.current || []).find(c => c && c.id?.toLowerCase() === chatIdLower);
              if (currentChat && currentChat.messages) {
                const serverMsgIds = new Set(chat.messages.map(m => m.id));
                const localOnlyMsgs = currentChat.messages.filter(m => {
                  if (serverMsgIds.has(m.id)) return false;
                  if (chat.clearedAt && m.timestamp < chat.clearedAt) return false;
                  return true;
                });

                if (localOnlyMsgs.length > 0) {
                  console.log(`[ShadowTalk] Preserving ${localOnlyMsgs.length} local messages for chat ${chat.id}`);
                  chat.messages = [...chat.messages, ...localOnlyMsgs].sort((a, b) => a.timestamp - b.timestamp);
                }
              }
            }
          });
        }

        // 🛡️ SYNC BLOCKED STATUS: Check if other users have blocked us while we were offline
        const directChats = mergedChats.filter(c => c && c.type === 'direct' && c.id.toLowerCase() !== myIdLower);
        if (directChats.length > 0) {
          const partnerIds = directChats.map(c => c.id.toLowerCase());
          const myIdentities = [myIdLower, inputId.toLowerCase(), shadowHex];

          try {
            const { data: blocks } = await supabase
              .from('chats')
              .select('owner_id, chat_id, chat_data')
              .in('owner_id', partnerIds)
              .or(`chat_id.eq."${myIdentities[0]}",chat_id.eq."${myIdentities[1]}",chat_id.eq."${myIdentities[2]}"`);

            if (blocks && blocks.length > 0) {
              blocks.forEach(block => {
                if (block.chat_data?.isBlocked) {
                  const targetChat = mergedChats.find(c => c.id.toLowerCase() === block.owner_id.toLowerCase());
                  if (targetChat) {
                    targetChat.isBlockedByOther = true;
                    if (targetChat.chat_data) targetChat.chat_data.isBlockedByOther = true;
                  }
                }
              });
            }
          } catch (err) {
            console.warn('[ShadowTalk] Failed to sync block statuses:', err);
          }
        }

        // Secondary merge pass to handle any duplicates that survived the first pass
        // (e.g. if the same contact is matched by both alias and shadow ID)
        const dedupedMap = new Map();
        mergedChats.forEach(chat => {
          if (!chat) return;
          const key = chat.type === 'group'
            ? chat.id.toLowerCase().trim()
            : (chat.contact?.id || chat.id).toLowerCase().trim();

          if (dedupedMap.has(key)) {
            const existing = dedupedMap.get(key);
            // Merge messages and keep the one with most recent activity
            const allMessages = [...(existing.messages || []), ...(chat.messages || [])];
            // Sort by ID to remove exact duplicates
            const uniqueMessages = Array.from(new Map(allMessages.map(m => [m.id, m])).values());

            if ((chat.lastActivity || 0) > (existing.lastActivity || 0)) {
              dedupedMap.set(key, { ...chat, messages: uniqueMessages });
            } else {
              dedupedMap.set(key, { ...existing, messages: uniqueMessages });
            }
          } else {
            dedupedMap.set(key, chat);
          }
        });

        const finalMerged = Array.from(dedupedMap.values());
        setChats(finalMerged);
        console.log('[ShadowTalk] loginMockUser finished. Merged chats count:', finalMerged.length);
        markIncomingMessagesAsDelivered(finalMerged, shortId);
        syncContactsLastSeen(finalMerged);
      } else {
        setChats([]);
        console.log('[ShadowTalk] loginMockUser finished. No chats found.');
      }

      // Fetch pending requests — check both the short alias and any legacy IDs
      const { data: reqData, error: reqError } = await supabase
        .from('requests')
        .select('*')
        .or(`receiver_id.eq."${shortId}",receiver_id.eq."${inputId}",receiver_id.eq."${shadowHex}"`)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });


      if (reqError) {
        console.error('[ShadowTalk] Request fetch error:', reqError);
      }

      if (reqData && reqData.length > 0) {
        const senderIds = reqData.map(r => r.sender_id);
        const { data: senderProfiles } = await supabase
          .from('users')
          .select('id, shadow_id, name')
          .in('id', senderIds);

        setRequests(reqData.map(r => {
          const profile = senderProfiles?.find(p => p.id === r.sender_id);
          return {
            id: r.id,
            senderId: r.sender_id,
            senderShadowId: profile?.shadow_id || r.sender_id,
            senderName: profile?.name || 'Unknown User',
            timestamp: new Date(r.created_at).getTime()
          };
        }));
      } else {
        setRequests([]);
      }
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to fetch user data:', err);
      if (!user) {
        setUser({
          id: inputId,
          shortId: inputId,
          shadowId: inputId,
          name: customName || 'Anonymous User',
          phrase: customPhrase || generateRecoveryPhrase()
        });
        setChats([]);
        setRequests([]);
      }
      setIsLoading(false);
    }
  };
  const logout = () => {
    // Clear all in-memory state immediately so the old user's data
    // cannot be seen by or merged into the next account.
    setChats([]);
    chatsRef.current = [];
    setRequests([]);
    setTypingUsers({});
    setUser(null);
    setSettings(prev => ({ ...prev, lockApp: false }));
    // Clear persisted user session from localStorage
    localStorage.removeItem('shadowtalk_user');
  };

  const acceptRequest = async (request) => {
    const senderId = request.senderId;
    const receiverId = user.id;

    try {
      // 1. Update the request status in DB
      await supabase
        .from('requests')
        .update({ status: 'accepted' })
        .match({ sender_id: senderId, receiver_id: receiverId });

      // 2. Fetch the sender's chat row to get existing messages (pre-accept messages)
      const { data: senderChatRow } = await supabase
        .from('chats')
        .select('chat_data')
        .match({ owner_id: senderId, chat_id: receiverId })
        .maybeSingle();

      const senderChatData = senderChatRow?.chat_data || {
        id: receiverId,
        type: 'direct',
        messages: [],
        contact: { id: receiverId, name: user.name, isOnline: true }
      };

      // 2b. Fetch the receiver's existing chat row to preserve clearedAt/deletedForMe/theme
      const { data: receiverChatRow } = await supabase
        .from('chats')
        .select('chat_data')
        .match({ owner_id: receiverId, chat_id: senderId })
        .maybeSingle();

      const existingReceiverData = receiverChatRow?.chat_data || {};

      // 3. Create the acceptance system message
      const acceptanceMsg = {
        id: `sys_acc_${Date.now()}`,
        text: `Request accepted. You can now chat with each other.`,
        senderId: 'system',
        timestamp: Date.now()
      };

      // 4. Create/Update the chat for the RECEIVER (Me)
      const receiverChat = {
        ...existingReceiverData,
        id: senderId,
        type: 'direct',
        status: 'direct',
        reconnection: false,
        isDeletedByOther: false, // 🔓 Reset on reconnection
        unreadCount: 0,
        lastActivity: Date.now(),
        messages: [acceptanceMsg],
        contact: {
          ...(existingReceiverData.contact || {}),
          id: senderId,
          shadowId: request.senderShadowId,
          name: request.senderName,
          isOnline: true
        }
      };

      await supabase.from('chats').upsert({
        owner_id: receiverId,
        chat_id: senderId,
        chat_data: receiverChat
      }, { onConflict: 'owner_id, chat_id' });

      const updatedSenderChat = {
        ...senderChatData,
        status: 'direct',
        reconnection: false,
        isDeletedByOther: false, // 🔓 Reset on reconnection
        messages: [acceptanceMsg],
        lastActivity: Date.now()
      };

      await supabase.from('chats').upsert({
        owner_id: senderId,
        chat_id: receiverId,
        chat_data: updatedSenderChat
      }, { onConflict: 'owner_id, chat_id' });

      // 4. Update the messages table for both parties
      await supabase.from('messages').insert({
        chat_id: senderId,
        sender_id: user.id.toLowerCase(),
        content: {
          ...acceptanceMsg,
          partnerId: receiverId,
          text: encrypt(acceptanceMsg.text, senderId)
        }
      });

      await supabase.from('messages').insert({
        chat_id: receiverId,
        sender_id: user.id.toLowerCase(),
        content: {
          ...acceptanceMsg,
          partnerId: senderId,
          text: encrypt(acceptanceMsg.text, receiverId)
        }
      });


      // 5.6 Broadcast connection status to the other user
      const privacyChannel = supabase.channel(`privacy_${senderId.toLowerCase()}`);
      privacyChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await privacyChannel.send({
            type: 'broadcast',
            event: 'status_change',
            payload: { userId: user.id, status: 'connected' }
          });
          setTimeout(() => supabase.removeChannel(privacyChannel), 1000);
        }
      });

      // 6. Update local state
      setRequests(prev => prev.filter(r => r.senderId !== senderId));
      setChats(prev => prev.map(chat => {
        const chatIdLower = chat.id?.toLowerCase();
        const targetIdLower = senderId.toLowerCase();
        if (chatIdLower === targetIdLower || chat.contact?.id?.toLowerCase() === targetIdLower) {
          // Check if message already exists to avoid duplicates when loginMockUser finishes
          const hasAccMsg = (chat.messages || []).some(m => m.id === acceptanceMsg.id);
          return {
            ...chat,
            status: 'direct',
            messages: hasAccMsg ? chat.messages : [...(chat.messages || []), acceptanceMsg],
            lastActivity: Date.now()
          };
        }
        return chat;
      }));

      loginMockUser(user.name, user.id, user.phrase); // Deep refresh
      showToast(`Connected with ${request.senderName || 'user'}!`, 'success');
    } catch (err) {
      console.error('Action failed:', err);
      showToast(err.message || 'Action failed', 'error');
    }
  };

  const rejectRequest = async (requestOrId) => {
    const passedReq = typeof requestOrId === 'object' ? requestOrId : requests.find(r => r.id === requestOrId);
    if (!passedReq) return;

    const senderId = passedReq.senderId;

    // 1. Remove from local requests state
    setRequests(prev => prev.filter(r => r.senderId !== senderId));

    // 2. Update Supabase requests table
    // Use match for safety in case the ID is constructed
    await supabase.from('requests')
      .update({ status: 'rejected' })
      .match({ sender_id: senderId, receiver_id: user.id });

    // 3. Remove the chat entry from dashboard (local & DB)
    await deleteChat(senderId);

    // 3.5 Insert system message for the sender
    const sysId = `sys_rej_${Date.now()}`;
    await supabase.from('messages').insert({
      id: sysId,
      chat_id: user.id.toLowerCase(), // The sender sees this chat as the recipient's ID
      sender_id: 'system',
      content: {
        id: sysId,
        text: encrypt('Your request has been rejected.', user.id.toLowerCase()),
        senderId: 'system',
        partnerId: user.id.toLowerCase(),
        timestamp: Date.now()
      }
    });

    // 3.7 Update sender's chat data to set status: 'rejected'
    try {
      const { data: senderChat } = await supabase
        .from('chats')
        .select('chat_data')
        .eq('owner_id', senderId)
        .eq('chat_id', user.id)
        .maybeSingle();

      if (senderChat) {
        const updatedData = { ...senderChat.chat_data, status: 'rejected' };
        await supabase
          .from('chats')
          .update({ chat_data: updatedData })
          .eq('owner_id', senderId)
          .eq('chat_id', user.id);
      }
    } catch (e) {
      console.error('[ShadowTalk] Error updating sender chat data on reject:', e);
    }

    // 4. Broadcast rejection to the sender
    const privacyChannel = supabase.channel(`privacy_${senderId.toLowerCase()}`);
    privacyChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await privacyChannel.send({
          type: 'broadcast',
          event: 'status_change',
          payload: { userId: user.id, status: 'rejected' }
        });
        setTimeout(() => supabase.removeChannel(privacyChannel), 3000);
      }
    });
  };

  const setTypingStatus = (chatId, isTyping) => {
    if (!user?.id || !chatSubRef.current || !settings.typingIndicators) return;
    const isGroup = String(chatId).toLowerCase().startsWith('group_');

    chatSubRef.current.send({
      type: 'broadcast',
      event: 'TYPING',
      payload: {
        chatId,
        userId: user.id,
        isTyping,
        targetUserId: isGroup ? null : chatId // In direct chats, chatId is the recipient's ID
      }
    });
  };

  const forwardMessage = async (targetChatIds, message) => {
    if (!user?.id) return;
    for (const tid of targetChatIds) {
      const forwardedContent = {
        ...message,
        id: `m_${Date.now()}_fwd_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: Date.now(),
        forwardedFrom: message.senderId,
        read: false,
        status: 'sent'
      };
      delete forwardedContent.deleteAt; // Reset disappearance for new chat
      await addMessage(tid, message.text, message.media, null, forwardedContent);
    }
    showToast(`Forwarded to ${targetChatIds.length} chat${targetChatIds.length > 1 ? 's' : ''}`);
  };

  const toggleStarMessage = async (chatId, messageId) => {
    if (!user?.id) return;
    const canonicalChatId = chatId.toLowerCase();
    let isStarred = false;

    setChats(prev => prev.map(chat => {
      if (chat.id.toLowerCase() === canonicalChatId) {
        const updatedMessages = (chat.messages || []).map(m => {
          if (m.id === messageId) {
            isStarred = !m.isStarred;
            return { ...m, isStarred };
          }
          return m;
        });
        return { ...chat, messages: updatedMessages };
      }
      return chat;
    }));

    // Update DB
    const { data: msgRow } = await supabase.from('messages').select('content').eq('id', messageId).single();
    if (msgRow?.content) {
      const updated = { ...msgRow.content, isStarred };
      await supabase.from('messages').update({ content: updated }).eq('id', messageId);
    }
  };

  const togglePinMessage = async (chatId, messageId) => {
    const canonicalChatId = chatId.toLowerCase();
    const chat = chatsRef.current.find(c => c.id.toLowerCase() === canonicalChatId);
    if (!chat) return;

    const pinnedItems = chat.pinnedMessageIds || [];
    // Handle both string IDs (legacy) and objects
    const isPinned = pinnedItems.some(item => (typeof item === 'string' ? item : item.id) === messageId);
    
    let updatedPinned;
    if (isPinned) {
      updatedPinned = pinnedItems.filter(item => (typeof item === 'string' ? item : item.id) !== messageId);
    } else {
      const newItem = { id: messageId, pinnedBy: user.id, timestamp: Date.now() };
      // Put the latest pinned message at the top!
      updatedPinned = [newItem, ...pinnedItems].slice(0, 3); // Limit to 3 pins
    }

    // Update local state and DB for current user
    await updateChatSettings(chatId, { pinnedMessageIds: updatedPinned });

    // Broadcast the change to the other user via a system message
    const syncId = `m_pind_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const setterName = user.name || user.id;
    const actionText = !isPinned ? 'pinned a message' : 'unpinned a message';
    const text = `${setterName} ${actionText}`;

    await supabase.from('messages').insert({
      id: syncId,
      chat_id: canonicalChatId,
      sender_id: user.id.toLowerCase(),
      content: {
        senderId: 'system',
        text: encrypt(text, canonicalChatId),
        type: 'notification',
        metadata: {
          isMetadataUpdate: true,
          updates: { pinnedMessageIds: updatedPinned },
          partnerId: user.id.toLowerCase() // So the receiver knows which chat to update
        },
        timestamp: Date.now()
      },
      delete_at: null
    });
  };

  const archiveChat = async (chatId, isArchived) => {
    if (!chatId) return;
    const cid = String(chatId).toLowerCase();

    // Find current state from ref to be absolutely sure
    const currentChat = (chatsRef.current || []).find(c => String(c.id).toLowerCase() === cid);
    const currentState = !!(currentChat?.isArchived || currentChat?.chat_data?.isArchived);

    // Determine target state: if provided use it, otherwise toggle
    const targetState = typeof isArchived === 'boolean' ? isArchived : !currentState;

    console.log(`[ShadowTalk] archiveChat: ${cid} | current: ${currentState} | target: ${targetState}`);

    await updateChatSettings(cid, { isArchived: targetState });
    showToast(targetState ? 'Chat archived' : 'Chat unarchived');
  };

  const addMessage = async (chatId, text, media = null, replyTo = null, forwardedData = null) => {
    if (!user?.id) return;

    // 1. Resolve IDs first so everything else can use the correct canonical database ID
    let canonicalId = chatId.toLowerCase();
    let contactProfile = null;
    if (!chatId.startsWith('group_')) {
      const { data } = await supabase
        .from('users')
        .select('id, shadow_id, name')
        .or(`id.eq."${chatId}",shadow_id.eq."${chatId}"`)
        .maybeSingle();
      if (data) {
        contactProfile = data;
        canonicalId = data.id.toLowerCase();
      }
    }

    let targetChat = chats.find(c =>
      c.id.toLowerCase() === canonicalId ||
      (c.contact?.id && c.contact.id.toLowerCase() === canonicalId) ||
      (c.contact?.shadowId && c.contact.shadowId.toLowerCase() === canonicalId)
    );

    const isGroup = canonicalId.startsWith('group_') || targetChat?.type === 'group';
    const isParticipant = !isGroup || (
      (targetChat?.members || []).some(m => m && (String(m.id).toLowerCase() === String(user.id).toLowerCase() || (user.shadowId && m.shadowId && String(m.shadowId).toLowerCase() === String(user.shadowId).toLowerCase()))) &&
      targetChat?.status !== 'removed'
    );

    if (isGroup && !isParticipant && targetChat?.adminId !== user.id) {
      showToast('You are no longer a participant in this group', 'error');
      return;
    }

    const isDeletedByOther = targetChat?.isDeletedByOther || targetChat?.chat_data?.isDeletedByOther;
    const isDeletedByMe = targetChat?.status === 'deleted' || targetChat?.chat_data?.status === 'deleted';
    const isReconnectionAttempt = isDeletedByOther && !isDeletedByMe && text === "I'd like to reconnect with you.";
    const isBlocked = targetChat?.isBlocked || targetChat?.chat_data?.isBlocked;
    const isBlockedByOther = targetChat?.isBlockedByOther || targetChat?.chat_data?.isBlockedByOther;

    if (isBlocked || isBlockedByOther || (isDeletedByOther && !isReconnectionAttempt) || targetChat?.status === 'pending_sent' || targetChat?.status === 'pending_received') {
      let msg = targetChat?.status === 'removed' ? 'You are no longer a participant in this group.' :
        isBlocked ? 'You blocked this contact.' :
          isBlockedByOther ? 'You have been blocked.' :
            'This conversation is read-only.';

      showToast(msg, 'error');
      return;
    }

    // PRIVACY CHECK: If direct chat, check if the recipient has blocked us or deleted us
    if (!isGroup) {
      const { data: otherData } = await supabase
        .from('chats')
        .select('chat_data')
        .ilike('owner_id', canonicalId)
        .ilike('chat_id', user.id)
        .maybeSingle();

      if (otherData?.chat_data?.isBlocked) {
        showToast('You can no longer interact with this contact.', 'error');
        // Update local state to show blocked UI
        setChats(prev => prev.map(c => c.id.toLowerCase() === canonicalId ? { ...c, isBlockedByOther: true } : c));
        return;
      }

      // Removed restriction on deleted chats to allow talking after clearing conversation
    }

    const isSelf = canonicalId === user.id.toLowerCase();
    
    const initialStatus = isSelf ? 'seen' : 'sent';
    const initialRead = isSelf;

    const newMessage = {
      id: `m_${Date.now()}`,
      text,
      media,
      deliveryStatus: 'sending', // Track delivery state
      replyTo: replyTo ? {
        id: replyTo.id,
        text: replyTo.text,
        senderId: replyTo.senderId,
        media: replyTo.media
      } : null,
      senderId: user.id,
      timestamp: Date.now(),
      read: initialRead,
      status: initialStatus,
      seenBy: [user.id],
      ...(forwardedData || {})
    };

    // SECURITY: Rule 9 & 10 (Allow Member DMs)
    const currentIsDirect = targetChat?.type === 'direct';
    if (currentIsDirect && !targetChat.isSelf) {
      const otherId = targetChat.id.toLowerCase();
      const myId = user.id.toLowerCase();
      const myShadowId = user.shadowId ? user.shadowId.toLowerCase() : null;
      const otherShadowId = targetChat?.contact?.shadowId ? targetChat.contact.shadowId.toLowerCase() : null;

      // If it's a message to self, bypass the blocking check entirely
      const isSelfMessage = (myId === otherId) || 
                            (user.shadowId && String(user.shadowId).toLowerCase() === otherId);

      if (!isSelfMessage) {
        const currentChats = chatsRef.current || [];
        const blockingGroup = currentChats.find(c => {
          if (!c || c.type !== 'group') return false;
          const isDisabled = c.allow_member_dm === false || c.allowMemberDMs === false;
          if (!isDisabled) return false;

          const myMatchCondition = (m) => m && (
            String(m.id).toLowerCase() === myId ||
            String(m.shadowId).toLowerCase() === myId ||
            (myShadowId && String(m.id).toLowerCase() === myShadowId) ||
            (myShadowId && String(m.shadowId).toLowerCase() === myShadowId)
          );
          const otherMatchCondition = (m) => m && (
            String(m.id).toLowerCase() === otherId ||
            String(m.shadowId).toLowerCase() === otherId ||
            (otherShadowId && String(m.id).toLowerCase() === otherShadowId) ||
            (otherShadowId && String(m.shadowId).toLowerCase() === otherShadowId)
          );

          const myMatch = (c.members || []).some(myMatchCondition);
          const otherMatch = (c.members || []).some(otherMatchCondition);

          const isSelfAdmin = String(c.adminId).toLowerCase() === myId ||
                              (myShadowId && String(c.adminId).toLowerCase() === myShadowId) ||
                              (c.members || []).some(m => myMatchCondition(m) && m.role === 'admin');
          const isOtherAdmin = String(c.adminId).toLowerCase() === otherId ||
                               (otherShadowId && String(c.adminId).toLowerCase() === otherShadowId) ||
                               (c.members || []).some(m => otherMatchCondition(m) && m.role === 'admin');

          return myMatch && otherMatch && !isSelfAdmin && !isOtherAdmin;
        });

        if (blockingGroup) {
          console.warn('[ShadowTalk] Message rejected: Member DMs disabled by admin in group', blockingGroup.id);
          showToast('Direct messages are currently disabled by group admin.', 'error');
          return;
        }

        // Fallback: If no blocking group found in local state, check DB directly.
        // This catches the case where sender's local state is stale (missed the broadcast).
        // Uses ALL local group IDs (not just ones where local member matching worked) to avoid
        // the same ID-format mismatch bug that affects the local-state check above.
        if (!blockingGroup) {
          const allLocalGroupIds = currentChats
            .filter(c => c && c.type === 'group')
            .map(c => c.id.toLowerCase());

          if (allLocalGroupIds.length > 0) {
            try {
              const { data: groupRows } = await supabase
                .from('chats')
                .select('owner_id, chat_id, chat_data')
                .in('chat_id', allLocalGroupIds);

              if (groupRows && groupRows.length > 0) {
                // Group rows by chat_id
                const rowsByGroup = {};
                groupRows.forEach(r => {
                  if (!rowsByGroup[r.chat_id]) rowsByGroup[r.chat_id] = [];
                  rowsByGroup[r.chat_id].push(r);
                });

                const matchId = (val, ...targets) =>
                  targets.some(t => t && String(val).toLowerCase() === t);

                for (const [sharedGroupId, rows] of Object.entries(rowsByGroup)) {
                  // Prefer admin's row as authoritative
                  const authoritative = rows.find(r => {
                    const cd = r.chat_data;
                    return cd && matchId(cd.adminId, r.owner_id);
                  }) || rows[0];

                  const cd = authoritative?.chat_data;
                  if (!cd) continue;

                  const isDisabled = cd.allow_member_dm === false || cd.allowMemberDMs === false;
                  if (!isDisabled) continue;

                  const members = cd.members || [];
                  const adminId = String(cd.adminId || '').toLowerCase();

                  // Check membership with both ID and shadowId
                  const myMember = members.find(m => m &&
                    (matchId(m.id, myId, myShadowId) || matchId(m.shadowId, myId, myShadowId))
                  );
                  const otherMember = members.find(m => m &&
                    (matchId(m.id, otherId, otherShadowId) || matchId(m.shadowId, otherId, otherShadowId))
                  );
                  if (!myMember || !otherMember) continue;

                  const isMeAdmin = matchId(adminId, myId, myShadowId) ||
                                    (myMember && myMember.role === 'admin');
                  const isOtherAdminDB = matchId(adminId, otherId, otherShadowId) ||
                                         (otherMember && otherMember.role === 'admin');
                  if (isMeAdmin || isOtherAdminDB) continue;

                  console.warn('[ShadowTalk] DB check: Member DMs disabled in group', sharedGroupId);
                  // Sync back into local state so subsequent calls don't need DB
                  setChats(prev => prev.map(c => {
                    if (String(c.id).toLowerCase() === sharedGroupId) {
                      return { ...c, allow_member_dm: false, allowMemberDMs: false };
                    }
                    return c;
                  }));
                  showToast('Direct messages are currently disabled by group admin.', 'error');
                  return;
                }
              }
            } catch (dbErr) {
              console.warn('[ShadowTalk] DB DM restriction check failed:', dbErr);
            }
          }
        }
      }
    }

    // Apply Disappearing Settings
    const config = targetChat?.disappearingConfig;
    if (config && config.type !== 'Off') {
      const duration = parseTimer(config.timer);
      if (config.type === 'Disappear after send') {
        newMessage.deleteAt = Date.now() + duration;
      } else if (config.type === 'Disappear after read') {
        newMessage.deleteAfterRead = true;
        newMessage.disappearDuration = duration;
      }
    }

    // Update local state
    setChats(prev => {
      const chatExists = prev.some(c => c.id.toLowerCase() === canonicalId);
      if (chatExists) {
        return prev.map(chat => {
          if (chat.id.toLowerCase() === canonicalId) {
            // Check if message already exists (avoid duplicates from real-time)
            if (chat.messages?.some(m => m.id === newMessage.id)) return chat;

            const updated = {
              ...chat,
              status: chat.status === 'deleted' ? 'direct' : chat.status,
              messages: [...(chat.messages || []), newMessage],
              unreadCount: 0, // Auto-reset when sending
              lastActivity: Date.now()
            };
            targetChat = updated;
            return updated;
          }
          return chat;
        });
      } else {
        const contactId = chatId.startsWith('pending_') ? chatId.replace('pending_', '') : canonicalId;
        const isSelf = canonicalId === user.id.toLowerCase();
        const newChat = {
          id: canonicalId,
          type: 'direct',
          isSelf: isSelf,
          status: isSelf ? 'direct' : (chatId.startsWith('pending_') ? 'pending_sent' : 'direct'),
          contact: {
            id: canonicalId,
            shadowId: contactProfile?.shadow_id || (chatId.length > 20 ? chatId : null),
            name: isSelf ? 'Note to Self' : (contactProfile?.name || contactId)
          },
          messages: [newMessage],
          unreadCount: 0,
          lastActivity: Date.now()
        };
        targetChat = newChat;
        return [newChat, ...prev];
      }
    });

    // 🔐 Encryption
    const encryptedMsg = {
      ...newMessage,
      text: encrypt(newMessage.text, canonicalId),
      replyTo: newMessage.replyTo ? {
        ...newMessage.replyTo,
        text: encrypt(newMessage.replyTo.text, canonicalId)
      } : null
    };

    // 1. Insert for SENDER — chat_id = recipient's ID (single record, no _rec needed)
    supabase.from('messages').insert({
      id: newMessage.id,
      chat_id: canonicalId,           // recipient's canonical ID
      sender_id: user.id.toLowerCase(),
      content: encryptedMsg,
      delete_at: newMessage.deleteAt || null
    }).select('created_at').single()
    .then(({ data: dbMsg }) => {
      // Sync the sender's local timestamp and set deliveryStatus to sent
      setChats(prev => prev.map(c => {
        if (c.id.toLowerCase() === canonicalId) {
          const msgs = [...(c.messages || [])];
          const idx = msgs.findIndex(m => m.id === newMessage.id);
          if (idx >= 0) {
            msgs[idx] = { ...msgs[idx], deliveryStatus: 'sent' };
            if (dbMsg?.created_at) {
              const serverTime = new Date(dbMsg.created_at).getTime();
              msgs[idx].timestamp = serverTime;
              msgs.sort((a, b) => a.timestamp - b.timestamp);
            }
          }
          const serverTime = dbMsg?.created_at ? new Date(dbMsg.created_at).getTime() : Date.now();
          return { ...c, messages: msgs, lastActivity: Math.max(c.lastActivity || 0, serverTime) };
        }
        return c;
      }));
      return dbMsg;
    }, (err) => {
      console.error('[ShadowTalk] Message insert failed:', err);
      // Set deliveryStatus to failed
      setChats(prev => prev.map(c => {
        if (c.id.toLowerCase() === canonicalId) {
          const msgs = [...(c.messages || [])];
          const idx = msgs.findIndex(m => m.id === newMessage.id);
          if (idx >= 0) {
            msgs[idx] = { ...msgs[idx], deliveryStatus: 'failed' };
          }
          return { ...c, messages: msgs };
        }
        return c;
      }));
      return null;
    })
    .then((dbMsg) => {
      if (!dbMsg) return; // Skip metadata update if insert failed

      // 2. Persist Metadata (LIGHT BLOB)
      const chatMetadata = { ...targetChat, messages: [] };
      return supabase.from('chats').upsert({
        owner_id: user.id.toLowerCase(),
        chat_id: canonicalId,
        chat_data: { ...chatMetadata, lastActivity: Date.now(), messages: [] }
      }, { onConflict: 'owner_id, chat_id' });
    })
    .then(() => {
      // 3. Update recipient's metadata (for direct chats)
      if (targetChat.type === 'direct') {
        const otherId = canonicalId;
        supabase
          .from('users')
          .select('id, shadow_id')
          .or(`id.eq."${otherId}",shadow_id.eq."${otherId}"`)
          .maybeSingle()
          .then(({ data: recipientUser }) => {
            const canonicalOtherId = recipientUser?.id || otherId;
            const isSelf = canonicalOtherId === user.id;

            if (!isSelf) {
              supabase
                .from('chats')
                .select('owner_id, chat_data')
                .eq('owner_id', canonicalOtherId)
                .eq('chat_id', user.id)
                .maybeSingle()
                .then(({ data: otherData }) => {
                  const actualOwnerId = otherData?.owner_id || canonicalOtherId;
                  const otherChatData = otherData?.chat_data || {};
                  
                  // Ensure basic properties are set if it's a new or empty chat_data
                  if (!otherChatData.id) otherChatData.id = user.id;
                  if (!otherChatData.type) otherChatData.type = 'direct';
                  if (!otherChatData.status) otherChatData.status = 'direct';
                  
                  // Ensure contact is populated
                  if (!otherChatData.contact || !otherChatData.contact.name) {
                    otherChatData.contact = {
                      id: user.id,
                      shadowId: user.shadowId,
                      name: user.name || 'ShadowTalk User'
                    };
                  }
                  
                  if (otherChatData.messages === undefined) otherChatData.messages = [];
                  if (otherChatData.unreadCount === undefined) otherChatData.unreadCount = 0;

                  let shouldIncrementUnread = true;
                  if (otherChatData.notificationType === 'Mentions Only') {
                    shouldIncrementUnread = text.includes(`@${user.shadowId || user.id}`);
                  } else if (otherChatData.notificationType === 'Mute' || (otherChatData.muteUntil && otherChatData.muteUntil > Date.now())) {
                    shouldIncrementUnread = false;
                  }

                  const myIdLower = user.id.toLowerCase();
                  supabase.from('chats').upsert({
                    owner_id: actualOwnerId.toLowerCase(),
                    chat_id: myIdLower,
                    chat_data: {
                      ...otherChatData,
                      status: otherChatData.status === 'deleted' ? 'direct' : otherChatData.status,
                      messages: [newMessage], // Store the last message for dashboard snippet
                      unreadCount: shouldIncrementUnread ? (otherChatData.unreadCount || 0) + 1 : (otherChatData.unreadCount || 0),
                      lastActivity: Date.now()
                    }
                  }, { onConflict: 'owner_id, chat_id' })
                  .then(({ error }) => {
                    if (error) console.error('[ShadowTalk] Error in upsert:', error);
                  });
                });
            }
          });
      } else if (targetChat.type === 'group') {
        const memberUpdates = targetChat.members.map((member) => {
          if (member.id === user.id) return Promise.resolve(); // Skip self
          return supabase
            .from('chats')
            .select('chat_data')
            .eq('owner_id', member.id)
            .eq('chat_id', chatId)
            .maybeSingle()
            .then(({ data: memberData }) => {
              const baseChat = memberData?.chat_data || targetChat;
              const updatedMemberChat = {
                ...baseChat,
                messages: [], // Keep it light
                unreadCount: (baseChat.unreadCount || 0) + 1,
                lastActivity: Date.now()
              };

              return supabase.from('chats').upsert({
                owner_id: member.id,
                chat_id: chatId,
                chat_data: updatedMemberChat
              }, { onConflict: 'owner_id, chat_id' });
            });
        });
        Promise.all(memberUpdates).catch(e => console.error('[ShadowTalk] Error in group member updates:', e));
      }
    });
  };

  const editMessage = async (chatId, messageId, newText) => {
    const canonicalChatId = chatId.toLowerCase();
    try {
      const { data: msgData } = await supabase
        .from('messages')
        .select('*')
        .eq('id', messageId)
        .maybeSingle();

      if (msgData) {
        const content = typeof msgData.content === 'string' ? JSON.parse(msgData.content) : msgData.content;
        const updatedContent = {
          ...content,
          text: encrypt(newText, canonicalChatId),
          edited: true,
          editedAt: Date.now()
        };

        // Update in atomic table
        await supabase
          .from('messages')
          .update({ content: updatedContent })
          .eq('id', messageId);

        setChats(prev => prev.map(chat => {
          if (chat.id.toLowerCase() === canonicalChatId) {
            return {
              ...chat,
              messages: (chat.messages || []).map(m =>
                m.id === messageId ? { ...m, text: newText, edited: true } : m
              )
            };
          }
          return chat;
        }));
      }
    } catch (err) {
      console.error('[ShadowTalk] Edit message error:', err);
    }
  };

  const createGroup = async (name, memberIds, allow_member_dm = true) => {
    console.log('[ShadowTalk] Creating group:', name, 'with members:', memberIds);

    // 1. Resolve all member IDs to their canonical DB IDs
    const resolvedMembers = [];
    const creatorMember = { id: user.id, shadowId: user.shadowId, name: user.name, role: 'admin' };
    resolvedMembers.push(creatorMember);

    for (const mid of memberIds) {
      try {
        const { data: memberUser } = await supabase
          .from('users')
          .select('id, shadow_id, name')
          .or(`id.eq."${mid}",shadow_id.eq."${mid}"`)
          .maybeSingle();

        const finalId = memberUser?.id || mid;
        console.log(`[ShadowTalk] Resolved member ${mid} -> ${finalId}`);

        resolvedMembers.push({
          id: finalId,
          shadowId: memberUser?.shadow_id || mid,
          name: memberUser?.name || 'Shadow ' + mid.substring(0, 6),
          role: 'member'
        });
      } catch (err) {
        console.warn(`[ShadowTalk] Could not resolve member ${mid}:`, err);
        resolvedMembers.push({ id: mid, shadowId: mid, name: 'Shadow ' + mid.substring(0, 6), role: 'member' });
      }
    }

    const groupHex = Array.from(crypto.getRandomValues(new Uint8Array(12))).map(b => b.toString(16).padStart(2, '0')).join('');
    const newGroupId = `group_${groupHex}`;

    const now = Date.now();
    const newGroup = {
      id: newGroupId,
      type: 'group',
      name,
      adminId: user.id,
      allow_member_dm,
      members: resolvedMembers,
      membershipIntervals: [{ joinedAt: now - 3600000, removedAt: null }], // 1h safety margin for clock skew
      messages: [{ id: `m_${now}`, text: `Group "${name}" created.`, senderId: 'system', type: 'notification', timestamp: now }],
      unreadCount: 0,
      lastActivity: now
    };

    // Update local state for creator immediately
    setChats(prev => [newGroup, ...prev]);

    // Save for the creator
    const { error: creatorError } = await supabase.from('chats').upsert({
      owner_id: user.id,
      chat_id: newGroupId,
      chat_data: newGroup
    }, { onConflict: 'owner_id, chat_id' });

    if (creatorError) {
      console.error('[ShadowTalk] Error saving group for creator:', creatorError);
      throw creatorError;
    }

    // 2.5 Save initial system message to atomic table
    await supabase.from('messages').insert({
      id: newGroup.messages[0].id,
      chat_id: newGroupId,
      sender_id: user.id.toLowerCase(),
      content: {
        ...newGroup.messages[0],
        text: encrypt(newGroup.messages[0].text, newGroupId)
      }
    });

    // Save for all invited members
    const sharePromises = resolvedMembers.map(async (member) => {
      if (member.id === user.id) return;

      const memberSpecificGroup = {
        ...newGroup,
        messages: [
          ...newGroup.messages,
          { id: `m_${Date.now()}_added`, text: `You were added by ${user.name}`, senderId: 'system', timestamp: Date.now() }
        ],
        unreadCount: 1
      };

      console.log(`[ShadowTalk] Sharing group with member: ${member.id}`);
      return supabase.from('chats').upsert({
        owner_id: member.id,
        chat_id: newGroupId,
        chat_data: memberSpecificGroup
      }, { onConflict: 'owner_id, chat_id' });
    });

    await Promise.all(sharePromises);
    console.log('[ShadowTalk] Group creation complete and shared with all members.');
    return newGroup;
  };

  const markAsRead = async (chatId) => {
    if (!user?.id) return;
    const canonicalChatId = chatId.toLowerCase();

    // 1. Update local chat metadata AND message statuses to 'seen' / 'read: true'
    setChats(prev => prev.map(chat => {
      const isMatch = chat.id.toLowerCase() === canonicalChatId ||
                      (chat.contact?.id && chat.contact.id.toLowerCase() === canonicalChatId) ||
                      (chat.contact?.shadowId && chat.contact.shadowId.toLowerCase() === canonicalChatId);
      if (isMatch) {
        return {
          ...chat,
          unreadCount: 0,
          messages: (chat.messages || []).map(m =>
            m.senderId?.toLowerCase() !== user.id.toLowerCase() && !m.read && m.status !== 'seen'
              ? { ...m, read: (settingsRef.current?.readReceipts !== false), status: (settingsRef.current?.readReceipts !== false ? 'seen' : 'delivered') }
              : m
          )
        };
      }
      return chat;
    }));

    // 2. Clear unreadCount in DB for me
    const targetChat = (chatsRef.current || chats).find(c =>
      c.id.toLowerCase() === canonicalChatId ||
      (c.contact?.id && c.contact.id.toLowerCase() === canonicalChatId) ||
      (c.contact?.shadowId && c.contact.shadowId.toLowerCase() === canonicalChatId)
    );
    if (!targetChat) return;

    const actualChatId = targetChat.id.toLowerCase();
    const { data: myData } = await supabase
      .from('chats')
      .select('chat_data, owner_id')
      .or(`owner_id.eq."${user.id}",owner_id.eq."${user.shadowId}"`)
      .eq('chat_id', actualChatId)
      .maybeSingle();

    if (myData?.chat_data) {
      await supabase.from('chats').upsert({
        owner_id: myData.owner_id || user.id,
        chat_id: actualChatId,
        chat_data: { ...myData.chat_data, unreadCount: 0, messages: [] } // keep it light
      }, { onConflict: 'owner_id, chat_id' });
    }

    const unreadMessages = (targetChat.messages || []).filter(m => m.senderId?.toLowerCase() !== user.id.toLowerCase() && !m.read);
    if (unreadMessages.length === 0) return;

    const now = Date.now();
    const unreadMsgIds = unreadMessages.map(m => m.id);

    // 4. Send real-time broadcast of seen status to the sender
    if (chatSubRef.current) {
      chatSubRef.current.send({
        type: 'broadcast',
        event: 'MESSAGE_STATUS_UPDATE',
        payload: {
          chatId: targetChat.type === 'group' ? actualChatId : userRef.current?.id?.toLowerCase(),
          readerId: userRef.current?.id?.toLowerCase(),
          messageIds: unreadMsgIds,
          status: settingsRef.current?.readReceipts !== false ? 'seen' : 'delivered'
        }
      });
      console.log('[ShadowTalk] Broadcasted seen status for:', unreadMsgIds);
    }

    const updatePromises = unreadMessages.map(async m => {
      const targetStatus = settingsRef.current?.readReceipts !== false ? 'seen' : 'delivered';
      
      const rpcPromise = supabase.rpc('append_message_status', {
        msg_id: m.id,
        user_id: user.id.toLowerCase(),
        status_type: targetStatus
      });

      if (targetChat.type === 'group') {
        return rpcPromise;
      }

      const updatedContent = { ...m, read: true, status: 'seen' };

      // Trigger disappearance timer if needed
      if (m.deleteAfterRead && !m.deleteAt) {
        updatedContent.deleteAt = now + (m.disappearDuration || 3600000);
      }

      const keyToUse = m.dbChatId || actualChatId;
      const dbContent = {
        ...updatedContent,
        text: encrypt(updatedContent.text, keyToUse),
        replyTo: updatedContent.replyTo ? {
          ...updatedContent.replyTo,
          text: encrypt(updatedContent.replyTo.text, keyToUse)
        } : null
      };

      return Promise.all([
        rpcPromise.catch(() => {}),
        supabase.from('messages').update({ content: dbContent }).eq('id', m.id).catch(() => {})
      ]);
    });

    await Promise.all(updatePromises).catch(err => console.error('Mark as read atomic error:', err));
  };

  const togglePin = async (chatId) => {
    if (!user?.id) return;

    let isPinned = false;
    setChats(prev => prev.map(chat => {
      if (chat.id === chatId) {
        isPinned = !chat.pinned;
        return { ...chat, pinned: isPinned };
      }
      return chat;
    }));

    // Update DB
    const { data } = await supabase
      .from('chats')
      .select('chat_data, owner_id')
      .or(`owner_id.eq."${user.id}",owner_id.eq."${user.shadowId}"`)
      .eq('chat_id', chatId)
      .maybeSingle();

    if (data?.chat_data) {
      const updated = { ...data.chat_data, pinned: !data.chat_data.pinned };
      await supabase.from('chats').upsert({
        owner_id: data.owner_id || user.id,
        chat_id: chatId,
        chat_data: updated
      }, { onConflict: 'owner_id, chat_id' });
      return updated.pinned;
    }
    return false;
  };

  const broadcastProfileUpdate = async (updates) => {
    if (!userRef.current?.id) return;
    const myId = userRef.current.id;
    const myShadowId = userRef.current.shadowId;

    console.log('[ShadowTalk] Triggering seamless profile sync:', updates);

    // 1. Broadcast to all privacy channels (for multi-tab and active listeners)
    const targets = new Set();
    (chatsRef.current || []).forEach(chat => {
      if (chat.type === 'direct' && !chat.isSelf) {
        targets.add((chat.contact?.id || chat.id).toLowerCase());
      } else if (chat.type === 'group' && chat.members) {
        chat.members.forEach(m => {
          const mid = (m.id || m.shadowId)?.toLowerCase();
          if (mid && mid !== myId.toLowerCase() && mid !== myShadowId?.toLowerCase()) {
            targets.add(mid);
          }
        });
      }
    });

    for (const targetId of targets) {
      const channelName = `privacy_${targetId}`;
      const broadcastChannel = supabase.channel(`${channelName}_sync_${Date.now()}`);
      broadcastChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          broadcastChannel.send({
            type: 'broadcast',
            event: 'profile_update',
            payload: { userId: myId, shadowId: myShadowId, updates }
          });
          setTimeout(() => supabase.removeChannel(broadcastChannel), 2000);
        }
      });
    }

    // 2. Seamless DB-backed Sync (Zero-handshake)
    // Insert a system "profile_sync" message into every active chat
    // This uses the already-open postgres_changes connection for instant delivery
    const activeChats = (chatsRef.current || []).filter(c => !c.isSelf).slice(0, 20); // Limit to top 20 for performance

    for (const chat of activeChats) {
      supabase.from('messages').insert({
        id: `m_psync_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        chat_id: chat.id,
        sender_id: myId.toLowerCase(),
        content: {
          senderId: 'system',
          type: 'profile_sync',
          userId: myId,
          shadowId: myShadowId,
          updates,
          timestamp: Date.now()
        },
        delete_at: null
      }).then(({ error }) => {
        if (error) console.error('[ShadowTalk] Profile sync DB error:', error);
      });
    }
  };

  const updateChatSettings = async (chatId, updates) => {
    if (!user?.id) return;

    setChats(prev => prev.map(chat => {
      if (chat.id?.toLowerCase() === chatId?.toLowerCase()) {
        const updated = { ...chat, ...updates, lastActivity: Date.now() };
        // Also sync the nested chat_data if it exists
        if (chat.chat_data) {
          updated.chat_data = { ...chat.chat_data, ...updates, lastActivity: Date.now() };
        }
        return updated;
      }
      return chat;
    }));

    // Find all records in DB (might be under shortId or shadowId)
    const { data: records } = await supabase
      .from('chats')
      .select('owner_id, chat_data')
      .or(`owner_id.eq."${user.id}",owner_id.eq."${user.shadowId}"`)
      .eq('chat_id', chatId);

    if (records && records.length > 0) {
      for (const record of records) {
        const updated = { ...record.chat_data, ...updates, lastActivity: Date.now() };
        await supabase.from('chats').upsert({
          owner_id: record.owner_id,
          chat_id: chatId,
          chat_data: updated
        }, { onConflict: 'owner_id, chat_id' });
      }
    }

    // 4. BROADCAST Real-time Sync (Multi-channel)
    const targets = [chatId.toLowerCase()];
    const localTarget = (chatsRef.current || []).find(c => String(c.id).toLowerCase() === chatId.toLowerCase());
    if (localTarget?.contact?.shadowId) targets.push(localTarget.contact.shadowId.toLowerCase());
    if (localTarget?.shadowId) targets.push(localTarget.shadowId.toLowerCase());

    for (const targetId of targets) {
      const targetChannelName = `privacy_${targetId}`;
      const broadcastChannel = supabase.channel(targetChannelName + '_sync_' + Date.now());
      broadcastChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await broadcastChannel.send({
            type: 'broadcast',
            event: 'status_change',
            payload: {
              userId: user.id,
              shadowId: user.shadowId,
              status: updates.status,
              isBlocked: updates.isBlocked,
              disappearingConfig: updates.disappearingConfig
            }
          });
          setTimeout(() => supabase.removeChannel(broadcastChannel), 3000);
        }
      });
    }

    // 5. PERSISTENT BACKUP: System message sync (Zero-handshake reliability)
    if (updates.disappearingConfig) {
      const canonicalPartnerId = (localTarget?.id || chatId).toLowerCase();
      const myId = user.id.toLowerCase();
      const syncId = `m_dsync_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      const setterName = user.name || user.id;

      // Send ONE shared message. 
      // For sender: appears in partner's chat. For partner: appears in sender's chat.
      supabase.from('messages').insert({
        id: syncId,
        chat_id: canonicalPartnerId,
        sender_id: myId,
        content: {
          senderId: 'system',
          text: `${setterName} set disappearing messages to ${updates.disappearingConfig.type} (${updates.disappearingConfig.timer})`,
          type: 'notification',
          metadata: {
            isMetadataUpdate: true,
            updates: { disappearingConfig: updates.disappearingConfig },
            partnerId: myId
          },
          timestamp: Date.now()
        },
        delete_at: null
      }).then(({ error }) => {
        if (error) console.error('[ShadowTalk] Sync DB error:', error);
      });
    }
  };

  const updateGroupSettings = async (groupId, updates) => {
    if (!user?.id || !groupId) return;
    const canonicalGroupId = groupId.toLowerCase().trim();

    const targetChat = chats.find(c => String(c.id).toLowerCase().trim() === canonicalGroupId);
    if (!targetChat || targetChat.type !== 'group') {
      console.warn('[ShadowTalk] Group not found for update:', canonicalGroupId);
      return;
    }

    // SECURITY: Validate permissions for restricted updates
    const isCurrentUserAdmin = targetChat && (targetChat.adminId === user.id || (targetChat.members || []).some(m => m && m.id === user.id && m.role === 'admin'));
    if (updates.disappearingConfig !== undefined && !isCurrentUserAdmin) {
      console.warn('[ShadowTalk] Security Block: Non-admin attempted to update disappearingConfig for group', canonicalGroupId);
      showToast('Only admins can modify disappearing messages settings', 'error');
      return;
    }

    // 1. Update local state
    setChats(prev => prev.map(chat => {
      if (String(chat.id).toLowerCase().trim() === canonicalGroupId) {
        return { ...chat, ...updates, lastActivity: Date.now() };
      }
      return chat;
    }));

    // 2. Update Admin's records in Supabase immediately
    // Rule 11: Priority to allow_member_dm
    const updatesWithBoth = { ...updates };
    if (updates.avatarUrl) updatesWithBoth.avatar_url = updates.avatarUrl;
    if (updates.avatar_url) updatesWithBoth.avatarUrl = updates.avatar_url;
    if (updates.allow_member_dm !== undefined) updatesWithBoth.allowMemberDMs = updates.allow_member_dm;
    if (updates.allowMemberDMs !== undefined) updatesWithBoth.allow_member_dm = updates.allowMemberDMs;

    try {
      const { data: adminRecords } = await supabase
        .from('chats')
        .select('chat_data, owner_id, chat_id')
        .or(`owner_id.eq."${user.id}",owner_id.eq."${user.shadowId}"`)
        .eq('chat_id', canonicalGroupId);

      if (adminRecords && adminRecords.length > 0) {
        await Promise.all(adminRecords.map(rec => {
          const updated = { ...rec.chat_data, ...updatesWithBoth, lastActivity: Date.now() };
          return supabase.from('chats').upsert({
            owner_id: rec.owner_id,
            chat_id: rec.chat_id, // Use existing chat_id to avoid creating duplicates
            chat_data: updated
          }, { onConflict: 'owner_id, chat_id' });
        }));
      } else if (targetChat) {
        const updated = { ...targetChat, ...updatesWithBoth, lastActivity: Date.now() };
        await supabase.from('chats').upsert({
          owner_id: user.id.toLowerCase(),
          chat_id: canonicalGroupId,
          chat_data: updated
        }, { onConflict: 'owner_id, chat_id' });
      }
    } catch (err) {
      console.error('[ShadowTalk] Admin metadata sync error:', err);
    }

    // 3. BROADCAST CHANGE TO MEMBERS (Real-time Sync)
    // We send a system message with metadata trigger. 
    // This is the most reliable way as it uses the same path as normal messages.
    if (updatesWithBoth.disappearingConfig || updatesWithBoth.name || updatesWithBoth.avatarUrl || updatesWithBoth.allow_member_dm !== undefined) {
      const config = updatesWithBoth.disappearingConfig;
      const text = config
        ? `Admin set disappearing messages to ${config.type} (${config.timer})`
        : `Admin updated group settings`;

      supabase.from('messages').insert({
        id: `m_gsync_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        chat_id: canonicalGroupId,
        sender_id: user.id.toLowerCase(),
        content: {
          senderId: 'system',
          text,
          type: 'notification',
          metadata: {
            isMetadataUpdate: true,
            updates: updatesWithBoth
          },
          timestamp: Date.now()
        },
        delete_at: null
      }).then(({ error }) => {
        if (error) console.error('[ShadowTalk] Group sync DB error:', error);
      });

      // Also trigger a real-time broadcast for those currently online
      const groupChannel = supabase.channel(`group_${canonicalGroupId}_meta`);
      groupChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await groupChannel.send({
            type: 'broadcast',
            event: 'group_metadata_update',
            payload: { groupId: canonicalGroupId, updates: updatesWithBoth }
          });
          setTimeout(() => supabase.removeChannel(groupChannel), 3000);
        }
      });
    }

    // Update last sync time to avoid immediate refresh loop
    lastSyncRef.current = Date.now();

    // 3. Update OTHER members via Broadcast (Members update their own DB rows upon receipt)
    // We no longer try to update other users' rows directly to avoid RLS and casing issues.

    // 4. Send a system message about the update (Broadcasting)
    try {
      let updateText = '';
      if (updates.name) updateText = `Group name changed to "${updates.name}"`;
      else if (updates.avatarUrl) updateText = `Group photo updated`;
      else if (updates.allow_member_dm !== undefined) updateText = updates.allow_member_dm ? 'Admin enabled member direct messages' : 'Admin disabled member direct messages';
      else if (updates.disappearingConfig) {
        const { type, timer } = updates.disappearingConfig;
        updateText = type === 'Off' ? 'Admin disabled disappearing messages' : `Admin set disappearing messages to ${type} (${timer})`;
      }

      if (updateText) {
        const updatesWithBoth = { ...updates };
        if (updates.avatarUrl) updatesWithBoth.avatar_url = updates.avatarUrl;
        if (updates.avatar_url) updatesWithBoth.avatarUrl = updates.avatar_url;
        if (updates.allow_member_dm !== undefined) updatesWithBoth.allowMemberDMs = updates.allow_member_dm;
        if (updates.allowMemberDMs !== undefined) updatesWithBoth.allow_member_dm = updates.allowMemberDMs;

        const msgId = `m_${Date.now()}_sys`;
        await supabase.from('messages').insert({
          id: msgId,
          chat_id: canonicalGroupId,
          sender_id: user.id.toLowerCase(),
          content: {
            id: msgId,
            text: encrypt(updateText, canonicalGroupId),
            type: 'notification',
            timestamp: Date.now(),
            metadata: {
              isMetadataUpdate: true,
              updates: updatesWithBoth
            }
          }
        });
      }
    } catch (err) {
      console.warn('[ShadowTalk] Broadcast message failed:', err.message);
    }

    // 5. Broadcast to all members via their privacy channels for instant sync
    try {
      const members = targetChat.members || [];
      for (const member of members) {
        const mid = (member.id || member.shadowId)?.toLowerCase();
        if (!mid || mid === user.id.toLowerCase()) continue;

        const channelName = `privacy_${mid}`;
        const broadcastChannel = supabase.channel(`${channelName}_group_upd_${Date.now()}`);

        broadcastChannel.subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await broadcastChannel.send({
              type: 'broadcast',
              event: 'group_metadata_update',
              payload: { groupId: canonicalGroupId, updates: updatesWithBoth }
            });
            setTimeout(() => supabase.removeChannel(broadcastChannel), 2000);
          }
        });
      }
    } catch (err) {
      console.warn('[ShadowTalk] Group broadcast failed:', err.message);
    }

    // UI gets instant success as synchronization happens via broadcast
    return true;
  };

  const deleteMessage = async (chatId, messageIds, forEveryone = false) => {
    const canonicalChatId = chatId.toLowerCase();
    try {
      if (forEveryone) {
        // 1. Delete from atomic messages table (Only if sender or admin)
        await supabase
          .from('messages')
          .delete()
          .in('id', messageIds);
      } else {
        // "Delete for Me" - Store in chat metadata
        const chatToUpdate = chats.find(c => c.id.toLowerCase() === canonicalChatId);
        if (chatToUpdate) {
          const currentDeleted = chatToUpdate.deletedForMe || [];
          const updatedDeleted = [...new Set([...currentDeleted, ...messageIds])];

          await updateChatSettings(chatId, { deletedForMe: updatedDeleted });
        }
      }

      // 1b. BROADCAST the deletion to ensure real-time sync (even if DB events are slow/incomplete)
      if (forEveryone && chatSubRef.current) {
        chatSubRef.current.send({
          type: 'broadcast',
          event: 'MESSAGE_DELETED',
          payload: { messageIds }
        });
      }

      // 2. Update local state immediately
      setChats(prev => prev.map(chat => {
        if (chat.id.toLowerCase() === canonicalChatId) {
          return {
            ...chat,
            messages: (chat.messages || []).filter(m => !messageIds.includes(m.id)),
            lastActivity: Date.now()
          };
        }
        return chat;
      }));
    } catch (err) {
      console.error('[ShadowTalk] Delete message error:', err);
    }
  };

  const bulkDeleteMessages = (chatId, messageIds, forEveryone = false) => deleteMessage(chatId, messageIds, forEveryone);
  const toggleReaction = async (chatId, messageId, emoji) => {
    if (!user?.id) return;
    const canonicalChatId = chatId.toLowerCase();
    const myIdLower = user.id.toLowerCase();

    try {
      // 1. Update local state first for responsiveness
      let updatedMsgContent = null;
      setChats(prev => prev.map(chat => {
        if (chat.id.toLowerCase() === canonicalChatId) {
          const updatedMessages = chat.messages.map(m => {
            if (m.id === messageId) {
              const reactions = { ...(m.reactions || {}) };
              const users = reactions[emoji] || [];

              // Use case-insensitive search in the users array
              const userIdx = users.findIndex(id => id.toLowerCase() === myIdLower);
              if (userIdx >= 0) {
                reactions[emoji] = users.filter((_, idx) => idx !== userIdx);
                if (reactions[emoji].length === 0) delete reactions[emoji];
              } else {
                reactions[emoji] = [...users, myIdLower];
              }
              const updated = { ...m, reactions };
              updatedMsgContent = updated;
              return updated;
            }
            return m;
          });
          return { ...chat, messages: updatedMessages, lastActivity: Date.now() };
        }
        return chat;
      }));

      // 2. Update the atomic messages table
      if (updatedMsgContent) {
        // We need to store the ENCRYPTED version in the DB
        // We need to store the ENCRYPTED version in the DB using the ORIGINAL key
        const encryptionKey = updatedMsgContent.dbChatId || canonicalChatId;
        const dbContent = {
          ...updatedMsgContent,
          text: encrypt(updatedMsgContent.text, encryptionKey),
          replyTo: updatedMsgContent.replyTo ? {
            ...updatedMsgContent.replyTo,
            text: encrypt(updatedMsgContent.replyTo.text, encryptionKey)
          } : null
        };

        // 3. BROADCAST the reaction for instant cross-device sync (WhatsApp model)
        if (chatSubRef.current) {
          chatSubRef.current.send({
            type: 'broadcast',
            event: 'REACTION_TOGGLE',
            payload: { chatId, messageId, emoji, userId: myIdLower }
          });
        }

        await supabase
          .from('messages')
          .update({ content: dbContent })
          .eq('id', messageId);
      }
    } catch (err) {
      console.error('[ShadowTalk] Toggle reaction error:', err);
    }
  };



  const clearMessages = async (chatId) => {
    if (!user?.id) return;
    let targetChat = null;

    setChats(prev => prev.map(chat => {
      if (chat.id === chatId) {
        // Use the timestamp of the latest message as the clear point.
        // If no messages exist, use current time minus a safety margin to avoid clock skew filtering.
        const lastMsgTime = (chat.messages && chat.messages.length > 0)
          ? Math.max(...chat.messages.map(m => m.timestamp))
          : Date.now() - 10000; // 10s safety margin

        targetChat = { ...chat, messages: [], clearedAt: lastMsgTime + 1, lastActivity: Date.now() };
        return targetChat;
      }
      return chat;
    }));

    if (targetChat) {
      // Find actual record
      const { data: records } = await supabase
        .from('chats')
        .select('owner_id')
        .or(`owner_id.eq."${user.id}",owner_id.eq."${user.shadowId}"`)
        .eq('chat_id', chatId)
        .limit(1);

      const data = records?.[0];

      await supabase.from('chats').upsert({
        owner_id: data?.owner_id || user.id,
        chat_id: chatId,
        chat_data: targetChat
      }, { onConflict: 'owner_id, chat_id' });
    }
  };

  const deleteChat = async (chatId) => {
    if (!user?.id) return;
    const canonicalChatId = String(chatId).toLowerCase().trim();
    setChats(prev => prev.filter(c => String(c.id).toLowerCase().trim() !== canonicalChatId));

    // Find and delete actual record
    const { data: records } = await supabase
      .from('chats')
      .select('owner_id, chat_data')
      .or(`owner_id.eq."${user.id}",owner_id.eq."${user.shadowId}"`)
      .eq('chat_id', canonicalChatId)
      .limit(1);

    const data = records?.[0];

    if (data?.owner_id) {
      // Instead of deleting, mark as deleted and clear messages array
      // This preserves clearedAt timestamp so old messages don't reappear
      const existingChatData = data.chat_data || {};
      const updatedChatData = { ...existingChatData, status: 'deleted', messages: [] };
      
      await supabase.from('chats').update({
        chat_data: updatedChatData
      })
        .eq('owner_id', data.owner_id)
        .eq('chat_id', canonicalChatId);
    }
  };

  const blockContact = async (chatId) => {
    if (!user?.id) return;
    await updateChatSettings(chatId, { isBlocked: true });

    // Update recipient's chat data
    try {
      const { data: recipientChat } = await supabase
        .from('chats')
        .select('chat_data')
        .eq('owner_id', chatId)
        .eq('chat_id', user.id)
        .maybeSingle();

      if (recipientChat) {
        const updatedData = { ...recipientChat.chat_data, isBlockedByOther: true };
        await supabase
          .from('chats')
          .update({ chat_data: updatedData })
          .eq('owner_id', chatId)
          .eq('chat_id', user.id);
      }
    } catch (e) {
      console.error('[ShadowTalk] Error updating recipient chat data:', e);
    }

    // Broadcast status change
    const privacyChannel = supabase.channel(`privacy_${chatId.toLowerCase()}`);
    privacyChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await privacyChannel.send({
          type: 'broadcast',
          event: 'status_change',
          payload: { userId: user.id, isBlocked: true }
        });
        setTimeout(() => supabase.removeChannel(privacyChannel), 3000);
      }
    });

    showToast('Contact blocked');
  };

  const unblockContact = async (chatId) => {
    if (!user?.id) return;

    // Update local state first for instant feedback
    setChats(prev => prev.map(chat => {
      if (chat.id === chatId || chat.id?.toLowerCase() === chatId?.toLowerCase()) {
        const updated = { ...chat, isBlocked: false, lastActivity: Date.now() };
        if (updated.chat_data) updated.chat_data.isBlocked = false;
        return updated;
      }
      return chat;
    }));

    await updateChatSettings(chatId, { isBlocked: false, lastActivity: Date.now() });

    // Update recipient's chat data
    try {
      const { data: recipientChat } = await supabase
        .from('chats')
        .select('chat_data')
        .eq('owner_id', chatId)
        .eq('chat_id', user.id)
        .maybeSingle();

      if (recipientChat) {
        const updatedData = { ...recipientChat.chat_data, isBlockedByOther: false };
        await supabase
          .from('chats')
          .update({ chat_data: updatedData })
          .eq('owner_id', chatId)
          .eq('chat_id', user.id);
      }
    } catch (e) {
      console.error('[ShadowTalk] Error updating recipient chat data:', e);
    }

    // Broadcast status change
    const privacyChannel = supabase.channel(`privacy_${chatId.toLowerCase()}`);
    privacyChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await privacyChannel.send({
          type: 'broadcast',
          event: 'status_change',
          payload: { userId: user.id, isBlocked: false }
        });
        setTimeout(() => supabase.removeChannel(privacyChannel), 3000);
      }
    });

    showToast('Contact unblocked');
  };

  const startCall = async (type, contact) => {
    if (!contact || !user?.id) return;

    // Check global permission
    if (!settings.voiceVideo) {
      showToast('Calling is disabled by admin', 'error');
      return;
    }

    try {
      const currentChat = chats.find(c => c.id.toLowerCase() === contact.id.toLowerCase());
      if (currentChat?.isBlocked || currentChat?.isBlockedByOther) {
        showToast('Cannot call: Contact is blocked', 'error');
        return;
      }

      useCallStore.getState().setCallData({ remoteUser: { id: contact.id, name: contact.nickname || contact.name, avatarUrl: contact.avatarUrl } });
      await callService.startCall(contact.id, type, { id: user.id, name: user.name, avatarUrl: user.avatarUrl });
      showToast(`Starting ${type} call...`, 'success');
    } catch (err) {
      showToast('Failed to start call', 'error');
    }
  };

  const endCall = () => {
    const remoteUser = useCallStore.getState().remoteUser;
    callService.endCall(remoteUser?.id);
  };

  const deleteContact = async (chatId) => {
    if (!user?.id) return;
    await updateChatSettings(chatId, { status: 'deleted', reconnection: false, clearedAt: Date.now() });

    // Clear any existing requests between these two users
    await supabase
      .from('requests')
      .delete()
      .or(`and(sender_id.eq."${user.id}",receiver_id.eq."${chatId}"),and(sender_id.eq."${chatId}",receiver_id.eq."${user.id}")`);

    // Update recipient's chat data to set isDeletedByOther: true
    try {
      const { data: recipientChat } = await supabase
        .from('chats')
        .select('chat_data')
        .eq('owner_id', chatId)
        .eq('chat_id', user.id)
        .maybeSingle();

      if (recipientChat) {
        const updatedData = { ...recipientChat.chat_data, isDeletedByOther: true };
        await supabase
          .from('chats')
          .update({ chat_data: updatedData })
          .eq('owner_id', chatId)
          .eq('chat_id', user.id);
      }
    } catch (e) {
      console.error('[ShadowTalk] Error updating recipient chat data:', e);
    }

    // Broadcast status change to the other user for real-time UI update
    const targetChannelName = `privacy_${chatId.toLowerCase()}`;
    const privacyChannel = supabase.channel(targetChannelName);

    console.log('[ShadowTalk] Sending privacy broadcast to:', targetChannelName);
    privacyChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        const { error } = await privacyChannel.send({
          type: 'broadcast',
          event: 'status_change',
          payload: { userId: user.id, status: 'deleted' }
        });
        if (error) console.error('[ShadowTalk] Broadcast error:', error);
        else console.log('[ShadowTalk] Broadcast sent successfully');

        // Give it a bit more time before removing the channel
        setTimeout(() => supabase.removeChannel(privacyChannel), 3000);
      }
    });

    // Add a system message to notify both sides
    const sysId = `sys_del_${Date.now()}`;
    const otherId = chatId.toLowerCase();

    // Insert system message into the messages table
    // This will appear in the chat history for both users
    await supabase.from('messages').insert({
      id: sysId,
      chat_id: otherId,
      sender_id: 'system',
      content: {
        id: sysId,
        text: encrypt('You are no longer friends with this contact.', otherId),
        senderId: 'system',
        partnerId: user.id.toLowerCase(),
        timestamp: Date.now()
      }
    });

    showToast('Contact removed');
  };

  const deleteGroup = async (groupId) => {
    if (!user?.id || !groupId) return;
    try {
      const canonicalGroupId = groupId.toLowerCase().trim();
      console.log('[ShadowTalk] deleteGroup attempting for:', canonicalGroupId);

      const targetChat = chats.find(c => String(c.id).toLowerCase().trim() === canonicalGroupId);
      if (!targetChat) {
        console.warn('[ShadowTalk] Group not found in local state:', canonicalGroupId);
        showToast('Group not found', 'error');
        return;
      }

      // SECURITY: Validate group ownership/admin role frontend-side
      const isCurrentUserAdmin = targetChat && (targetChat.adminId === user.id || (targetChat.members || []).some(m => m && m.id === user.id && m.role === 'admin'));
      if (!isCurrentUserAdmin) {
        console.warn('[ShadowTalk] Security Block: Non-admin attempted to delete group', canonicalGroupId);
        showToast('Only admins can delete this group', 'error');
        return;
      }

      // 1. Delete ALL group member rows from the chats table
      // SECURITY: Validate group ownership/admin role server-side in PostgREST
      console.log('[ShadowTalk] Deleting group chats records from DB...');
      const { error: dbError } = await supabase
        .from('chats')
        .delete()
        .eq('chat_id', canonicalGroupId)
        .filter('chat_data->>adminId', 'eq', targetChat.adminId);

      if (dbError) {
        console.error('[ShadowTalk] Failed to delete group records from DB:', dbError);
        throw new Error(dbError.message || 'Failed to delete group from database');
      }

      // 2. Delete all group messages from the messages table
      console.log('[ShadowTalk] Deleting group messages from DB...');
      const { error: msgError } = await supabase
        .from('messages')
        .delete()
        .eq('chat_id', canonicalGroupId);

      if (msgError) {
        console.warn('[ShadowTalk] Group message deletion warning:', msgError);
      }

      // 3. Broadcast GROUP_DELETED event instantly to all connected members
      if (chatSubRef.current) {
        console.log('[ShadowTalk] Broadcasting GROUP_DELETED event for group:', canonicalGroupId);
        chatSubRef.current.send({
          type: 'broadcast',
          event: 'GROUP_DELETED',
          payload: {
            groupId: canonicalGroupId
          }
        });
      }

      // 4. Remove the group locally from current admin's dashboard/chat list
      setChats(prev => prev.filter(c => String(c.id).toLowerCase().trim() !== canonicalGroupId));

      showToast('Group deleted successfully', 'success');
    } catch (err) {
      console.error('[ShadowTalk] deleteGroup fatal error:', err);
      showToast(err.message || 'Failed to delete group', 'error');
      throw err;
    }
  };

  const leaveGroup = async (groupId) => {
    if (!user?.id) return;
    try {
      const canonicalGroupId = groupId.toLowerCase().trim();
      console.log('[ShadowTalk] leaveGroup attempting for:', canonicalGroupId);
      const targetChat = chats.find(c => String(c.id).toLowerCase().trim() === canonicalGroupId);

      if (!targetChat) {
        console.warn('[ShadowTalk] Group not found in local state:', canonicalGroupId);
        await deleteChat(groupId);
        return;
      }

      const systemMsg = {
        id: `m_${Date.now()}_left`,
        text: `${user.name} left the group`,
        senderId: 'system',
        type: 'notification',
        timestamp: Date.now()
      };

      // 1. Save system message FIRST to get the official Server-Side Timestamp
      console.log('[ShadowTalk] Recording leave activity in DB...');
      const { data: sysMsgData, error: sysMsgError } = await supabase.from('messages').insert({
        id: systemMsg.id,
        chat_id: canonicalGroupId,
        sender_id: user.id.toLowerCase(),
        content: { ...systemMsg, text: encrypt(systemMsg.text, canonicalGroupId) }
      }).select('created_at').single();

      if (sysMsgError || !sysMsgData) {
        console.error('[ShadowTalk] Failed to insert leave system message:', sysMsgError);
        throw new Error(sysMsgError?.message || 'Failed to record leave activity');
      }

      const serverTime = sysMsgData.created_at ? new Date(sysMsgData.created_at).getTime() : Date.now();
      const leftAt = serverTime;

      // 2. Remove user from members list
      const updatedMembers = (targetChat.members || []).filter(m => {
        if (!m || !m.id) return false;
        const idMatch = String(m.id).toLowerCase() === String(user.id).toLowerCase();
        const shadowMatch = user.shadowId && m.shadowId && String(m.shadowId).toLowerCase() === String(user.shadowId).toLowerCase();
        return !(idMatch || shadowMatch);
      });

      let intervals = [...(targetChat.membershipIntervals || [])];
      if (intervals.length > 0 && !intervals[intervals.length - 1].removedAt) {
        intervals[intervals.length - 1].removedAt = leftAt;
      } else if (intervals.length === 0) {
        intervals.push({ joinedAt: targetChat.lastActivity || (leftAt - 3600000), removedAt: leftAt });
      }

      // 3. Update current user's record to 'removed'
      const myChatUpdate = {
        ...targetChat,
        status: 'removed',
        exitType: 'left',
        removedAt: leftAt,
        membershipIntervals: intervals,
        members: updatedMembers,
        lastActivity: leftAt
      };

      // Update local state first for instant feedback
      setChats(prev => prev.map(c =>
        String(c.id).toLowerCase().trim() === canonicalGroupId ? { ...myChatUpdate, messages: [...(c.messages || []), systemMsg] } : c
      ));

      // Update DB for me
      console.log('[ShadowTalk] Updating my group status to removed...');
      const { error: myUpdateError } = await supabase.from('chats').upsert({
        owner_id: user.id.toLowerCase(),
        chat_id: canonicalGroupId,
        chat_data: myChatUpdate
      }, { onConflict: 'owner_id, chat_id' });

      if (myUpdateError) {
        console.error('[ShadowTalk] Error updating my chat record:', myUpdateError);
        throw new Error(myUpdateError.message || 'Failed to update your group status');
      }

      // 4. Update other members' records (non-blocking) - OPTIONAL but good for consistency
      // We don't throw here if it fails, as we already left successfully.
      updatedMembers.forEach(async (m) => {
        try {
          const { data: existing } = await supabase
            .from('chats')
            .select('chat_data')
            .eq('owner_id', m.id.toLowerCase())
            .eq('chat_id', canonicalGroupId)
            .maybeSingle();

          if (existing?.chat_data) {
            const updatedData = {
              ...existing.chat_data,
              members: updatedMembers,
              lastActivity: leftAt
            };
            await supabase.from('chats').upsert({
              owner_id: m.id.toLowerCase(),
              chat_id: canonicalGroupId,
              chat_data: updatedData
            }, { onConflict: 'owner_id, chat_id' });
          }
        } catch (err) {
          console.error('[ShadowTalk] Error updating other member after leave:', err);
        }
      });

      // 5. Broadcast change for instant UI update for others
      if (chatSubRef.current) {
        chatSubRef.current.send({
          type: 'broadcast',
          event: 'GROUP_SYNC',
          payload: {
            groupId: canonicalGroupId,
            members: updatedMembers,
            lastActivity: leftAt,
            type: 'member_left'
          }
        });
      }

      showToast('You left the group');
    } catch (err) {
      console.error('[ShadowTalk] leaveGroup fatal error:', err);
      throw err; // Re-throw to be caught by UI
    }
  };

  const rejoinGroup = async (groupId) => {
    if (!user?.id) return;
    const canonicalGroupId = groupId.toLowerCase().trim();

    // Send a rejoin request message
    const requestMsg = {
      id: `m_${Date.now()}_rejoin`,
      text: `${user.name} requested to rejoin the group`,
      senderId: user.id,
      type: 'rejoin_request',
      timestamp: Date.now()
    };

    const { error } = await supabase.from('messages').insert({
      id: requestMsg.id,
      chat_id: canonicalGroupId,
      sender_id: user.id.toLowerCase(),
      content: { ...requestMsg, text: encrypt(requestMsg.text, canonicalGroupId) }
    });

    if (error) {
      console.error('[ShadowTalk] Failed to send rejoin request:', error);
      showToast('Failed to send rejoin request', 'error');
    } else {
      showToast('Rejoin request sent', 'success');
      // Update local state to reflect we sent the request (optional, but good for UI)
      setChats(prev => prev.map(c =>
        c.id.toLowerCase().trim() === canonicalGroupId ? { ...c, rejoinRequested: true } : c
      ));
    }
  };

  const addMemberToGroup = async (groupId, newMemberIdOrShadowId) => {
    if (!user?.id) return;

    const canonicalGroupId = groupId.toLowerCase();
    const targetChat = chats.find(c => c.id.toLowerCase() === canonicalGroupId);
    const isCurrentUserAdmin = targetChat && (targetChat.adminId === user.id || (targetChat.members || []).some(m => m && m.id === user.id && m.role === 'admin'));
    if (!targetChat || !isCurrentUserAdmin) {
      showToast('Only admin can add members', 'error');
      return;
    }

    const memberIdLower = newMemberIdOrShadowId.toLowerCase();
    // Resolve new member
    const { data: memberUser } = await supabase
      .from('users')
      .select('id, shadow_id, name')
      .or(`id.eq."${memberIdLower}",shadow_id.eq."${memberIdLower}"`)
      .maybeSingle();

    const finalId = (memberUser?.id || memberIdLower).toLowerCase();
    const finalName = memberUser?.name || 'Shadow ' + memberIdLower.substring(0, 6);
    const shadowHex = (memberUser?.shadow_id || memberIdLower).toLowerCase();

    if (!targetChat) {
      showToast('Group not found', 'error');
      return;
    }

    if ((targetChat.members || []).some(m => m.id.toLowerCase() === finalId)) {
      showToast('Member already in group', 'info');
      return;
    }

    const newMember = {
      id: finalId,
      shadowId: shadowHex,
      name: finalName,
      role: 'member'
    };

    const systemMsg = {
      id: `m_${Date.now()}`,
      text: `${finalName} was added by ${user.name}`,
      senderId: 'system',
      type: 'notification',
      timestamp: Date.now(),
      addedBy: user.name,
      addedId: finalId,
      // Include metadata so the new member can "discover" the group instantly
      groupMetadata: {
        id: canonicalGroupId,
        type: 'group',
        name: targetChat.name,
        adminId: targetChat.adminId,
        avatarUrl: targetChat.avatarUrl,
        members: [...(targetChat.members || []), newMember],
        createdAt: targetChat.createdAt || Date.now(),
        allowMemberDMs: targetChat.allowMemberDMs,
        disappearingConfig: targetChat.disappearingConfig
      }
    };

    const now = Date.now();

    // 1. Save system message FIRST
    const { data: sysMsgData, error: sysMsgError } = await supabase.from('messages').insert({
      id: systemMsg.id,
      chat_id: canonicalGroupId,
      sender_id: user.id.toLowerCase(), // Use current user ID as sender_id to avoid FK constraint errors
      content: { ...systemMsg, text: encrypt(systemMsg.text, canonicalGroupId) }
    }).select('created_at').single();

    if (sysMsgError) {
      console.error('[ShadowTalk] Failed to insert join system message:', sysMsgError);
      showToast('Failed to add member', 'error');
      return;
    }

    const serverJoinTime = new Date(sysMsgData.created_at).getTime();
    // The strictJoinTime is now the exact millisecond the server processed the join
    const strictJoinTime = serverJoinTime;

    const updatedGroupMetadata = {
      ...targetChat,
      status: 'active', // Ensure it's active if re-adding
      members: [...(targetChat.members || []), newMember],
      lastActivity: strictJoinTime
    };

    // Update for all members (including new one)
    const updatePromises = updatedGroupMetadata.members.map(async (m) => {
      try {
        const { data: existing } = await supabase
          .from('chats')
          .select('chat_data')
          .eq('owner_id', m.id.toLowerCase())
          .eq('chat_id', canonicalGroupId)
          .maybeSingle();

        let memberSpecificData;
        if (existing?.chat_data) {
          memberSpecificData = {
            ...existing.chat_data,
            status: 'active',
            members: updatedGroupMetadata.members,
            lastActivity: strictJoinTime
          };

          // If this is the NEW member, update their intervals
          if (m.id.toLowerCase() === finalId) {
            let intervals = [...(memberSpecificData.membershipIntervals || [])];
            // Close any open interval just in case (shouldn't happen but safe)
            if (intervals.length > 0 && !intervals[intervals.length - 1].removedAt) {
              intervals[intervals.length - 1].removedAt = strictJoinTime;
            }
            intervals.push({ joinedAt: strictJoinTime, removedAt: null });
            memberSpecificData.membershipIntervals = intervals;
            memberSpecificData.removedAt = null;
          }
        } else {
          // Completely new member for this group record
          memberSpecificData = {
            ...updatedGroupMetadata,
            membershipIntervals: [{ joinedAt: strictJoinTime, removedAt: null }]
          };
        }

        await supabase.from('chats').upsert({
          owner_id: m.id.toLowerCase(),
          chat_id: canonicalGroupId,
          chat_data: memberSpecificData
        }, { onConflict: 'owner_id, chat_id' });
      } catch (err) {
        console.error('[ShadowTalk] Error updating member in addMember:', err);
      }
    });

    await Promise.all(updatePromises);

    // Update local state if I am the admin who added
    setChats(prev => prev.map(c => {
      if (c.id.toLowerCase().trim() === canonicalGroupId) {
        let memberSpecificData = { ...c, members: updatedGroupMetadata.members };
        // If I added MYSELF (e.g. testing or weird edge case), update my intervals too
        if (finalId === user.id.toLowerCase()) {
          let intervals = [...(memberSpecificData.membershipIntervals || [])];
          if (intervals.length > 0 && !intervals[intervals.length - 1].removedAt) {
            intervals[intervals.length - 1].removedAt = strictJoinTime;
          }
          intervals.push({ joinedAt: strictJoinTime, removedAt: null });
          memberSpecificData.membershipIntervals = intervals;
          memberSpecificData.removedAt = null;
          memberSpecificData.status = 'active';
        }
        return memberSpecificData;
      }
      return c;
    }));

    // 5. Broadcast to others for instant UI update
    if (chatSubRef.current) {
      chatSubRef.current.send({
        type: 'broadcast',
        event: 'GROUP_SYNC',
        payload: {
          groupId: canonicalGroupId,
          members: updatedGroupMetadata.members,
          lastActivity: strictJoinTime,
          type: 'member_added'
        }
      });
    }

    showToast(`${finalName} added to group`);
  };

  const removeMemberFromGroup = async (groupId, memberId) => {
    if (!user?.id) return;
    const canonicalGroupId = groupId.toLowerCase();
    const targetChat = chats.find(c => c.id.toLowerCase() === canonicalGroupId);

    const isCurrentUserAdmin = targetChat && (targetChat.adminId === user.id || (targetChat.members || []).some(m => m && m.id === user.id && m.role === 'admin'));
    if (!targetChat || !isCurrentUserAdmin) {
      showToast('Only admin can remove members', 'error');
      return;
    }

    const memberToRemove = (targetChat.members || []).find(m =>
      m && (String(m.id).toLowerCase() === String(memberId).toLowerCase() || String(m.shadowId).toLowerCase() === String(memberId).toLowerCase())
    );
    if (!memberToRemove) return;

    const updatedMembers = (targetChat.members || []).filter(m => {
      if (!m || !m.id) return false;
      const idMatch = String(m.id).toLowerCase() === String(memberId).toLowerCase();
      const shadowMatch = m.shadowId && String(m.shadowId).toLowerCase() === String(memberId).toLowerCase();
      return !(idMatch || shadowMatch);
    });
    const memberIdLower = memberId.toLowerCase();

    const systemMsg = {
      id: `m_${Date.now()}`,
      text: `${memberToRemove.name} was removed by ${user.name}`,
      senderId: 'system',
      type: 'notification',
      timestamp: Date.now()
    };

    // 1. Update LOCAL state immediately for instant feedback
    setChats(prev => prev.map(c => {
      if (String(c.id).toLowerCase().trim() === canonicalGroupId) {
        return {
          ...c,
          members: updatedMembers,
          messages: [...(c.messages || []), systemMsg]
        };
      }
      return c;
    }));

    const updatedGroupMetadata = {
      ...targetChat,
      members: updatedMembers,
      messages: [], // DB blob stays empty
      lastActivity: Date.now()
    };

    // 1. Save system message FIRST to get the official Server-Side Timestamp
    const { data: sysMsgData, error: sysMsgError } = await supabase.from('messages').insert({
      id: systemMsg.id,
      chat_id: canonicalGroupId,
      sender_id: user.id.toLowerCase(),
      content: { ...systemMsg, text: encrypt(systemMsg.text, canonicalGroupId) }
    }).select('created_at').single();

    if (sysMsgError) {
      console.error('[ShadowTalk] Failed to insert removal system message:', sysMsgError);
      showToast('Failed to remove member', 'error');
      return;
    }

    const serverRemoveTime = new Date(sysMsgData.created_at).getTime();
    const removedAt = serverRemoveTime;

    // 2. Update the chat record for the removed member
    const { data: memberChatData } = await supabase
      .from('chats')
      .select('chat_data')
      .eq('owner_id', memberIdLower)
      .eq('chat_id', canonicalGroupId)
      .maybeSingle();

    if (memberChatData) {
      let intervals = [...(memberChatData.chat_data.membershipIntervals || [])];
      // Close the current active interval
      if (intervals.length > 0 && !intervals[intervals.length - 1].removedAt) {
        intervals[intervals.length - 1].removedAt = removedAt;
      } else if (intervals.length === 0) {
        // Fallback: create an interval that ends now
        intervals.push({ joinedAt: memberChatData.chat_data.lastActivity || (removedAt - 3600000), removedAt });
      }

      const removedUserChat = {
        ...memberChatData.chat_data,
        membershipIntervals: intervals,
        status: 'removed',
        exitType: 'removed',
        removedAt,
        members: updatedMembers,
        lastActivity: removedAt
      };

      await supabase.from('chats').upsert({
        owner_id: memberIdLower,
        chat_id: canonicalGroupId,
        chat_data: removedUserChat
      }, { onConflict: 'owner_id, chat_id' });
    }

    // Try to find the removed member's real row by looking at all rows for this group
    const { data: allGroupChats } = await supabase
      .from('chats')
      .select('owner_id, chat_data')
      .eq('chat_id', canonicalGroupId);
      
    if (allGroupChats) {
      // Update ALL rows in the group to have the new members array
      // This ensures even offline removed members get locked out when they fetch their row
      const updateAllPromises = allGroupChats.map(async (c) => {
        // DO NOT overwrite the removed member's row here, because we already updated their interval!
        if (c.owner_id === memberIdLower) return;
        const newChatData = { ...c.chat_data, members: updatedMembers };
        await supabase.from('chats').update({ chat_data: newChatData })
          .eq('owner_id', c.owner_id)
          .eq('chat_id', canonicalGroupId);
      });
      await Promise.all(updateAllPromises);
    }

    // 3. Save system message and trigger background work
    Promise.all([
      supabase.from('messages').insert({
        chat_id: canonicalGroupId,
        content: { ...systemMsg, text: encrypt(systemMsg.text, canonicalGroupId) }
      })
    ]).catch(err => console.error('[ShadowTalk] Post-removal sync error:', err));

    // 6. Broadcast for instant UI update
    if (chatSubRef.current) {
      chatSubRef.current.send({
        type: 'broadcast',
        event: 'GROUP_SYNC',
        payload: {
          groupId: canonicalGroupId,
          members: updatedMembers,
          lastActivity: removedAt,
          type: 'member_removed'
        }
      });
    }

    // Update the SENDER'S local state immediately
    setChats(prev => prev.map(c => {
      if (c.id.toLowerCase() === canonicalGroupId) {
        return {
          ...c,
          members: updatedMembers,
          lastActivity: removedAt,
          messages: [...(c.messages || []), systemMsg]
        };
      }
      return c;
    }));

    showToast(`${memberToRemove.name} removed from group`);
  };

  const promoteMemberToAdmin = async (groupId, memberId) => {
    if (!user?.id) return;
    const canonicalGroupId = groupId.toLowerCase();
    const targetChat = chats.find(c => c.id.toLowerCase() === canonicalGroupId);

    const isCurrentUserAdmin = targetChat && (targetChat.adminId === user.id || (targetChat.members || []).some(m => m && m.id === user.id && m.role === 'admin'));
    if (!targetChat || !isCurrentUserAdmin) {
      showToast('Only admin can promote members', 'error');
      return;
    }

    const memberToPromote = (targetChat.members || []).find(m =>
      m && (String(m.id).toLowerCase() === String(memberId).toLowerCase() || String(m.shadowId).toLowerCase() === String(memberId).toLowerCase())
    );
    if (!memberToPromote) return;

    const updatedMembers = (targetChat.members || []).map(m => {
      if (m && (String(m.id).toLowerCase() === String(memberId).toLowerCase() || String(m.shadowId).toLowerCase() === String(memberId).toLowerCase())) {
        return { ...m, role: 'admin' };
      }
      return m;
    });

    const systemMsg = {
      id: `m_${Date.now()}`,
      text: `${memberToPromote.name} was promoted to Admin by ${user.name}`,
      senderId: 'system',
      type: 'notification',
      timestamp: Date.now()
    };

    // 1. Update LOCAL state immediately for instant feedback
    setChats(prev => prev.map(c => {
      if (String(c.id).toLowerCase().trim() === canonicalGroupId) {
        return {
          ...c,
          members: updatedMembers,
          messages: [...(c.messages || []), systemMsg]
        };
      }
      return c;
    }));

    const updatedGroupMetadata = {
      ...targetChat,
      members: updatedMembers,
      messages: [], // DB blob stays empty
      lastActivity: Date.now()
    };

    // 1. Save system message FIRST to get the official Server-Side Timestamp
    const { data: sysMsgData, error: sysMsgError } = await supabase.from('messages').insert({
      id: systemMsg.id,
      chat_id: canonicalGroupId,
      sender_id: user.id.toLowerCase(),
      content: { ...systemMsg, text: encrypt(systemMsg.text, canonicalGroupId) }
    }).select('created_at').single();

    if (sysMsgError) {
      console.error('[ShadowTalk] Failed to insert promotion system message:', sysMsgError);
      showToast('Failed to promote member', 'error');
      return;
    }

    const serverPromoTime = new Date(sysMsgData.created_at).getTime();

    // 2. Update remaining members' rows in DB (non-blocking)
    const updatePromises = updatedMembers.map(async (m) => {
      try {
        const { data: existing } = await supabase
          .from('chats')
          .select('chat_data')
          .eq('owner_id', m.id.toLowerCase()) // Normalize
          .eq('chat_id', canonicalGroupId)
          .maybeSingle();

        const baseChat = existing?.chat_data || updatedGroupMetadata;
        await supabase.from('chats').upsert({
          owner_id: m.id.toLowerCase(), // Normalize
          chat_id: canonicalGroupId,
          chat_data: { ...baseChat, members: updatedMembers, messages: [], lastActivity: Date.now() }
        }, { onConflict: 'owner_id, chat_id' });
      } catch (e) {
        console.error('[ShadowTalk] Background sync failed for member:', m.id, e);
      }
    });

    // 3. Save system message and trigger background work
    Promise.all([
      supabase.from('messages').insert({
        chat_id: canonicalGroupId,
        content: { ...systemMsg, text: encrypt(systemMsg.text, canonicalGroupId) }
      }),
      ...updatePromises
    ]).catch(err => console.error('[ShadowTalk] Post-promotion sync error:', err));

    // 6. Broadcast for instant UI update
    if (chatSubRef.current) {
      chatSubRef.current.send({
        type: 'broadcast',
        event: 'GROUP_SYNC',
        payload: {
          groupId: canonicalGroupId,
          members: updatedMembers,
          lastActivity: serverPromoTime,
          type: 'member_promoted'
        }
      });
    }

    showToast(`${memberToPromote.name} promoted to Admin`);
  };

  const demoteAdminToMember = async (groupId, memberId) => {
    if (!user?.id) return;
    const canonicalGroupId = groupId.toLowerCase();
    const targetChat = chats.find(c => c.id.toLowerCase() === canonicalGroupId);

    // ONLY the head admin (group creator) can demote
    const isHeadAdmin = targetChat && targetChat.adminId === user.id;
    if (!targetChat || !isHeadAdmin) {
      showToast('Only the head admin can demote other admins', 'error');
      return;
    }

    const memberToDemote = (targetChat.members || []).find(m =>
      m && (String(m.id).toLowerCase() === String(memberId).toLowerCase() || String(m.shadowId).toLowerCase() === String(memberId).toLowerCase())
    );
    if (!memberToDemote || memberToDemote.role !== 'admin') return;

    if (String(memberToDemote.id).toLowerCase() === targetChat.adminId.toLowerCase()) {
      showToast('Cannot demote the head admin', 'error');
      return;
    }

    const updatedMembers = (targetChat.members || []).map(m => {
      if (m && (String(m.id).toLowerCase() === String(memberId).toLowerCase() || String(m.shadowId).toLowerCase() === String(memberId).toLowerCase())) {
        return { ...m, role: 'member' };
      }
      return m;
    });

    const systemMsg = {
      id: `m_${Date.now()}`,
      text: `${memberToDemote.name} was demoted to Member by ${user.name}`,
      senderId: 'system',
      type: 'notification',
      timestamp: Date.now()
    };

    setChats(prev => prev.map(c => {
      if (String(c.id).toLowerCase().trim() === canonicalGroupId) {
        return {
          ...c,
          members: updatedMembers,
          messages: [...(c.messages || []), systemMsg]
        };
      }
      return c;
    }));

    const updatedGroupMetadata = {
      ...targetChat,
      members: updatedMembers,
      messages: [],
      lastActivity: Date.now()
    };

    const { data: sysMsgData, error: sysMsgError } = await supabase.from('messages').insert({
      id: systemMsg.id,
      chat_id: canonicalGroupId,
      sender_id: user.id.toLowerCase(),
      content: { ...systemMsg, text: encrypt(systemMsg.text, canonicalGroupId) }
    }).select('created_at').single();

    if (sysMsgError) {
      console.error('[ShadowTalk] Failed to insert demotion system message:', sysMsgError);
      showToast('Failed to demote member', 'error');
      return;
    }

    const serverDemoteTime = new Date(sysMsgData.created_at).getTime();

    const updatePromises = updatedMembers.map(async (m) => {
      try {
        const { data: existing } = await supabase
          .from('chats')
          .select('chat_data')
          .eq('owner_id', m.id.toLowerCase())
          .eq('chat_id', canonicalGroupId)
          .maybeSingle();

        const baseChat = existing?.chat_data || updatedGroupMetadata;
        await supabase.from('chats').upsert({
          owner_id: m.id.toLowerCase(),
          chat_id: canonicalGroupId,
          chat_data: { ...baseChat, members: updatedMembers, messages: [], lastActivity: Date.now() }
        }, { onConflict: 'owner_id, chat_id' });
      } catch (e) {
        console.error('[ShadowTalk] Background sync failed for member:', m.id, e);
      }
    });

    Promise.all([
      supabase.from('messages').insert({
        chat_id: canonicalGroupId,
        content: { ...systemMsg, text: encrypt(systemMsg.text, canonicalGroupId) }
      }),
      ...updatePromises
    ]).catch(err => console.error('[ShadowTalk] Post-demotion sync error:', err));

    if (chatSubRef.current) {
      chatSubRef.current.send({
        type: 'broadcast',
        event: 'GROUP_SYNC',
        payload: {
          groupId: canonicalGroupId,
          members: updatedMembers,
          lastActivity: serverDemoteTime,
          type: 'member_demoted'
        }
      });
    }

    showToast(`${memberToDemote.name} demoted to Member`);
  };
  async function syncMissedMessages() {
    if (!user?.id || !navigator.onLine) return;
    console.log('[ShadowTalk] Syncing missed messages...');

    const currentChats = chatsRef.current || [];
    let updatedChats = [...currentChats];
    let anyNewMsgs = false;

    for (let i = 0; i < updatedChats.length; i++) {
      const chat = updatedChats[i];
      const lastMsg = chat.messages?.[chat.messages.length - 1];
      const lastTimestamp = lastMsg?.timestamp || 0;

      const { data: newMsgs, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chat.id.toLowerCase())
        .gt('created_at', new Date(lastTimestamp).toISOString())
        .order('created_at', { ascending: true });

      if (error) {
        console.error(`[ShadowTalk] Error syncing messages for chat ${chat.id}:`, error);
        continue;
      }

      if (newMsgs && newMsgs.length > 0) {
        console.log(`[ShadowTalk] Found ${newMsgs.length} missed messages for chat ${chat.id}`);
        anyNewMsgs = true;
        
        const existingIds = new Set(chat.messages?.map(m => m.id) || []);
        const filteredNewMsgs = newMsgs
          .filter(m => !existingIds.has(m.id))
          .map(m => {
            const content = m.content;
            return {
              ...content,
              id: m.id,
              text: decrypt(content.text, chat.id),
              timestamp: new Date(m.created_at).getTime()
            };
          });

        const mergedMsgs = [...(chat.messages || []), ...filteredNewMsgs];
        mergedMsgs.sort((a, b) => a.timestamp - b.timestamp);

        updatedChats[i] = { 
          ...chat, 
          messages: mergedMsgs, 
          lastActivity: Math.max(chat.lastActivity || 0, mergedMsgs[mergedMsgs.length - 1]?.timestamp || 0) 
        };
      }
    }

    if (anyNewMsgs) {
      setChats(updatedChats);
      markIncomingMessagesAsDelivered(updatedChats, user.id);
    }
  };

  async function retryPendingMessages() {
    if (!user?.id || !navigator.onLine) return;
    console.log('[ShadowTalk] Retrying pending messages...');

    const currentChats = chatsRef.current || [];
    for (const chat of currentChats) {
      const failedMsgs = chat.messages?.filter(m => m.deliveryStatus === 'failed') || [];
      for (const msg of failedMsgs) {
        console.log(`[ShadowTalk] Retrying message ${msg.id} for chat ${chat.id}`);
        
        setChats(prev => prev.map(c => {
          if (c.id.toLowerCase() === chat.id.toLowerCase()) {
            return {
              ...c,
              messages: (c.messages || []).map(m =>
                m.id === msg.id ? { ...m, deliveryStatus: 'sending' } : m
              )
            };
          }
          return c;
        }));

        const encryptedMsg = {
          ...msg,
          text: encrypt(msg.text, chat.id),
          replyTo: msg.replyTo ? {
            ...msg.replyTo,
            text: encrypt(msg.replyTo.text, chat.id)
          } : null
        };

        supabase.from('messages').insert({
          id: msg.id,
          chat_id: chat.id.toLowerCase(),
          sender_id: user.id.toLowerCase(),
          content: encryptedMsg,
          delete_at: msg.deleteAt || null
        }).select('created_at').single()
        .then(({ data: dbMsg }) => {
          setChats(prev => prev.map(c => {
            if (c.id.toLowerCase() === chat.id.toLowerCase()) {
              const msgs = [...(c.messages || [])];
              const idx = msgs.findIndex(m => m.id === msg.id);
              if (idx >= 0) {
                msgs[idx] = { ...msgs[idx], deliveryStatus: 'sent' };
                if (dbMsg?.created_at) {
                  const serverTime = new Date(dbMsg.created_at).getTime();
                  msgs[idx].timestamp = serverTime;
                  msgs.sort((a, b) => a.timestamp - b.timestamp);
                }
              }
              const serverTime = dbMsg?.created_at ? new Date(dbMsg.created_at).getTime() : Date.now();
              return { ...c, messages: msgs, lastActivity: Math.max(c.lastActivity || 0, serverTime) };
            }
            return c;
          }));
        }, (err) => {
          console.error(`[ShadowTalk] Retry failed for message ${msg.id}:`, err);
          setChats(prev => prev.map(c => {
            if (c.id.toLowerCase() === chat.id.toLowerCase()) {
              const msgs = [...(c.messages || [])];
              const idx = msgs.findIndex(m => m.id === msg.id);
              if (idx >= 0) {
                msgs[idx] = { ...msgs[idx], deliveryStatus: 'failed' };
              }
              return { ...c, messages: msgs };
            }
            return c;
          }));
        });
      }
    }
  };

  const inviteFriend = async () => {
    const appUrl = 'https://shadowtalk.app'; // Placeholder
    const inviteMessage = `🚀 Have you tried ShadowTalk yet?\n\nIt's the ultimate anonymous messaging app with zero data tracking. No phone, no email, just pure privacy.\n\nDownload it here: ${appUrl}\n\nLet's chat securely! 🔒✨`;

    const res = await shareContent({
      title: 'Join me on ShadowTalk',
      text: inviteMessage,
      url: appUrl
    });

    if (!res.success && res.reason === 'unsupported') {
      window.open(`https://wa.me/?text=${encodeURIComponent(inviteMessage)}`, '_blank');
      navigator.clipboard.writeText(inviteMessage);
      showToast('Invite link copied and opening WhatsApp...', 'info');
    }
  };

  const openViewer = (blobUrl, filename, mimeType) => {
    const viewerHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>${filename || 'Document'}</title>
            <style>
              body, html { margin: 0; padding: 0; height: 100%; width: 100%; overflow: hidden; background-color: #333; }
              embed { width: 100%; height: 100%; border: none; }
            </style>
          </head>
          <body>
            <embed src="${blobUrl}" type="${mimeType || 'application/pdf'}">
          </body>
        </html>
      `;

    const viewerBlob = new Blob([viewerHtml], { type: 'text/html' });
    const viewerUrl = window.URL.createObjectURL(viewerBlob);
    window.open(viewerUrl, '_blank');
  };

  const showConfirm = (config) => {
    return new Promise((resolve) => {
      setConfirmConfig({
        ...config,
        onConfirm: () => {
          setConfirmConfig(null);
          resolve(true);
        },
        onCancel: () => {
          setConfirmConfig(null);
          resolve(false);
        }
      });
    });
  };

  const downloadFile = async (url, filename) => {
    try {
      // 1. Check if already "downloaded" (cached in this session)
      if (downloadCacheRef.current.has(url)) {
        console.log('[ShadowTalk] Opening cached document:', filename);
        const cachedUrl = downloadCacheRef.current.get(url);
        openViewer(cachedUrl, filename);
        return;
      }

      // Ask for confirmation before downloading
      const confirmed = await showConfirm({
        title: 'Download File?',
        message: `Do you want to download "${filename || 'document'}"?`,
        icon: DownloadIcon
      });

      if (!confirmed) return;

      showToast('Downloading document...', 'info');
      const response = await fetch(url);
      const blob = await response.blob();

      // Use File constructor to give the blob a name
      let finalFilename = filename || "document";
      let finalType = blob.type;

      // Force video downloads to be MP4 if they are WebM
      if (blob.type.startsWith('video/') || finalFilename.endsWith('.webm')) {
        if (finalFilename.endsWith('.webm')) {
          finalFilename = finalFilename.replace(/\.webm$/, '.mp4');
        } else if (!finalFilename.includes('.')) {
          finalFilename += '.mp4';
        }
        finalType = 'video/mp4';
      }

      const file = new File([blob], finalFilename, { type: finalType });
      const blobUrl = window.URL.createObjectURL(file);

      // Store in session cache
      downloadCacheRef.current.set(url, blobUrl);

      // 2. Trigger Download with the correct name
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = finalFilename;
      document.body.appendChild(a);
      a.click();

      // 3. Open it for immediate viewing
      setTimeout(() => {
        document.body.removeChild(a);
        openViewer(blobUrl, finalFilename, finalType);
      }, 100);

    } catch (error) {
      console.error('Download failed:', error);
      window.open(url, '_blank');
    }
  };

  const contextValue = {
    user, setUser, loginMockUser, logout, isOffline,
    theme, setTheme,
    themeVariant, setThemeVariant,
    primaryColor, setPrimaryColor,
    globalWallpaper, setGlobalWallpaper,
    followSystem, setFollowSystem,
    chats, setChats, addMessage, editMessage, toggleReaction, createGroup, deleteMessage, bulkDeleteMessages, clearMessages, deleteChat, deleteContact,
    blockContact, unblockContact, deleteContact, deleteGroup, leaveGroup, rejoinGroup, addMemberToGroup, removeMemberFromGroup, promoteMemberToAdmin, demoteAdminToMember, markAsRead, togglePin, updateChatSettings, updateGroupSettings,
    broadcastProfileUpdate,
    forwardMessage, toggleStarMessage, togglePinMessage, archiveChat, setTypingStatus, typingUsers,
    updateChatTheme,
    callLogs, unreadMissedCalls, callNotifications, addCallNotification, markCallsAsRead,
    requests: settings.commRequests ? requests : requests.filter(r => !r.isCommunity), acceptRequest, rejectRequest,
    settings, setSettings,
    generateRecoveryPhrase,
    encrypt, decrypt,
    toast, showToast,
    isCalling: useCallStore(state => state.isCalling),
    callData: useCallStore(state => state.callData),
    startCall, endCall,
    isLoading,
    inviteFriend,
    lastSyncRef,
    downloadCache: downloadCacheRef.current,
    downloadFile,
    showConfirm,
    activeChatId,
    setActiveChatId,
    onlineUsers,
    syncContactsLastSeen
  };

  window.AppContextValue = contextValue;

  const IconComponent = confirmConfig?.icon || DownloadIcon;

  return (
    <AppContext.Provider value={contextValue}>
      {children}
      {confirmConfig && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 2000, padding: '20px',
          backdropFilter: 'blur(10px)', animation: 'fadeIn 0.2s'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)', borderRadius: '24px', padding: '32px',
            width: '100%', maxWidth: '360px', textAlign: 'center', border: '1px solid var(--border-color)',
            animation: 'slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(0, 255, 136, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
              <IconComponent size={32} color="var(--accent-primary)" />
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '12px' }}>{confirmConfig.title}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '32px', lineHeight: '1.5' }}>
              {confirmConfig.message}
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn-secondary" onClick={confirmConfig.onCancel} style={{ flex: 1 }}>Cancel</button>
              <button className="btn-primary" onClick={confirmConfig.onConfirm} style={{ flex: 1 }}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </AppContext.Provider>
  );
};
