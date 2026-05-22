import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  ArrowLeft as ArrowLeftIcon, 
  Send as SendIcon, 
  Phone as PhoneIcon, 
  User as UserIcon, 
  Paperclip as PaperclipIcon, 
  Mic as MicIcon, 
  Image as ImageIcon, 
  Smile as SmileIcon, 
  Crown as CrownIcon, 
  ShieldAlert as ShieldAlertIcon, 
  ShieldCheck as ShieldCheckIcon, 
  Users as UsersIcon, 
  Plus as PlusIcon, 
  Search as SearchIcon, 
  X as XIcon, 
  Reply as ReplyIcon, 
  Copy as CopyIcon, 
  Info as InfoIcon, 
  CheckCircle as CheckCircleIcon, 
  Trash2 as Trash2Icon, 
  Clock as ClockIcon, 
  CheckCheck as CheckCheckIcon, 
  Check as CheckIcon, 
  Camera as CameraIcon, 
  FileText as FileTextIcon, 
  Play as PlayIcon, 
  Square as SquareIcon, 
  UserPlus as UserPlusIcon, 
  ChevronRight as ChevronRightIcon, 
  ChevronLeft as ChevronLeftIcon,
  ArrowDown as ArrowDownIcon,
  MessageSquare as MessageSquareIcon, 
  Edit2 as Edit2Icon, 
  PhoneMissed as PhoneMissedIcon, 
  PhoneForwarded as PhoneForwardedIcon,
  Lock as LockIcon,
  Timer as TimerIcon,
  RefreshCw as RefreshCwIcon,
  Shield as ShieldIcon,
  Ban as BanIcon,
  Star as StarIcon,
  Pin as PinIcon,
  Forward as ForwardIcon,
  Download as DownloadIcon,
  Palette as PaletteIcon,
  Share2 as ShareIcon
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { supabase } from '../supabaseClient';
import { useCallStore } from '../modules/calling/store';

import { triggerHaptic } from '../utils/haptics';
import { shareContent } from '../utils/shareHelper';

const isIndefinitelyReadOnly = false;

const DefaultAvatar = ({ name, size = 40 }) => {
  const colors = [
    '#FF5733', '#4ECCA3', '#3357FF', '#F333FF', '#FF33A8', 
    '#33FFF5', '#FFD369', '#FF8C33', '#8C33FF', '#33FF8C'
  ];
  const charCode = (name || '?').charCodeAt(0);
  const color = colors[charCode % colors.length];
  const initial = (name || '?').charAt(0).toUpperCase();

  return (
    <div style={{
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: '50%',
      backgroundColor: color,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontWeight: 'bold',
      fontSize: `${size / 2}px`,
      flexShrink: 0,
      textShadow: '0 1px 2px rgba(0,0,0,0.2)'
    }}>
      {initial}
    </div>
  );
};

