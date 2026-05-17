import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search as SearchIcon, 
  Plus as PlusIcon, 
  User as UserIcon, 
  Users as UsersIcon, 
  X as XIcon, 
  MessageSquare as MessageSquareIcon, 
  Globe as GlobeIcon, 
  UserPlus as UserPlusIcon, 
  QrCode as QrCodeIcon, 
  Fingerprint as FingerprintIcon, 
  Lock as LockIcon, 
  Pin as PinIcon, 
  Edit2 as Edit2Icon, 
  Bell as BellIcon, 
  Ban as BanIcon, 
  Trash2 as Trash2Icon, 
  Eraser as EraserIcon, 
  Info as InfoIcon, 
  ArrowLeft as ArrowLeftIcon, 
  Clock as ClockIcon, 
  Check as CheckIcon, 
  Timer as TimerIcon, 
  Paperclip as PaperclipIcon, 
  ChevronRight as ChevronRightIcon, 
  CheckCheck as CheckCheckIcon, 
  Copy as CopyIcon, 
  Settings as SettingsIcon, 
  LogOut as LogOutIcon, 
  Inbox as InboxIcon,
  BellOff as BellOffIcon 
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { useAppContext } from '../context/AppContext';

const DefaultAvatar = ({ name, size = 48 }) => {
  const colors = [
    '#FF5733', '#4ECCA3', '#3357FF', '#F333FF', '#FF33A8', 
    '#33FFF5', '#FFD369', '#FF8C33', '#8C33FF', '#33FF8C'
  ];
  const charCode = (name || '?').charCodeAt(0);
  const color = colors[charCode % colors.length];
  const initial = (name || '?').charAt(0).toUpperCase();

  return (
    <div style={{
      width: `${size}px`, height: `${size}px`, borderRadius: '50%',
      backgroundColor: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 'bold', fontSize: `${size / 2.5}px`, flexShrink: 0,
      textShadow: '0 1px 2px rgba(0,0,0,0.2)'
    }}>{initial}</div>
  );
};

const SkeletonChatRow = () => (
  <div className="chat-list-item" style={{ margin: '8px 12px', border: 'none', cursor: 'default', background: 'rgba(255,255,255,0.02)' }}>
    <div className="avatar skeleton" style={{ width: 48, height: 48, borderRadius: '50%' }} />
    <div className="chat-info" style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div className="skeleton" style={{ width: '120px', height: '16px', borderRadius: '4px' }} />
        <div className="skeleton" style={{ width: '40px', height: '12px', borderRadius: '4px' }} />
      </div>
      <div className="skeleton" style={{ width: '80%', height: '12px', borderRadius: '4px' }} />
    </div>
  </div>
);



export default function Chats() {
  const { 
    chats, user, requests, acceptRequest, rejectRequest,
    togglePin, blockContact, unblockContact, deleteContact, leaveGroup, clearMessages, deleteChat, updateChatSettings, showToast,
    setSettings,
    isLoading,
    inviteFriend,
    archiveChat,
    typingUsers
  } = useAppContext();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [showStartModal, setShowStartModal] = useState(false);
  const [view, setView] = useState('chats'); // 'chats' | 'requests'
  const [filter, setFilter] = useState('all'); // 'all' | 'direct' | 'groups'
  const [confirmAction, setConfirmAction] = useState(null);
  const [selectedQuickChat, setSelectedQuickChat] = useState(null);
  const [longPressTimer, setLongPressTimer] = useState(null);

  const handleLongPressStart = (chat) => {
    const timer = setTimeout(() => {
      setSelectedQuickChat(chat);
      if (window.navigator.vibrate) window.navigator.vibrate(50);
    }, 600);
    setLongPressTimer(timer);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer) clearTimeout(longPressTimer);
  };

  const handleContextMenu = (e, chat) => {
    e.preventDefault();
    setSelectedQuickChat(chat);
  };



  const filteredChats = (chats || [])
    .filter(chat => {
      if (!chat) return false;
      if (chat.status === 'deleted') return false;
      
      const hasMessages = chat.messages && chat.messages.length > 0;
      
      // If filtering by Direct, show direct chats OR any chat with messages that isn't a group
      if (filter === 'direct') {
        if (chat.type === 'group') return false;
      }
      
      // If filtering by Groups, only show groups
      if (filter === 'groups') {
        if (chat.type !== 'group') return false;
      }

      // Special safety: If it has messages, it's definitely an active chat we should consider
      // (Unless it's explicitly a group and we're in the direct tab)

      const isGroup = chat.type === 'group';
      const isAdminOfMyGroup = !isGroup && (chats || []).some(c => 
        c && c.type === 'group' && 
        (c.adminId === chat.id || c.adminId === chat.contact?.shadowId || c.adminId === chat.contact?.id) && 
        (c.members || []).some(m => m && (m.id === user?.id || m.shadowId === user?.shadowId))
      );

      const name = isGroup 
        ? (chat.name || 'Unnamed Group') 
        : (chat.contact?.nickname || chat.contact?.name || (isAdminOfMyGroup ? 'Group Administrator' : 'Unknown User'));
      
      const hasMatchingMessage = chat.messages?.some(m => 
        m && (m.text?.toLowerCase().includes(search.toLowerCase()) ||
        m.media?.name?.toLowerCase().includes(search.toLowerCase()))
      );

      // Filter archived chats
      const isChatArchived = !!(chat.isArchived || chat.chat_data?.isArchived);
      if (filter === 'archived') {
        if (!isChatArchived) return false;
      } else {
        if (isChatArchived) return false;
      }

      return name.toLowerCase().includes(search.toLowerCase()) || hasMatchingMessage;
    })
    .sort((a, b) => {
      // Pin priority
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      // Then time priority
      return (b.lastActivity || 0) - (a.lastActivity || 0);
    });

  const formatTime = (ts) => {
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (isLoading || !user) {
    return (
      <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary)' }}>
        <div className="spinner" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} className="animate-fade-in">
      <div className="screen-header" style={{ justifyContent: 'center', position: 'relative', height: '70px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ position: 'absolute', left: '16px', display: 'flex', alignItems: 'center' }}>
          <button 
            className="icon-btn" 
            onClick={() => navigate('/settings')}
            style={{ 
              padding: 0, 
              width: '40px', 
              height: '40px', 
              borderRadius: '50%', 
              overflow: 'hidden',
              border: '2px solid rgba(124, 77, 255, 0.5)',
              boxShadow: '0 0 15px rgba(124, 77, 255, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s ease'
            }}
          >
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="Me" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <DefaultAvatar name={user?.name} size={40} />
            )}
          </button>
        </div>
        <h1 style={{
          fontSize: '1.4rem',
          fontWeight: '800',
          letterSpacing: '-0.5px',
          margin: 0,
          color: 'var(--text-primary)'
        }}>
          ShadowTalk
        </h1>
        <div style={{ position: 'absolute', right: '16px', display: 'flex', gap: '8px' }}>
          {view === 'chats' ? (
            <>
              <button className="icon-btn glass-morphism-light" onClick={() => setFilter(filter === 'archived' ? 'all' : 'archived')} style={{ position: 'relative', border: 'none', color: filter === 'archived' ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                <InboxIcon size={22} />
                {filter !== 'archived' && (chats || []).some(c => c.isArchived && c.unreadCount > 0) && (
                  <div style={{ position: 'absolute', top: '0', right: '0', width: '10px', height: '10px', backgroundColor: 'var(--accent-primary)', borderRadius: '50%' }}></div>
                )}
              </button>
              <button className="icon-btn glass-morphism-light" onClick={() => setView('requests')} style={{ position: 'relative', border: 'none' }}>
                <BellIcon size={22} color="var(--text-primary)" />
                {requests.length > 0 && <div style={{ position: 'absolute', top: '0', right: '0', width: '10px', height: '10px', backgroundColor: 'var(--accent-primary)', borderRadius: '50%', boxShadow: '0 0 10px var(--accent-primary)' }}></div>}
              </button>
              <button className="icon-btn glass-morphism-light" onClick={() => navigate('/search')} style={{ border: 'none' }}>
                <SearchIcon size={22} color="var(--text-primary)" />
              </button>
            </>
          ) : (
            <button className="icon-btn glass-morphism-light" onClick={() => setView('chats')} style={{ border: 'none' }}>
              <XIcon size={22} color="var(--text-primary)" />
            </button>
          )}
        </div>
      </div>

      {view === 'requests' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '16px' }}>Message Requests</h2>
          {requests.length === 0 ? (
            <div className="empty-state">
              <p>No new requests</p>
            </div>
          ) : (
            requests.map(req => (
              <div key={req.id} style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--bg-tertiary)', padding: '16px', borderRadius: '16px', marginBottom: '12px' }}>
                <div className="avatar" style={{ width: 40, height: 40, overflow: 'hidden' }}>
                  <DefaultAvatar name={req.senderName} size={40} />
                </div>
                <div style={{ flex: 1, margin: '0 12px', overflow: 'hidden' }}>
                  <div style={{ fontWeight: 600, fontFamily: 'monospace', color: 'var(--accent-primary)', fontSize: '0.85rem' }}>
                    {req.senderShadowId || req.senderId}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {req.senderName} wants to connect
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    className="btn-secondary" 
                    style={{ width: 'auto', padding: '8px 12px', borderRadius: '20px', fontSize: '0.85rem', color: 'var(--accent-danger)', border: '1px solid var(--border-color)' }}
                    onClick={() => setConfirmAction({ type: 'reject', request: req })}
                  >
                    Reject
                  </button>
                  <button 
                    className="btn-primary" 
                    style={{ width: 'auto', padding: '8px 12px', borderRadius: '20px', fontSize: '0.85rem' }}
                    onClick={() => setConfirmAction({ type: 'accept', request: req })}
                  >
                    Accept
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmAction && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 400,
          padding: '20px',
          animation: 'fadeIn 0.2s ease-out',
          backdropFilter: 'blur(5px)'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '16px',
            padding: '24px',
            width: '100%',
            maxWidth: '320px',
            textAlign: 'center',
            border: '1px solid var(--border-color)',
            animation: 'slideUp 0.3s ease-out'
          }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '12px' }}>
              {confirmAction.type === 'accept' && 'Accept Request?'}
              {confirmAction.type === 'reject' && 'Reject Request?'}
              {confirmAction.type === 'clear' && 'Clear All Messages?'}
              {confirmAction.type === 'delete' && 'Delete Conversation?'}
              {confirmAction.type === 'block' && 'Block Contact?'}
              {confirmAction.type === 'leave_group' && 'Leave Group?'}
              {confirmAction.type === 'delete_contact' && 'Delete Contact?'}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px', lineHeight: '1.4' }}>
              {confirmAction.type === 'accept' && `Add ${confirmAction.request?.senderName} to your contacts?`}
              {confirmAction.type === 'reject' && `Decline the request from ${confirmAction.request?.senderName}?`}
              {confirmAction.type === 'clear' && 'This will empty all messages in this chat. This cannot be undone.'}
              {confirmAction.type === 'delete' && 'This will remove the chat and all messages. This cannot be undone.'}
              {confirmAction.type === 'block' && 'Blocked contacts cannot message you or see your online status.'}
              {confirmAction.type === 'leave_group' && 'Are you sure you want to leave this group?'}
              {confirmAction.type === 'delete_contact' && 'This will remove the contact but keep the chat history.'}
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                className="btn-secondary" 
                onClick={() => setConfirmAction(null)}
                style={{ flex: 1, padding: '12px' }}
              >
                Cancel
              </button>
              <button 
                className="btn-primary" 
                onClick={async () => {
                  if (confirmAction.type === 'accept') {
                    await acceptRequest(confirmAction.request);
                  } else if (confirmAction.type === 'reject') {
                    await rejectRequest(confirmAction.request);
                  } else if (confirmAction.type === 'clear') {
                    await clearMessages(confirmAction.id);
                    setSelectedQuickChat(null);
                  } else if (confirmAction.type === 'delete') {
                    await deleteChat(confirmAction.id);
                    setSelectedQuickChat(null);
                  } else if (confirmAction.type === 'block') {
                    await blockContact(confirmAction.id);
                    setSelectedQuickChat(null);
                  } else if (confirmAction.type === 'leave_group') {
                    await leaveGroup(confirmAction.id);
                    setSelectedQuickChat(null);
                  } else if (confirmAction.type === 'delete_contact') {
                    await deleteContact(confirmAction.id);
                    setSelectedQuickChat(null);
                  }
                  setConfirmAction(null);
                }}
                style={{ 
                  flex: 1, 
                  padding: '12px', 
                  backgroundColor: (confirmAction.type === 'reject' || confirmAction.type === 'clear' || confirmAction.type === 'delete' || confirmAction.type === 'block' || confirmAction.type === 'leave_group' || confirmAction.type === 'delete_contact') ? '#ff4444' : 'var(--accent-primary)',
                  color: (confirmAction.type === 'reject' || confirmAction.type === 'clear' || confirmAction.type === 'delete' || confirmAction.type === 'block' || confirmAction.type === 'leave_group' || confirmAction.type === 'delete_contact') ? '#fff' : '#000',
                  border: 'none'
                }}
              >
                {(confirmAction.type === 'clear' || confirmAction.type === 'delete' || confirmAction.type === 'leave_group' || confirmAction.type === 'delete_contact') ? 'Confirm' : confirmAction.type === 'accept' ? 'Accept' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {view === 'chats' && (
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 20px', gap: '8px', marginBottom: '16px' }}>
          {[
            { id: 'all', label: 'All', icon: <MessageSquareIcon size={16} /> },
            { id: 'direct', label: 'Direct', icon: <UserIcon size={16} /> },
            { id: 'groups', label: 'Groups', icon: <UsersIcon size={16} /> },
            { id: 'archived', label: 'Archived', icon: <InboxIcon size={16} /> }
          ].map(f => (
            <button key={f.id} 
              onClick={() => setFilter(f.id)}
              className={filter === f.id ? '' : 'glass-morphism-light'}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                padding: '10px 0', borderRadius: '16px', fontSize: '0.75rem', fontWeight: 600,
                backgroundColor: filter === f.id ? 'var(--accent-primary)' : 'transparent',
                color: filter === f.id ? '#fff' : 'var(--text-secondary)',
                border: filter === f.id ? 'none' : '1px solid var(--border-color)', 
                cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                boxShadow: filter === f.id ? 'var(--shadow-glow)' : 'none',
                transform: filter === f.id ? 'scale(1.02)' : 'scale(1)'
              }}
            >
              {f.icon}
              <span>{f.label}</span>
            </button>
          ))}
        </div>
      )}

      {view === 'chats' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredChats.length === 0 ? (
            <div style={{ 
              flex: 1, 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center',
              padding: '40px',
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* Background Shady Image */}
              <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: '#0a0a0a',
                backgroundImage: `linear-gradient(rgba(0,0,0,0.8), rgba(0,0,0,0.8)), url('https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=2070')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                opacity: 0.2,
                zIndex: 0
              }} />

              <div style={{ position: 'relative', zIndex: 1, animation: 'fadeIn 1s ease-out' }}>
                {/* App Logo - Matching Splash Screen */}
                <div style={{
                  position: 'relative',
                  width: '100px',
                  height: '100px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 30px auto',
                }}>
                  <div style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(0,255,136,0.15) 0%, rgba(0,0,0,0) 70%)',
                  }} />
                  <MessageSquareIcon size={80} color="var(--accent-primary)" strokeWidth={1.5} style={{ filter: 'drop-shadow(0 0 10px rgba(0,255,136,0.5))' }} />
                  <LockIcon size={35} color="var(--bg-primary)" fill="var(--accent-primary)" style={{ position: 'absolute', marginTop: '-8px' }} />
                </div>

                <div style={{ 
                  fontSize: '2.5rem', 
                  fontWeight: 900, 
                  color: 'var(--text-primary)', 
                  marginBottom: '10px',
                  letterSpacing: '4px',
                  textTransform: 'uppercase'
                }}>
                  ShadowTalk
                </div>

                <div style={{ 
                  fontSize: '1.2rem', 
                  fontWeight: 500, 
                  color: 'var(--accent-primary)', 
                  marginBottom: '32px',
                  letterSpacing: '1px',
                  opacity: 0.8
                }}>
                  The shadows are waiting...
                </div>
                
                <button 
                  className="hoverable" 
                  onClick={() => setShowStartModal(true)}
                  style={{
                    fontSize: '1rem',
                    color: '#000',
                    backgroundColor: 'var(--accent-primary)',
                    padding: '14px 32px',
                    borderRadius: '30px',
                    border: 'none',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 4px 15px rgba(0, 255, 136, 0.3)'
                  }}
                >
                  Break the Silence
                </button>

              </div>
            </div>
          ) : isLoading ? (
            <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
              {[1, 2, 3, 4, 5, 6, 7].map(i => <SkeletonChatRow key={i} />)}
            </div>
          ) : (
          filteredChats.map(chat => {
            const isGroup = chat.type === 'group';
            const isBlocked = !isGroup && (chat.isBlocked || chat.chat_data?.isBlocked || chat.is_blocked);
            const isBlockedByOther = !isGroup && (chat.isBlockedByOther || chat.chat_data?.isBlockedByOther || chat.is_blocked_by_other);
            const isNoteToSelf = !isGroup && (chat.isSelf || chat.id.toLowerCase() === (user?.shortId || user?.id || '').toLowerCase());
            let name = isNoteToSelf ? 'Note to Self' : (isGroup ? chat.name : (chat.contact?.nickname || chat.contact?.name || 'Unknown User'));
            const lastMsg = (chat.messages || [])[(chat.messages?.length || 0) - 1];
            const isPendingReceived = chat.status === 'pending_received';
            const isPendingSent = chat.status === 'pending_sent';
            const isMuted = chat.notificationType?.startsWith('Mute') || (chat.muteUntil && chat.muteUntil > Date.now());
            
            const isAdminOfMyGroup = !isGroup && !isNoteToSelf && (chats || []).some(c => 
              c && c.type === 'group' && c.status !== 'removed' &&
              (c.adminId === chat.id || (chat.contact && (c.adminId === chat.contact.shadowId || c.adminId === chat.contact.id))) && 
              (c.members || []).some(m => m && (String(m.id).toLowerCase() === String(user?.id).toLowerCase() || String(m.shadowId).toLowerCase() === String(user?.shadowId).toLowerCase()))
            );
            
            return (
              <div 
                key={chat.id} 
                className={`chat-list-item ${chat.unreadCount > 0 ? 'unread-highlight' : ''}`} 
                onClick={() => navigate(`/chat/${chat.id}`)}
                onContextMenu={(e) => handleContextMenu(e, chat)}
                onTouchStart={() => handleLongPressStart(chat)}
                onTouchEnd={handleLongPressEnd}
                onMouseDown={() => handleLongPressStart(chat)}
                onMouseUp={handleLongPressEnd}
                onMouseLeave={handleLongPressEnd}
                style={{
                  borderLeft: chat.pinned ? '4px solid var(--accent-secondary)' : isPendingReceived ? '4px solid var(--accent-primary)' : isPendingSent ? '4px solid #aaa' : undefined,
                  position: 'relative',
                  cursor: 'pointer',
                  margin: '8px 12px',
                }}
              >
                {chat.pinned && <PinIcon size={12} style={{ position: 'absolute', top: '8px', right: '8px', color: 'var(--accent-secondary)', opacity: 0.8 }} />}
                <div className={`avatar ${isGroup ? 'group' : ''}`} style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isGroup && (chat.avatarUrl || chat.avatar_url) ? (
                    <img src={chat.avatarUrl || chat.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                  ) : isGroup ? (
                    <DefaultAvatar name={name} />
                  ) : chat.contact?.avatarUrl ? (
                    <img src={chat.contact.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                  ) : (
                    <DefaultAvatar name={name} />
                  )}
                  {!isGroup && chat.contact?.isOnline && !isPendingReceived && !chat.isBlocked && !chat.isBlockedByOther && <div className="avatar-online" />}
                  {isPendingReceived && <div style={{ position: 'absolute', bottom: -2, right: -2, backgroundColor: 'var(--accent-primary)', borderRadius: '50%', padding: '2px', color: '#000' }}><UserPlusIcon size={12} /></div>}
                </div>
                
                <div className="chat-info">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span className="chat-name" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)', fontWeight: 700 }}>
                      {name}
                      {isMuted && <BellOffIcon size={14} style={{ color: 'var(--text-muted)', opacity: 0.6 }} />}
                      {isGroup ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <UsersIcon size={14} style={{ opacity: 0.8 }} />
                          <span style={{ 
                            fontSize: '0.6rem', 
                            backgroundColor: 'rgba(0, 255, 136, 0.15)', 
                            color: 'var(--accent-primary)',
                            padding: '2px 6px',
                            borderRadius: '6px',
                            fontWeight: 800,
                            letterSpacing: '0.5px'
                          }}>GROUP</span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <LockIcon size={12} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                          {isAdminOfMyGroup && (
                            <span style={{ 
                              fontSize: '0.6rem', 
                              backgroundColor: 'rgba(168, 85, 247, 0.15)', 
                              color: '#a855f7',
                              padding: '2px 6px',
                              borderRadius: '6px',
                              fontWeight: 800,
                              letterSpacing: '0.5px'
                            }}>ADMIN</span>
                          )}
                        </div>
                      )}
                      {(isPendingReceived || isPendingSent) && (
                        <span style={{ 
                          fontSize: '0.6rem', 
                          backgroundColor: isPendingReceived ? 'var(--accent-primary)' : 'var(--bg-tertiary)', 
                          color: isPendingReceived ? '#000' : 'var(--text-muted)',
                          padding: '2px 6px',
                          borderRadius: '10px',
                          fontWeight: 700,
                          textTransform: 'uppercase'
                        }}>
                          {isPendingReceived ? (chat.reconnection ? 'No longer friend yet' : 'Request') : (chat.reconnection ? 'No longer friend yet' : 'Pending')}
                        </span>
                      )}
                    </span>
                    <span style={{ 
                      fontSize: '0.75rem', 
                      color: chat.unreadCount > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                      fontWeight: chat.unreadCount > 0 ? 700 : 500,
                      flexShrink: 0
                    }}>{formatTime(chat.lastActivity)}</span>
                  </div>
                  
                  <div className="chat-preview-container" style={{ marginTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="chat-preview" style={{ 
                      fontStyle: (isPendingReceived || isPendingSent) ? 'italic' : 'normal',
                      color: chat.unreadCount > 0 ? '#fff' : 'var(--text-muted)',
                      fontWeight: chat.unreadCount > 0 ? 600 : 400,
                      flex: 1
                    }}>
                      {isBlocked ? (
                        <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.8rem' }}>You have blocked the user</span>
                      ) : isBlockedByOther ? (
                        <span style={{ color: '#ff4444', fontWeight: 600, fontSize: '0.8rem' }}>You have been blocked</span>
                      ) : chat.status === 'removed' ? (
                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          {chat.exitType === 'left' ? 'You left the group' : 'You were removed'}
                        </span>
                      ) : (
                        typingUsers[chat.id] && Object.values(typingUsers[chat.id]).some(v => v) ? (
                          <span style={{ color: 'var(--text-primary)', fontWeight: 600, animation: 'pulse 1.5s infinite' }}>typing...</span>
                        ) : (
                          lastMsg ? (lastMsg.senderId === user?.id ? `You: ${lastMsg.text}` : lastMsg.text) : 'No messages yet'
                        )
                      )}
                    </span>
                    
                    {isBlocked ? (
                      <button 
                        className="btn-primary" 
                        style={{ 
                          fontSize: '0.7rem', 
                          padding: '4px 10px', 
                          height: 'auto', 
                          width: 'auto',
                          borderRadius: '8px',
                          marginLeft: '8px',
                          flexShrink: 0
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          unblockContact(chat.id);
                        }}
                      >
                        Unblock
                      </button>
                    ) : isPendingReceived ? (
                      <div style={{ display: 'flex', gap: '8px', marginLeft: '12px' }} onClick={e => e.stopPropagation()}>
                        <button 
                          className="icon-btn" 
                          style={{ width: '28px', height: '28px', backgroundColor: 'rgba(255, 68, 68, 0.1)', color: '#ff4444' }}
                          onClick={() => setConfirmAction({ type: 'reject', request: { id: `r_${chat.id}`, senderId: chat.id, senderName: name, contact: chat.contact } })}
                        >
                          <XIcon size={16} />
                        </button>
                        <button 
                          className="icon-btn" 
                          style={{ width: '28px', height: '28px', backgroundColor: 'rgba(0, 255, 136, 0.1)', color: 'var(--accent-primary)' }}
                          onClick={() => acceptRequest({ id: `r_${chat.id}`, senderId: chat.id, senderName: name, senderShadowId: chat.contact.shadowId })}
                        >
                          <UserPlusIcon size={16} />
                        </button>
                      </div>
                    ) : chat.unreadCount > 0 && (
                      <div style={{
                        backgroundColor: 'var(--accent-primary)',
                        color: '#fff',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '12px',
                        marginLeft: '8px',
                        boxShadow: '0 0 10px rgba(124, 77, 255, 0.4)'
                      }}>{chat.unreadCount}</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      )}

      {view === 'chats' && (
        <button className="fab" onClick={() => setShowStartModal(true)} style={{ right: '50%', transform: 'translateX(50%)' }}>
          <PlusIcon size={28} />
        </button>
      )}

      {/* Start Conversation Modal */}
      {showStartModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)',
          zIndex: 300,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'fadeIn 0.2s ease-out',
          backdropFilter: 'blur(10px)',
          padding: '20px'
        }} onClick={() => setShowStartModal(false)}>
          <div className="glass-box" style={{
            padding: '32px',
            width: '100%',
            maxWidth: '380px',
            maxHeight: '90vh',
            overflowY: 'auto',
            animation: 'slideUp 0.3s ease-out',
            border: 'none',
            borderRadius: '32px'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>New Chat</h2>
              <button className="icon-btn hoverable" onClick={() => setShowStartModal(false)} style={{ margin: 0 }}>
                <XIcon size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
              {[
                { label: 'New Message', icon: <MessageSquareIcon size={22} />, path: '/new-chat', color: 'var(--accent-primary)' },
                { label: 'Create Group', icon: <UsersIcon size={22} />, path: '/create-group', color: 'var(--accent-secondary)' },
                { label: 'Invite a Friend', icon: <UserPlusIcon size={22} />, path: '/invite-friend', color: '#a855f7' }
              ].map((option, idx) => (
                <div 
                  key={idx}
                  className="settings-item hoverable"
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', 
                    borderRadius: '16px', cursor: 'pointer', border: 'none'
                  }}
                  onClick={() => {
                    if (option.path === '/invite-friend') {
                      inviteFriend();
                      setShowStartModal(false);
                    } else {
                      navigate(option.path);
                    }
                  }}
                >
                  <div style={{ 
                    width: 44, height: 44, borderRadius: '12px', 
                    backgroundColor: `${option.color}20`, display: 'flex', 
                    alignItems: 'center', justifyContent: 'center', color: option.color
                  }}>
                    {option.icon}
                  </div>
                  <span style={{ fontSize: '1.05rem', fontWeight: 600 }}>{option.label}</span>
                </div>
              ))}
            </div>

            <div style={{ textAlign: 'center' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Your Shadow ID</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px', lineHeight: '1.4' }}>
                Scan to connect instantly
              </p>
              
              <div style={{ 
                backgroundColor: '#fff', padding: '16px', borderRadius: '24px', 
                display: 'inline-flex', boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                border: '4px solid var(--accent-primary)'
              }}>
                <QRCodeCanvas 
                  value={user?.shadowId || user?.id}
                  size={180}
                  level="H"
                  includeMargin={false}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Profile Bottom Sheet */}
      {selectedQuickChat && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1000,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          backdropFilter: 'blur(5px)',
          animation: 'fadeIn 0.2s ease-out'
        }} onClick={() => setSelectedQuickChat(null)}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)', width: '100%', maxWidth: '500px',
            borderTopLeftRadius: '32px', borderTopRightRadius: '32px',
            padding: '24px 0', animation: 'slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 -10px 40px rgba(0,0,0,0.5)', border: '1px solid var(--border-color)',
            borderBottom: 'none'
          }} onClick={e => e.stopPropagation()}>
            
            {/* Drag Handle */}
            <div style={{ width: '40px', height: '4px', backgroundColor: 'var(--border-color)', borderRadius: '2px', margin: '0 auto 24px auto' }} />

            {/* Header / Info */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '0 24px 24px 24px', borderBottom: '1px solid var(--border-color)', gap: '16px' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {selectedQuickChat.type === 'group' && selectedQuickChat.avatarUrl ? (
                  <img src={selectedQuickChat.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : selectedQuickChat.type === 'group' ? (
                  <UsersIcon size={32} color="var(--accent-primary)" />
                ) : selectedQuickChat.contact?.avatarUrl ? (
                  <img src={selectedQuickChat.contact.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <UserIcon size={32} color="var(--accent-primary)" />
                )}
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                  {selectedQuickChat.type === 'group' ? selectedQuickChat.name : (selectedQuickChat.contact?.nickname || selectedQuickChat.contact?.name || 'Unknown')}
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                  {selectedQuickChat.type === 'group' ? '' : (selectedQuickChat.contact?.shadowId || selectedQuickChat.id)}
                </span>
              </div>
              <button 
                className="icon-btn" 
                onClick={() => navigate(`/profile/${selectedQuickChat.id}`)}
                style={{ backgroundColor: 'var(--bg-tertiary)', width: '40px', height: '40px' }}
              >
                <InfoIcon size={20} />
              </button>
            </div>

            {/* Action Grid (Symmetric 3-column layout) */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(3, 1fr)', 
              padding: '24px 24px', 
              gap: '24px 16px' 
            }}>
              {/* Row 1: Pin, Archive, Copy ID */}
              <div className="quick-action-item" onClick={() => { togglePin(selectedQuickChat.id); setSelectedQuickChat(null); }}>
                <div className="quick-action-icon" style={{ 
                  backgroundColor: selectedQuickChat.pinned ? 'rgba(0, 255, 136, 0.15)' : 'var(--bg-tertiary)',
                  color: selectedQuickChat.pinned ? 'var(--accent-primary)' : 'var(--text-primary)',
                  boxShadow: selectedQuickChat.pinned ? '0 0 15px rgba(0, 255, 136, 0.2)' : 'none',
                  border: selectedQuickChat.pinned ? '1px solid rgba(0, 255, 136, 0.3)' : '1px solid transparent'
                }}>
                  <PinIcon size={22} />
                </div>
                <span>{selectedQuickChat.pinned ? 'Unpin' : 'Pin'}</span>
              </div>
              
              <div className="quick-action-item" onClick={() => { 
                const isCurrentlyArchived = !!(selectedQuickChat.isArchived || selectedQuickChat.chat_data?.isArchived);
                archiveChat(selectedQuickChat.id, !isCurrentlyArchived); 
                setSelectedQuickChat(null); 
              }}>
                <div className="quick-action-icon" style={{ 
                  backgroundColor: (selectedQuickChat.isArchived || selectedQuickChat.chat_data?.isArchived) ? 'rgba(0, 255, 136, 0.15)' : 'var(--bg-tertiary)',
                  color: (selectedQuickChat.isArchived || selectedQuickChat.chat_data?.isArchived) ? 'var(--accent-primary)' : 'var(--text-primary)',
                  boxShadow: (selectedQuickChat.isArchived || selectedQuickChat.chat_data?.isArchived) ? '0 0 15px rgba(0, 255, 136, 0.2)' : 'none',
                  border: (selectedQuickChat.isArchived || selectedQuickChat.chat_data?.isArchived) ? '1px solid rgba(0, 255, 136, 0.3)' : '1px solid transparent'
                }}>
                  <InboxIcon size={22} />
                </div>
                <span>{(selectedQuickChat.isArchived || selectedQuickChat.chat_data?.isArchived) ? 'Unarchive' : 'Archive'}</span>
              </div>

              {selectedQuickChat.type !== 'group' ? (
                <div className="quick-action-item" onClick={() => { navigator.clipboard.writeText(selectedQuickChat.contact?.shadowId || selectedQuickChat.id); showToast('ID Copied', 'success'); setSelectedQuickChat(null); }}>
                  <div className="quick-action-icon">
                    <CopyIcon size={20} />
                  </div>
                  <span>Copy ID</span>
                </div>
              ) : (
                <div className="quick-action-item" style={{ opacity: 0.3, cursor: 'default' }}>
                  <div className="quick-action-icon">
                    <CopyIcon size={20} />
                  </div>
                  <span>Copy ID</span>
                </div>
              )}

              {/* Row 2: Mute, Search, Info */}
              <div className="quick-action-item" onClick={() => { navigate(`/profile/${selectedQuickChat.id}?action=mute`); setSelectedQuickChat(null); }}>
                <div className="quick-action-icon">
                  <BellIcon size={20} />
                </div>
                <span>Mute</span>
              </div>

              <div className="quick-action-item" onClick={() => { navigate(`/chat/${selectedQuickChat.id}?search=true`); setSelectedQuickChat(null); }}>
                <div className="quick-action-icon">
                  <SearchIcon size={20} />
                </div>
                <span>Search</span>
              </div>

              <div className="quick-action-item" onClick={() => { navigate(`/profile/${selectedQuickChat.id}`); setSelectedQuickChat(null); }}>
                <div className="quick-action-icon">
                  <InfoIcon size={20} />
                </div>
                <span>Info</span>
              </div>
            </div>

            {/* List Actions */}
            <div style={{ padding: '0 12px 12px 12px', maxHeight: '300px', overflowY: 'auto' }}>
              <div 
                className="menu-item" 
                onClick={() => { navigate(`/profile/${selectedQuickChat.id}?view=disappearing`); setSelectedQuickChat(null); }}
                style={{ borderRadius: '12px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                  <TimerIcon size={20} color="#ccc" />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span>Disappearing Messages</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {selectedQuickChat.disappearingConfig?.type === 'Off' || !selectedQuickChat.disappearingConfig ? 'Off' : `${selectedQuickChat.disappearingConfig.type} (${selectedQuickChat.disappearingConfig.timer})`}
                    </span>
                  </div>
                </div>
                <ChevronRightIcon size={18} color="var(--text-muted)" />
              </div>

              <div 
                className="menu-item" 
                onClick={() => { navigate(`/profile/${selectedQuickChat.id}?view=attachments`); setSelectedQuickChat(null); }}
                style={{ borderRadius: '12px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                  <PaperclipIcon size={20} color="#ccc" />
                  <span>Attachments</span>
                </div>
                <ChevronRightIcon size={18} color="var(--text-muted)" />
              </div>

              {selectedQuickChat.type === 'group' && (
                <div 
                  className="menu-item" 
                  onClick={() => { navigate(`/profile/${selectedQuickChat.id}?view=group_members`); setSelectedQuickChat(null); }}
                  style={{ borderRadius: '12px' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                    <UsersIcon size={20} color="#ccc" />
                    <span>Group Members ({selectedQuickChat.members?.length || 0})</span>
                  </div>
                  <ChevronRightIcon size={18} color="var(--text-muted)" />
                </div>
              )}

              <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '12px 20px' }} />

              {/* Clear and Delete actions removed as requested */}

              {selectedQuickChat.type === 'group' ? (
                <>
                  <div 
                    className="menu-item" 
                    onClick={() => { setConfirmAction({ type: 'clear', id: selectedQuickChat.id }); setSelectedQuickChat(null); }}
                    style={{ borderRadius: '12px', color: '#ff4444' }}
                  >
                    <EraserIcon size={20} />
                    <span>Clear all message</span>
                  </div>
                  <div 
                    className="menu-item" 
                    onClick={() => { setConfirmAction({ type: 'leave_group', id: selectedQuickChat.id }); setSelectedQuickChat(null); }}
                    style={{ borderRadius: '12px', color: '#ff4444' }}
                  >
                    <LogOutIcon size={20} />
                    <span>Leave Group</span>
                  </div>
                </>
              ) : (
                <>
                  <div 
                    className="menu-item" 
                    onClick={() => { setConfirmAction({ type: 'delete', id: selectedQuickChat.id }); setSelectedQuickChat(null); }}
                    style={{ borderRadius: '12px', color: '#ff4444' }}
                  >
                    <Trash2Icon size={20} />
                    <span>Delete Conversation</span>
                  </div>
                  <div 
                    className="menu-item" 
                    onClick={() => { setConfirmAction({ type: 'clear', id: selectedQuickChat.id }); setSelectedQuickChat(null); }}
                    style={{ borderRadius: '12px', color: '#ff4444' }}
                  >
                    <EraserIcon size={20} />
                    <span>Clear all message</span>
                  </div>
                </>
              )}

              {selectedQuickChat.type !== 'group' && (
                <>
                  <div 
                    className="menu-item" 
                    onClick={() => { setConfirmAction({ type: 'block', id: selectedQuickChat.id }); setSelectedQuickChat(null); }}
                    style={{ borderRadius: '12px', color: '#ff4444' }}
                  >
                    <BanIcon size={20} />
                    <span>Block Contact</span>
                  </div>

                  <div 
                    className="menu-item" 
                    onClick={() => { setConfirmAction({ type: 'delete_contact', id: selectedQuickChat.id }); setSelectedQuickChat(null); }}
                    style={{ borderRadius: '12px', color: '#ff4444' }}
                  >
                    <UserIcon size={20} />
                    <span>Delete Contact</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}


      <style>{`
        .quick-action-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .quick-action-item:hover .quick-action-icon {
          transform: translateY(-2px);
          background-color: var(--bg-tertiary);
        }
        .quick-action-item:active {
          transform: scale(0.95);
        }
        .quick-action-icon {
          width: 56px;
          height: 56px;
          border-radius: 18px;
          background-color: var(--bg-tertiary);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--accent-primary);
          transition: all 0.3s ease;
          border: 1px solid rgba(255,255,255,0.03);
        }
        .quick-action-item span {
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--text-secondary);
          letter-spacing: -0.2px;
        }
        .menu-item {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px 24px;
          cursor: pointer;
          transition: all 0.2s;
          font-weight: 500;
          margin: 0 8px;
        }
        .menu-item:hover {
          background-color: var(--bg-tertiary);
          border-radius: 16px;
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// Inline fallback for MessageSquareSlash since I didn't import it at the top
const MessageSquareSlash = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    <line x1="1" y1="1" x2="23" y2="23"></line>
  </svg>
);