export default function ChatDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    chats, setChats, addMessage, editMessage, toggleReaction, deleteMessage, bulkDeleteMessages, markAsRead, user, showToast, 
    settings, startCall, isLoading, updateChatSettings, updateGroupSettings, loginMockUser, decrypt, acceptRequest, rejectRequest,
    blockContact, unblockContact, inviteFriend, broadcastProfileUpdate, downloadFile,
    forwardMessage, toggleStarMessage, togglePinMessage, archiveChat, setTypingStatus, typingUsers,
    updateChatTheme, showConfirm, setActiveChatId, syncContactsLastSeen, onlineUsers
  } = useAppContext();
  const searchParams = new URLSearchParams(location.search);
  const initialSearchMode = searchParams.get('search') === 'true';

  const [inputText, setInputText] = useState('');
  const [isSearchMode, setIsSearchMode] = useState(initialSearchMode);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [flashMessageId, setFlashMessageId] = useState(null);
  const [showMembers, setShowMembers] = useState(false);
  
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [longPressTimer, setLongPressTimer] = useState(null);
  const [showInfo, setShowInfo] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  
  const [copyFeedback, setCopyFeedback] = useState(null);
  const [deleteConfirmMsg, setDeleteConfirmMsg] = useState(null); // { msg, type: 'device'|'everyone'|'choose' }
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [multiSelected, setMultiSelected] = useState([]);
  
  const [showAttachments, setShowAttachments] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showReactionEmojiPicker, setShowReactionEmojiPicker] = useState(false);
  const [reactingToMessageId, setReactingToMessageId] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [cameraMode, setCameraMode] = useState('photo'); // 'photo' | 'video'
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [videoRecordingTime, setVideoRecordingTime] = useState(0);
  const [videoRecorder, setVideoRecorder] = useState(null);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [resolvedContact, setResolvedContact] = useState(null);
  const [isBlockedByOtherDetail, setIsBlockedByOtherDetail] = useState(false);
  const [isBlockedDetail, setIsBlockedDetail] = useState(false);
  const [dmRestrictedByGroupId, setDmRestrictedByGroupId] = useState(null); // DB-verified DM restriction
  const [isResolving, setIsResolving] = useState(false);
  const [resolutionFailed, setResolutionFailed] = useState(false);

  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState([]); // [{ type, url, name }]
  const [previewMedia, setPreviewMedia] = useState(null);

  useEffect(() => {
    if (setActiveChatId) {
      setActiveChatId(id);
      return () => setActiveChatId(null);
    }
  }, [id, setActiveChatId]);


  const [showForwardModal, setShowForwardModal] = useState(false);
  const [messageToForward, setMessageToForward] = useState(null);
  const [mentionSearch, setMentionSearch] = useState(null); // { query: string, index: number }
  const [touchStart, setTouchStart] = useState(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swipingMsgId, setSwipingMsgId] = useState(null);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const wallpaperInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Find the chat: Try direct ID match first, then fallback to matching contact IDs (DB ID or Shadow ID)
  // Use case-insensitive matching and trimming for maximum reliability
  const matchingChats = (chats || []).filter(c => {
    const cid = String(c?.id || '').toLowerCase().trim();
    const targetId = String(id || '').toLowerCase().trim();
    return cid === targetId || (c.type === 'direct' && (
      String(c.contact?.id).toLowerCase().trim() === targetId || 
      String(c.contact?.shadowId).toLowerCase().trim() === targetId
    ));
  }).sort((a, b) => {
    const statusWeight = (s) => (s === 'pending_sent' || s === 'pending_received') ? 2 : (s === 'direct' ? 1 : 0);
    const weightA = statusWeight(a?.status);
    const weightB = statusWeight(b?.status);
    if (weightA !== weightB) return weightB - weightA;
    return (b?.lastActivity || 0) - (a?.lastActivity || 0);
  });

  const chat = matchingChats[0] || (id?.startsWith('pending_') ? {
    id,
    type: 'direct',
    contact: { id: id.replace('pending_', ''), name: id.replace('pending_', '') },
    messages: [],
    members: [],
    status: 'pending_sent'
  } : (resolvedContact ? {
    id: resolvedContact.id,
    type: 'direct',
    contact: resolvedContact,
    messages: [],
    members: [],
    status: 'new'
  } : null));

  const safeChat = (chat && typeof chat === 'object') ? chat : { 
    id: '', 
    type: 'direct', 
    contact: {}, 
    messages: [], 
    members: [],
    unreadCount: 0,
    lastActivity: Date.now(),
    name: '',
    adminId: '',
    status: 'new'
  };

  const shadowIdFetchedRef = useRef(false);
  useEffect(() => {
    if (chat?.type === 'direct' && id && safeChat.contact && !safeChat.contact.shadowId && !shadowIdFetchedRef.current && updateChatSettings) {
      shadowIdFetchedRef.current = true;
      const fetchShadowId = async () => {
        try {
          const { data, error } = await supabase.from('users').select('shadow_id, name, avatar_url').eq('id', id).maybeSingle();
          if (data && data.shadow_id) {
            console.log('[ChatDetail] Found missing contact info for', id, ':', data);
            await updateChatSettings(chat.id, { 
              contact: { 
                ...safeChat.contact, 
                shadowId: data.shadow_id,
                name: safeChat.contact.name && safeChat.contact.name !== 'User' ? safeChat.contact.name : data.name,
                avatarUrl: safeChat.contact.avatarUrl || data.avatar_url
              } 
            });
          }
        } catch (err) {
          console.error('[ChatDetail] Error fetching missing contact info:', err);
        }
      };
      fetchShadowId();
    }
  }, [chat?.type, chat?.id, id, safeChat.contact, updateChatSettings]);

  const isGroup = id?.startsWith('group_') || safeChat.type === 'group';
  const isNoteToSelf = !isGroup && (
    safeChat.isSelf === true || 
    (safeChat.id?.toLowerCase() === (user?.id || '').toLowerCase()) ||
    (safeChat.id?.toLowerCase() === (user?.shortId || '').toLowerCase()) ||
    (id?.toLowerCase() === (user?.id || '').toLowerCase()) ||
    (id?.toLowerCase() === (user?.shortId || '').toLowerCase()) ||
    (user?.shadowId && id?.toLowerCase() === user.shadowId.toLowerCase()) ||
    (user?.shadowId && safeChat.id?.toLowerCase() === user.shadowId.toLowerCase()) ||
    (safeChat.contact?.id?.toLowerCase() === (user?.id || '').toLowerCase()) ||
    (safeChat.contact?.id?.toLowerCase() === (user?.shortId || '').toLowerCase()) ||
    (user?.shadowId && safeChat.contact?.id?.toLowerCase() === user.shadowId.toLowerCase())
  );
  const name = isNoteToSelf ? 'Note to Self' : (isGroup ? (safeChat.name || 'Unnamed Group') : (safeChat.contact?.nickname || safeChat.contact?.name || id));
  const isAdmin = isGroup && (safeChat.adminId === user?.id || (safeChat.members || []).some(m => m && (String(m.id).toLowerCase() === String(user?.id).toLowerCase() || (user?.shadowId && m.shadowId && String(m.shadowId).toLowerCase() === String(user?.shadowId).toLowerCase())) && m.role === 'admin'));
  const isParticipant = isGroup ? (safeChat.members && Array.isArray(safeChat.members) && safeChat.members.some(m => m && (String(m.id).toLowerCase() === String(user?.id).toLowerCase() || (user?.shadowId && m.shadowId && String(m.shadowId).toLowerCase() === String(user?.shadowId).toLowerCase())))) : true;
  const isRemoved = isGroup && !isParticipant && !isAdmin && (safeChat.status === 'removed' || !!chat);
  const rejoinRequested = safeChat.rejoinRequested || false;
  let chatMessages = safeChat.messages || [];
  
  // Always filter messages by membership intervals if they exist so users don't see gap messages
  const intervals = safeChat.membershipIntervals || [];
  if (intervals.length > 0) {
    chatMessages = chatMessages.filter(msg => {
      return intervals.some(inv => 
        msg.timestamp >= (inv.joinedAt - 5000) && (!inv.removedAt || msg.timestamp <= (inv.removedAt + 5000))
      );
    });
  } else if (isRemoved && safeChat.removedAt) {
    chatMessages = chatMessages.filter(msg => msg.timestamp <= (safeChat.removedAt + 5000));
  }

  // Group consecutive pin notifications
  let processedMessages = [];
  let consecutivePins = [];

  for (let i = 0; i < chatMessages.length; i++) {
    const msg = chatMessages[i];
    const isPinNotify = msg.type === 'notification' && (msg.text.includes('pinned a message') || msg.text.includes('unpinned a message'));

    if (isPinNotify) {
      consecutivePins.push(msg);
      const nextMsg = chatMessages[i + 1];
      const isNextPin = nextMsg && nextMsg.type === 'notification' && 
                        (nextMsg.text.includes('pinned a message') || nextMsg.text.includes('unpinned a message')) &&
                        nextMsg.senderId === msg.senderId;

      if (!isNextPin) {
        const combinedText = consecutivePins.map(m => m.text).join(', ');
        const combinedMsg = {
          ...msg,
          id: `combined-pin-${msg.id}`,
          text: combinedText,
          isCombined: true
        };
        processedMessages.push(combinedMsg);
        consecutivePins = []; // Reset
      }
    } else {
      processedMessages.push(msg);
    }
  }
  chatMessages = processedMessages;

  const otherId = safeChat.type === 'direct' ? (safeChat.contact?.id || id) : null;
  const isDeletedByMe = !isGroup && safeChat.status === 'deleted';
  const isDeletedByOther = safeChat.status !== 'pending_sent' && safeChat.status !== 'pending_received' && (safeChat.isDeletedByOther || false);

  // Media Gallery Logic
  const allMediaMessages = chatMessages.filter(m => m.media && (m.media.type === 'image' || m.media.type === 'video'));

  const handleNextMedia = (e) => {
    if (e) e.stopPropagation();
    const currentIndex = allMediaMessages.findIndex(m => m.id === previewMedia?.id);
    if (currentIndex !== -1 && currentIndex < allMediaMessages.length - 1) {
      setPreviewMedia(allMediaMessages[currentIndex + 1]);
    }
  };

  const handlePrevMedia = (e) => {
    if (e) e.stopPropagation();
    const currentIndex = allMediaMessages.findIndex(m => m.id === previewMedia?.id);
    if (currentIndex !== -1 && currentIndex > 0) {
      setPreviewMedia(allMediaMessages[currentIndex - 1]);
    }
  };

  const [touchStartX, setTouchStartX] = useState(null);

  const onMediaTouchStart = (e) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const onMediaTouchEnd = (e) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;

    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        handleNextMedia();
      } else {
        handlePrevMedia();
      }
    }
    setTouchStartX(null);
  };

  // Keyboard support for media viewer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!previewMedia) return;
      if (e.key === 'ArrowRight') handleNextMedia();
      if (e.key === 'ArrowLeft') handlePrevMedia();
      if (e.key === 'Escape') setPreviewMedia(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewMedia, allMediaMessages]);


  useEffect(() => {
    if (!isGroup && otherId && user?.id) {
      if (syncContactsLastSeen && chats && chats.length > 0) {
        syncContactsLastSeen(chats);
      }
      
      const checkStatus = async () => {
        // Check requests table for rejection
        const { data: reqData } = await supabase.from('requests')
          .select('status')
          .eq('sender_id', user.id)
          .eq('receiver_id', otherId)
          .maybeSingle();

        if (reqData?.status === 'rejected') {
          setChats(prev => prev.map(c => {
            if (c.id === id || c.id === otherId) {
              return { ...c, status: 'rejected' };
            }
            return c;
          }));
        }

        const { data } = await supabase.from('chats')
          .select('chat_data')
          .eq('owner_id', otherId)
          .eq('chat_id', user.id)
          .maybeSingle();
        
        if (data?.chat_data) {
          const remoteData = data.chat_data;
          const isRemoteBlocked = remoteData.isBlocked === true;
          const remoteStatus = remoteData.status;

          setIsBlockedByOtherDetail(isRemoteBlocked);
          
          setChats(prev => prev.map(c => {
            const isMatch = c.id === id || c.id === otherId;
            if (isMatch) {
              // If the remote status is 'pending_received', it means THEY received our request
              // So our status should be 'pending_sent' if it's currently 'direct' or 'deleted'
              const needsStatusFix = (c.status === 'direct' || c.status === 'deleted') && remoteStatus === 'pending_received';
              
              return { 
                ...c, 
                isBlockedByOther: isRemoteBlocked,
                status: needsStatusFix ? 'pending_sent' : c.status,
                isDeletedByOther: needsStatusFix ? false : c.isDeletedByOther
              };
            }
            return c;
          }));
        }

        // Fetch other user's self-chat to get their fresh global lastSeen
        const { data: selfChatData } = await supabase.from('chats')
          .select('chat_data')
          .eq('owner_id', otherId)
          .eq('chat_id', otherId)
          .maybeSingle();

        if (selfChatData?.chat_data?.contact) {
          const freshLastSeen = selfChatData.chat_data.contact.lastSeen || selfChatData.chat_data.lastActivity;
          if (freshLastSeen) {
            setChats(prev => prev.map(c => {
              const isMatch = c.id === id || c.id === otherId;
              if (isMatch && c.contact && c.contact.lastSeen !== freshLastSeen) {
                return {
                  ...c,
                  contact: { ...c.contact, lastSeen: freshLastSeen }
                };
              }
              return c;
            }));
          }
        }
      };
      checkStatus();
      
      // Local privacy listener for THIS specific chat
      const channelName = `privacy_${user.id.toLowerCase()}`;
      const localSub = supabase.channel(channelName + '_detail_' + Date.now())
        .on('broadcast', { event: 'status_change' }, (payload) => {
          const { userId, isBlocked } = payload.payload;
          if (userId?.toLowerCase() === otherId?.toLowerCase()) {
            setIsBlockedByOtherDetail(isBlocked === true);
          }
        })
        .subscribe();

      const interval = setInterval(checkStatus, 5000);
      return () => {
        clearInterval(interval);
        supabase.removeChannel(localSub);
      };
    }
  }, [id, otherId, user?.id]);

  const handleTyping = (text) => {
    setInputText(text);
    
    // Auto-expand height
    if (inputRef.current) {
      inputRef.current.style.height = '44px';
      const scrollHeight = inputRef.current.scrollHeight;
      inputRef.current.style.height = Math.min(scrollHeight, 150) + 'px';
    }

    if (!id || !user?.id || isNoteToSelf) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    setTypingStatus(id, true);
    
    typingTimeoutRef.current = setTimeout(() => {
      setTypingStatus(id, false);
    }, 3000);

    // Mention Detection
    if (isGroup) {
      const cursorPosition = text.length; // Simplified for this implementation, ideally use ref selectionStart
      const textBeforeCursor = text.slice(0, cursorPosition);
      const lastAtSymbol = textBeforeCursor.lastIndexOf('@');
      
      if (lastAtSymbol !== -1) {
        const query = textBeforeCursor.slice(lastAtSymbol + 1);
        // Only trigger if @ is at start of string or after a space
        if (lastAtSymbol === 0 || textBeforeCursor[lastAtSymbol - 1] === ' ') {
          if (!query.includes(' ')) {
            setMentionSearch({ query, index: lastAtSymbol });
          } else {
            setMentionSearch(null);
          }
        } else {
          setMentionSearch(null);
        }
      } else {
        setMentionSearch(null);
      }
    }
  };

  useEffect(() => {
    if (!isGroup && id) {
       // Check if I blocked them
       const myChat = chats.find(c => c.id === id);
       setIsBlockedDetail(!!(myChat?.isBlocked || myChat?.chat_data?.isBlocked));
    }
  }, [chats, id]);

  // DB-backed check: Verify allow_member_dm from admin's authoritative row.
  // This ensures BOTH sides of a DM see/enforce the restriction symmetrically,
  // regardless of local state staleness (stale local state is the root cause of asymmetry).
  useEffect(() => {
    if (isGroup || !otherId || !user?.id || isNoteToSelf) {
      setDmRestrictedByGroupId(null);
      return;
    }

    let cancelled = false;
    const myIdLow = user.id.toLowerCase();
    const myShadowIdLow = user.shadowId ? user.shadowId.toLowerCase() : null;
    const otherIdLow = otherId.toLowerCase();
    const otherShadowIdLow = safeChat.contact?.shadowId ? safeChat.contact.shadowId.toLowerCase() : null;

    const matchesId = (id, ...targets) =>
      targets.some(t => t && String(id).toLowerCase() === t);

    const fetchCanonicalRestriction = async () => {
      try {
        // Step 1: Get all group IDs from local state that this user is part of
        const allLocalGroupIds = (chats || [])
          .filter(c => c && c.type === 'group')
          .map(c => c.id.toLowerCase());

        if (allLocalGroupIds.length === 0) {
          if (!cancelled) setDmRestrictedByGroupId(null);
          return;
        }

        // Step 2: Fetch ALL rows for these groups from DB to find admin rows
        const { data: groupRows } = await supabase
          .from('chats')
          .select('owner_id, chat_id, chat_data')
          .in('chat_id', allLocalGroupIds);

        if (cancelled || !groupRows) return;

        let foundRestrictingGroupId = null;

        // Group the rows by chat_id
        const rowsByGroup = {};
        groupRows.forEach(r => {
          if (!rowsByGroup[r.chat_id]) rowsByGroup[r.chat_id] = [];
          rowsByGroup[r.chat_id].push(r);
        });

        for (const [sharedGroupId, rows] of Object.entries(rowsByGroup)) {
          // Prefer the admin's row as it is the authoritative source
          let authoritative = rows.find(r => {
            const cd = r.chat_data;
            return cd && matchesId(cd.adminId, r.owner_id);
          }) || rows[0];

          const cd = authoritative?.chat_data;
          if (!cd) continue;

          // Must have DMs disabled
          const isDisabled = cd.allow_member_dm === false || cd.allowMemberDMs === false;
          if (!isDisabled) continue;

          // Check that both this user and the other user are members of this group
          const members = cd.members || [];
          const adminId = String(cd.adminId || '').toLowerCase();

          const myMember = members.find(m => m &&
            matchesId(m.id, myIdLow, myShadowIdLow) ||
            matchesId(m.shadowId, myIdLow, myShadowIdLow)
          );
          const otherMember = members.find(m => m &&
            matchesId(m.id, otherIdLow, otherShadowIdLow) ||
            matchesId(m.shadowId, otherIdLow, otherShadowIdLow)
          );

          if (!myMember || !otherMember) continue;

          // Skip if either user is an admin (admins are exempt from DM restrictions)
          const isMeAdmin = matchesId(adminId, myIdLow, myShadowIdLow) ||
                            (myMember && myMember.role === 'admin');
          const isOtherAdminInGroup = matchesId(adminId, otherIdLow, otherShadowIdLow) ||
                                      (otherMember && otherMember.role === 'admin');
          if (isMeAdmin || isOtherAdminInGroup) continue;

          foundRestrictingGroupId = sharedGroupId;

          // Patch local chats state so subsequent renders don't need DB call
          if (!cancelled) {
            setChats(prev => prev.map(c => {
              if (String(c.id).toLowerCase() === sharedGroupId) {
                if (c.allow_member_dm === false && c.allowMemberDMs === false) return c;
                return { ...c, allow_member_dm: false, allowMemberDMs: false };
              }
              return c;
            }));
          }
          break;
        }

        if (!cancelled) {
          setDmRestrictedByGroupId(foundRestrictingGroupId || null);
        }
      } catch (err) {
        console.warn('[ChatDetail] DM restriction DB check failed:', err);
      }
    };

    fetchCanonicalRestriction();
    return () => { cancelled = true; };
  // Re-run when the chat partner changes, or when local group settings change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGroup, otherId, user?.id, isNoteToSelf, chats.filter(c => c?.type === 'group').map(c => `${c.id}:${c.allow_member_dm}:${c.allowMemberDMs}`).join('|')]);

  const isBlocked = !isGroup && (isBlockedDetail || safeChat.isBlocked || safeChat.chat_data?.isBlocked);
  const isBlockedByOther = !isGroup && (isBlockedByOtherDetail || safeChat.isBlockedByOther || safeChat.chat_data?.isBlockedByOther);
  
  const isReadOnly = isRemoved || isDeletedByMe || isDeletedByOther || isBlocked || isBlockedByOther || safeChat.status === 'pending_received' || safeChat.status === 'pending_sent' || safeChat.status === 'rejected' || isIndefinitelyReadOnly;
  
  // Check if any SHARED group has DMs disabled and neither user is the admin (Rule 1, 8)
  const blockingGroups = (chat?.type === 'direct' && otherId && user?.id && !isNoteToSelf) ? (chats || []).filter(c => {
    if (!c || c.type !== 'group') return false;
    const isDisabled = c.allow_member_dm === false || c.allowMemberDMs === false;
    if (!isDisabled) return false;
    
    const myId = user.id.toLowerCase();
    const myShadowId = user.shadowId ? user.shadowId.toLowerCase() : null;
    const otherIdLow = otherId.toLowerCase();
    const otherShadowId = safeChat.contact?.shadowId ? safeChat.contact.shadowId.toLowerCase() : null;
    
    const myMatchCondition = (m) => m && (
      String(m.id).toLowerCase() === myId || 
      String(m.shadowId).toLowerCase() === myId ||
      (myShadowId && String(m.id).toLowerCase() === myShadowId) ||
      (myShadowId && String(m.shadowId).toLowerCase() === myShadowId)
    );
    
    const otherMatchCondition = (m) => m && (
      String(m.id).toLowerCase() === otherIdLow || 
      String(m.shadowId).toLowerCase() === otherIdLow ||
      (otherShadowId && String(m.id).toLowerCase() === otherShadowId) ||
      (otherShadowId && String(m.shadowId).toLowerCase() === otherShadowId)
    );
    
    const myMatch = (c.members || []).some(myMatchCondition);
    const otherMatch = (c.members || []).some(otherMatchCondition);
    
    const isSelfAdmin = String(c.adminId).toLowerCase() === myId ||
                        (myShadowId && String(c.adminId).toLowerCase() === myShadowId) ||
                        (c.members || []).some(m => myMatchCondition(m) && m.role === 'admin');
                        
    const isOtherAdmin = String(c.adminId).toLowerCase() === otherIdLow ||
                         (otherShadowId && String(c.adminId).toLowerCase() === otherShadowId) ||
                         (c.members || []).some(m => otherMatchCondition(m) && m.role === 'admin');

    console.log(`[Diagnostic] Group: ${c.name || c.id}, isDisabled: ${isDisabled}, myId: ${myId}, myShadow: ${myShadowId}, otherId: ${otherIdLow}, otherShadow: ${otherShadowId}, myMatch: ${myMatch}, otherMatch: ${otherMatch}, isSelfAdmin: ${isSelfAdmin}, isOtherAdmin: ${isOtherAdmin}`);
    if (!myMatch) {
      console.log(`[Diagnostic] myMatch failed. Group members:`, c.members);
    }
    if (!otherMatch) {
      console.log(`[Diagnostic] otherMatch failed. Group members:`, c.members);
    }
    
    return myMatch && otherMatch && !isSelfAdmin && !isOtherAdmin;
  }) : [];

  const isRestrictedByAdmin = blockingGroups.length > 0 || dmRestrictedByGroupId !== null;
  
  // Actually apply the restriction to isReadOnly for direct chats
  const finalIsReadOnly = !isNoteToSelf && (isReadOnly || (chat?.type === 'direct' && isRestrictedByAdmin));

  console.log('[ChatDetail] Render state:', JSON.stringify({ 
    id, 
    hasChat: !!chat, 
    chatId: chat?.id,
    chatStatus: chat?.status,
    isGroup,
    isRemoved,
    isReadOnly: finalIsReadOnly,
    isParticipant,
    isAdmin,
    membersCount: safeChat.members?.length || 0,
    myId: user?.id,
    memberIds: (safeChat.members || []).map(m => m?.id),
    messagesCount: chatMessages.length,
    user: user ? { id: user?.id, name: user.name } : null
  }, null, 2));

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [facingMode, setFacingMode] = useState('environment');
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const docInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [capturedFile, setCapturedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const inputRef = useRef(null);
  const prevMessagesCountRef = useRef(0);
  const prevLastActivityRef = useRef(safeChat.lastActivity || 0);


  const chatsRef = useRef(chats);
  useEffect(() => { chatsRef.current = chats; }, [chats]);

  // REAL-TIME MESSAGE LISTENER FOR CURRENT CHAT
  useEffect(() => {
    if (!id || !user?.id) return;
    const canonicalId = id.toLowerCase().trim();

    const channel = supabase
      .channel(`chat-realtime-${canonicalId}`)
      .on('broadcast', { event: 'MESSAGE_DELETED' }, (payload) => {
        const { messageIds } = payload.payload;
        console.log('[ShadowTalk] Detail broadcast deletion:', messageIds);
        setChats(prev => prev.map(c => {
          if (c.id.toLowerCase() === canonicalId) {
            return {
              ...c,
              messages: (c.messages || []).filter(m => !messageIds.includes(m.id))
            };
          }
          return c;
        }));
      })
      .on('postgres_changes', {
        event: '*', 
        schema: 'public',
        table: 'messages'
      }, (payload) => {
        // 1. Handle Deletions
        if (payload.eventType === 'DELETE') {
          // Global listener in AppContext handles message deletions
          return;
        }

        // Global listener in AppContext handles message insertion and decryption
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, user?.id]);

  const uploadFile = async (file, type, skipAutoSend = true, skipLoadingState = false) => {
    try {
      if (!skipLoadingState) setIsUploading(true);
      
      // 1. Basic Validation
      if (!file) throw new Error('No file selected');
      if (file.size === 0) throw new Error('Selected file is empty');
      if (file.size > 50 * 1024 * 1024) throw new Error('File too large (max 50MB)');

      // 2. Prepare File Path
      const fileNameRaw = file.name || `${type}_${Date.now()}`;
      const fileExt = fileNameRaw.includes('.') ? fileNameRaw.split('.').pop() : (type === 'image' ? 'jpg' : 'bin');
      const safeFileName = `${Math.random().toString(36).substring(2, 10)}_${Date.now()}.${fileExt}`;
      const folderPath = user?.id || 'unknown';
      const filePath = `${folderPath}/${safeFileName}`;

      console.log('[ShadowTalk] Initializing mobile-optimized upload:', { 
        name: fileNameRaw, 
        size: file.size, 
        type: file.type,
        path: filePath 
      });

      // 3. Robust Blob conversion for mobile browsers
      // Some mobile browsers handle File objects poorly in async transfers
      const fileBlob = new Blob([file], { type: file.type || 'application/octet-stream' });

      // 4. Upload with retry/upsert logic
      const { data, error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(filePath, fileBlob, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type || 'application/octet-stream'
        });

      if (uploadError) {
        console.error('[ShadowTalk] Supabase storage error:', uploadError);
        throw new Error(uploadError.message || 'Storage transmission failed');
      }

      // 5. Success - Get URL
      const { data: { publicUrl } } = supabase.storage
        .from('attachments')
        .getPublicUrl(filePath);

      console.log('[ShadowTalk] Upload success! URL:', publicUrl);

      if (skipAutoSend) {
        setPendingAttachments(prev => [...prev, { type, url: publicUrl, name: fileNameRaw }]);
        // showToast('Attachment added', 'success'); // Silent during batch
      } else {
        addMessage(id, '', { type, url: publicUrl, name: fileNameRaw });
      }
      setShowAttachments(false);
    } catch (error) {
      console.error('[ShadowTalk] Final upload error:', error);
      showToast(`Upload failed: ${error.message || 'Check connection'}`, 'error');
    } finally {
      if (!skipLoadingState) setIsUploading(false);
    }
  };

  const handleMultipleFiles = async (files, type) => {
    if (!files || files.length === 0) return;
    
    const currentCount = pendingAttachments.length;
    const newFiles = Array.from(files);
    const totalPossible = 50;
    const remainingSlots = totalPossible - currentCount;
    
    if (remainingSlots <= 0) {
      showToast(`Maximum ${totalPossible} attachments allowed`, 'error');
      return;
    }
    
    const filesToUpload = newFiles.slice(0, remainingSlots);
    if (newFiles.length > remainingSlots) {
      showToast(`Only first ${remainingSlots} files selected (Max ${totalPossible})`, 'info');
    }

    setIsUploading(true);
    try {
      // Parallel uploads for better speed on high-speed connections
      await Promise.all(filesToUpload.map(file => {
        const determinedType = file.type.startsWith('video/') ? 'video' : (file.type.startsWith('image/') ? 'image' : type);
        return uploadFile(file, determinedType, true, true);
      }));
      showToast(`${filesToUpload.length} file(s) attached`, 'success');
    } catch (err) {
      console.error('[ShadowTalk] Batch upload error:', err);
    } finally {
      setIsUploading(false);
      // Reset input values to allow re-selecting the same file if needed
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (docInputRef.current) docInputRef.current.value = '';
    }
  };



  const removePendingAttachment = async (index) => {
    const confirmed = await showConfirm({
      title: 'Remove Attachment?',
      message: 'Are you sure you want to remove this attachment?',
      icon: Trash2Icon
    });
    if (confirmed) {
      setPendingAttachments(prev => prev.filter((_, i) => i !== index));
    }
  };

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const file = new File([blob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
        // Set skipAutoSend to false so it sends immediately
        await uploadFile(file, 'audio', false);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      
      let seconds = 0;
      const timer = setInterval(() => {
        seconds++;
        setRecordingTime(seconds);
      }, 1000);
      
      recorder.onstart = () => {
        // store timer to clear it
        recorder.timerInterval = timer;
      };
    } catch (err) {
      console.error('Recording error:', err);
      showToast('Microphone access denied', 'error');
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      clearInterval(mediaRecorder.timerInterval);
      setIsRecording(false);
      setRecordingTime(0);
      setMediaRecorder(null);
    }
  };

  const startCamera = async () => {
    // Cleanup any existing stream first
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      // Give hardware a moment to release
      await new Promise(r => setTimeout(r, 300));
    }

    // 🎙️ RESILIENCE: If a call is ongoing, don't request audio to avoid "Device in use" errors
    const isOngoingCall = useCallStore.getState().isCalling;
    console.log('[ChatDetail] Starting camera. isOngoingCall:', isOngoingCall);

    try {
      let stream;
      try {
        // Try high quality. Include audio only if NOT in a call.
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: facingMode === 'environment' ? { exact: 'environment' } : 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: !isOngoingCall
        });
      } catch (e) {
        console.warn('First camera attempt failed, trying simpler constraints:', e);
        try {
          // Try basic video with facingMode fallback (non-exact)
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: facingMode }, 
            audio: !isOngoingCall 
          });
        } catch (e2) {
          console.warn('Second attempt failed, trying video only absolute fallback:', e2);
          try {
            // Absolute fallback: video only, no fancy constraints
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
          } catch (e3) {
            // Final attempt: minimal facingMode constraint
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facingMode === 'environment' ? { exact: 'environment' } : 'user' } });
          }
        }
      }
      
      setCameraStream(stream);
      setIsCameraActive(true);
      setShowAttachments(false);
    } catch (err) {
      console.error('Final Camera Error:', err);
      if (err.name === 'NotReadableError' || err.name === 'AbortError') {
        showToast('Camera is already in use by another app or call', 'error');
      } else {
        showToast('Camera access denied', 'error');
      }
    }
  };

  const switchCamera = async () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);
    
    // Stop current stream
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
    }
    
    const isOngoingCall = useCallStore.getState().isCalling;

    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: newMode === 'environment' ? { exact: 'environment' } : 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: !isOngoingCall
        });
      } catch (e) {
        try {
          // Fallback to non-exact facingMode
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: newMode },
            audio: !isOngoingCall
          });
        } catch (e2) {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
      }
      setCameraStream(stream);
    } catch (err) {
      console.error('Switch camera error:', err);
      showToast('Could not switch camera', 'error');
    }
  };

  useEffect(() => {
    if (isCameraActive && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [isCameraActive, cameraStream, previewUrl]);

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
    setCapturedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob((blob) => {
        const file = new File([blob], `camera_capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
        const url = URL.createObjectURL(blob);
        setCapturedFile(file);
        setPreviewUrl(url);
      }, 'image/jpeg', 0.9);
    }
  };

  const startRecordingVideo = async () => {
    if (!cameraStream) return;
    try {
      const mimeType = MediaRecorder.isTypeSupported('video/mp4;codecs=h264') 
        ? 'video/mp4;codecs=h264' 
        : (MediaRecorder.isTypeSupported('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8' : 'video/webm');
      
      const recorder = new MediaRecorder(cameraStream, { mimeType });
      const chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: mimeType });
        const file = new File([blob], `video_capture_${Date.now()}.${mimeType.includes('mp4') ? 'mp4' : 'webm'}`, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setCapturedFile(file);
        setPreviewUrl(url);
      };
      recorder.start(100); // 100ms timeslice to ensure data is captured reliably
      setVideoRecorder(recorder);
      setIsRecordingVideo(true);
      setVideoRecordingTime(0);
      const timer = setInterval(() => setVideoRecordingTime(prev => prev + 1), 1000);
      recorder.timerInterval = timer;
    } catch (err) {
      console.error('Video recording error:', err);
      showToast('Could not start video recording', 'error');
    }
  };

  const stopRecordingVideo = () => {
    if (videoRecorder) {
      videoRecorder.stop();
      clearInterval(videoRecorder.timerInterval);
      setIsRecordingVideo(false);
      setVideoRecorder(null);
    }
  };

  const sendCapturedPhoto = async () => {
    if (capturedFile) {
      const type = cameraMode === 'video' ? 'video' : 'image';
      await uploadFile(capturedFile, type, true);
      stopCamera();
    }
  };

  const retakePhoto = () => {
    setCapturedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  const handleEmojiClick = (emoji) => {
    if (reactingToMessageId) {
      toggleReaction(id, reactingToMessageId, emoji);
      setReactingToMessageId(null);
      setShowEmojiPicker(false);
    } else {
      setInputText(prev => prev + emoji);
    }
  };

  const handlePaste = async (e) => {
    const clipboardData = e.clipboardData || window.clipboardData;
    const items = clipboardData?.items;
    if (!items) return;

    const filesToUpload = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) filesToUpload.push(file);
      }
    }

    if (filesToUpload.length > 0) {
      showToast(`Uploading ${filesToUpload.length} image${filesToUpload.length > 1 ? 's' : ''}...`, 'info');
      for (const file of filesToUpload) {
        await uploadFile(file, 'image');
      }
    }
  };

  useEffect(() => {
    const onGlobalPaste = (e) => {
      // Don't intercept if user is typing in a search box or something else
      const target = e.target;
      if (target.tagName === 'INPUT' && target.placeholder !== 'Message...') return;
      if (target.tagName === 'TEXTAREA') return;
      
      handlePaste(e);
    };

    window.addEventListener('paste', onGlobalPaste);
    return () => window.removeEventListener('paste', onGlobalPaste);
  }, [id, handlePaste]);

  const scrollToMessage = (msgId) => {
    const element = document.getElementById(`msg-${msgId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setFlashMessageId(msgId);
      setTimeout(() => setFlashMessageId(null), 2000);
      setIsSearchMode(false);
      setChatSearchQuery('');
    }
  };


  // Handle switching from "pending" to "real" chat automatically
  useEffect(() => {
    if (id && id.startsWith('pending_')) {
      const contactId = id.replace('pending_', '');
      const realChat = chats.find(c => c.contact?.id === contactId && !c.id.startsWith('pending_'));
      if (realChat) {
        navigate(`/chat/${realChat.id}`, { replace: true });
      }
    }
  }, [chats, id, navigate]);

  const handleLongPressStart = (msg) => {
    if (isSelectMode) return; // Don't open context menu while in multi-select mode
    if (longPressTimer) clearTimeout(longPressTimer);
    const timer = setTimeout(() => {
      setSelectedMessage(msg);
      if (window.navigator.vibrate) window.navigator.vibrate(50);
    }, 600);
    setLongPressTimer(timer);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer) clearTimeout(longPressTimer);
  };

  const [initialUnreadCount, setInitialUnreadCount] = useState(0);

  useEffect(() => {
    const handleRead = () => {
      if (safeChat && safeChat.unreadCount > 0 && document.visibilityState === 'visible') {
        if (initialUnreadCount === 0) {
          setInitialUnreadCount(safeChat.unreadCount);
        }
        markAsRead(id);
      }
    };
    
    handleRead(); // initial check
    document.addEventListener('visibilitychange', handleRead);
    return () => document.removeEventListener('visibilitychange', handleRead);
  }, [safeChat?.unreadCount, id, initialUnreadCount, markAsRead]);

  // Reset resolution state when switching chats
  useEffect(() => {
    setResolvedContact(null);
    setIsResolving(false);
    setResolutionFailed(false);
  }, [id]);

  // Guard: if chat is found, stop resolving immediately
  useEffect(() => {
    if (chat && isResolving) {
      console.log('[ChatDetail] Chat found, clearing resolving state');
      setIsResolving(false);
    }
  }, [chat, isResolving]);

  const [hasInitialScrolled, setHasInitialScrolled] = useState(false);

  useEffect(() => {
    setHasInitialScrolled(false);
    prevMessagesCountRef.current = 0;
  }, [id]);

  useEffect(() => {
    if (chat && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 120;
      const currentCount = chatMessages.length;
      const prevCount = prevMessagesCountRef.current;
      const currentActivity = safeChat.lastActivity || 0;
      const prevActivity = prevLastActivityRef.current;
      const lastMessage = chatMessages[currentCount - 1];
      
      if (!hasInitialScrolled && currentCount > 0) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
        setHasInitialScrolled(true);
      } else if (currentCount > prevCount || (currentActivity > prevActivity && prevActivity > 0)) {
        // A NEW message actually arrived (either list grew or activity updated)
        const isActuallyMe = lastMessage?.senderId && 
                            String(lastMessage.senderId).toLowerCase() === String(user?.id || '').toLowerCase();
        
        if (isActuallyMe) {
          // I sent this, scroll to bottom
          setTimeout(() => {
            if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: 'smooth' });
            }
          }, 100);
          setNewMessagesCount(0);
        } else {
          // Message from others
          if (isAtBottom) {
            // If already at bottom, scroll to bottom to show new message
            setTimeout(() => {
              if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: 'smooth' });
              }
            }, 100);
            setNewMessagesCount(0);
          } else {
            // If not at bottom, show unread count
            const added = currentCount - prevCount;
            setNewMessagesCount(prev => prev + added);
            setShowScrollBottomBtn(true);
          }
        }
      }
      
      prevMessagesCountRef.current = currentCount;
      prevLastActivityRef.current = currentActivity;
    }
  }, [chatMessages.length, id, hasInitialScrolled]);

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      // Use a stricter threshold for clearing unread count (must be very close to bottom)
      const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 40;
      const isGenerallyAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 150;
      
      setShowScrollBottomBtn(!isGenerallyAtBottom);
      
      if (isAtBottom && newMessagesCount > 0) {
        setNewMessagesCount(0);
      }
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setNewMessagesCount(0);
    setShowScrollBottomBtn(false);
  };


  // Auto-resolve unknown ID if not in local chats list
  useEffect(() => {
    const cleanId = id?.trim();
    // Skip if already have chat, or not ready, or terminal states already reached
    if (!cleanId || !user?.id) return;
    if (chat) return;
    if (isLoading || isResolving || resolutionFailed || resolvedContact) return;
    if (cleanId.startsWith('pending_')) return;

    console.log('[ChatDetail] Triggering resolution for:', cleanId);
    let isMounted = true;
    const safetyTimeout = setTimeout(() => {
      if (isMounted) {
        console.warn('[ShadowTalk] Resolution timed out for ID:', id);
        setIsResolving(false);
        setResolutionFailed(true);
      }
    }, 12000);

    const resolveId = async () => {
      setIsResolving(true);
      try {
        // 1. Try to resolve as a User
        const { data: userData } = await supabase
          .from('users')
          .select('id, shadow_id, name, avatar_url')
          .or(`id.eq."${cleanId}",shadow_id.ilike."${cleanId}"`)
          .maybeSingle();

        if (isMounted && userData) {
          setResolvedContact({
            id: userData.id,
            shadowId: userData.shadow_id,
            name: userData.name,
            avatarUrl: userData.avatar_url,
            isOnline: false
          });
          setIsResolving(false);
          clearTimeout(safetyTimeout);
          return;
        }

        // 2. Try to resolve as a Group or Removed Group
        const { data: chatData } = await supabase
          .from('chats')
          .select('chat_data')
          .eq('owner_id', user?.id)
          .eq('chat_id', cleanId.toLowerCase())
          .maybeSingle();

        if (isMounted && chatData?.chat_data) {
          // Sync this group (active or removed) into local state
          await loginMockUser(user.name, user?.id, user.phrase, true);
          setIsResolving(false);
          clearTimeout(safetyTimeout);
          return;
        }

        if (isMounted) {
          setResolutionFailed(true);
          setIsResolving(false);
        }
      } catch (err) {
        console.error('[ShadowTalk] Resolution error:', err);
        if (isMounted) {
          setResolutionFailed(true);
          setIsResolving(false);
        }
      } finally {
        if (isMounted) clearTimeout(safetyTimeout);
      }
    };
    resolveId();

    return () => {
      isMounted = false;
      clearTimeout(safetyTimeout);
    };
  }, [chat, isLoading, id, resolvedContact, isResolving, resolutionFailed, user]);

  if (isLoading || !user) {
    return (
      <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary)' }}>
        <div className="spinner" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  // ── LOADING STATE ──
  // Rule 15: Only show sync screen if we are resolving AND the chat is truly missing
  if (isResolving && !chat && isLoading) {
    return (
      <div className="loading-screen" style={{ backgroundColor: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div className="spinner" style={{ width: 40, height: 40 }} />
            <p style={{ marginLeft: '12px', color: 'var(--text-muted)' }}>Synchronizing ShadowTalk...</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
            <button 
              className="btn-secondary" 
              onClick={() => { loginMockUser(user?.name, user?.id, user?.phrase, true); }}
              style={{ fontSize: '0.8rem', padding: '10px 20px', backgroundColor: 'rgba(0, 255, 136, 0.1)', color: 'var(--accent-primary)', border: '1px solid var(--accent-primary)', borderRadius: '12px' }}
            >
              Refresh Connection
            </button>
            <button 
              className="btn-secondary" 
              onClick={() => { setIsResolving(false); setResolutionFailed(true); }}
              style={{ fontSize: '0.8rem', padding: '8px 16px', opacity: 0.5 }}
            >
              Take too long? Click to skip
            </button>
          </div>
        </div>
      );
    }
  
    if (!chat) {
      return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', padding: '20px', textAlign: 'center' }}>
        <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
          <ShieldAlertIcon size={40} color="var(--text-muted)" />
        </div>
        <h2 style={{ marginBottom: '12px', fontWeight: 800 }}>Chat not found</h2>
        <p style={{ color: 'var(--text-muted)', maxWidth: '300px', lineHeight: '1.5', marginBottom: '32px' }}>
          The conversation with ID <strong>{id}</strong> could not be loaded. It may have been removed or you do not have access.
      </p>
        <button className="btn-primary" onClick={() => navigate('/chats')} style={{ padding: '12px 32px' }}>
          Back to Chats
        </button>
      </div>
    );
  }

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim() && pendingAttachments.length === 0) return;

    if (editingMessage) {
      await editMessage(id, editingMessage.id, inputText);
      setEditingMessage(null);
      setInputText('');
      if (inputRef.current) inputRef.current.style.height = '44px';
      return;
    }

    if (inputText.trim() || pendingAttachments.length > 0) {
      if (pendingAttachments.length === 0) {
        addMessage(id, inputText, null, replyTo);
      } else {
        const first = pendingAttachments[0];
        addMessage(id, inputText, first, replyTo);
        for (let i = 1; i < pendingAttachments.length; i++) {
          addMessage(id, '', pendingAttachments[i]);
        }
      }

      setInputText('');
      if (inputRef.current) inputRef.current.style.height = '44px';
      setPendingAttachments([]);
      setReplyTo(null);
      setTypingStatus(id, false);
      setShowEmojiPicker(false);
      setShowAttachments(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleAction = (action, msg) => {
    if (action === 'reply') {
      setReplyTo(msg);
      setSelectedMessage(null);
    } else if (action === 'copy') {
      navigator.clipboard.writeText(msg.text);
      setCopyFeedback('text');
      setTimeout(() => {
        setCopyFeedback(null);
        if (!showInfo) setSelectedMessage(null);
      }, 1000);
    } else if (action === 'info') {
      setShowInfo(true);
    } else if (action === 'delete') {
      setDeleteConfirmMsg({ msg, type: 'choose' });
      setSelectedMessage(null);
    } else if (action === 'copy_id') {
      const partnerId = isGroup ? msg.senderId : (safeChat.contact?.shadowId || safeChat.contact?.id || id);
      navigator.clipboard.writeText(partnerId);
      setCopyFeedback('id');
      setTimeout(() => {
        setCopyFeedback(null);
        if (!showInfo) setSelectedMessage(null);
      }, 1000);
    } else if (action === 'select') {
      setIsSelectMode(true);
      setMultiSelected([msg.id]);
      setSelectedMessage(null);
    } else if (action === 'edit') {
      setEditingMessage(msg);
      setInputText(msg.text);
      setSelectedMessage(null);
    } else if (action === 'star') {
      toggleStarMessage(id, msg.id);
      setSelectedMessage(null);
    } else if (action === 'forward') {
      setMessageToForward(msg);
      setShowForwardModal(true);
      setSelectedMessage(null);
    } else if (action === 'pin') {
      togglePinMessage(id, msg.id);
      setSelectedMessage(null);
    } else if (action === 'download') {
      if (msg.media?.url) {
        downloadFile(msg.media.url, msg.media.name);
      }
      setSelectedMessage(null);
    } else if (action === 'share') {
      setSelectedMessage(null);
      const shareOptions = {
        title: msg.text ? 'Share Message' : 'Share Attachment'
      };
      if (msg.text) {
        shareOptions.text = msg.text;
      }
      if (msg.media?.url) {
        shareOptions.mediaUrl = msg.media.url;
        shareOptions.fileName = msg.media.name;
        shareOptions.mimeType = msg.media.type;
        showToast('Preparing file for sharing...', 'info');
      }
      shareContent(shareOptions).then((res) => {
        if (!res.success && res.reason === 'unsupported') {
          showToast(res.message || 'Sharing is not supported on this browser.', 'error');
        } else if (res.success && res.reason === 'file_fallback') {
          showToast('Shared as a link because file sharing failed.', 'info');
        }
      }).catch((err) => {
        console.error('Sharing failed:', err);
        showToast('Sharing failed: ' + (err.message || 'Unknown error'), 'error');
      });
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirmMsg) return;
    const { msg, type } = deleteConfirmMsg;
    if (type === 'device' || type === 'confirm_device') {
      bulkDeleteMessages(id, [msg.id], false);
      setDeleteConfirmMsg(null);
      setShowInfo(false);
    } else if (type === 'everyone' || type === 'confirm_everyone') {
      bulkDeleteMessages(id, [msg.id], true);
      showToast('Message deleted for everyone', 'success');
      setDeleteConfirmMsg(null);
      setShowInfo(false);
    }
  };

  const handleSaveName = async () => {
    if (!newName.trim()) {
      setIsRenaming(false);
      return;
    }
    try {
      if (isGroup) {
        await updateGroupSettings(id, { name: newName });
      } else {
        await updateChatSettings(id, { contact: { ...safeChat.contact, nickname: newName } });
      }
      showToast('Name updated!', 'success');
      setIsRenaming(false);
    } catch (err) {
      showToast('Failed to save name', 'error');
    }
  };

  const isContactOnline = (() => {
    if (safeChat.contact?.isOnline) return true;
    if (!onlineUsers || !id) return false;
    const idLower = id.toLowerCase();
    if (onlineUsers.has(idLower)) return true;
    if (safeChat.contact?.shadowId && onlineUsers.has(safeChat.contact.shadowId.toLowerCase())) return true;
    return false;
  })();

  try {
  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)', overflow: 'hidden', position: 'relative' }}>
      <div className="screen-header glass-morphism" style={{ position: 'sticky', top: 0, borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '0 16px', zIndex: 1000, backgroundColor: 'rgba(10,10,10,0.8)', backdropFilter: 'blur(20px)' }}>
        {isSearchMode ? (
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '12px' }}>
              <div style={{ flex: 1, backgroundColor: 'var(--bg-tertiary)', borderRadius: '8px', display: 'flex', alignItems: 'center', padding: '8px 12px' }}>
                <SearchIcon size={20} color="var(--text-muted)" />
                <input 
                  type="text" 
                  placeholder="Search in chat..." 
                  value={chatSearchQuery}
                  onChange={(e) => setChatSearchQuery(e.target.value)}
                  style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-primary)', marginLeft: '8px', outline: 'none', fontSize: '1rem' }}
                  autoFocus
                />
                {chatSearchQuery && <XIcon size={18} color="var(--text-muted)" onClick={() => setChatSearchQuery('')} style={{ cursor: 'pointer' }} />}
              </div>
              <button 
                onClick={() => { setIsSearchMode(false); setChatSearchQuery(''); }} 
                style={{ color: 'var(--text-primary)', background: 'none', border: 'none', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
            
            {chatSearchQuery && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0,
                backgroundColor: 'var(--bg-secondary)', borderRadius: '12px',
                border: '1px solid var(--border-color)', boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                maxHeight: '300px', overflowY: 'auto', zIndex: 1000,
                animation: 'fadeIn 0.2s ease-out'
              }}>
                {chatMessages.filter(m => 
                  m.type !== 'notification' && 
                  m.senderId !== 'system' && 
                  !m.type?.startsWith('call') &&
                  (
                    (m.text?.toLowerCase().includes(chatSearchQuery.toLowerCase())) ||
                    (m.media?.name?.toLowerCase().includes(chatSearchQuery.toLowerCase()))
                  )
                ).length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    No results found
                  </div>
                ) : (
                  chatMessages
                    .filter(m => 
                      m.type !== 'notification' && 
                      m.senderId !== 'system' && 
                      !m.type?.startsWith('call') &&
                      (
                        (m.text?.toLowerCase().includes(chatSearchQuery.toLowerCase())) ||
                        (m.media?.name?.toLowerCase().includes(chatSearchQuery.toLowerCase()))
                      )
                    )
                    .reverse()
                    .map(msg => (
                      <div 
                        key={msg.id}
                        onClick={() => scrollToMessage(msg.id)}
                        style={{
                          padding: '12px 16px', borderBottom: '1px solid var(--border-color)',
                          cursor: 'pointer', transition: 'background-color 0.2s'
                        }}
                        className="hoverable"
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
                            {msg.senderId === user?.id ? 'You' : (isGroup ? (safeChat.members || []).find(m => m && m.id === msg.senderId)?.name || 'Unknown' : name)}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {msg.media && <PaperclipIcon size={14} color="var(--accent-primary)" />}
                          {msg.text || msg.media?.name || 'Media file'}
                        </div>
                      </div>
                    ))
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button className="icon-btn" onClick={() => navigate(-1)} style={{ margin: '0 -10px' }}>
                <ArrowLeftIcon size={24} />
              </button>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }} onClick={() => isGroup ? setShowMembers(true) : navigate(`/profile/${id}`)}>
                <button 
                  onClick={(e) => { e.stopPropagation(); setShowThemeModal(true); }}
                  style={{ 
                    padding: '8px', borderRadius: '8px', 
                    backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)', display: 'flex', 
                    alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <PaletteIcon size={18} color="var(--accent-primary)" />
                </button>
                {safeChat.contact?.avatarUrl || safeChat.avatarUrl || safeChat.avatar_url ? (
                  <img src={safeChat.contact?.avatarUrl || safeChat.avatarUrl || safeChat.avatar_url} alt="" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <DefaultAvatar name={name} size={40} />
                )}
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {isRenaming ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                        <input 
                          type="text" 
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveName();
                            if (e.key === 'Escape') setIsRenaming(false);
                          }}
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            backgroundColor: 'var(--bg-tertiary)',
                            border: '1px solid var(--accent-primary)',
                            color: 'var(--text-primary)',
                            borderRadius: '4px',
                            padding: '2px 8px',
                            fontSize: '0.9rem',
                            outline: 'none',
                            width: '100%'
                          }}
                        />
                        <CheckIcon size={18} color="var(--accent-primary)" onClick={(e) => { e.stopPropagation(); handleSaveName(); }} style={{ cursor: 'pointer' }} />
                        <XIcon size={18} color="var(--text-muted)" onClick={(e) => { e.stopPropagation(); setIsRenaming(false); }} style={{ cursor: 'pointer' }} />
                      </div>
                    ) : (
                      <>
                        <span className="header-title" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: (!isReadOnly && (!isGroup || isAdmin)) ? 'pointer' : 'default', overflow: 'hidden', maxWidth: '100%' }} onClick={(e) => { e.stopPropagation(); if(!isReadOnly && (!isGroup || isAdmin)) { setNewName(name); setIsRenaming(true); } }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                          {!isReadOnly && (!isGroup || isAdmin) && <Edit2Icon size={14} style={{ opacity: 0.5, flexShrink: 0 }} />}
                        </span>
                        <ShieldCheckIcon size={16} color="var(--accent-primary)" style={{ opacity: 0.9 }} title="End-to-End Encrypted" />
                        {isGroup && <span style={{ fontSize: '0.7rem', color: isReadOnly ? 'var(--accent-danger)' : 'var(--text-muted)', backgroundColor: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px' }}>{isReadOnly ? 'Read Only' : 'Group'}</span>}
                      </>
                    )}
                  </div>
                  {typingUsers[id] && Object.values(typingUsers[id]).some(v => v) ? (
                    <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 600, animation: 'pulse 1.5s infinite' }}>
                      typing...
                    </span>
                  ) : (!isGroup && isContactOnline && !isReadOnly && !isNoteToSelf) ? (
                    <span style={{ fontSize: '0.75rem', color: '#4ECCA3', fontWeight: 600 }}>
                      online
                    </span>
                  ) : (!isGroup && safeChat.contact?.lastSeen && !isReadOnly && !isNoteToSelf) ? (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      last seen {(() => {
                        const date = new Date(safeChat.contact.lastSeen);
                        const now = new Date();
                        const isToday = date.toDateString() === now.toDateString();
                        const isYesterday = date.toDateString() === new Date(now - 86400000).toDateString();
                        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        if (isToday) return `today at ${timeStr}`;
                        if (isYesterday) return `yesterday at ${timeStr}`;
                        return `${date.toLocaleDateString()} at ${timeStr}`;
                      })()}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button className="icon-btn" onClick={() => setIsSearchMode(true)}>
                <SearchIcon size={22} />
              </button>
              {!isGroup && !isReadOnly && !isNoteToSelf && settings.voiceVideo !== false && (
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button className="icon-btn" onClick={() => {
                    // Audio wake-up for browser
                    const AudioContext = window.AudioContext || window.webkitAudioContext;
                    if (AudioContext) {
                      const ctx = new AudioContext();
                      ctx.resume().then(() => ctx.close());
                    }
                    startCall('voice', safeChat.contact);
                  }}>
                    <PhoneIcon size={22} />
                  </button>
                </div>
              )}
              <button className="icon-btn" onClick={() => navigate(`/profile/${id}`)}>
                <UserIcon size={24} />
              </button>
            </div>
          </>
        )}
      </div>

      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        onClick={() => { setShowEmojiPicker(false); setShowAttachments(false); }}
        style={{ 
          flex: 1, 
          overflowY: 'auto', 
          padding: '20px', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '16px', 
          position: 'relative',
          backgroundImage: safeChat.theme?.backgroundImage ? `url(${safeChat.theme.backgroundImage})` : 'none',
          backgroundColor: safeChat.theme?.backgroundColor || 'transparent',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'fixed'
        }}
      >
        <div style={{ textAlign: 'center', margin: '20px 0' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-tertiary)', padding: '8px 16px', borderRadius: 'var(--radius-full)', fontSize: '0.8rem', color: 'var(--text-muted)', border: '1px solid rgba(0, 255, 136, 0.1)' }}>
            <ShieldCheckIcon size={16} color="var(--accent-primary)" />
            Messages are end-to-end encrypted.
          </div>
        </div>
        
        {safeChat.pinnedMessageIds && safeChat.pinnedMessageIds.length > 0 && (
          <div style={{ 
            position: 'sticky',
            top: 0,
            zIndex: 10,
            backgroundColor: 'var(--bg-secondary)', 
            borderRadius: '12px', 
            padding: '14px 16px', 
            marginBottom: '16px',
            border: '1px solid rgba(0, 255, 136, 0.2)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
            maxHeight: '140px',
            minHeight: '80px',
            overflowY: 'auto',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--accent-primary)', fontWeight: 700, paddingBottom: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PinIcon size={14} /> PINNED MESSAGES
              </div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{safeChat.pinnedMessageIds.length} pinned</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {safeChat.pinnedMessageIds.map(item => {
                const pid = typeof item === 'string' ? item : item.id;
                const pmsg = chatMessages.find(m => m.id === pid);
                if (!pmsg) return null;
                
                const pinnedBy = typeof item === 'string' ? null : item.pinnedBy;
                const isByMe = pinnedBy === user?.id;
                const byName = isByMe ? 'You' : (safeChat.contact?.nickname || safeChat.contact?.name || 'Friend');
                
                return (
                  <div key={pid} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    gap: '8px', 
                    cursor: 'pointer', 
                    overflow: 'hidden',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '8px',
                    padding: '10px 14px'
                  }}>
                    <div onClick={() => scrollToMessage(pid)} style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, overflow: 'hidden' }}>
                      <div style={{ width: '4px', height: '24px', backgroundColor: 'var(--accent-primary)', borderRadius: '2px' }} />
                      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <span style={{ fontSize: '0.95rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {pmsg.text || (pmsg.media ? 'Media file' : 'Message')}
                        </span>
                        {pinnedBy && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Pinned by {byName}
                          </span>
                        )}
                      </div>
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePinMessage(id, pid);
                      }}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}
                      className="hoverable"
                    >
                      <XIcon size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!isNoteToSelf && (
          <div style={{ 
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            padding: '16px', color: 'var(--text-muted)', fontSize: '0.75rem',
            opacity: 0.6, textAlign: 'center'
          }}>
            <LockIcon size={12} />
            <span>Messages are end-to-end encrypted. No one outside of this chat, not even ShadowTalk, can read them.</span>
          </div>
        )}

        {chatMessages.length === 0 && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--text-muted)', opacity: 0.5 }}>
            <MessageSquareIcon size={48} style={{ marginBottom: '16px' }} />
            <p>{isNoteToSelf ? 'No notes yet. Save something here!' : 'No messages yet. Say hi!'}</p>
          </div>
        )}

        {chatMessages.map((msg, idx) => {
            const isMine = msg.senderId === user?.id;
            const isSelected = multiSelected.includes(msg.id);
            let senderName = '';
            if (isGroup && !isMine) {
              senderName = (safeChat.members || []).find(m => m && (m.id === msg.senderId || m.shadowId === msg.senderId))?.name || 'Unknown';
            }

            // Text highlight simulation if in search mode or mentions
            let highlightedText = msg.text || '';
            const groupMembers = isGroup ? (safeChat.members || []) : [];

            if (isSearchMode && chatSearchQuery && highlightedText.toLowerCase().includes(chatSearchQuery.toLowerCase())) {
              const regex = new RegExp(`(${chatSearchQuery})`, 'gi');
              const parts = highlightedText.split(regex);
              highlightedText = parts.map((part, i) => 
                regex.test(part) ? <mark key={i} style={{ backgroundColor: 'var(--accent-primary)', color: '#000', borderRadius: '2px', padding: '0 2px' }}>{part}</mark> : part
              );
            } else if (isGroup && highlightedText.includes('@')) {
              // Mention highlighting using actual member names
              const memberNames = groupMembers.map(m => m.name).filter(Boolean);
              if (memberNames.length > 0) {
                // Sort names by length descending to match longest possible name first (e.g. "@John Doe" before "@John")
                const sortedNames = [...memberNames].sort((a, b) => b.length - a.length);
                const escapedNames = sortedNames.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
                const mentionRegex = new RegExp(`(@(?:${escapedNames.join('|')}))`, 'g');
                
                const parts = highlightedText.split(mentionRegex);
                highlightedText = parts.map((part, i) => {
                  if (part.startsWith('@')) {
                    const name = part.slice(1);
                    if (memberNames.includes(name)) {
                      return <span key={i} style={{ color: isMine ? '#000' : 'var(--accent-primary)', fontWeight: 800 }}>{part}</span>;
                    }
                  }
                  return part;
                });
              }
            }
            const isFirstUnread = initialUnreadCount > 0 && idx === chatMessages.length - initialUnreadCount;



            if (msg.type === 'notification') {
              return (
                <div key={msg.id} style={{ 
                  width: '100%', 
                  display: 'flex', 
                  justifyContent: 'center', 
                  margin: '12px 0',
                  animation: 'fadeIn 0.5s ease-out'
                }}>
                  <div style={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.05)', 
                    color: 'var(--text-muted)', 
                    padding: '6px 16px', 
                    borderRadius: '16px', 
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'blur(10px)',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
                  }}>
                    {msg.text}
                  </div>
                </div>
              );
            }

          if (msg.senderId === 'system') {
            return (
              <div key={msg.id} style={{ 
                width: '100%', 
                display: 'flex', 
                justifyContent: 'center', 
                margin: '24px 0' 
              }}>
                <div style={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.05)', 
                  color: 'var(--text-muted)', 
                  padding: '8px 20px', 
                  borderRadius: '20px', 
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  backdropFilter: 'blur(10px)'
                }}>
                  {msg.text}
                </div>
              </div>
            );
          }

          if (msg.type === 'call' || (msg.type && msg.type.startsWith('call_'))) {
            // Robust status detection - check content status, metadata, and column status
            const rawStatus = String(msg.status || msg.metadata?.status || msg.metadata?.call_status || msg.content?.status || msg.metadata?.status || '').toUpperCase().trim();
            const isMine = String(msg.senderId || '').toLowerCase() === String(user?.id || '').toLowerCase();
            
            // Map statuses with robustness to variants
            const isMissed = ['MISSED', 'MISS', 'UNANSWERED'].includes(rawStatus);
            const isRejected = ['REJECTED', 'REJECT', 'DECLINED', 'DECLINE', 'BUSY'].includes(rawStatus);
            const isCancelled = ['CANCELLED', 'CANCEL'].includes(rawStatus);
            const isEnded = ['ENDED', 'END', 'COMPLETED', 'COMPLETE'].includes(rawStatus);
            const isAccepted = ['ACCEPTED', 'ACCEPT', 'ONGOING', 'CONNECTED', 'CONNECT'].includes(rawStatus);
            const isFailed = ['FAILED', 'FAIL', 'ERROR', 'BUSY_REJECTED'].includes(rawStatus);
            const isCalling = ['CALLING', 'CALL', 'RINGING', 'RING'].includes(rawStatus) || (rawStatus === '' && !isEnded && !isAccepted && !isRejected && !isMissed && !isCancelled);

            let icon = <PhoneIcon size={18} />;
            let statusText = msg.text || 'Audio call';
            let iconColor = '#aaa'; // Default gray
            let bubbleColor = 'rgba(44, 44, 46, 0.85)';
            let textColor = '#fff';

            if (isMissed) {
              icon = <PhoneMissedIcon size={18} />;
              statusText = isMine ? 'No Answer' : 'Missed call';
              iconColor = '#ffcc00'; // Yellow
              bubbleColor = 'rgba(255, 204, 0, 0.25)';
              textColor = '#ffcc00';
            } else if (isRejected) {
              icon = <PhoneMissedIcon size={18} style={{ transform: 'rotate(180deg)' }} />;
              statusText = (rawStatus === 'BUSY' || (msg.text || '').toLowerCase().includes('busy')) ? 'User busy' : 'Rejected audio call';
              iconColor = '#ff4d4d'; // Red
              bubbleColor = 'rgba(255, 77, 77, 0.25)';
              textColor = '#ff4d4d';
            } else if (isCancelled) {
              icon = <PhoneIcon size={18} />;
              statusText = 'Cancelled call';
              iconColor = '#aaa';
              bubbleColor = 'rgba(44, 44, 46, 0.85)';
              textColor = 'var(--text-muted)';
            } else if (isFailed) {
              icon = <PhoneIcon size={18} />;
              statusText = 'Call failed';
              iconColor = '#ff4d4d';
              bubbleColor = 'rgba(255, 77, 77, 0.25)';
              textColor = '#ff4d4d';
            } else if (isEnded) {
              iconColor = '#00ff88'; // Green
              const durationText = (msg.text || '').includes('•') ? msg.text.split('•')[1].trim() : '';
              statusText = (isMine ? 'Outgoing' : 'Incoming') + ` audio call ${durationText ? '• ' + durationText : ''}`;
            } else if (isAccepted) {
              iconColor = '#00ff88';
              statusText = (isMine ? 'Outgoing' : 'Incoming') + ' audio call';
            } else if (isCalling) {
              statusText = (isMine ? 'Outgoing' : 'Incoming') + ' audio call...';
              iconColor = 'var(--accent-primary)';
            }

            return (
              <div key={msg.id} style={{ 
                width: '100%', 
                display: 'flex', 
                justifyContent: isMine ? 'flex-end' : 'flex-start', 
                margin: '12px 0',
                animation: 'fadeIn 0.4s ease-out'
              }}>
                <div style={{ 
                  backgroundColor: bubbleColor, 
                  color: textColor, 
                  padding: '12px 20px', 
                  borderRadius: '24px', 
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  border: `1px solid ${iconColor}44`,
                  backdropFilter: 'blur(20px)',
                  boxShadow: isCalling ? '0 0 20px rgba(0, 255, 136, 0.1)' : 'none',
                  maxWidth: '85%'
                }}>
                  <div style={{ color: iconColor, display: 'flex' }}>
                    {icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>
                      {statusText}
                    </div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '2px' }}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          // Date Separator logic
          const msgDate = new Date(msg.timestamp).toDateString();
          const prevMsg = chatMessages[idx - 1];
          const prevMsgDate = prevMsg ? new Date(prevMsg.timestamp).toDateString() : null;
          const showDateSeparator = msgDate !== prevMsgDate;

          return (
            <React.Fragment key={msg.id}>
              {showDateSeparator && (
                <div style={{ width: '100%', display: 'flex', justifyContent: 'center', margin: '24px 0' }}>
                  <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '6px 16px', borderRadius: '16px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>
                    {msgDate === new Date().toDateString() ? 'Today' : (msgDate === new Date(Date.now() - 86400000).toDateString() ? 'Yesterday' : msgDate)}
                  </div>
                </div>
              )}
              {isFirstUnread && (
                <div style={{ width: '100%', display: 'flex', alignItems: 'center', margin: '24px 0', gap: '16px' }}>
                  <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, var(--accent-primary))' }} />
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    {initialUnreadCount} Unread Message{initialUnreadCount > 1 ? 's' : ''}
                  </span>
                  <div style={{ flex: 1, height: '1px', background: 'linear-gradient(270deg, transparent, var(--accent-primary))' }} />
                </div>
              )}
            <div key={msg.id} id={`msg-${msg.id}`}
              onClick={() => {
                if (isSelectMode) {
                  setMultiSelected(prev =>
                    prev.includes(msg.id) ? prev.filter(i => i !== msg.id) : [...prev, msg.id]
                  );
                }
              }}
              style={{
              alignSelf: isMine ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              justifyContent: isMine ? 'flex-end' : 'flex-start',
              transition: 'all 0.5s ease',
              borderRadius: '12px',
              padding: isSelectMode ? '6px 4px' : (flashMessageId === msg.id ? '8px' : '0'),
              backgroundColor: isSelected ? 'rgba(0, 255, 136, 0.08)' : (flashMessageId === msg.id ? 'rgba(0, 255, 136, 0.2)' : 'transparent'),
              transform: flashMessageId === msg.id ? 'scale(1.02)' : 'scale(1)',
              cursor: isSelectMode ? 'pointer' : 'default'
            }}>
              {isSelectMode && (
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    setMultiSelected(prev => prev.includes(msg.id) ? prev.filter(i => i !== msg.id) : [...prev, msg.id]);
                  }}
                  style={{
                    width: '24px', height: '24px', borderRadius: '50%',
                    border: `2px solid ${isSelected ? 'var(--accent-primary)' : 'var(--text-muted)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', flexShrink: 0,
                    backgroundColor: isSelected ? 'var(--accent-primary)' : 'transparent',
                    transition: 'all 0.15s'
                  }}
                >
                  {isSelected && <CheckCircleIcon size={16} color="#000" />}
                </div>
              )}

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                maxWidth: '80%',
                opacity: isSelectMode && !isSelected ? 0.6 : 1,
                transition: 'opacity 0.2s'
              }}>
                {isGroup && !isMine && (
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px', marginLeft: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {senderName} {safeChat.adminId && msg.senderId === safeChat.adminId && <CrownIcon size={12} color="var(--accent-secondary)" />}
                  </span>
                )}
                
                {/* SPECIAL RENDERING FOR REJOIN REQUESTS */}
                {msg.type === 'rejoin_request' && (
                  <div style={{
                    backgroundColor: 'rgba(124, 77, 255, 0.05)',
                    border: '1px solid rgba(124, 77, 255, 0.2)',
                    borderRadius: '16px',
                    padding: '16px',
                    margin: '12px 0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    alignItems: 'center',
                    width: '100%'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-secondary)', fontWeight: 600 }}>
                      <UserPlusIcon size={20} />
                      <span>Rejoin Request</span>
                    </div>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textAlign: 'center', margin: 0 }}>
                      {msg.text}
                    </p>
                    {isAdmin && (
                      <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                        <button 
                          className="btn-secondary" 
                          style={{ flex: 1, padding: '8px', fontSize: '0.85rem' }}
                          onClick={() => {
                            showToast('Request ignored', 'info');
                          }}
                        >
                          Ignore
                        </button>
                        <button 
                          className="btn-primary" 
                          style={{ flex: 1, padding: '8px', fontSize: '0.85rem' }}
                          onClick={() => addMemberToGroup(id, msg.senderId)}
                        >
                          Approve
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {msg.type !== 'rejoin_request' && (
                  <div 
                    onClick={(e) => {
                      if (isSelectMode) {
                        e.stopPropagation();
                        return;
                      }
                    }}
                    onTouchStart={(e) => {
                      if (isSelectMode) return;
                      setTouchStart(e.touches[0].clientX);
                      setSwipingMsgId(msg.id);
                    }}
                    onTouchMove={(e) => {
                      if (!touchStart || isSelectMode) return;
                      const diff = touchStart - e.touches[0].clientX;
                      if (diff > 0) { // Swiping left
                        setSwipeOffset(Math.min(diff, 100));
                      }
                    } }
                    onTouchEnd={() => {
                      if (swipeOffset > 60) {
                        setReplyTo(msg);
                        if (navigator.vibrate) navigator.vibrate(10);
                      }
                      setTouchStart(null);
                      setSwipeOffset(0);
                      setSwipingMsgId(null);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setSelectedMessage(msg);
                    }}
                    onMouseDown={() => handleLongPressStart(msg)}
                    onMouseUp={handleLongPressEnd}
                    onMouseLeave={handleLongPressEnd}
                    style={{
                      background: isMine 
                        ? (safeChat.theme?.senderColor ? `${safeChat.theme.senderColor}cc` : 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)') 
                        : (safeChat.theme?.receiverColor || 'rgba(44, 44, 46, 0.85)'),
                      backdropFilter: 'blur(20px)',
                      border: isMine ? 'none' : '1px solid rgba(255, 255, 255, 0.12)',
                      color: isMine ? (safeChat.theme?.senderColor ? '#fff' : '#000') : '#fff',
                      padding: msg.media ? '4px' : '12px 16px',
                      borderRadius: isMine ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                      boxShadow: isMine ? (safeChat.theme?.senderColor ? `0 8px 25px ${safeChat.theme.senderColor}55` : 'var(--shadow-glow)') : '0 8px 25px rgba(0,0,0,0.3)',
                      position: 'relative',
                      cursor: 'pointer',
                      overflow: 'visible', // Changed to visible to see the reply icon behind
                      transition: swipingMsgId === msg.id ? 'none' : 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      transform: swipingMsgId === msg.id ? `translateX(${-swipeOffset}px)` : 'translateX(0)',
                      opacity: (msg.deleteAt && msg.deleteAt <= Date.now()) ? 0 : 1,
                      borderTop: msg.isStarred ? '1px solid var(--accent-primary)' : (isMine ? 'none' : '1px solid rgba(255, 255, 255, 0.08)')
                    }}
                  >
                  {swipingMsgId === msg.id && swipeOffset > 10 && (
                    <div style={{
                      position: 'absolute', right: '-40px', top: '50%', transform: 'translateY(-50%)',
                      opacity: Math.min(swipeOffset / 60, 1), transition: 'opacity 0.1s',
                      color: 'var(--accent-primary)'
                    }}>
                      <ReplyIcon size={24} />
                    </div>
                  )}
                  {msg.forwardedFrom && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.65rem', color: isMine ? 'rgba(0,0,0,0.5)' : 'var(--text-muted)', marginBottom: '4px', fontStyle: 'italic' }}>
                      <ForwardIcon size={12} /> Forwarded
                    </div>
                  )}
                  {msg.replyTo && (
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        const target = document.getElementById(`msg-${msg.replyTo.id}`);
                        target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }}
                      style={{ 
                        backgroundColor: isMine ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.05)',
                        borderLeft: `4px solid ${isMine ? '#000' : 'var(--accent-primary)'}`,
                        padding: '8px 12px',
                        borderRadius: '8px',
                        marginBottom: '8px',
                        fontSize: '0.85rem',
                        opacity: 0.8
                      }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: '2px', fontSize: '0.75rem' }}>
                        {msg.replyTo.senderId === user?.id ? 'You' : (isGroup ? (safeChat.members || []).find(m => m && (m.id === msg.replyTo.senderId || m.shadowId === msg.replyTo.senderId))?.name || 'Unknown' : safeChat.contact?.name || 'Unknown')}
                      </div>
                      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {msg.replyTo.text || (msg.replyTo.media ? (msg.replyTo.media.type === 'image' ? 'Photo' : (msg.replyTo.media.type === 'video' ? 'Video' : 'File')) : 'Message')}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {msg.media && (
                      <div style={{ marginBottom: msg.text ? '4px' : 0 }}>
                        {msg.media.type === 'image' && (
                          <div style={{ position: 'relative', group: 'true' }}>
                            <img 
                              src={msg.media.url} 
                              alt="Shared" 
                              style={{ width: '100%', borderRadius: '12px', cursor: 'pointer' }} 
                              onClick={(e) => { e.stopPropagation(); setPreviewMedia(msg); }} 
                            />
                            <div style={{
                              position: 'absolute', top: '8px', right: '8px',
                              display: 'flex', gap: '8px', opacity: 0.8
                            }}>
                              <button 
                                onClick={(e) => { e.stopPropagation(); downloadFile(msg.media.url, msg.media.name); }}
                                style={{
                                  width: '32px', height: '32px', borderRadius: '80%',
                                  backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)',
                                  color: '#fff', border: 'none', cursor: 'pointer',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}
                              >
                                <DownloadIcon size={16} />
                              </button>
                            </div>
                          </div>
                        )}
                        {msg.media.type === 'video' && (
                          <div 
                            style={{ position: 'relative', cursor: 'pointer', borderRadius: '12px', overflow: 'hidden' }}
                            onClick={(e) => { e.stopPropagation(); setPreviewMedia(msg); }}
                          >
                            <video 
                              src={msg.media.url} 
                              style={{ width: '100%', display: 'block' }} 
                            />
                            <div style={{
                              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              backgroundColor: 'rgba(0,0,0,0.3)'
                            }}>
                              <div style={{
                                width: '50px', height: '50px', borderRadius: '50%',
                                backgroundColor: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                border: '1px solid rgba(255,255,255,0.3)'
                              }}>
                                <PlayIcon size={24} color="#fff" fill="#fff" />
                              </div>
                            </div>
                            <div style={{
                              position: 'absolute', top: '8px', right: '8px',
                              display: 'flex', gap: '8px'
                            }}>
                              <button 
                                onClick={(e) => { e.stopPropagation(); downloadFile(msg.media.url, msg.media.name); }}
                                style={{
                                  width: '32px', height: '32px', borderRadius: '50%',
                                  backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)',
                                  color: '#fff', border: 'none', cursor: 'pointer',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}
                              >
                                <DownloadIcon size={16} />
                              </button>
                            </div>
                          </div>
                        )}
                        {msg.media.type === 'audio' && (
                          <div 
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                const audio = new Audio(msg.media.url);
                                audio.crossOrigin = "anonymous"; // Handle CORS if needed
                                await audio.play();
                              } catch (err) {
                                console.error('Audio playback error:', err);
                                showToast('Playback failed. Check browser permissions.', 'error');
                              }
                            }}
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '12px', 
                              backgroundColor: isMine ? 'rgba(0,0,0,0.15)' : 'var(--bg-secondary)', 
                              padding: '12px 16px', 
                              borderRadius: '16px',
                              minWidth: '200px',
                              cursor: 'pointer'
                            }}
                          >
                            <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <PlayIcon size={18} fill="currentColor" />
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ height: '3px', backgroundColor: isMine ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)', borderRadius: '2px', position: 'relative' }}>
                                <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: '0%', backgroundColor: 'var(--accent-primary)', borderRadius: '2px' }} />
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.65rem', color: isMine ? 'rgba(0,0,0,0.5)' : 'var(--text-muted)' }}>
                                <span>Voice Message</span>
                                <span>Audio</span>
                              </div>
                            </div>
                          </div>
                        )}
                        {msg.media.type === 'document' && (
                          <div 
                            onClick={(e) => { e.stopPropagation(); downloadFile(msg.media.url, msg.media.name); }}
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '12px', 
                              backgroundColor: isMine ? 'rgba(0,0,0,0.1)' : 'var(--bg-secondary)', 
                              padding: '12px 16px', 
                              borderRadius: '12px',
                              cursor: 'pointer'
                            }}
                          >
                            <FileTextIcon size={24} color={isMine ? '#000' : 'var(--accent-primary)'} />
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                              <div style={{ fontSize: '0.85rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg.media.name}</div>
                              <div style={{ fontSize: '0.7rem', color: isMine ? 'rgba(0,0,0,0.5)' : 'var(--text-muted)' }}>Document</div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {msg.text && msg.type !== 'call' && <span style={{ lineHeight: '1.4', wordBreak: 'break-word' }}>{highlightedText}</span>}
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    gap: '4px',
                    marginTop: '4px',
                    fontSize: '0.65rem',
                    color: isMine ? 'rgba(0,0,0,0.6)' : 'var(--text-muted)'
                  }}>
                    {msg.edited && <span style={{ opacity: 0.6, fontSize: '0.6rem' }}>(edited)</span>}
                    {msg.isStarred && <StarIcon size={10} fill="currentColor" style={{ opacity: 0.8 }} />}
                    {msg.deleteAt && <TimerIcon size={12} style={{ opacity: 0.7, marginRight: '2px' }} />}
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {isMine && (
                      <div style={{ marginLeft: '4px', display: 'flex', alignItems: 'center' }}>
                        {isGroup ? (
                          // Group Chat Ticks
                          (msg.seenBy && msg.seenBy.length >= (safeChat.members?.length || 1) - 1) ? (
                            settings.readReceipts ? (
                              <CheckCheckIcon size={14} color="#34b7f1" style={{ opacity: 1 }} />
                            ) : (
                              <CheckCheckIcon size={14} color="var(--text-muted)" style={{ opacity: 0.6 }} />
                            )
                          ) : (msg.deliveredTo && msg.deliveredTo.length >= (safeChat.members?.length || 1) - 1) ? (
                            <CheckCheckIcon size={14} color="var(--text-muted)" style={{ opacity: 0.6 }} />
                          ) : (
                            <CheckIcon size={14} color="var(--text-muted)" style={{ opacity: 0.6 }} />
                          )
                        ) : (
                          // Direct Chat Ticks
                          (msg.status === 'seen' || msg.read || (msg.seenBy && msg.seenBy.some(sId => sId.toLowerCase() === (safeChat.contact?.id || id).toLowerCase()))) ? (
                            settings.readReceipts ? (
                              <CheckCheckIcon size={14} color="#34b7f1" style={{ opacity: 1 }} />
                            ) : (
                              <CheckCheckIcon size={14} color="var(--text-muted)" style={{ opacity: 0.6 }} />
                            )
                          ) : (msg.status === 'delivered' || (msg.deliveredTo && msg.deliveredTo.some(dId => dId.toLowerCase() === (safeChat.contact?.id || id).toLowerCase()))) ? (
                            <CheckCheckIcon size={14} color="var(--text-muted)" style={{ opacity: 0.6 }} />
                          ) : (
                            <CheckIcon size={14} color="var(--text-muted)" style={{ opacity: 0.6 }} />
                          )
                        )}
                      </div>
                    )}
                  </div>
                  </div>
                )}

                {/* Reactions */}
                {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '4px',
                    marginTop: '4px',
                    marginBottom: '4px',
                    alignSelf: isMine ? 'flex-end' : 'flex-start'
                  }}>
                    {Object.entries(msg.reactions).map(([emoji, users]) => (
                      <div 
                        key={emoji}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleReaction(id, msg.id, emoji);
                        }}
                        style={{
                          backgroundColor: users.some(uid => uid.toLowerCase() === user?.id?.toLowerCase()) ? 'var(--accent-primary)' : 'rgba(255,255,255,0.08)',
                          borderRadius: '12px',
                          padding: '2px 8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          border: users.some(uid => uid.toLowerCase() === user?.id?.toLowerCase()) ? 'none' : '1px solid rgba(255,255,255,0.1)',
                          color: users.some(uid => uid.toLowerCase() === user?.id?.toLowerCase()) ? '#000' : 'var(--text-primary)',
                          transition: 'all 0.2s',
                          boxShadow: users.some(uid => uid.toLowerCase() === user?.id?.toLowerCase()) ? '0 2px 8px rgba(0, 255, 136, 0.3)' : 'none'
                        }}
                      >
                        <span>{emoji}</span>
                        {users.length > 1 && <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>{users.length}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            </React.Fragment>
          );
        })}

        {/* Typing Indicator */}
        {(() => {
          const currentTypingObj = typingUsers[id] || {};
          const typingUserIds = Object.keys(currentTypingObj).filter(uid => currentTypingObj[uid] && uid !== user?.id);
          
          if (typingUserIds.length === 0) return null;
          
          const typingNames = typingUserIds.map(uid => {
            if (isGroup) {
              return (safeChat.members || []).find(m => m && (m.id === uid || m.shadowId === uid))?.name || 'Someone';
            } else {
              return safeChat.contact?.name || 'Someone';
            }
          });
          
          let typingText = '';
          if (typingNames.length === 1) {
            typingText = `${typingNames[0]} is typing...`;
          } else if (typingNames.length === 2) {
            typingText = `${typingNames[0]} and ${typingNames[1]} are typing...`;
          } else if (typingNames.length > 2) {
            typingText = 'Multiple people are typing...';
          }
          
          return (
            <div style={{ 
              alignSelf: 'flex-start',
              maxWidth: '85%',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%',
              justifyContent: 'flex-start',
              margin: '4px 0',
              animation: 'fadeIn 0.3s ease-out'
            }}>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                maxWidth: '80%'
              }}>
                {isGroup && (
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px', marginLeft: '12px' }}>
                    {typingNames.join(', ')}
                  </span>
                )}
                <div style={{
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  padding: '10px 16px',
                  borderRadius: '16px 16px 16px 4px',
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  border: '1px solid var(--border-color)',
                  backdropFilter: 'blur(20px)'
                }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                    {typingText}
                  </span>
                </div>
              </div>
            </div>
          );
        })()}

        <div ref={messagesEndRef} style={{ height: '1px' }} />
      </div>

      {/* Floating Scroll Button & New Message Badge */}
      {(showScrollBottomBtn || newMessagesCount > 0) && (
        <div style={{
          position: 'absolute',
          bottom: '100px', 
          right: '20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
          zIndex: 10000,
          pointerEvents: 'none'
        }}>
          {newMessagesCount > 0 && (
            <div 
              onClick={(e) => { e.stopPropagation(); scrollToBottom(); }}
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: '#000',
                padding: '12px 20px',
                borderRadius: '30px',
                fontSize: '0.95rem',
                fontWeight: 900,
                cursor: 'pointer',
                boxShadow: '0 10px 30px rgba(0, 255, 136, 0.6)',
                animation: 'bounce 2s infinite',
                border: '3px solid #000',
                pointerEvents: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <div style={{ width: '10px', height: '10px', backgroundColor: '#000', borderRadius: '50%', animation: 'pulse 1s infinite' }}></div>
              {newMessagesCount} NEW MESSAGE{newMessagesCount > 1 ? 'S' : ''}
              <ArrowDownIcon size={18} />
            </div>
          )}
          {showScrollBottomBtn && (
            <button 
              onClick={(e) => { e.stopPropagation(); scrollToBottom(); }}
              style={{
                width: '55px',
                height: '55px',
                borderRadius: '50%',
                backgroundColor: '#000',
                border: '3px solid var(--accent-primary)',
                color: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 8px 20px rgba(0,0,0,0.8)',
                transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                pointerEvents: 'auto'
              }}
            >
              <ArrowDownIcon size={32} />
            </button>
          )}
        </div>
      )}

      <div style={{
        padding: '0',
        backgroundColor: 'rgba(10, 10, 10, 0.8)',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        position: 'relative',
        backdropFilter: 'blur(20px)',
        zIndex: 20
      }}>

        {/* ── MULTI-SELECT TOOLBAR ── */}
        {isSelectMode ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '12px 16px',
            animation: 'slideUp 0.2s ease-out'
          }}>
            {/* Cancel */}
            <button
              onClick={() => { setIsSelectMode(false); setMultiSelected([]); }}
              style={{
                width: '36px', height: '36px', borderRadius: '50%',
                background: 'var(--bg-tertiary)', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'var(--text-primary)', flexShrink: 0
              }}
            >
              <XIcon size={20} />
            </button>

            {/* Count + Select All */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 700, color: 'var(--accent-primary)', fontSize: '1rem' }}>
                {multiSelected.length} selected
              </span>
              <button
                onClick={() => {
                  const allIds = chatMessages.map(m => m.id);
                  if (multiSelected.length === allIds.length) {
                    setMultiSelected([]);
                  } else {
                    setMultiSelected(allIds);
                  }
                }}
                style={{
                  fontSize: '0.75rem', fontWeight: 600,
                  color: 'var(--text-muted)', background: 'none',
                  border: 'none', cursor: 'pointer', padding: '4px 8px',
                  borderRadius: '8px', backgroundColor: 'var(--bg-tertiary)'
                }}
              >
                {multiSelected.length === chatMessages.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            {/* Copy button */}
            <button
              disabled={multiSelected.length === 0}
              onClick={() => {
                const selectedMsgs = chatMessages
                  .filter(m => multiSelected.includes(m.id) && m.text)
                  .map(m => m.text)
                  .join('\n');
                if (selectedMsgs) {
                  navigator.clipboard.writeText(selectedMsgs);
                  showToast(`Copied ${multiSelected.length} message${multiSelected.length > 1 ? 's' : ''}`, 'success');
                } else {
                  showToast('No text to copy', 'info');
                }
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '10px 18px', borderRadius: '20px',
                backgroundColor: multiSelected.length === 0 ? 'var(--bg-tertiary)' : 'var(--accent-primary)',
                color: multiSelected.length === 0 ? 'var(--text-muted)' : '#000',
                border: 'none', cursor: multiSelected.length === 0 ? 'not-allowed' : 'pointer',
                fontWeight: 700, fontSize: '0.9rem', transition: 'all 0.2s'
              }}
            >
              <CopyIcon size={18} /> Copy
            </button>

            {/* Delete button */}
            <button
              disabled={multiSelected.length === 0}
              onClick={() => {
                if (multiSelected.length === 0) return;
                const selectedMsgObjects = chatMessages.filter(m => multiSelected.includes(m.id));
                setDeleteConfirmMsg({ msgs: selectedMsgObjects, type: 'choose_multi' });
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '10px 18px', borderRadius: '20px',
                backgroundColor: multiSelected.length === 0 ? 'var(--bg-tertiary)' : 'rgba(255,68,68,0.15)',
                color: multiSelected.length === 0 ? 'var(--text-muted)' : 'var(--accent-danger)',
                border: `1px solid ${multiSelected.length === 0 ? 'transparent' : 'rgba(255,68,68,0.3)'}`,
                cursor: multiSelected.length === 0 ? 'not-allowed' : 'pointer',
                fontWeight: 700, fontSize: '0.9rem', transition: 'all 0.2s'
              }}
            >
              <Trash2Icon size={18} /> Delete
            </button>
          </div>
        ) : (
          <>
        
        {/* Hidden File Inputs */}
        <input type="file" ref={fileInputRef} hidden accept="image/*,video/*" multiple onChange={(e) => handleMultipleFiles(e.target.files, 'image')} />
        <input type="file" ref={cameraInputRef} hidden accept="image/*" capture onChange={(e) => e.target.files[0] && uploadFile(e.target.files[0], 'image', true)} />
        <input type="file" ref={docInputRef} hidden multiple onChange={(e) => handleMultipleFiles(e.target.files, 'document')} />

        {/* Attachment Menu and Emoji Picker moved into chat-input-container for correct anchoring */}

        {/* Voice Recording Overlay */}
        {isRecording && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'var(--bg-secondary)', zIndex: 600,
            display: 'flex', alignItems: 'center', padding: '0 20px',
            gap: '16px'
          }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="pulse-red" style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ff4444' }} />
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Recording Voice Message...</span>
              <span style={{ color: 'var(--accent-primary)', fontFamily: 'monospace' }}>
                {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
              </span>
            </div>
            <button onClick={() => setIsRecording(false)} style={{ color: 'var(--accent-danger)', fontWeight: 600 }}>Cancel</button>
            <button 
              onClick={stopVoiceRecording} 
              style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <SquareIcon size={20} fill="currentColor" />
            </button>
          </div>
        )}

        {/* Pending Attachments Preview */}
        {pendingAttachments.length > 0 && (
          <div style={{
            padding: '12px 20px',
            backgroundColor: 'var(--bg-secondary)',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            {pendingAttachments.map((att, idx) => (
              <div key={idx} style={{ position: 'relative' }}>
                {att.type === 'image' ? (
                  <img 
                    src={att.url} 
                    style={{ width: '60px', height: '60px', borderRadius: '8px', objectFit: 'cover', cursor: 'pointer' }} 
                    alt="preview" 
                    onClick={() => setPreviewMedia({ media: att, timestamp: Date.now(), isPending: true, index: idx })}
                  />
                ) : (
                  <div 
                    onClick={() => setPreviewMedia({ media: att, timestamp: Date.now(), isPending: true, index: idx })}
                    style={{ width: '60px', height: '60px', borderRadius: '8px', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  >
                     {att.type === 'video' ? <PlayIcon size={24} color="var(--accent-primary)" /> : <FileTextIcon size={24} color="var(--accent-primary)" />}
                  </div>
                )}
                <button 
                  type="button"
                  onClick={() => removePendingAttachment(idx)}
                  style={{ 
                    position: 'absolute', top: '-6px', right: '-6px', 
                    width: '20px', height: '20px', borderRadius: '50%', 
                    backgroundColor: 'rgba(255,68,68,0.9)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: 'none', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                    zIndex: 10
                  }}
                >
                  <XIcon size={12} strokeWidth={3} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Editing Mode Indicator */}
        {editingMessage && (
          <div style={{
            padding: '12px 20px',
            backgroundColor: 'rgba(0, 255, 136, 0.05)',
            borderTop: '1px solid var(--accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--accent-primary)' }}>
              <Edit2Icon size={16} />
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Editing Message</span>
            </div>
            <button 
              type="button"
              onClick={() => { setEditingMessage(null); setInputText(''); }}
              style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* Reply Preview */}

        {/* ── READ-ONLY / BLOCKED AREA ── */}
        {finalIsReadOnly ? (
          <div style={{ 
            backgroundColor: 'var(--bg-secondary)', 
            padding: '24px', 
            borderTop: '1px solid var(--border-color)',
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            gap: '16px',
            animation: 'slideUp 0.3s ease-out'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-muted)' }}>
              {isIndefinitelyReadOnly || isRestrictedByAdmin ? <BanIcon size={20} color="var(--accent-danger)" /> : <LockIcon size={20} />}
              <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>
                {safeChat.status === 'pending_received' ? 'You have a message request from this user.' :
                 safeChat.status === 'pending_sent' ? 'Connection request sent. Waiting for approval...' :
                 safeChat.status === 'rejected' ? 'Connection request was declined.' :
                 isRemoved ? (safeChat.exitType === 'left' ? 'You have left the group.' : 
                              (safeChat.exitType === 'removed' ? 'Admin has removed you from this group.' : 
                              'You are no longer a participant in this group.')) : 
                 isBlocked ? 'You blocked this contact.' :
                 isBlockedByOther ? 'You have been blocked.' :
                 isDeletedByMe ? 'You are no longer friends.' :
                 isDeletedByOther ? 'This contact removed you.' :
                 isIndefinitelyReadOnly ? 'Only admins can send messages.' :
                 isRestrictedByAdmin ? 'Admin disabled direct messaging between members.' :
                 'This conversation is read-only.'}
              </span>
            </div>

            {isBlocked && (
              <button 
                className="btn-primary" 
                style={{ width: 'auto', minWidth: '150px', borderRadius: '12px' }}
                onClick={() => {
                  unblockContact(id);
                  setIsBlockedDetail(false);
                }}
              >
                Unblock
              </button>
            )}
          </div>
        ) : (
          <div className="chat-input-container" style={{ position: 'relative', padding: '12px 16px 24px 16px', backgroundColor: 'var(--bg-primary)', borderTop: '1px solid var(--border-color)' }}>
            {/* Attachment Menu */}
            {showAttachments && (
              <div className="animate-slide-up" style={{
                position: 'absolute', bottom: 'calc(100% + 8px)', left: '16px',
                backgroundColor: 'rgba(23, 23, 23, 0.8)', borderRadius: '28px',
                padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.1)', zIndex: 500,
                backdropFilter: 'blur(20px)', width: 'auto', minWidth: '280px'
              }}>
                <div className="attach-item" onClick={startCamera}>
                  <div className="attach-icon" style={{ 
                    background: 'linear-gradient(135deg, #FF512F 0%, #DD2476 100%)',
                    boxShadow: '0 8px 20px rgba(221, 36, 118, 0.3)'
                  }}>
                    <CameraIcon size={26} strokeWidth={2.5} />
                  </div>
                  <span>Camera</span>
                </div>
                <div className="attach-item" onClick={() => fileInputRef.current.click()}>
                  <div className="attach-icon" style={{ 
                    background: 'linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%)',
                    boxShadow: '0 8px 20px rgba(109, 213, 237, 0.3)'
                  }}>
                    <ImageIcon size={26} strokeWidth={2.5} />
                  </div>
                  <span>Gallery</span>
                </div>
                <div className="attach-item" onClick={() => docInputRef.current.click()}>
                  <div className="attach-icon" style={{ 
                    background: 'linear-gradient(135deg, #8E2DE2 0%, #4A00E0 100%)',
                    boxShadow: '0 8px 20px rgba(74, 0, 224, 0.3)'
                  }}>
                    <FileTextIcon size={26} strokeWidth={2.5} />
                  </div>
                  <span>Document</span>
                </div>
              </div>
            )}

            {/* Emoji Picker (Premium Drawer) */}
            {showEmojiPicker && (
              <div className="animate-slide-up glass-morphism" style={{
                position: 'absolute', bottom: 'calc(100% + 8px)', right: '16px',
                borderRadius: '24px',
                padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)',
                gap: '12px', boxShadow: '0 15px 50px rgba(0,0,0,0.5)',
                zIndex: 500,
                maxHeight: '280px', overflowY: 'auto',
                width: 'auto', minWidth: '260px'
              }}>
                {['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🤩','🥳','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','🤯','🤠','🥳','😎','🤓','🧐','😈','🔥','✨','💯','👍','❤️','🙌','👏','🔥','😂','🙏','✅','❌','⚠️','💡','⭐','🎁','🎂','🎈','🍕','🍔','🍟','🥗','🍦','🍰','🍷','🍺','☕','🍵','⚽','🏀','🏈','⚾','🎾','🏐','🎸','🎹','🎮','🎧','📱','💻','⌚','📷','📽️','🏠','🏢','🏥','🏦','🏨','⛪','🕌','⛩️','🏔️','🌋','🏖️','🏙️','🌃','🌅','🌄','🌇','🚗','🚕','🚌','🚑','🚒','✈️','🚀','🛸','🛸','🌈','☀️','🌧️','❄️','⚡','⭐','🔥','💧','🍃','🌳','🌵','🍄','🐾','🐱','🐶','🐭','🐹','🐰','🦊','🐻','🐼','🐯','🦁','🐮','🐷','🐵','🐥','🦆','🦉','🐸','🐢','🐍','🐲','🐳','🐬','🐙','🦞','🦀','🕷️','🦋'].map(emo => (
                  <span key={emo} onClick={() => handleEmojiClick(emo)} style={{ fontSize: '1.6rem', cursor: 'pointer', textAlign: 'center', transition: 'transform 0.2s' }} className="hoverable-emoji">{emo}</span>
                ))}
              </div>
            )}
            {finalIsReadOnly && (
              <div style={{ padding: '8px 16px', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '12px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <ShieldIcon size={14} color="var(--text-muted)" />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {isIndefinitelyReadOnly 
                    ? "Only admins can send messages in this group." 
                    : (isRestrictedByAdmin 
                      ? "Direct messages between members are currently disabled by admin." 
                      : "This chat is currently read-only.")}
                </span>
              </div>
            )}
            {replyTo && (
              <div className="reply-preview animate-slide-up" style={{ padding: '12px 16px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '16px 16px 4px 4px', borderLeft: '4px solid var(--accent-primary)', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ color: 'var(--accent-primary)', fontSize: '0.8rem', fontWeight: 700, marginBottom: '2px' }}>
                    Reply to {replyTo.senderId === user?.id ? 'You' : (isGroup ? (safeChat.members || [])?.find(m => m && (m.id === replyTo.senderId || m.shadowId === replyTo.senderId))?.name || 'Member' : safeChat.contact?.name || 'Member')}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {replyTo.text || (replyTo.media ? (replyTo.media.type === 'image' ? 'Photo' : (replyTo.media.type === 'video' ? 'Video' : 'File')) : 'Message')}
                  </div>
                </div>
                <button className="icon-btn" onClick={() => setReplyTo(null)} style={{ background: 'transparent' }}><XIcon size={18} /></button>
              </div>
            )}

            {/* Mention Suggestions */}
            {mentionSearch && isGroup && (
              <div style={{
                position: 'absolute',
                bottom: '100%',
                left: 0,
                width: '100%',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: '16px',
                marginBottom: '8px',
                border: '1px solid var(--border-color)',
                boxShadow: '0 -10px 30px rgba(0,0,0,0.4)',
                maxHeight: '200px',
                overflowY: 'auto',
                zIndex: 1000,
                animation: 'slideUp 0.2s ease-out'
              }}>
                {(safeChat.members || [])
                  .filter(m => m.id !== user?.id && m.name.toLowerCase().includes(mentionSearch.query.toLowerCase()))
                  .map(member => (
                    <div 
                      key={member.id}
                      onClick={() => {
                        const before = inputText.slice(0, mentionSearch.index);
                        const after = inputText.slice(mentionSearch.index + mentionSearch.query.length + 1);
                        setInputText(before + '@' + member.name + ' ' + after);
                        setMentionSearch(null);
                      }}
                      style={{
                        padding: '12px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--border-color)'
                      }}
                      className="hoverable"
                    >
                      <DefaultAvatar name={member.name} size={30} />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{member.name}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{member.shadowId || member.id}</span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
            
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
              {!finalIsReadOnly && (
                <div style={{ display: 'flex', gap: '4px', paddingBottom: '4px' }}>
                  <button className="icon-btn glass-morphism-light" onClick={() => { const newVal = !showEmojiPicker; setShowEmojiPicker(newVal); if (newVal) setShowAttachments(false); }} style={{ border: 'none' }}><SmileIcon size={24} color="var(--text-muted)" /></button>
                  <button className="icon-btn glass-morphism-light" onClick={() => { const newVal = !showAttachments; setShowAttachments(newVal); if (newVal) setShowEmojiPicker(false); }} style={{ border: 'none' }}><PaperclipIcon size={24} color="var(--text-muted)" /></button>
                </div>
              )}
              
              <div style={{ flex: 1, position: 'relative' }}>
                <textarea
                  ref={inputRef}
                  className="text-input"
                  placeholder={isNoteToSelf ? "Note to self..." : (finalIsReadOnly ? "Read-only mode" : "Message...")}
                  value={inputText}
                  disabled={finalIsReadOnly}
                  onChange={(e) => handleTyping(e.target.value)}
                  onFocus={() => { setShowEmojiPicker(false); setShowAttachments(false); }}
                  onPaste={async (e) => {
                    if (finalIsReadOnly) return;
                    const items = e.clipboardData?.items;
                    if (!items) return;

                    const files = [];
                    for (let i = 0; i < items.length; i++) {
                      if (items[i].type.indexOf('image') !== -1) {
                        const file = items[i].getAsFile();
                        if (file) files.push(file);
                      }
                    }
                    if (files.length > 0) {
                      e.preventDefault();
                      await handleMultipleFiles(files, 'image');
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (!finalIsReadOnly) handleSend(e);
                    }
                  }}
                  style={{
                    minHeight: '44px',
                    maxHeight: '150px',
                    borderRadius: '24px',
                    padding: '11px 16px',
                    resize: 'none',
                    lineHeight: '1.4',
                    backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    fontSize: '1rem',
                    transition: 'all 0.2s'
                  }}
                  rows={1}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {(!inputText.trim() && pendingAttachments.length === 0) ? (
                  <button 
                    className="icon-btn pulse" 
                    onMouseDown={startVoiceRecording}
                    onMouseUp={stopVoiceRecording}
                    onTouchStart={startVoiceRecording}
                    onTouchEnd={stopVoiceRecording}
                    disabled={finalIsReadOnly}
                    style={{ 
                      backgroundColor: isRecording ? 'var(--accent-danger)' : 'var(--bg-tertiary)', 
                      color: isRecording ? '#fff' : 'var(--text-primary)', 
                      border: 'none', width: '44px', height: '44px',
                      opacity: finalIsReadOnly ? 0.5 : 1,
                      cursor: finalIsReadOnly ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <MicIcon size={22} />
                  </button>
                ) : (
                  <button 
                    className="icon-btn" 
                    onClick={handleSend}
                    disabled={finalIsReadOnly}
                    style={{ 
                      backgroundColor: 'var(--accent-primary)', 
                      color: '#000', border: 'none', width: '44px', height: '44px', 
                      boxShadow: 'var(--shadow-glow)',
                      opacity: finalIsReadOnly ? 0.5 : 1,
                      cursor: finalIsReadOnly ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <SendIcon size={20} />
                  </button>
                )}
              </div>
            </div>

            {pendingAttachments.length > 0 && (
              <div style={{ display: 'flex', gap: '10px', marginTop: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                {pendingAttachments.map((file, idx) => (
                  <div key={idx} style={{ position: 'relative', width: '60px', height: '60px' }}>
                    <img src={file.url} alt="" style={{ width: '100%', height: '100%', borderRadius: '12px', objectFit: 'cover', border: '2px solid var(--accent-primary)' }} />
                    <button 
                      onClick={() => removePendingAttachment(idx)}
                      style={{ position: 'absolute', top: '-8px', right: '-8px', backgroundColor: '#ff4444', color: '#fff', border: 'none', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <XIcon size={12} />
                    </button>
                  </div>
                ))}

                {/* Add More Plus Icon - Visible until limit of 50 is reached */}
                {pendingAttachments.length < 50 && (
                  <div 
                    className="hoverable"
                    onClick={() => setShowAttachments(true)}
                    style={{ 
                      width: '60px', height: '60px', borderRadius: '12px', 
                      border: '2px dashed var(--accent-primary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', backgroundColor: 'rgba(0, 255, 136, 0.05)',
                      transition: 'all 0.2s ease'
                    }}
                    title="Add more media"
                  >
                    <PlusIcon size={24} color="var(--accent-primary)" />
                  </div>
                )}
              </div>
            )}

          </div>
        )}
          </>
        )}
      </div>

      {/* Message Actions Menu */}
      {selectedMessage && !showInfo && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)'
        }} onClick={() => setSelectedMessage(null)}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)', width: '85%', maxWidth: '300px',
            borderRadius: '24px', overflow: 'hidden', border: '1px solid var(--border-color)',
            animation: 'slideUp 0.2s ease-out'
          }} onClick={e => e.stopPropagation()}>
            
            {/* Emojis */}
            <div style={{ display: 'flex', justifyContent: 'space-around', padding: '16px 12px', backgroundColor: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--border-color)' }}>
              {['😈','😂','🥰','😢','😡','👍','❤️'].map(emo => (
                <span key={emo} style={{ fontSize: '1.5rem', cursor: 'pointer' }} onClick={() => { toggleReaction(id, selectedMessage.id, emo); setSelectedMessage(null); }}>{emo}</span>
              ))}
              <div 
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.1)' }}
                onClick={() => {
                  setReactingToMessageId(selectedMessage.id);
                  setSelectedMessage(null);
                  setShowReactionEmojiPicker(true);
                }}
              >
                <PlusIcon size={20} color="var(--text-primary)" />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="menu-item" onClick={() => handleAction('star', selectedMessage)}>
                <StarIcon size={20} fill={selectedMessage.isStarred ? 'var(--accent-primary)' : 'none'} color={selectedMessage.isStarred ? 'var(--accent-primary)' : 'currentColor'} /> 
                {selectedMessage.isStarred ? 'Unstar' : 'Star'}
              </div>
              <div className="menu-item" onClick={() => handleAction('forward', selectedMessage)}>
                <ForwardIcon size={20} /> Forward
              </div>
              <div className="menu-item" onClick={() => handleAction('pin', selectedMessage)}>
                <PinIcon size={20} fill={safeChat.pinnedMessageIds?.includes(selectedMessage.id) ? 'var(--accent-primary)' : 'none'} color={safeChat.pinnedMessageIds?.includes(selectedMessage.id) ? 'var(--accent-primary)' : 'currentColor'} /> 
                {safeChat.pinnedMessageIds?.includes(selectedMessage.id) ? 'Unpin' : 'Pin'}
              </div>
              <div className="menu-item" onClick={() => handleAction('reply', selectedMessage)}>
                <ReplyIcon size={20} /> Reply
              </div>
              <div className="menu-item" onClick={() => handleAction('copy', selectedMessage)}>
                <CopyIcon size={20} /> {copyFeedback === 'text' ? <span style={{ color: 'var(--accent-primary)' }}>Copied!</span> : 'Copy'}
              </div>
              <div className="menu-item" onClick={() => handleAction('info', selectedMessage)}>
                <InfoIcon size={20} /> Info
              </div>
              <div className="menu-item" onClick={() => handleAction('select', selectedMessage)}>
                <CheckCircleIcon size={20} /> Select
              </div>
              <div className="menu-item" onClick={() => handleAction('share', selectedMessage)}>
                <ShareIcon size={20} /> Share
              </div>
              {selectedMessage.media && (
                <div className="menu-item" onClick={() => handleAction('download', selectedMessage)}>
                  <DownloadIcon size={20} /> Download
                </div>
              )}
              {selectedMessage.senderId === user?.id && selectedMessage.text && (
                <div className="menu-item" onClick={() => handleAction('edit', selectedMessage)}>
                  <Edit2Icon size={20} /> Edit
                </div>
              )}
              {!isGroup && (
                <div className="menu-item" onClick={() => handleAction('copy_id', selectedMessage)}>
                  <CopyIcon size={20} /> {copyFeedback === 'id' ? <span style={{ color: 'var(--accent-primary)' }}>Copied!</span> : 'Copy Account ID'}
                </div>
              )}
              <div className="menu-item text-danger" onClick={() => handleAction('delete', selectedMessage)} style={{ borderTop: '1px solid var(--border-color)', marginTop: '4px' }}>
                <Trash2Icon size={20} /> Delete
                <div style={{ fontSize: '0.6rem', color: 'var(--accent-danger)', marginTop: '2px', marginLeft: '28px' }}>Auto-deletes in 6d 22h</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal — Step 1: Choose scope */}
      {deleteConfirmMsg?.type === 'choose' && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 2000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(5px)'
        }} onClick={() => setDeleteConfirmMsg(null)}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)', borderRadius: '24px', padding: '24px',
            width: '85%', maxWidth: '340px', border: '1px solid var(--border-color)',
            animation: 'slideUp 0.3s ease-out'
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '6px', textAlign: 'center' }}>Delete Message</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '24px', textAlign: 'center' }}>
              Choose how you want to delete this message
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Delete on this device only */}
              <button
                onClick={() => setDeleteConfirmMsg({ msg: deleteConfirmMsg.msg, type: 'confirm_device' })}
                style={{
                  padding: '16px', borderRadius: '16px', border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)',
                  textAlign: 'left', cursor: 'pointer', width: '100%'
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.1rem' }}>📱</span> Delete on this device
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Removes from your chat only. The other person will still see it.
                </div>
              </button>

              {/* Delete for everyone */}
              {(deleteConfirmMsg.msg.senderId === user?.id || isAdmin) && (
                <button
                  onClick={() => setDeleteConfirmMsg({ msg: deleteConfirmMsg.msg, type: 'confirm_everyone' })}
                  style={{
                    padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,68,68,0.3)',
                    backgroundColor: 'rgba(255,68,68,0.08)', color: 'var(--accent-danger)',
                    textAlign: 'left', cursor: 'pointer', width: '100%'
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.1rem' }}>🗑️</span> Delete for everyone
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'rgba(255,68,68,0.7)' }}>
                    Removes from both yours and the recipient's chat.
                  </div>
                </button>
              )}

              <button
                onClick={() => setDeleteConfirmMsg(null)}
                style={{
                  padding: '12px', borderRadius: '16px', border: '1px solid var(--border-color)',
                  backgroundColor: 'transparent', color: 'var(--text-muted)',
                  cursor: 'pointer', width: '100%', marginTop: '4px'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal — Multi-Select Version */}
      {deleteConfirmMsg?.type === 'choose_multi' && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 2000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(5px)'
        }} onClick={() => setDeleteConfirmMsg(null)}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)', borderRadius: '24px', padding: '24px',
            width: '85%', maxWidth: '340px', border: '1px solid var(--border-color)',
            animation: 'slideUp 0.3s ease-out'
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '6px', textAlign: 'center' }}>Delete {deleteConfirmMsg.msgs.length} Messages</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '24px', textAlign: 'center' }}>
              Choose how you want to delete the selected messages
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Delete on this device only */}
              <button
                onClick={async () => {
                  const ids = deleteConfirmMsg.msgs.map(m => m.id);
                  await bulkDeleteMessages(id, ids, false);
                  setDeleteConfirmMsg(null);
                  setIsSelectMode(false);
                  setMultiSelected([]);
                }}
                style={{
                  padding: '16px', borderRadius: '16px', border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)',
                  textAlign: 'left', cursor: 'pointer', width: '100%'
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.1rem' }}>📱</span> Delete on this device
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Removes from your chat only.
                </div>
              </button>

              {/* Delete for everyone */}
              {(deleteConfirmMsg.msgs.every(m => m.senderId === user?.id) || isAdmin) && (
                <button
                  onClick={async () => {
                    const ids = deleteConfirmMsg.msgs.map(m => m.id);
                    await bulkDeleteMessages(id, ids, true);
                    showToast(`${ids.length} messages deleted for everyone`, 'success');
                    setDeleteConfirmMsg(null);
                    setIsSelectMode(false);
                    setMultiSelected([]);
                  }}
                  style={{
                    padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,68,68,0.3)',
                    backgroundColor: 'rgba(255,68,68,0.08)', color: 'var(--accent-danger)',
                    textAlign: 'left', cursor: 'pointer', width: '100%'
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.1rem' }}>🗑️</span> Delete for everyone
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'rgba(255,68,68,0.7)' }}>
                    Removes from everyone's devices.
                  </div>
                </button>
              )}

              <button
                onClick={() => setDeleteConfirmMsg(null)}
                style={{
                  padding: '12px', borderRadius: '16px', border: '1px solid var(--border-color)',
                  backgroundColor: 'transparent', color: 'var(--text-muted)',
                  cursor: 'pointer', width: '100%', marginTop: '4px'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal — Step 2: Confirm device-only */}
      {deleteConfirmMsg?.type === 'confirm_device' && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 2000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(5px)'
        }} onClick={() => setDeleteConfirmMsg(null)}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)', borderRadius: '24px', padding: '24px',
            width: '85%', maxWidth: '320px', border: '1px solid var(--border-color)',
            animation: 'slideUp 0.3s ease-out', textAlign: 'center'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📱</div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '8px' }}>Delete on this device?</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '24px', lineHeight: '1.5' }}>
              This message will only be removed from your chat. The other person will still see it.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setDeleteConfirmMsg(null)}>Cancel</button>
              <button
                style={{ flex: 1, padding: '12px', borderRadius: '12px', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', cursor: 'pointer', fontWeight: 600 }}
                onClick={() => {
                  bulkDeleteMessages(id, [deleteConfirmMsg.msg.id], false);
                  setDeleteConfirmMsg(null);
                  setShowInfo(false);
                }}
              >Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Centered Reaction Emoji Picker */}
      {showReactionEmojiPicker && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 3000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(10px)'
        }} onClick={() => { setShowReactionEmojiPicker(false); setReactingToMessageId(null); }}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)', borderRadius: '32px',
            padding: '24px', maxWidth: '340px', width: '90%',
            border: '1px solid var(--border-color)',
            animation: 'slideUp 0.3s ease-out',
            boxShadow: '0 20px 60px rgba(0,0,0,0.6)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Choose Reaction</h3>
              <XIcon size={20} onClick={() => { setShowReactionEmojiPicker(false); setReactingToMessageId(null); }} style={{ cursor: 'pointer', opacity: 0.6 }} />
            </div>
            <div style={{ 
              display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '14px',
              maxHeight: '350px', overflowY: 'auto', padding: '4px'
            }}>
              {['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🤩','🥳','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','🤯','🤠','😈','🔥','✨','💯','👍','❤️','🙌','👏','🔥','🙏','✅','❌','⚠️','💡','⭐','🎁','🎂','🎈','🍕','🍔','🍟','🥗','🍦','🍰','🍷','🍺','☕','🍵','⚽','🏀','🏈','⚾','🎾','🏐','🎸','🎹','🎮','🎧','📱','💻','⌚','📷','📽️','🏠','🏢','🏥','🏦','🏨','⛪','🕌','⛩️','🏔️','🌋','🏖️','🏙️','🌃','🌅','🌄','🌇','🚗','🚕','🚌','🚑','🚒','✈️','🚀','🛸','🌈','☀️','🌧️','❄️','⚡','💧','🍃','🌳','🌵','🍄','🐾','🐱','🐶','🐭','🐹','🐰','🦊','🐻','🐼','🐯','🦁','🐮','🐷','🐵','🐥','🦆','🦉','🐸','🐢','🐍','🐲','🐳','🐬','🐙','🦞','🦀','🕷','🦋'].map(emo => (
                <span 
                  key={emo} 
                  onClick={() => {
                    toggleReaction(id, reactingToMessageId, emo);
                    setShowReactionEmojiPicker(false);
                    setReactingToMessageId(null);
                  }} 
                  style={{ fontSize: '1.8rem', cursor: 'pointer', textAlign: 'center', transition: 'transform 0.1s' }} 
                  className="hoverable-emoji"
                >
                  {emo}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal — Step 2: Confirm for everyone */}
      {deleteConfirmMsg?.type === 'confirm_everyone' && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 2000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(8px)'
        }} onClick={() => setDeleteConfirmMsg(null)}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)', borderRadius: '24px', padding: '28px',
            width: '85%', maxWidth: '320px', border: '1px solid rgba(255,68,68,0.3)',
            animation: 'slideUp 0.3s ease-out', textAlign: 'center',
            boxShadow: '0 0 40px rgba(255,68,68,0.15)'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🗑️</div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '8px', color: 'var(--accent-danger)' }}>Delete for Everyone?</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '24px', lineHeight: '1.5' }}>
              This message will be permanently deleted from <strong style={{ color: 'var(--text-primary)' }}>both</strong> your chat and the recipient's chat. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setDeleteConfirmMsg(null)}>Cancel</button>
              <button
                style={{ flex: 1, padding: '12px', borderRadius: '12px', backgroundColor: 'var(--accent-danger)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                onClick={async () => {
                  bulkDeleteMessages(id, [deleteConfirmMsg.msg.id], true);
                  showToast('Message deleted for everyone', 'success');
                  setDeleteConfirmMsg(null);
                  setShowInfo(false);
                }}
              >Delete for All</button>
            </div>
          </div>
        </div>
      )}

      {/* Message Info Modal */}
      {showInfo && selectedMessage && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(8px)'
        }} onClick={() => { setShowInfo(false); setSelectedMessage(null); }}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)', width: '90%', maxWidth: '350px',
            borderRadius: '24px', padding: '24px', border: '1px solid var(--border-color)',
            animation: 'fadeIn 0.2s ease-out'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Message Info</h3>
              <XIcon size={24} style={{ cursor: 'pointer' }} onClick={() => { setShowInfo(false); setSelectedMessage(null); }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ClockIcon size={20} color="var(--accent-primary)" />
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sent Time</div>
                  <div style={{ fontWeight: 600 }}>{new Date(selectedMessage.timestamp).toLocaleString()}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCheckIcon size={20} color="var(--accent-primary)" />
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Received Time</div>
                  <div style={{ fontWeight: 600 }}>{new Date(selectedMessage.timestamp + 1000).toLocaleString()}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UserIcon size={20} color="var(--accent-secondary)" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sender Details</div>
                  <div style={{ fontWeight: 600 }}>{selectedMessage.senderId === user?.id ? 'You' : (isGroup ? (safeChat.members || []).find(m => m && m.id === selectedMessage.senderId)?.name || 'Unknown' : safeChat.contact?.name || 'Unknown')}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    {selectedMessage.senderId === user?.id 
                      ? user?.shadowId 
                      : (isGroup ? (safeChat.members?.find(m => m.id === selectedMessage.senderId)?.shadowId || selectedMessage.senderId) : (safeChat.contact?.shadowId || safeChat.contact?.id))
                    }
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
              <button className="btn-secondary" style={{ flex: 1, padding: '12px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }} onClick={() => handleAction('copy', selectedMessage)}>
                <CopyIcon size={20} color={copyFeedback === 'text' ? 'var(--accent-primary)' : 'currentColor'} /> 
                <span style={{ fontSize: '0.75rem', color: copyFeedback === 'text' ? 'var(--accent-primary)' : 'inherit' }}>
                  {copyFeedback === 'text' ? 'Copied' : 'Copy'}
                </span>
              </button>
              <button className="btn-secondary" style={{ flex: 1, padding: '12px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }} onClick={() => { handleAction('reply', selectedMessage); setShowInfo(false); }}>
                <ReplyIcon size={20} /> <span style={{ fontSize: '0.75rem' }}>Reply</span>
              </button>
              <button className="btn-secondary" style={{ flex: 1, padding: '12px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }} onClick={() => { handleAction('share', selectedMessage); setShowInfo(false); }}>
                <ShareIcon size={20} /> <span style={{ fontSize: '0.75rem' }}>Share</span>
              </button>
              <button className="btn-secondary" style={{ flex: 1, padding: '12px', borderRadius: '12px', color: 'var(--accent-danger)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }} onClick={() => handleAction('delete', selectedMessage)}>
                <Trash2Icon size={20} /> <span style={{ fontSize: '0.75rem' }}>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Members Modal */}
      {showMembers && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(8px)'
        }} onClick={() => setShowMembers(false)}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)', width: '90%', maxWidth: '400px',
            borderRadius: '24px', padding: '24px', border: '1px solid var(--border-color)',
            animation: 'fadeIn 0.2s ease-out', maxHeight: '80vh', display: 'flex', flexDirection: 'column'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Group Members</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{safeChat.members?.length || 0} participants</span>
              </div>
              <XIcon size={24} style={{ cursor: 'pointer' }} onClick={() => setShowMembers(false)} />
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '4px' }}>
              {safeChat.members?.map((member, idx) => {
                const isMemberAdmin = member.role === 'admin' || member.id === chat.adminId;
                const isMe = member.id === user?.id;
                
                return (
                  <div 
                    key={member.id} 
                    style={{ 
                      padding: '12px', 
                      backgroundColor: 'var(--bg-tertiary)', 
                      borderRadius: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: isMe ? 'default' : 'pointer'
                    }}
                    onClick={() => {
                      if (isMe) return;

                      const isMemberAdmin = member.role === 'admin' || member.id === chat.adminId;
                      const allowMemberDMs = chat.allow_member_dm !== false && chat.allowMemberDMs !== false;

                      if (isAdmin) {
                        setShowMembers(false);
                        navigate(`/profile/${id}`, { state: { view: 'group_members', selectedMember: member } });
                      } else if (isMemberAdmin || allowMemberDMs) {
                        setShowMembers(false);
                        navigate('/new-chat', { state: { presetId: member.id } });
                      } else {
                        // User is not admin and not allowed to DM
                        showToast(`Admin disabled direct messaging`, 'error');
                      }
                    }}
                  >
                    <div style={{ 
                      width: '40px', height: '40px', borderRadius: '12px', 
                      backgroundColor: 'var(--accent-primary)', color: '#000',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.2rem', fontWeight: 700
                    }}>
                      {member.name?.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {member.name} {isMe && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>(You)</span>}
                        {isMemberAdmin && <CrownIcon size={14} color="var(--accent-secondary)" />}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {member.shadowId || member.name}
                      </div>
                    </div>
                    {!isMe && <ChevronRightIcon size={18} color="var(--text-muted)" />}
                  </div>
                );
              })}
            </div>

            <button 
              className="btn-primary" 
              style={{ marginTop: '24px', width: '100%', borderRadius: '16px' }}
              onClick={() => setShowMembers(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Camera Capture UI */}
      {isCameraActive && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: '#000', zIndex: 3000,
          display: 'flex', flexDirection: 'column'
        }}>
          <div style={{
            position: 'absolute', top: '20px', left: '20px', right: '20px',
            display: 'flex', justifyContent: 'space-between', zIndex: 10
          }}>
            <button className="icon-btn" style={{ backgroundColor: 'rgba(0,0,0,0.5)', color: '#fff' }} onClick={stopCamera}>
              <XIcon size={28} />
            </button>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: '1rem', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>Camera Preview</div>
            <div style={{ width: '44px' }}></div>
          </div>

          <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {previewUrl ? (
              cameraMode === 'photo' ? (
                <img src={previewUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <video src={previewUrl} autoPlay loop controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )
            ) : (
              <video 
                ref={videoRef}
                autoPlay 
                playsInline 
                muted 
                onLoadedMetadata={() => videoRef.current.play()}
                onError={() => {
                  showToast('Camera stream error', 'error');
                  if (typeof stopCamera === 'function') stopCamera();
                }}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )}
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            
            {isRecordingVideo && (
              <div style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'rgba(255,0,0,0.7)', color: '#fff', padding: '6px 16px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '8px', zIndex: 100 }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#fff', animation: 'pulse 1s infinite' }} />
                <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>
                  {Math.floor(videoRecordingTime / 60)}:{(videoRecordingTime % 60).toString().padStart(2, '0')}
                </span>
              </div>
            )}

            {isUploading && (
              <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
                <div className="spinner" style={{ width: '50px', height: '50px' }} />
              </div>
            )}
          </div>

          <div style={{
            padding: '20px 20px 40px 20px',
            background: 'rgba(0,0,0,0.8)',
            display: 'flex', flexDirection: 'column', gap: '20px'
          }}>
            {!previewUrl && !isRecordingVideo && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '30px' }}>
                <button 
                  onClick={() => setCameraMode('photo')}
                  style={{ 
                    color: cameraMode === 'photo' ? 'var(--accent-primary)' : 'rgba(255,255,255,0.5)',
                    background: 'none', border: 'none', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer'
                  }}
                >PHOTO</button>
                <button 
                  onClick={() => setCameraMode('video')}
                  style={{ 
                    color: cameraMode === 'video' ? 'var(--accent-primary)' : 'rgba(255,255,255,0.5)',
                    background: 'none', border: 'none', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer'
                  }}
                >VIDEO</button>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '40px' }}>
              {previewUrl ? (
                <>
                  <button 
                    onClick={retakePhoto}
                    className="icon-btn"
                    style={{ width: '60px', height: '60px', backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff' }}
                  >
                    <XIcon size={24} />
                  </button>
                  <button 
                    onClick={sendCapturedPhoto}
                    disabled={isUploading}
                    style={{
                      width: '80px', height: '80px', borderRadius: '50%',
                      backgroundColor: 'var(--accent-primary)', color: '#000',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: 'none', cursor: 'pointer',
                      boxShadow: '0 0 20px rgba(0, 255, 136, 0.4)'
                    }}
                  >
                    <SendIcon size={32} />
                  </button>
                  <div style={{ width: '60px' }}></div>
                </>
              ) : (
                <>
                  <button 
                    className="icon-btn" 
                    style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff' }}
                    onClick={switchCamera}
                  >
                    <RefreshCwIcon size={24} />
                  </button>
                  <button 
                    onClick={cameraMode === 'photo' ? capturePhoto : (isRecordingVideo ? stopRecordingVideo : startRecordingVideo)}
                    disabled={isUploading}
                    style={{
                      width: '80px', height: '80px', borderRadius: '50%',
                      border: '6px solid #fff', backgroundColor: 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', outline: 'none'
                    }}
                  >
                    {cameraMode === 'photo' ? (
                      <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: '#fff' }}></div>
                    ) : (
                      <div style={{ 
                        width: isRecordingVideo ? '30px' : '60px', 
                        height: isRecordingVideo ? '30px' : '60px', 
                        borderRadius: isRecordingVideo ? '4px' : '50%', 
                        backgroundColor: '#ff4444',
                        transition: 'all 0.2s'
                      }}></div>
                    )}
                  </button>
                  <button 
                    className="icon-btn" 
                    style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff' }}
                    onClick={stopCamera}
                  >
                    <ArrowDownIcon size={24} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Forward Modal */}
      {showForwardModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 3000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(10px)'
        }} onClick={() => setShowForwardModal(false)}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)', width: '90%', maxWidth: '400px',
            borderRadius: '24px', padding: '24px', border: '1px solid var(--border-color)',
            animation: 'slideUp 0.3s ease-out'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Forward to...</h3>
              <XIcon size={24} style={{ cursor: 'pointer' }} onClick={() => setShowForwardModal(false)} />
            </div>

            <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(chats || []).filter(c => !c.isArchived).map(c => {
                const cname = c.type === 'group' ? c.name : (c.contact?.name || 'User');
                return (
                  <div 
                    key={c.id} 
                    onClick={() => {
                      forwardMessage([c.id], messageToForward);
                      setShowForwardModal(false);
                      setMessageToForward(null);
                    }}
                    style={{ 
                      display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', 
                      borderRadius: '16px', backgroundColor: 'var(--bg-tertiary)', cursor: 'pointer'
                    }}
                    className="hoverable"
                  >
                    {c.avatarUrl || c.contact?.avatarUrl ? (
                      <img src={c.avatarUrl || c.contact?.avatarUrl} alt="" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
                    ) : (
                      <DefaultAvatar name={cname} size={40} />
                    )}
                    <span style={{ fontWeight: 600 }}>{cname}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      
      {/* Media Viewer Overlay */}
      {previewMedia && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.98)', zIndex: 5000,
          display: 'flex', flexDirection: 'column',
          animation: 'fadeIn 0.2s ease-out'
        }} onClick={(e) => { e.stopPropagation(); setPreviewMedia(null); }}>
          
          {/* Header */}
          <div style={{
            padding: '20px', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 100%)',
            zIndex: 10,
            position: 'absolute',
            top: 0, left: 0, right: 0
          }} onClick={e => e.stopPropagation()}>
            <button 
              className="icon-btn" 
              onClick={() => setPreviewMedia(null)}
              style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none' }}
            >
              <ArrowLeftIcon size={24} />
            </button>
            
            <div style={{ display: 'flex', gap: '16px' }}>
              <button 
                className="icon-btn" 
                onClick={() => downloadFile(previewMedia.media.url, previewMedia.media.name)}
                style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none' }}
              >
                <DownloadIcon size={24} />
              </button>
              <button 
                className="icon-btn" 
                onClick={() => {
                  if (previewMedia.isPending) {
                    removePendingAttachment(previewMedia.index);
                  } else {
                    setDeleteConfirmMsg({ msg: previewMedia, type: 'choose' });
                  }
                  setPreviewMedia(null);
                }}
                style={{ backgroundColor: 'rgba(255,68,68,0.2)', color: 'var(--accent-danger)', border: 'none' }}
              >
                <Trash2Icon size={24} />
              </button>
            </div>
          </div>
          
          {/* Content Area */}
          <div 
            style={{ 
              flex: 1, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              padding: '0px',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={onMediaTouchStart}
            onTouchEnd={onMediaTouchEnd}
          >
            {/* Navigation Arrows (Visible on Desktop/Laptop) */}
            <div style={{
              position: 'absolute', top: 0, left: 0, bottom: 0, right: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0 20px', pointerEvents: 'none', zIndex: 20
            }}>
              <button 
                onClick={handlePrevMedia}
                style={{ 
                  backgroundColor: 'rgba(0,0,0,0.3)', color: '#fff', border: 'none',
                  borderRadius: '50%', width: '48px', height: '48px',
                  display: allMediaMessages.findIndex(m => m.id === previewMedia?.id) > 0 ? 'flex' : 'none',
                  alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  pointerEvents: 'auto', backdropFilter: 'blur(10px)',
                  transition: 'opacity 0.2s'
                }}
                className="hoverable"
              >
                <ChevronLeftIcon size={32} />
              </button>

              <button 
                onClick={handleNextMedia}
                style={{ 
                  backgroundColor: 'rgba(0,0,0,0.3)', color: '#fff', border: 'none',
                  borderRadius: '50%', width: '48px', height: '48px',
                  display: allMediaMessages.findIndex(m => m.id === previewMedia?.id) < allMediaMessages.length - 1 ? 'flex' : 'none',
                  alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  pointerEvents: 'auto', backdropFilter: 'blur(10px)',
                  transition: 'opacity 0.2s'
                }}
                className="hoverable"
              >
                <ChevronRightIcon size={32} />
              </button>
            </div>

            {previewMedia.media.type === 'image' ? (
              <img 
                key={previewMedia.id}
                src={previewMedia.media.url} 
                onError={() => { 
                  showToast('Failed to load image', 'error'); 
                  setPreviewMedia(null); 
                }}
                style={{ 
                  maxWidth: '100%', maxHeight: '100vh', objectFit: 'contain', 
                  boxShadow: '0 0 50px rgba(0,0,0,0.5)',
                  animation: 'scaleIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                }} 
                alt={previewMedia.media.name || 'Preview'} 
              />
            ) : (
              <video 
                key={previewMedia.id}
                src={previewMedia.media.url} 
                controls 
                autoPlay 
                onError={() => { 
                  showToast('Failed to load video', 'error'); 
                  setPreviewMedia(null); 
                }}
                style={{ 
                  maxWidth: '100%', maxHeight: '100vh', outline: 'none',
                  animation: 'scaleIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                }} 
              />
            )}
          </div>


          {/* Footer Info */}
          <div style={{
            padding: '20px',
            background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)',
            position: 'absolute',
            bottom: 0, left: 0, right: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
             <div style={{ color: '#fff', fontWeight: 600, fontSize: '0.95rem' }}>
               {previewMedia.media.name || (previewMedia.media.type === 'image' ? 'Photo' : 'Video')}
             </div>
             <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem' }}>
               {new Date(previewMedia.timestamp).toLocaleString()}
             </div>
          </div>
        </div>
      )}

      {/* Chat Theme Modal */}
      {showThemeModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 4000,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center'
        }} onClick={() => setShowThemeModal(false)}>
          <div style={{
            backgroundColor: 'var(--bg-primary)', width: '100%', maxWidth: '500px',
            borderRadius: '24px 24px 0 0', padding: '24px', border: '1px solid var(--border-color)',
            animation: 'slideUp 0.3s ease-out', maxHeight: '90vh', overflowY: 'auto'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <PaletteIcon size={24} color="var(--accent-primary)" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Chat Theme</h3>
              </div>
              <XIcon size={24} style={{ cursor: 'pointer' }} onClick={() => setShowThemeModal(false)} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Preview Section */}
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text-muted)' }}>PREVIEW</label>
                <div style={{ 
                  height: '200px', borderRadius: '16px', overflow: 'hidden', position: 'relative',
                  backgroundImage: safeChat.theme?.backgroundImage ? `url(${safeChat.theme.backgroundImage})` : 'none',
                  backgroundColor: safeChat.theme?.backgroundColor || 'var(--bg-secondary)',
                  backgroundSize: 'cover', backgroundPosition: 'center',
                  display: 'flex', flexDirection: 'column', padding: '16px', gap: '8px',
                  border: '1px solid var(--border-color)',
                  boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)'
                }}>
                  {/* Mock Messages */}
                  <div style={{ 
                    alignSelf: 'flex-start', padding: '8px 12px', borderRadius: '12px 12px 12px 4px',
                    backgroundColor: safeChat.theme?.receiverColor || 'rgba(44, 44, 46, 0.85)',
                    backdropFilter: 'blur(10px)', color: '#fff', fontSize: '0.8rem', maxWidth: '80%',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}>
                    Hey! How does the new theme look?
                  </div>
                  <div style={{ 
                    alignSelf: 'flex-end', padding: '8px 12px', borderRadius: '12px 12px 4px 12px',
                    backgroundColor: safeChat.theme?.senderColor || 'var(--accent-primary)',
                    color: safeChat.theme?.senderColor ? '#fff' : '#000', fontSize: '0.8rem', maxWidth: '80%',
                    boxShadow: safeChat.theme?.senderColor ? `0 4px 12px ${safeChat.theme.senderColor}44` : 'none'
                  }}>
                    Looks amazing! Very premium. ✨
                  </div>
                  <div style={{ 
                    alignSelf: 'center', padding: '4px 12px', borderRadius: '20px',
                    backgroundColor: 'rgba(44, 44, 46, 0.85)', backdropFilter: 'blur(10px)',
                    color: '#ff4d4d', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '6px',
                    border: '1px solid rgba(255,77,77,0.2)'
                  }}>
                    <PhoneMissedIcon size={12} /> Missed call
                  </div>
                </div>
              </div>

              {/* Bubble Colors */}
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text-muted)' }}>BUBBLE COLORS</label>
                <div style={{ display: 'flex', gap: '16px', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.9rem' }}>Sender Color</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {['#00ff88', '#007AFF', '#FF2D55', '#AF52DE', '#FF9500'].map(col => (
                        <div 
                          key={col}
                          onClick={() => updateChatTheme(id, { ...safeChat.theme, senderColor: col })}
                          style={{ 
                            width: '24px', height: '24px', borderRadius: '50%', backgroundColor: col, cursor: 'pointer',
                            border: safeChat.theme?.senderColor === col ? '2px solid #fff' : 'none',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
                          }} 
                        />
                      ))}
                      <input 
                        type="color" 
                        value={safeChat.theme?.senderColor || '#00ff88'} 
                        onChange={(e) => updateChatTheme(id, { ...safeChat.theme, senderColor: e.target.value })}
                        style={{ width: '24px', height: '24px', padding: 0, border: 'none', backgroundColor: 'transparent', cursor: 'pointer' }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.9rem' }}>Receiver Color</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {['rgba(255,255,255,0.05)', '#2C2C2E', '#3A3A3C', '#48484A'].map(col => (
                        <div 
                          key={col}
                          onClick={() => updateChatTheme(id, { ...safeChat.theme, receiverColor: col })}
                          style={{ 
                            width: '24px', height: '24px', borderRadius: '50%', backgroundColor: col, cursor: 'pointer',
                            border: safeChat.theme?.receiverColor === col ? '2px solid #fff' : 'none',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
                          }} 
                        />
                      ))}
                      <input 
                        type="color" 
                        value={safeChat.theme?.receiverColor || '#2C2C2E'} 
                        onChange={(e) => updateChatTheme(id, { ...safeChat.theme, receiverColor: e.target.value })}
                        style={{ width: '24px', height: '24px', padding: 0, border: 'none', backgroundColor: 'transparent', cursor: 'pointer' }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Wallpaper Settings */}
              <div>
                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text-muted)' }}>WALLPAPER</label>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
                  {/* Predefined Wallpapers */}
                  {[
                    { name: 'None', val: '', color: 'var(--bg-primary)' },
                    { name: 'Dark Flow', val: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=1920&q=80', color: '#1a1a1a' },
                    { name: 'Abstract', val: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1920&q=80', color: '#2c3e50' },
                    { name: 'Nature', val: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1920&q=80', color: '#27ae60' },
                    { name: 'Neon City', val: 'https://images.unsplash.com/photo-1519608487968-3e4213fdf14a?auto=format&fit=crop&w=1920&q=80', color: '#1a0b2e' },
                    { name: 'Liquid Gold', val: 'https://images.unsplash.com/photo-1550684376-ef3b2f11595a?auto=format&fit=crop&w=1920&q=80', color: '#7a5214' },
                    { name: 'Cyberpunk', val: 'https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=1920&q=80', color: '#2b0b3a' },
                    { name: 'Deep Ocean', val: 'https://images.unsplash.com/photo-1682687220199-d0124f48f95b?auto=format&fit=crop&w=1920&q=80', color: '#031424' },
                    { name: 'Sunset Vibe', val: 'https://images.unsplash.com/photo-1495344517868-8ebaf0a2044a?auto=format&fit=crop&w=1920&q=80', color: '#4a1525' },
                    { name: 'Minimal Geo', val: 'https://images.unsplash.com/photo-1557672172-298e090bd0f1?auto=format&fit=crop&w=1920&q=80', color: '#2d3436' },
                    { name: 'Glass', val: 'https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?auto=format&fit=crop&w=1920&q=80', color: '#1f2a3a' },
                    { name: 'Peaks', val: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1920&q=80', color: '#2c2514' },
                    { name: 'Emerald', val: 'https://images.unsplash.com/photo-1607412702206-8dce49377a06?auto=format&fit=crop&w=1920&q=80', color: '#0b2415' },
                    { name: 'Vivid', val: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1920&q=80', color: '#1a1014' },
                    { name: 'White', val: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=1920&q=80', color: '#e0e0e0' },
                    { name: 'Splash', val: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=1920&q=80', color: '#1a1a2e' },
                    { name: 'Aurora', val: 'https://images.unsplash.com/photo-1531306728370-e2ebd9d7bb99?auto=format&fit=crop&w=1920&q=80', color: '#0a0a0a' },
                    { name: 'Wood', val: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?auto=format&fit=crop&w=1920&q=80', color: '#2e1c14' },
                    { name: 'Galaxy', val: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1920&q=80', color: '#0a0a2a' },
                    { name: 'Polygon', val: 'https://images.unsplash.com/photo-1604871000636-074fa5117945?auto=format&fit=crop&w=1920&q=80', color: '#1a1c29' },
                    { name: 'Arch', val: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1920&q=80', color: '#1c1c1c' },
                    { name: 'Alpine', val: 'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=1920&q=80', color: '#1f132e' },
                    { name: 'Pastel', val: 'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=1920&q=80', color: '#1b0922' },
                    { name: 'Forest', val: 'https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&w=1920&q=80', color: '#0f1a14' }
                  ].map(wp => (
                    <div 
                      key={wp.name}
                      onClick={() => updateChatTheme(id, { ...safeChat.theme, backgroundImage: wp.val, backgroundColor: wp.color })}
                      style={{ 
                        height: '80px', borderRadius: '12px', cursor: 'pointer', position: 'relative', overflow: 'hidden',
                        border: safeChat.theme?.backgroundImage === wp.val ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                        backgroundImage: wp.val ? `url(${wp.val.replace('w=1920', 'w=200')})` : 'none',
                        backgroundColor: wp.color,
                        backgroundSize: 'cover', backgroundPosition: 'center'
                      }}
                    >
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: '0.6rem', textAlign: 'center', padding: '2px' }}>{wp.name}</div>
                    </div>
                  ))}
                </div>

                <input 
                  type="file" 
                  ref={wallpaperInputRef} 
                  hidden 
                  accept="image/*" 
                  onChange={async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    showToast('Uploading wallpaper...', 'info');
                    try {
                      const fileName = `${user.id}/${Date.now()}_${file.name}`;
                      const { data, error } = await supabase.storage
                        .from('attachments')
                        .upload(fileName, file);
                      if (error) throw error;
                      const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(data.path);
                      updateChatTheme(id, { ...safeChat.theme, backgroundImage: publicUrl });
                      showToast('Wallpaper updated', 'success');
                    } catch (err) {
                      console.error('Wallpaper upload error:', err);
                      showToast('Failed to upload wallpaper', 'error');
                    }
                  }} 
                />

                <button 
                  onClick={() => wallpaperInputRef.current.click()}
                  style={{ 
                    width: '100%', padding: '12px', borderRadius: '12px', 
                    backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)', display: 'flex', 
                    alignItems: 'center', justifyContent: 'center', gap: '8px',
                    fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  <ImageIcon size={18} /> Upload from Gallery
                </button>
              </div>

              <button 
                onClick={() => updateChatTheme(id, {})}
                style={{ color: 'var(--accent-danger)', fontSize: '0.8rem', background: 'none', border: 'none', cursor: 'pointer', marginTop: '8px' }}
              >
                Reset to Default
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .menu-item {
          padding: 12px 20px;
          cursor: pointer;
          font-size: 0.95rem;
          display: flex;
          align-items: center;
          gap: 12px;
          transition: background-color 0.2s;
        }
        .menu-item:hover {
          background-color: var(--bg-tertiary);
        }
        .attach-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }
        .attach-icon {
          width: 64px;
          height: 64px;
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          margin-bottom: 4px;
        }
        .attach-item:hover .attach-icon {
          transform: translateY(-5px);
          filter: brightness(1.1);
        }
        .attach-item:active .attach-icon {
          transform: scale(0.9);
        }
        .attach-item span {
          font-size: 0.8rem;
          color: var(--text-primary);
          font-weight: 600;
        }
        .pulse {
          animation: pulse 1.5s infinite;
        }
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.7; }
          100% { transform: scale(1); opacity: 1; }
        }
        .pulse-red {
          animation: pulseRed 1.5s infinite;
        }
        @keyframes pulseRed {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 68, 68, 0.4); }
          70% { transform: scale(1.1); box-shadow: 0 0 0 10px rgba(255, 68, 68, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 68, 68, 0); }
        }
        .animate-slide-up {
          animation: slideUp 0.3s ease-out;
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        mark {
          background-color: var(--accent-primary) !important;
          color: #000 !important;
          border-radius: 2px;
          padding: 0 2px;
        }
      `}</style>
    </div>
  );
  } catch (error) {
    console.error('[ChatDetail] CRITICAL RENDER ERROR:', error);
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', padding: '20px', textAlign: 'center' }}>
        <ShieldAlertIcon size={60} color="var(--accent-primary)" style={{ marginBottom: '20px' }} />
        <h2 style={{ marginBottom: '10px' }}>Something went wrong</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '20px', maxWidth: '400px' }}>
          {error.message}
        </p>
        <button 
          onClick={() => navigate('/chats')}
          style={{ padding: '12px 24px', backgroundColor: 'var(--accent-primary)', color: '#000', border: 'none', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' }}
        >
          Back to Chats
        </button>
        <pre style={{ marginTop: '30px', padding: '15px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'left', overflow: 'auto', maxWidth: '90%' }}>
          {error.stack}
        </pre>
      </div>
    );
  }
}
