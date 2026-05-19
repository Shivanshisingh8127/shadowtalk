import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  ArrowLeft as ArrowLeftIcon, 
  Edit2 as Edit2Icon, 
  Copy as CopyIcon, 
  Search as SearchIcon, 
  Timer as TimerIcon, 
  Pin as PinIcon, 
  Bell as BellIcon, 
  Paperclip as PaperclipIcon, 
  Ban as BanIcon, 
  Trash2 as Trash2Icon, 
  Eraser as EraserIcon, 
  Check as CheckIcon, 
  QrCode as QrCodeIcon, 
  File as FileIcon, 
  Image as ImageIcon, 
  ChevronRight as ChevronRightIcon, 
  ChevronLeft as ChevronLeftIcon,
  Volume2 as Volume2Icon, 
  AtSign as AtSignIcon, 
  VolumeX as VolumeXIcon, 
  Users as UsersIcon, 
  LogOut as LogOutIcon, 
  Clock as ClockIcon, 
  User as UserIcon, 
  Plus as PlusIcon, 
  Crown as CrownIcon, 
  Camera as CameraIcon,
  Phone as PhoneIcon, 
  Video as VideoIcon, 
  X as XIcon, 
  UserMinus as UserMinusIcon,
  Shield as ShieldIcon,
  Download as DownloadIcon,
  Play as PlayIcon,
  Palette as PaletteIcon,
  PhoneMissed as PhoneMissedIcon
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useAppContext } from '../context/AppContext';

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

export default function ContactProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    chats, setChats, user, togglePin, updateChatSettings, updateGroupSettings,
    clearMessages, deleteChat, deleteContact, 
    blockContact, unblockContact, showToast, startCall, addMemberToGroup, removeMemberFromGroup, promoteMemberToAdmin, leaveGroup, deleteGroup,
    isLoading, downloadFile, bulkDeleteMessages, updateChatTheme, showConfirm
  } = useAppContext();
  
  const chat = chats.find(c => c.id.toLowerCase() === id?.toLowerCase());

  const [showEdit, setShowEdit] = useState(false);
  const [nickname, setNickname] = useState('');
  const [copied, setCopied] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [isUploadingPic, setIsUploadingPic] = useState(false);
  const [previewMedia, setPreviewMedia] = useState(null);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [promoteSearchQuery, setPromoteSearchQuery] = useState('');
  const avatarInputRef = useRef(null);
  const wallpaperInputRef = useRef(null);

  // States for toggles & selections
  const [disappearingState, setDisappearingState] = useState('Off');
  const [pinned, setPinned] = useState(false);
  const [notifications, setNotifications] = useState('All Messages');
  const [muteUntil, setMuteUntil] = useState(null);

  // Danger Zone Confirmation
  const [confirmAction, setConfirmAction] = useState(null);

  // Disappearing messages temporary state
  const [tempDisappearType, setTempDisappearType] = useState('Off');
  const [tempDisappearTimer, setTempDisappearTimer] = useState('1 Hour');

  // Notifications temporary state
  const [tempNotificationType, setTempNotificationType] = useState(notifications);
  const [showMuteTimer, setShowMuteTimer] = useState(false);
  const [showMuteModal, setShowMuteModal] = useState(false);
  const [muteTimer, setMuteTimer] = useState(null);
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);

  // Attachments state
  const [attachmentTab, setAttachmentTab] = useState('media');
  const [muteFeedback, setMuteFeedback] = useState(null);
  const [countdown, setCountdown] = useState('');
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [addMemberId, setAddMemberId] = useState('');
  const [selectedMemberInfo, setSelectedMemberInfo] = useState(null);
  const [adminSearchQuery, setAdminSearchQuery] = useState('');

  // Media Gallery Logic
  const allMediaMessages = chat?.messages?.filter(m => m.media && (m.media.type === 'image' || m.media.type === 'video')) || [];

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

  // Sub-views management
  const [activeView, setActiveView] = useState(() => {
    const params = new URLSearchParams(location.search);
    return location.state?.view || params.get('view') || 'main';
  });
  useEffect(() => {
    if (chat) {
      setNickname(chat.contact?.nickname || chat.contact?.name || chat.name || '');
      setPinned(chat.pinned || false);
      setNotifications(chat.notificationType || 'All Messages');
      setMuteUntil(chat.muteUntil || null);

      const config = chat.disappearingConfig || { type: 'Off', timer: '1 Hour' };
      setDisappearingState(config.type === 'Off' ? 'Off' : `${config.type} (${config.timer})`);
      setTempDisappearType(config.type);
      setTempDisappearTimer(config.timer);

      // Handle Quick Actions from Dashboard
      const params = new URLSearchParams(location.search);
      if (params.get('action') === 'mute') {
        setShowMuteModal(true);
      }
    }
  }, [chat]);

  useEffect(() => {
    if (location.state?.selectedMember) {
      setSelectedMemberInfo(location.state.selectedMember);
    }
    const params = new URLSearchParams(location.search);
    const viewParam = location.state?.view || params.get('view') || 'main';
    if (viewParam !== activeView) {
      setActiveView(viewParam);
    }
  }, [location.search, location.state]);

  useEffect(() => {
    if (!muteUntil) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const diff = muteUntil - now;
      if (diff <= 0) {
        setMuteUntil(null);
        setMuteTimer(null);
        setNotifications('All Messages');
        updateChatSettings(id, { notificationType: 'All Messages', muteUntil: null });
        clearInterval(interval);
      } else {
        const hours = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setCountdown(`${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [muteUntil]);

  // Robust Toggle State for Group Settings
  const [isUpdatingDMs, setIsUpdatingDMs] = useState(false);
  const [localAllowDMs, setLocalAllowDMs] = useState((chat?.allow_member_dm !== false && chat?.allowMemberDMs !== false));

  // Sync local state with chat object when it changes (but not while updating)
  useEffect(() => {
    if (!isUpdatingDMs) {
      setLocalAllowDMs((chat?.allow_member_dm !== false && chat?.allowMemberDMs !== false));
    }
  }, [chat?.allow_member_dm, chat?.allowMemberDMs, isUpdatingDMs]);

  const handleToggleDMs = async () => {
    if (isUpdatingDMs) return;
    
    const newVal = !localAllowDMs;
    setLocalAllowDMs(newVal); // Optimistic UI update
    setIsUpdatingDMs(true);
    
    try {
      // Rule 11: Priority to allow_member_dm
      await updateGroupSettings(id, { allow_member_dm: newVal, allowMemberDMs: newVal });
      showToast(`Group messaging for members ${newVal ? 'enabled' : 'disabled'}`, 'info');
    } catch (err) {
      setLocalAllowDMs(!newVal); // Revert on error
      showToast('Failed to update settings', 'error');
    } finally {
      // Keep isUpdatingDMs true for a short moment to let sync catch up
      setTimeout(() => setIsUpdatingDMs(false), 2000);
    }
  };

  // QR Scanning for adding members
  const [isScanningMember, setIsScanningMember] = useState(false);
  useEffect(() => {
    let scanner = null;
    if (activeView === 'add_member' && isScanningMember) {
      scanner = new Html5QrcodeScanner("member-reader", { fps: 10, qrbox: 250 });
      scanner.render(async (decodedText) => {
        scanner.clear();
        setIsScanningMember(false);
        setAddMemberId(decodedText);
        // Automatically try to add if it's a valid ID
        if (decodedText.trim()) {
          await addMemberToGroup(id, decodedText.trim());
          setActiveView('group_members');
          setAddMemberId('');
        }
      }, (err) => {
        // quiet fail
      });
    }
    return () => {
      if (scanner) scanner.clear();
    };
  }, [activeView, isScanningMember, id, addMemberToGroup]);

  const [isResolving, setIsResolving] = useState(true);
  useEffect(() => {
    if (isLoading) {
      setIsResolving(true);
    } else {
      // Small delay to let chats state settle
      const timer = setTimeout(() => setIsResolving(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  if (isLoading || (isResolving && !chat)) {
    return (
      <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary)' }}>
        <div className="spinner" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  if (!chat && !isResolving) {
    return (
      <div className="empty-state">
        <p>Profile not found</p>
        <button className="btn-secondary" onClick={() => navigate(-1)} style={{ marginTop: '20px' }}>Go Back</button>
      </div>
    );
  }

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    
    try {
      if (confirmAction === 'clear') {
        await clearMessages(id);
        showToast('Chat cleared', 'success');
      } else if (confirmAction === 'delete') {
        await deleteChat(id);
        showToast('Conversation deleted', 'success');
        navigate('/chats');
      } else if (confirmAction === 'block') {
        await blockContact(id);
        showToast('Contact blocked', 'success');
        navigate('/chats');
      } else if (confirmAction === 'delete_contact') {
        await deleteContact(id);
        showToast('Contact deleted', 'success');
        navigate('/chats');
      } else if (confirmAction === 'leave_group') {
        await leaveGroup(id);
        navigate('/chats');
      } else if (confirmAction === 'delete_group_admin') {
        await deleteGroup(id);
        navigate('/chats');
      }
    } catch (err) {
      console.error('Action failed:', err);
      showToast(err.message || 'Action failed', 'error');
    } finally {
      setConfirmAction(null);
    }
  };

  const handleGroupPicUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setIsUploadingPic(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${id}_pic_${Date.now()}.${fileExt}`;
      const filePath = `profiles/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('attachments')
        .getPublicUrl(filePath);

      if (isGroup) {
        await updateGroupSettings(id, { avatarUrl: publicUrl });
      } else {
        await updateChatSettings(id, { avatarUrl: publicUrl });
      }
      showToast('Profile picture updated!', 'success');
    } catch (err) {
      console.error('Profile pic error:', err);
      showToast('Failed to update picture', 'error');
    } finally {
      setIsUploadingPic(false);
    }
  };

  const isGroup = chat.type === 'group';
  const displayId = isGroup ? chat.id : (chat.contact?.shadowId || chat.contact?.id);
  const isNoteToSelf = !isGroup && chat.id.toLowerCase() === (user?.shortId || user?.id || '').toLowerCase();
  const displayName = isNoteToSelf ? 'Note to Self' : (isGroup ? chat.name : (chat.contact?.nickname || chat.contact?.name || 'Unknown'));
  const isAdmin = isGroup && chat.adminId === user?.id;

  const handleSaveNickname = async () => {
    if (nickname.trim()) {
      try {
        if (isGroup) {
          await updateGroupSettings(id, { name: nickname });
        } else {
          await updateChatSettings(id, { contact: { ...chat.contact, nickname: nickname } });
        }
        showToast('Name updated successfully!', 'success');
        setShowEdit(false);
      } catch (err) {
        showToast('Failed to update name', 'error');
      }
    } else {
      setShowEdit(false);
    }
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(displayId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const executeDangerAction = async () => {
    if (!confirmAction) return;

    if (confirmAction === 'clear') {
      await clearMessages(id);
    } else if (confirmAction === 'delete' || confirmAction === 'delete_group') {
      await deleteChat(id);
      navigate('/chats');
      return;
    } else if (confirmAction === 'block') {
      await blockContact(id);
      navigate('/chats');
      return;
    } else if (confirmAction === 'delete_contact') {
      await deleteChat(id);
      navigate('/chats');
      return;
    } else if (confirmAction === 'leave_group') {
      await leaveGroup(id);
      navigate('/chats');
      return;
    }
    setConfirmAction(null);
  };

  // ---------------- Sub Views ----------------

  if (activeView === 'disappearing') {
    return (
      <div className="app-container animate-fade-in" style={{ backgroundColor: '#000', color: '#fff', display: 'flex', flexDirection: 'column' }}>
        <div className="screen-header" style={{ borderBottom: 'none', justifyContent: 'center', padding: '16px 20px', position: 'relative' }}>
          <button className="icon-btn" onClick={() => setActiveView('main')} style={{ position: 'absolute', left: '20px', color: '#fff' }}>
            <ArrowLeftIcon size={24} />
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: '1.2rem', fontWeight: 700 }}>Disappearing Messages</span>
            <span style={{ fontSize: '0.75rem', color: '#aaa', textAlign: 'center', maxWidth: '250px', marginTop: '4px', lineHeight: '1.4' }}>
              This setting applies to messages you send in this conversation.
            </span>
          </div>
        </div>
        
        <div style={{ padding: '0 20px 20px 20px', display: 'flex', flexDirection: 'column', gap: '24px', flex: 1, overflowY: 'auto' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: '#aaa', fontSize: '0.85rem', marginBottom: '8px', marginLeft: '4px' }}>Delete Type</span>
            <div className="glass-box" style={{ padding: 0, borderRadius: '16px', overflow: 'hidden', border: 'none' }}>
              {[
                { id: 'Off', label: 'Off', sub: null },
                { id: 'Disappear after read', label: 'Disappear After Read', sub: 'Messages delete after they have been read.' },
                { id: 'Disappear after send', label: 'Disappear After Send', sub: 'Messages delete after they have been sent.' }
              ].map((opt, idx) => {
                const isSelected = tempDisappearType === opt.id;
                return (
                  <div 
                    key={opt.id} 
                    className={`settings-item ${(!isGroup || isAdmin) ? 'hoverable' : ''}`} 
                    onClick={() => (!isGroup || isAdmin) && setTempDisappearType(opt.id)}
                    style={{ 
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between', 
                      padding: '16px',
                      borderBottom: idx === 2 ? 'none' : '1px solid #333'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '1rem', fontWeight: 600, color: '#fff' }}>{opt.label}</span>
                      {opt.sub && <span style={{ fontSize: '0.75rem', color: '#aaa', marginTop: '4px' }}>{opt.sub}</span>}
                    </div>
                    <div style={{
                      width: '24px', height: '24px', borderRadius: '50%',
                      border: isSelected ? '2px solid #fff' : '2px solid #666',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {isSelected && <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)' }} />}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {tempDisappearType !== 'Off' && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ color: '#aaa', fontSize: '0.85rem', marginBottom: '8px', marginLeft: '4px' }}>Timer</span>
              <div className="glass-box" style={{ padding: 0, borderRadius: '16px', overflow: 'hidden', border: 'none' }}>
                {['5 minutes', '1 hour', '12 hours', '1 day', '1 week', '2 weeks'].map((time, idx) => {
                  const isSelected = tempDisappearTimer === time;
                  return (
                    <div 
                      key={time} 
                      className={`settings-item ${(!isGroup || isAdmin) ? 'hoverable' : ''}`} 
                      onClick={() => (!isGroup || isAdmin) && setTempDisappearTimer(time)}
                      style={{ 
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between', 
                        padding: '16px',
                        borderBottom: idx === 5 ? 'none' : '1px solid #333'
                      }}
                    >
                      <span style={{ fontSize: '1rem', fontWeight: 600, color: '#fff' }}>{time}</span>
                      <div style={{
                        width: '24px', height: '24px', borderRadius: '50%',
                        border: isSelected ? '2px solid #fff' : '2px solid #666',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        {isSelected && <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)' }} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <button 
            style={{ 
              width: '200px', padding: '12px', borderRadius: '30px', 
              backgroundColor: 'transparent', 
              border: (!isGroup || isAdmin) ? '2px solid var(--accent-primary)' : '2px solid #555',
              color: (!isGroup || isAdmin) ? 'var(--accent-primary)' : '#555', 
              fontSize: '1rem', fontWeight: 600,
              cursor: (!isGroup || isAdmin) ? 'pointer' : 'not-allowed',
              opacity: (!isGroup || isAdmin) ? 1 : 0.5
            }}
            disabled={isGroup && !isAdmin}
            onClick={async () => {
              if (isGroup && !isAdmin) return;
              const config = { type: tempDisappearType, timer: tempDisappearTimer };
              setDisappearingState(tempDisappearType === 'Off' ? 'Off' : `${tempDisappearType} (${tempDisappearTimer})`);
              if (isGroup) {
                await updateGroupSettings(id, { disappearingConfig: config });
              } else {
                await updateChatSettings(id, { disappearingConfig: config });
              }
              setActiveView('main');
            }}
          >
            Set
          </button>
          
          {isGroup && !isAdmin && (
            <span style={{ fontSize: '0.8rem', color: '#888', textAlign: 'center', marginTop: '4px' }}>
              Only group admins can change disappearing message settings
            </span>
          )}
        </div>
      </div>
    );
  }

  if (activeView === 'notifications') {
    return (
      <div className="app-container animate-fade-in" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="screen-header">
          <button className="icon-btn hoverable" onClick={() => setActiveView('main')} style={{ margin: '0 -10px' }}>
            <ArrowLeftIcon size={24} />
          </button>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, flex: 1, textAlign: 'center' }}>Notifications</h1>
          <div style={{ width: 40 }} />
        </div>
        
        <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: '24px', flex: 1 }}>
          <div className="glass-box" style={{ padding: 0, borderRadius: '24px', overflow: 'hidden', border: 'none' }}>
            {[
              { id: 'All Messages', label: 'All Messages', icon: Volume2Icon },
              { id: 'Mentions Only', label: 'Mentions Only', icon: AtSignIcon },
              { id: 'Mute', label: 'Mute', icon: VolumeXIcon }
            ].map((opt, idx) => {
              const isSelected = tempNotificationType.startsWith(opt.id);
              const IconComp = opt.icon;
              return (
                <div 
                  key={opt.id} 
                  className="settings-item hoverable" 
                  onClick={() => {
                    if (opt.id === 'Mute') {
                      setShowMuteTimer(true);
                    } else {
                      setTempNotificationType(opt.id);
                    }
                  }}
                  style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between', 
                    padding: '20px',
                    borderBottom: idx === 2 ? 'none' : '1px solid var(--border-color)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ 
                      width: 40, height: 40, borderRadius: '12px', 
                      backgroundColor: isSelected ? 'var(--accent-primary)20' : 'var(--bg-tertiary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: isSelected ? 'var(--accent-primary)' : 'var(--text-muted)'
                    }}>
                      <IconComp size={22} />
                    </div>
                    <span style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {opt.id === 'Mute' && tempNotificationType.startsWith('Mute (') ? tempNotificationType : opt.label}
                    </span>
                  </div>
                  <div style={{
                    width: '24px', height: '24px', borderRadius: '50%',
                    border: isSelected ? '2px solid var(--accent-primary)' : '2px solid var(--border-color)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {isSelected && <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)' }} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ padding: '24px', display: 'flex', justifyContent: 'center' }}>
          <button 
            className="btn-primary"
            disabled={isSavingNotifications}
            style={{ 
              height: '56px', borderRadius: '18px', width: '100%', maxWidth: '300px',
              opacity: isSavingNotifications ? 0.6 : 1
            }}
            onClick={async () => {
              try {
                setIsSavingNotifications(true);
                const finalType = tempNotificationType;
                const finalMuteUntil = finalType.startsWith('Mute') ? muteUntil : null;
                
                if (finalType === 'All Messages' || finalType === 'Mentions Only') {
                  setMuteUntil(null);
                  setMuteTimer(null);
                }

                if (isGroup) {
                  await updateGroupSettings(id, { notificationType: finalType, muteUntil: finalMuteUntil });
                } else {
                  await updateChatSettings(id, { notificationType: finalType, muteUntil: finalMuteUntil });
                }
                
                setNotifications(finalType);
                showToast(`Notifications set to: ${finalType}`, 'success');
                setActiveView('main');
              } catch (err) {
                showToast('Failed to save notification settings', 'error');
              } finally {
                setIsSavingNotifications(false);
              }
            }}
          >
            {isSavingNotifications ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

        {showMuteTimer && (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 400,
            display: 'flex', alignItems: 'flex-end',
            backdropFilter: 'blur(8px)',
            animation: 'fadeIn 0.2s ease-out'
          }} onClick={() => setShowMuteTimer(false)}>
            <div className="glass-box" style={{
              width: '100%',
              borderTopLeftRadius: '32px', borderTopRightRadius: '32px',
              borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
              padding: '24px 20px', animation: 'slideUp 0.3s ease-out',
              display: 'flex', flexDirection: 'column', gap: '8px',
              border: 'none',
              background: 'color-mix(in srgb, var(--accent-primary) 10%, rgba(15, 17, 21, 0.9))'
            }} onClick={e => e.stopPropagation()}>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', color: 'var(--text-primary)', textAlign: 'center', fontWeight: 700 }}>Mute For</h3>
              {['1 Hour', '8 Hours', '1 Day', 'Until I turn it back on'].map((time) => (
                <div 
                  key={time}
                  className="settings-item hoverable"
                  style={{
                    padding: '18px', fontSize: '1.05rem', fontWeight: 600,
                    textAlign: 'center', borderRadius: '16px',
                    cursor: 'pointer', border: 'none'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    let until = null;
                    if (time === '1 Hour') until = Date.now() + 3600000;
                    else if (time === '8 Hours') until = Date.now() + 8 * 3600000;
                    else if (time === '1 Day') until = Date.now() + 24 * 3600000;
                    
                    setMuteUntil(until);
                    const newType = time === 'Until I turn it back on' ? 'Mute' : `Mute (${time})`;
                    setTempNotificationType(newType);
                    setMuteTimer(time);
                    setShowMuteTimer(false);
                  }}
                >
                  {time}
                </div>
              ))}
              <div 
                className="settings-item hoverable"
                style={{
                  padding: '16px', fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-primary)',
                  textAlign: 'center', marginTop: '8px', cursor: 'pointer', borderRadius: '16px'
                }}
                onClick={() => setShowMuteTimer(false)}
              >
                Cancel
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (activeView === 'attachments') {
    return (
      <div className="app-container animate-fade-in" style={{ display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)', overflow: 'hidden' }}>
        <div className="screen-header">
          <button className="icon-btn" onClick={() => setActiveView('main')} style={{ margin: '0 -10px' }}>
            <ArrowLeftIcon size={24} />
          </button>
          <span className="header-title">Attachments</span>
          <div style={{ width: 40 }} />
        </div>
        
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
          <button 
            style={{ flex: 1, padding: '16px', background: 'none', border: 'none', color: attachmentTab === 'media' ? 'var(--accent-primary)' : 'var(--text-muted)', borderBottom: attachmentTab === 'media' ? '2px solid var(--accent-primary)' : '2px solid transparent', fontWeight: 600, fontSize: '1rem', cursor: 'pointer' }}
            onClick={() => setAttachmentTab('media')}
          >
            Media
          </button>
          <button 
            style={{ flex: 1, padding: '16px', background: 'none', border: 'none', color: attachmentTab === 'files' ? 'var(--accent-primary)' : 'var(--text-muted)', borderBottom: attachmentTab === 'files' ? '2px solid var(--accent-primary)' : '2px solid transparent', fontWeight: 600, fontSize: '1rem', cursor: 'pointer' }}
            onClick={() => setAttachmentTab('files')}
          >
            Files
          </button>
        </div>

        <div style={{ padding: '20px', flex: 1, overflowY: 'auto', minHeight: 0, WebkitOverflowScrolling: 'touch' }}>
          {attachmentTab === 'media' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {chat.messages.filter(m => m.media && (m.media.type === 'image' || m.media.type === 'video')).length === 0 ? (
                <div style={{ gridColumn: 'span 3', textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No media found</div>
              ) : (
                chat.messages.filter(m => m.media && (m.media.type === 'image' || m.media.type === 'video')).map((msg, i) => (
                  <div 
                    key={msg.id} 
                    style={{ aspectRatio: '1', backgroundColor: 'var(--bg-tertiary)', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', position: 'relative' }}
                    onClick={() => setPreviewMedia(msg)}
                  >
                    {msg.media.type === 'video' ? (
                      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                        <video src={msg.media.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#fff' }}>
                          <PlayIcon size={24} fill="#fff" />
                        </div>
                      </div>
                    ) : (
                      <img src={msg.media.url} alt="media" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                  </div>
                ))
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {chat.messages.filter(m => m.media && m.media.type === 'document').length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No documents found</div>
              ) : (
                chat.messages.filter(m => m.media && m.media.type === 'document').map((msg) => (
                    <div 
                      key={msg.id} 
                      className="glass-box hoverable"
                      style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px', border: 'none' }}
                      onClick={() => downloadFile(msg.media.url, msg.media.name)}
                    >
                    <div style={{ padding: '12px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                      <FileIcon size={24} color="var(--accent-secondary)" />
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ fontWeight: 600, marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{msg.media.name || 'Untitled Document'}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(msg.timestamp).toLocaleDateString()}</div>
                    </div>
                    <button 
                      className="icon-btn" 
                      onClick={async (e) => {
                        e.stopPropagation();
                        const confirmed = await showConfirm({
                          title: 'Delete File?',
                          message: 'Are you sure you want to delete this file?',
                          icon: Trash2Icon
                        });
                        if (confirmed) {
                          await bulkDeleteMessages(id, [msg.id], false);
                          showToast('File deleted', 'success');
                        }
                      }}
                      style={{ color: 'var(--accent-danger)' }}
                    >
                      <Trash2Icon size={20} />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        
        {/* Full Media Preview Modal */}
        {previewMedia && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.98)', zIndex: 5000,
            display: 'flex', flexDirection: 'column',
            animation: 'fadeIn 0.2s ease-out'
          }} onClick={() => setPreviewMedia(null)}>
            
            <div style={{
              padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 100%)',
              zIndex: 10, position: 'absolute', top: 0, left: 0, right: 0
            }} onClick={e => e.stopPropagation()}>
              <button className="icon-btn" onClick={() => setPreviewMedia(null)} style={{ color: '#fff' }}>
                <ArrowLeftIcon size={24} />
              </button>
              
              <div style={{ display: 'flex', gap: '20px' }}>
                <button className="icon-btn" onClick={() => downloadFile(previewMedia.media.url, previewMedia.media.name)} style={{ color: '#fff' }}>
                  <DownloadIcon size={24} />
                </button>
                <button className="icon-btn" onClick={async () => {
                  const confirmed = await showConfirm({
                    title: 'Delete Media?',
                    message: 'Are you sure you want to delete this media?',
                    icon: Trash2Icon
                  });
                  if (confirmed) {
                    await bulkDeleteMessages(id, [previewMedia.id], false);
                    setPreviewMedia(null);
                    showToast('Media deleted', 'success');
                  }
                }} style={{ color: 'var(--accent-danger)' }}>
                  <Trash2Icon size={24} />
                </button>
              </div>
            </div>
            
            <div 
              style={{ 
                flex: 1, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                padding: '20px',
                position: 'relative'
              }} 
              onClick={e => e.stopPropagation()}
              onTouchStart={onMediaTouchStart}
              onTouchEnd={onMediaTouchEnd}
            >
              {/* Navigation Arrows */}
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

              {previewMedia.media.type === 'video' ? (
                <video 
                  key={previewMedia.id}
                  src={previewMedia.media.url} 
                  controls 
                  autoPlay 
                  style={{ 
                    maxWidth: '100%', maxHeight: '100%',
                    animation: 'scaleIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                  }} 
                />
              ) : (
                <img 
                  key={previewMedia.id}
                  src={previewMedia.media.url} 
                  style={{ 
                    maxWidth: '100%', maxHeight: '100%', objectFit: 'contain',
                    animation: 'scaleIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                  }} 
                  alt="" 
                />
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (activeView === 'group_members' && isGroup) {
    const currentUserId = user?.id;


    const handleMemberClick = (member) => {
      if (member.id === currentUserId || (member.shadowId && member.shadowId === user?.shadowId)) {
        navigate(`/chat/${currentUserId}`);
        return;
      }
      
      if (isAdmin) {
        setSelectedMemberInfo(member);
        return;
      }

      const isMemberAdmin = member.role === 'admin' || member.id === chat?.adminId;
      // Members can DM admins or other members if allowed
      if (isMemberAdmin || localAllowDMs) {
        const existingChat = chats.find(c => !c.isGroup && c.contact?.id === member.id);
        if (existingChat) {
          navigate(`/chat/${existingChat.id}`);
        } else {
          navigate('/new-chat', { state: { presetId: member.id } });
        }
      } else {
        setConfirmAction({
          type: 'restricted',
          title: 'Direct Messaging Restricted',
          message: `The admin of "${chat?.name}" has disabled direct messaging between members. You can still message the admin directly.`
        });
      }
    };

    return (
      <div className="app-container animate-fade-in" style={{ backgroundColor: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
        <div className="screen-header">
          <button className="icon-btn hoverable glass-box" onClick={() => setActiveView('main')} style={{ margin: '0 -10px', border: 'none' }}>
            <ArrowLeftIcon size={24} />
          </button>
          <span className="header-title">Group Members</span>
          <button className="icon-btn hoverable glass-box" onClick={() => setActiveView('add_member')} style={{ margin: '0 -10px', border: 'none' }}>
            {isAdmin ? <PlusIcon size={24} color="var(--accent-primary)" /> : <div style={{ width: 24 }} />}
          </button>
        </div>

        <div style={{ padding: '0 20px 20px', flex: 1, overflowY: 'auto' }}>
          <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '16px' }}>{chat.members.length} Members</h3>
          <div className="settings-section" style={{ padding: 0 }}>
            {(chat.members || [])
              .filter(m => m && m.id)
              .map((member, idx) => {
                const isMemberAdmin = member.role === 'admin' || member.id === chat.adminId;
                const isMe = member.id === currentUserId;
                
                const canDM = isAdmin || isMemberAdmin || localAllowDMs;
                const opacity = (!isMe && !canDM) ? 0.6 : 1;

              return (
                <div 
                  key={member.id} 
                  className="glass-box setting-item hoverable"
                  onClick={() => handleMemberClick(member)}
                  style={{ 
                    padding: '16px 20px', 
                    marginBottom: '8px',
                    opacity,
                    cursor: 'pointer',
                    border: 'none',
                    borderRadius: '16px'
                  }}
                >
                  <div className="avatar" style={{ width: 40, height: 40, marginRight: '12px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-tertiary)' }}>
                    {(isMe ? user?.avatarUrl : member.avatarUrl) ? (
                      <img src={isMe ? user.avatarUrl : member.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <DefaultAvatar name={member.name} size={40} />
                    )}
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {member.name} {isMe && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>(You)</span>}
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', opacity: 0.8, fontFamily: 'monospace', marginLeft: 'auto' }}>
                        {member.shadowId || member.name}
                      </span>
                    </span>
                    {isMemberAdmin ? (
                      <span style={{ fontSize: '0.8rem', color: 'var(--accent-secondary)' }}>Group Admin</span>
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Member</span>
                    )}
                  </div>
                  {!isMe && !canDM && (
                    <BanIcon size={20} color="var(--text-muted)" />
                  )}
                  {!isMe && canDM && (
                    <ChevronRightIcon size={20} color="var(--text-muted)" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Member Info Popup (Admin Only) */}
        {selectedMemberInfo && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 2100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(10px)'
          }} onClick={() => setSelectedMemberInfo(null)}>
            <div style={{
              backgroundColor: 'var(--bg-secondary)', borderRadius: '28px', padding: '32px',
              width: '90%', maxWidth: '360px', border: '1px solid var(--border-color)',
              animation: 'fadeIn 0.3s ease-out', textAlign: 'center'
            }} onClick={e => e.stopPropagation()}>
              <div style={{ width: 80, height: 80, margin: '0 auto 20px', borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-tertiary)' }}>
                {selectedMemberInfo.avatarUrl ? (
                  <img src={selectedMemberInfo.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <DefaultAvatar name={selectedMemberInfo.name} size={80} />
                )}
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '4px' }}>{selectedMemberInfo.name}</h2>
              <div style={{ fontSize: '0.9rem', color: 'var(--accent-primary)', marginBottom: '24px' }}>
                {selectedMemberInfo.role === 'admin' ? 'Group Admin' : 'Group Member'}
              </div>

              <div style={{ backgroundColor: 'var(--bg-tertiary)', borderRadius: '16px', padding: '16px', marginBottom: '24px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>Member ID</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.95rem', wordBreak: 'break-all', color: 'var(--text-primary)' }}>{selectedMemberInfo.shadowId || selectedMemberInfo.name}</div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button className="btn-primary" style={{ flex: 1 }} onClick={() => {
                    const isAdminOfGroup = chat.adminId.toLowerCase() === user?.id.toLowerCase();
                    const isTargetAdmin = selectedMemberInfo.role === 'admin' || selectedMemberInfo.id.toLowerCase() === chat.adminId.toLowerCase();
                    const isDMsAllowed = chat.allow_member_dm !== false;

                    if (isAdminOfGroup || isTargetAdmin || isDMsAllowed) {
                      const existingChat = chats.find(c => c.type === 'direct' && c.contact?.id === selectedMemberInfo.id);
                      if (existingChat) {
                        navigate(`/chat/${existingChat.id}`);
                      } else {
                        navigate('/new-chat', { state: { presetId: selectedMemberInfo.id } });
                      }
                      setSelectedMemberInfo(null);
                    } else {
                      setSelectedMemberInfo(null);
                      setConfirmAction({
                        type: 'restricted',
                        title: 'Direct Messaging Restricted',
                        message: `The admin of "${chat.name}" has disabled direct messaging between members. You can still message the admin directly.`
                      });
                    }
                  }}>
                    Message
                  </button>
                  <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setSelectedMemberInfo(null)}>
                    Close
                  </button>
                </div>
                
                {isAdmin && selectedMemberInfo.id !== user?.id && (
                  <button 
                    className="btn-secondary" 
                    style={{ 
                      width: '100%', 
                      color: 'var(--accent-danger)', 
                      borderColor: 'var(--accent-danger)',
                      backgroundColor: 'rgba(255, 68, 68, 0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '12px'
                    }}
                    onClick={() => {
                      setConfirmAction({
                        type: 'remove_member',
                        member: selectedMemberInfo
                      });
                      setSelectedMemberInfo(null);
                    }}
                  >
                    <UserMinusIcon size={18} /> Remove from Group
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        {/* Restricted Action Modal */}
        {confirmAction && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 2200,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(10px)', padding: '20px'
          }} onClick={() => setConfirmAction(null)}>
            <div style={{
              backgroundColor: 'var(--bg-secondary)', borderRadius: '24px', padding: '28px',
              width: '100%', maxWidth: '340px', animation: 'slideUp 0.3s ease-out', border: '1px solid var(--border-color)',
              textAlign: 'center'
            }} onClick={e => e.stopPropagation()}>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '12px', color: '#fff' }}>
                {confirmAction.type === 'remove_member' ? 'Remove Member?' : (confirmAction.type === 'restricted' ? confirmAction.title : 'Confirmation')}
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '28px', lineHeight: '1.5' }}>
                {confirmAction.type === 'remove_member' 
                  ? `Are you sure you want to remove ${confirmAction.member.name} from this group?`
                  : (confirmAction.type === 'restricted' ? confirmAction.message : 'Are you sure you want to proceed?')}
              </p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  className="btn-secondary" 
                  style={{ flex: 1 }}
                  onClick={() => setConfirmAction(null)}
                >
                  {confirmAction.type === 'restricted' ? 'Understood' : 'Cancel'}
                </button>
                {confirmAction.type !== 'restricted' && (
                  <button 
                    className="btn-primary" 
                    style={{ 
                      flex: 1, 
                      backgroundColor: confirmAction.type === 'remove_member' ? 'var(--accent-danger)' : 'var(--accent-primary)',
                      color: confirmAction.type === 'remove_member' ? '#fff' : '#000'
                    }}
                    onClick={async () => {
                      if (confirmAction.type === 'remove_member') {
                        await removeMemberFromGroup(id, confirmAction.member.id);
                      } else {
                        await handleConfirmAction();
                      }
                      setConfirmAction(null);
                    }}
                  >
                    Confirm
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------------- Main View ----------------

  if (activeView === 'add_member' && isGroup) {
    return (
      <div className="app-container animate-fade-in" style={{ backgroundColor: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
        <div className="screen-header" style={{ borderBottom: 'none', justifyContent: 'space-between', padding: '16px 20px' }}>
          <button className="icon-btn" onClick={() => { setActiveView('group_members'); setIsScanningMember(false); }} style={{ margin: '0 -10px' }}>
            <ArrowLeftIcon size={24} />
          </button>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Add Member</h1>
          <div style={{ width: 40 }} />
        </div>

        <div style={{ padding: '0 20px 20px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '24px' }}>
              Add a new member to "{chat.name}" by scanning their QR code or entering their Shadow ID.
            </p>
          </div>

          {!isScanningMember ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <button 
                className="hoverable"
                style={{
                  display: 'flex', alignItems: 'center', gap: '20px', padding: '24px',
                  backgroundColor: 'var(--bg-tertiary)', borderRadius: '20px', width: '100%',
                  border: '1px solid var(--border-color)', transition: 'all 0.3s'
                }}
                onClick={() => setIsScanningMember(true)}
              >
                <div style={{ width: 56, height: 56, borderRadius: '16px', backgroundColor: 'rgba(0, 255, 136, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <QrCodeIcon size={28} color="var(--accent-primary)" />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Scan QR Code</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>Use camera to scan member's ID</div>
                </div>
              </button>

              <div style={{ position: 'relative', margin: '10px 0', textAlign: 'center' }}>
                <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', backgroundColor: 'var(--border-color)', zIndex: 0 }} />
                <span style={{ position: 'relative', backgroundColor: 'var(--bg-primary)', padding: '0 15px', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>Or Enter Shadow ID</span>
              </div>

              <div style={{ backgroundColor: 'var(--bg-tertiary)', borderRadius: '20px', padding: '24px', border: '1px solid var(--border-color)' }}>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '12px', fontWeight: 700 }}>Recipient Shadow ID</label>
                  <input 
                    type="text" 
                    className="text-input" 
                    placeholder="e.g. 05e3b9f4..." 
                    value={addMemberId}
                    onChange={(e) => setAddMemberId(e.target.value)}
                    style={{ textAlign: 'left', letterSpacing: '1px', fontFamily: 'monospace', fontSize: '1.1rem', padding: '12px 0', borderBottom: '2px solid var(--border-color)', borderRadius: 0, backgroundColor: 'transparent' }}
                  />
                </div>
                <button 
                  className="btn-primary" 
                  disabled={!addMemberId.trim()}
                  onClick={async () => {
                    if (addMemberId.trim()) {
                      await addMemberToGroup(id, addMemberId.trim());
                      setActiveView('group_members');
                      setAddMemberId('');
                    }
                  }}
                  style={{ width: '100%', padding: '16px', borderRadius: '14px', fontSize: '1rem' }}
                >
                  Add Member to Group
                </button>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div id="member-reader" style={{ width: '100%', borderRadius: '20px', overflow: 'hidden', border: '2px solid var(--accent-primary)' }}></div>
              <button 
                className="btn-secondary" 
                onClick={() => setIsScanningMember(false)}
                style={{ padding: '14px', borderRadius: '12px' }}
              >
                Cancel Scanning
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (activeView === 'manage_admins' && isGroup && isAdmin) {
    return (
      <div className="app-container animate-fade-in" style={{ color: '#fff', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'rgba(6, 7, 10, 0.25)',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          minHeight: '100vh'
        }}>
          <div className="screen-header" style={{ borderBottom: 'none', justifyContent: 'flex-start', padding: '16px 20px', background: 'transparent' }}>
            <button className="icon-btn hoverable" onClick={() => setActiveView('main')} style={{ margin: '0', padding: '0', color: '#fff' }}>
              <ArrowLeftIcon size={24} />
            </button>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 0 16px' }}>Manage Admins</h1>
          </div>

          <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
            <p style={{ 
              color: '#fff', 
              fontSize: '0.95rem', 
              fontWeight: 500,
              textAlign: 'center', 
              marginBottom: '24px', 
              padding: '12px 16px',
              backgroundColor: 'rgba(15, 17, 21, 0.9)',
              borderLeft: '4px solid var(--accent-primary)',
              borderRadius: '8px',
              lineHeight: '1.4',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
            }}>
              Admins cannot be demoted or removed from the group.
            </p>

            <button 
              className="settings-item hoverable"
              style={{
                display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px',
                width: '100%', cursor: 'pointer', marginBottom: '24px',
                backgroundColor: 'color-mix(in srgb, var(--accent-primary) 15%, rgba(15, 17, 21, 0.9))',
                border: '1.5px solid var(--accent-primary)',
                borderRadius: '16px',
                boxShadow: '0 4px 15px rgba(0,0,0,0.4)'
              }}
              onClick={() => setActiveView('promote_members')}
            >
              <div style={{ display: 'flex', position: 'relative' }}>
                <CrownIcon size={24} color="var(--accent-primary)" />
                <div style={{ position: 'absolute', bottom: -4, right: -4, backgroundColor: 'var(--bg-secondary)', borderRadius: '50%', padding: '2px' }}>
                  <PlusIcon size={10} color="var(--accent-primary)" />
                </div>
              </div>
              <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff' }}>Promote Members</span>
            </button>

            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent-primary)', marginBottom: '16px', marginLeft: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Admins
            </h3>
            
            <div style={{ position: 'relative', marginBottom: '20px' }}>
              <SearchIcon size={20} color="#888" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="text" 
                className="text-input"
                placeholder="Search" 
                style={{
                  width: '100%', padding: '12px 16px 12px 48px',
                  fontSize: '1rem',
                  backgroundColor: 'rgba(15, 17, 21, 0.95)',
                  border: '1.5px solid rgba(255, 255, 255, 0.15)',
                  color: '#fff',
                  borderRadius: '12px',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
                }}
                value={adminSearchQuery}
                onChange={(e) => setAdminSearchQuery(e.target.value)}
              />
              {adminSearchQuery && (
                <button 
                  className="icon-btn" 
                  style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', padding: '4px' }}
                  onClick={() => setAdminSearchQuery('')}
                >
                  <XIcon size={16} color="#888" />
                </button>
              )}
            </div>

            <div className="settings-section" style={{ padding: 0 }}>
              {(chat.members || [])
                .filter(m => (m.role === 'admin' || m.id === chat.adminId) && m.name.toLowerCase().includes(adminSearchQuery.toLowerCase()))
                .map(admin => {
                  const isMe = admin.id === user?.id;
                  return (
                    <div 
                      key={admin.id} 
                      className="settings-item"
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '16px', 
                        padding: '12px 16px', 
                        borderRadius: '12px',
                        marginBottom: '8px',
                        backgroundColor: 'color-mix(in srgb, var(--accent-primary) 12%, rgba(15, 17, 21, 0.9))',
                        border: '1px solid rgba(255, 255, 255, 0.08)'
                      }}
                    >
                      <div className="avatar" style={{ position: 'relative', width: 44, height: 44, borderRadius: '50%', overflow: 'visible', marginRight: 0 }}>
                        <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden' }}>
                          {(isMe ? user?.avatarUrl : admin.avatarUrl) ? (
                            <img src={isMe ? user.avatarUrl : admin.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <DefaultAvatar name={admin.name} size={44} />
                          )}
                        </div>
                        <div style={{ 
                          position: 'absolute', bottom: -2, right: -2, 
                          backgroundColor: '#FFD700', borderRadius: '50%', 
                          padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: '2px solid #000'
                        }}>
                          <CrownIcon size={10} color="#000" fill="#000" />
                        </div>
                      </div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '1.05rem', fontWeight: 600, color: '#fff' }}>
                          {admin.name} {isMe && '(You)'}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: '#888' }}>
                          {admin.shadowId || admin.name}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activeView === 'promote_members' && isGroup && isAdmin) {
    return (
      <div className="app-container animate-fade-in" style={{ color: '#fff', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'rgba(6, 7, 10, 0.25)',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          minHeight: '100vh'
        }}>
          <div className="screen-header" style={{ borderBottom: 'none', justifyContent: 'flex-start', padding: '16px 20px', background: 'transparent' }}>
            <button className="icon-btn hoverable" onClick={() => setActiveView('manage_admins')} style={{ margin: '0', padding: '0', color: '#fff' }}>
              <ArrowLeftIcon size={24} />
            </button>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 0 16px' }}>Promote Members</h1>
          </div>

          <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
            <div style={{ position: 'relative', marginBottom: '20px' }}>
              <SearchIcon size={20} color="#888" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="text" 
                className="text-input"
                placeholder="Search members to promote" 
                style={{
                  width: '100%', padding: '12px 16px 12px 48px',
                  fontSize: '1rem',
                  backgroundColor: 'rgba(15, 17, 21, 0.95)',
                  border: '1.5px solid rgba(255, 255, 255, 0.15)',
                  color: '#fff',
                  borderRadius: '12px',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
                }}
                value={promoteSearchQuery}
                onChange={(e) => setPromoteSearchQuery(e.target.value)}
              />
              {promoteSearchQuery && (
                <button 
                  className="icon-btn" 
                  style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', padding: '4px' }}
                  onClick={() => setPromoteSearchQuery('')}
                >
                  <XIcon size={16} color="#888" />
                </button>
              )}
            </div>

            <div className="settings-section" style={{ padding: 0 }}>
              {(chat.members || [])
                .filter(m => !(m.role === 'admin' || m.id === chat.adminId) && m.name.toLowerCase().includes(promoteSearchQuery.toLowerCase()))
                .map(member => {
                  return (
                    <div 
                      key={member.id} 
                      className="settings-item hoverable" 
                      onClick={async () => {
                        const confirmed = await showConfirm({
                          title: 'Promote to Admin?',
                          message: `Are you sure you want to promote ${member.name} to Admin?`,
                          icon: CrownIcon
                        });
                        if (confirmed) {
                          await promoteMemberToAdmin(id, member.id);
                          setActiveView('manage_admins');
                        }
                      }}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '16px', 
                        padding: '12px 16px', 
                        cursor: 'pointer',
                        borderRadius: '12px',
                        marginBottom: '8px',
                        backgroundColor: 'color-mix(in srgb, var(--accent-primary) 12%, rgba(15, 17, 21, 0.9))',
                        border: '1px solid rgba(255, 255, 255, 0.08)'
                      }}
                    >
                      <div className="avatar" style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden' }}>
                        {member.avatarUrl ? (
                          <img src={member.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <DefaultAvatar name={member.name} size={44} />
                        )}
                      </div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '1.05rem', fontWeight: 600, color: '#fff' }}>{member.name}</span>
                        <span style={{ fontSize: '0.8rem', color: '#888' }}>{member.shadowId || member.name}</span>
                      </div>
                    </div>
                  );
                })}
              {(chat.members || []).filter(m => !(m.role === 'admin' || m.id === chat.adminId) && m.name.toLowerCase().includes(promoteSearchQuery.toLowerCase())).length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#888' }}>
                  No members available to promote.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="app-container animate-fade-in" style={{ backgroundColor: 'var(--bg-primary)', overflowY: 'auto' }}>
      
      {/* Header */}
      <div className="screen-header" style={{ borderBottom: 'none', justifyContent: 'space-between', padding: '16px 20px' }}>
        <button className="icon-btn" onClick={() => navigate(-1)} style={{ margin: '0 -10px' }}>
          <ArrowLeftIcon size={24} />
        </button>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>{isGroup ? 'Group Info' : 'Contact Info'}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginRight: '-10px' }}>
          {!isGroup && !isNoteToSelf && (
            <>
              <button className="icon-btn" onClick={() => startCall('voice', chat.contact)}>
                <PhoneIcon size={20} />
              </button>
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 20px 20px 20px' }}>
        
        {/* Avatar with QR/Camera Badge */}
        <div style={{ position: 'relative', display: 'inline-block', marginBottom: '16px' }}>
          <div style={{
            width: '120px', height: '120px',
            borderRadius: '50%', backgroundColor: 'var(--bg-tertiary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '3rem', fontWeight: 700, color: '#fff',
            position: 'relative', overflow: 'hidden',
            border: '2px solid rgba(124, 77, 255, 0.5)',
            boxShadow: '0 0 20px rgba(124, 77, 255, 0.3)'
          }}>
            {chat.avatarUrl || chat.contact?.avatarUrl ? (
              <img src={chat.avatarUrl || chat.contact?.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <DefaultAvatar name={displayName} size={120} />
            )}
            {isUploadingPic && (
              <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="spinner" style={{ width: 24, height: 24, borderColor: 'var(--accent-primary)', borderTopColor: 'transparent', borderRadius: '50%', borderStyle: 'solid', borderWidth: '2px', animation: 'spin 1s linear infinite' }} />
              </div>
            )}
          </div>
          {(!isGroup || isAdmin) && (
            <div style={{
              position: 'absolute', bottom: '0', right: '0',
              backgroundColor: 'var(--accent-primary)', width: '32px', height: '32px',
              borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '3px solid var(--bg-primary)', cursor: 'pointer'
            }} onClick={() => isGroup ? avatarInputRef.current?.click() : setShowQRModal(true)}>
              {isGroup ? <CameraIcon size={14} color="#000" /> : <QrCodeIcon size={14} color="#000" />}
            </div>
          )}
          <input type="file" ref={avatarInputRef} hidden accept="image/*" onChange={handleGroupPicUpload} />
        </div>
        
        {/* Name / Nickname Edit */}
        {showEdit ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <input 
              type="text" 
              className="text-input"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Enter nickname"
              style={{ textAlign: 'center', width: '200px', fontSize: '1.2rem' }}
              autoFocus
            />
            <button className="icon-btn" onClick={handleSaveNickname} style={{ color: 'var(--accent-primary)' }}>
              <CheckIcon size={24} />
            </button>
          </div>
        ) : (
          <h2 
            style={{ fontSize: '1.6rem', fontWeight: 700, textAlign: 'center', lineHeight: '1.2', cursor: (!isGroup || isAdmin) ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}
            onClick={() => (!isGroup || isAdmin) && setShowEdit(true)}
          >
            {displayName}
            {(!isGroup || isAdmin) && <Edit2Icon size={16} style={{ opacity: 0.5 }} />}
          </h2>
        )}
      </div>

      {/* Account ID Section */}
      {!isGroup && (
        <div className="glass-box hoverable" style={{ padding: '16px 20px', margin: '0 20px 32px 20px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', border: 'none' }} onClick={handleCopyId}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Account ID:</span>
          <span style={{ fontFamily: 'monospace', fontSize: '1rem', color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {displayId}
          </span>
          {copied ? <CheckIcon size={18} color="var(--accent-primary)" /> : <CopyIcon size={18} color="var(--text-muted)" />}
        </div>
      )}

      <div style={{ padding: '0 20px 40px 20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Main Options List */}
        <div className="glass-box" style={{ padding: 0, border: 'none', borderRadius: '24px', overflow: 'hidden' }}>
          {!isGroup && (
            <div className="settings-item hoverable" onClick={handleCopyId} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px' }}>
              <CopyIcon size={24} color="var(--text-muted)" />
              <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>{copied ? 'Copied!' : 'Copy Account ID'}</span>
            </div>
          )}
          
          {true && (
            <div className="settings-item hoverable" onClick={() => setActiveView('disappearing')} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px' }}>
              <TimerIcon size={24} color="var(--text-muted)" />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>Disappearing Messages</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{disappearingState}</span>
              </div>
              <ChevronRightIcon size={20} color="var(--text-muted)" />
            </div>
          )}
          
          <div className="settings-item hoverable" onClick={async () => {
            const newState = await togglePin(id);
            setPinned(newState);
          }} style={{ gap: '16px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
              <PinIcon size={24} color="#ccc" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>{pinned ? 'Unpin Conversation' : 'Pin Conversation'}</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{pinned ? 'Pinned' : 'Unpinned'}</span>
              </div>
            </div>
            <div className={`toggle-switch ${pinned ? 'active' : ''}`} />
          </div>
          
          <div className="settings-item hoverable" onClick={() => setActiveView('notifications')} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
            <BellIcon size={24} color="#ccc" />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>Notifications</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {muteUntil ? `Muted • ${countdown} left` : (notifications === 'Mute' ? 'Muted Indefinitely' : (notifications === 'All Messages' ? 'All Messages Enabled' : (notifications === 'Mentions Only' ? 'Mentions Only Enabled' : notifications)))}
              </span>
            </div>
            <ChevronRightIcon size={20} color="var(--text-muted)" />
          </div>

          <div className="settings-item hoverable" onClick={() => setShowThemeModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
            <PaletteIcon size={24} color="#ccc" />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>Chat Theme</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Customize colors & wallpaper</span>
            </div>
            <ChevronRightIcon size={20} color="var(--text-muted)" />
          </div>

          {isGroup && (
            <div 
              className={`settings-item ${isAdmin ? 'hoverable' : ''}`} 
              onClick={isAdmin ? handleToggleDMs : null} 
              style={{ 
                gap: '16px', padding: '16px', borderBottom: '1px solid var(--border-color)', 
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                cursor: isAdmin ? 'pointer' : 'default',
                opacity: isAdmin ? 1 : 0.5
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                <ShieldIcon size={24} color={localAllowDMs ? "var(--accent-primary)" : "var(--text-muted)"} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>Allow Member DMs</span>
                    {isUpdatingDMs && <div className="spinner" style={{ width: 14, height: 14, borderWidth: '2px' }} />}
                  </div>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {localAllowDMs ? 'Members can message each other' : 'Direct messages between members are disabled'}
                  </span>
                </div>
              </div>
              <div 
                className={`toggle-switch ${localAllowDMs ? 'active' : ''}`} 
                style={{
                  width: '40px', height: '22px', borderRadius: '11px',
                  backgroundColor: localAllowDMs ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)',
                  position: 'relative', transition: 'all 0.3s'
                }}
              >
                <div style={{
                  width: '16px', height: '16px', borderRadius: '50%',
                  backgroundColor: '#fff', position: 'absolute', top: '3px',
                  left: localAllowDMs ? '21px' : '3px', transition: 'all 0.3s'
                }} />
              </div>
            </div>
          )}

          {isGroup && isAdmin && (
            <div 
              className="settings-item hoverable" 
              onClick={() => setActiveView('manage_admins')} 
              style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', borderBottom: '1px solid var(--border-color)' }}
            >
              <CrownIcon size={24} color="#ccc" />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>Manage Admins</span>
              </div>
              <ChevronRightIcon size={20} color="var(--text-muted)" />
            </div>
          )}

          {isGroup && (
            <div className="settings-item hoverable" onClick={() => setActiveView('group_members')} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', borderBottom: 'none' }}>
              <UsersIcon size={24} color="#ccc" />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>Group Members</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{chat.members.length} participants</span>
              </div>
              <ChevronRightIcon size={20} color="var(--text-muted)" />
            </div>
          )}
          
          <div className="settings-item hoverable" onClick={() => setActiveView('attachments')} style={{ display: 'flex', alignItems: 'center', borderBottom: 'none', borderTop: '1px solid var(--border-color)', gap: '16px', padding: '16px' }}>
            <PaperclipIcon size={24} color="#ccc" />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>Attachments</span>
            </div>
            <ChevronRightIcon size={20} color="var(--text-muted)" />
          </div>
        </div>

        {/* Danger Zone */}
        <div className="glass-box" style={{ padding: 0, marginTop: '16px', border: 'none', borderRadius: '24px', overflow: 'hidden' }}>
          {!isGroup && (
            <div className="settings-item hoverable" onClick={() => setConfirmAction('delete')} style={{ display: 'flex', alignItems: 'center', padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
              <Trash2Icon size={24} color="#ff4444" />
              <span style={{ color: '#ff4444', fontSize: '1.1rem', fontWeight: 600, marginLeft: '12px' }}>Delete Conversation</span>
            </div>
          )}

          <div className="settings-item hoverable" onClick={() => setConfirmAction('clear')} style={{ display: 'flex', alignItems: 'center', padding: '16px', borderBottom: (isGroup || !isGroup) ? '1px solid var(--border-color)' : 'none' }}>
            <EraserIcon size={24} color="#ff4444" />
            <span style={{ color: '#ff4444', fontSize: '1.1rem', fontWeight: 600, marginLeft: '12px' }}>Clear all message</span>
          </div>

          {!isGroup && (
            <>
              <div className="settings-item hoverable" onClick={() => setConfirmAction('block')} style={{ display: 'flex', alignItems: 'center', padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
                <BanIcon size={24} color="#ff4444" />
                <span style={{ color: '#ff4444', fontSize: '1.1rem', fontWeight: 600, marginLeft: '12px' }}>Block Contact</span>
              </div>

              <div className="settings-item hoverable" onClick={() => setConfirmAction('delete_contact')} style={{ display: 'flex', alignItems: 'center', padding: '16px', borderBottom: isGroup ? '1px solid var(--border-color)' : 'none' }}>
                <UserIcon size={24} color="#ff4444" />
                <span style={{ color: '#ff4444', fontSize: '1.1rem', fontWeight: 600, marginLeft: '12px' }}>Delete Contact</span>
              </div>
            </>
          )}

          {isGroup && (
            <>
              <div className="settings-item hoverable" 
                onClick={() => setConfirmAction(chat.status === 'removed' ? 'delete_group' : 'leave_group')} 
                style={{ display: 'flex', alignItems: 'center', borderBottom: (isAdmin && chat.status !== 'removed') ? '1px solid var(--border-color)' : 'none', padding: '16px' }}
              >
                {chat.status === 'removed' ? (
                  <>
                    <Trash2Icon size={24} color="#ff4444" />
                    <span style={{ color: '#ff4444', fontSize: '1.1rem', fontWeight: 600, marginLeft: '12px' }}>Delete Group Chat</span>
                  </>
                ) : (
                  <>
                    <LogOutIcon size={24} color="#ff4444" />
                    <span style={{ color: '#ff4444', fontSize: '1.1rem', fontWeight: 600, marginLeft: '12px' }}>Leave Group</span>
                  </>
                )}
              </div>

              {isAdmin && chat.status !== 'removed' && (
                <div className="settings-item hoverable" 
                  onClick={() => setConfirmAction('delete_group_admin')} 
                  style={{ display: 'flex', alignItems: 'center', borderBottom: 'none', padding: '16px' }}
                >
                  <Trash2Icon size={24} color="#ff4444" />
                  <span style={{ color: '#ff4444', fontSize: '1.1rem', fontWeight: 600, marginLeft: '12px' }}>Delete Group</span>
                </div>
              )}
            </>
          )}
        </div>

      </div>

      {/* Mute Duration Selection Modal */}
      {showMuteModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(5px)'
        }} onClick={() => setShowMuteModal(false)}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)', borderRadius: '24px', padding: '24px',
            width: '85%', maxWidth: '320px', border: '1px solid var(--border-color)',
            animation: 'slideUp 0.3s ease-out'
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '20px', textAlign: 'center' }}>Mute Notifications</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { label: '1 Hour', value: '1 Hour' },
                { label: '8 Hours', value: '8 Hours' },
                { label: '1 Day', value: '1 Day' },
                { label: 'Until I turn it back on', value: 'Until I turn it back on' }
              ].map(option => (
                <div 
                  key={option.value} 
                  className="menu-item hoverable" 
                  onClick={async (e) => { 
                    e.stopPropagation();
                    console.log('[ShadowTalk] Mute option selected:', option.value);
                    setMuteTimer(option.value); 
                    
                    let duration = 0;
                    if (option.value === '1 Hour') duration = 1 * 3600000;
                    else if (option.value === '8 Hours') duration = 8 * 3600000;
                    else if (option.value === '1 Day') duration = 24 * 3600000;
                    
                    const finalMuteUntil = duration > 0 ? Date.now() + duration : null;
                    const finalType = option.value === 'Until I turn it back on' ? 'Mute' : `Mute (${option.label})`;
                    
                    // Optimistic update
                    setMuteUntil(finalMuteUntil);
                    setNotifications(finalType);
                    setTempNotificationType(finalType);
                    
                    // Close modal early for better feel
                    setShowMuteModal(false); 
                    
                    // SAVE PERSISTENTLY
                    try {
                      if (isGroup) {
                        console.log('[ShadowTalk] Updating group mute settings for:', id);
                        await updateGroupSettings(id, { notificationType: finalType, muteUntil: finalMuteUntil });
                      } else {
                        console.log('[ShadowTalk] Updating chat mute settings for:', id);
                        await updateChatSettings(id, { notificationType: finalType, muteUntil: finalMuteUntil });
                      }
                      setMuteFeedback(`Notifications muted for ${option.label}`);
                      showToast(`Muted for ${option.label}`, 'success');
                    } catch (err) {
                      console.error('[ShadowTalk] Mute save error:', err);
                      showToast('Failed to update mute settings', 'error');
                    }
                    
                    setTimeout(() => setMuteFeedback(null), 3000);
                  }}
                  style={{ borderRadius: '12px', padding: '16px', justifyContent: 'space-between', border: '1px solid transparent' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <ClockIcon size={20} color="var(--text-muted)" />
                    <span>{option.label}</span>
                  </div>
                  {muteTimer === option.value && <CheckIcon size={20} color="var(--accent-primary)" />}
                </div>
              ))}
            </div>
            <button 
              className="btn-secondary" 
              style={{ marginTop: '20px', width: '100%', borderRadius: '12px', border: 'none' }}
              onClick={() => setShowMuteModal(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Danger Zone / Restriction Confirmation Modal */}
      {confirmAction && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 400,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(2px)'
        }} onClick={() => setConfirmAction(null)}>
          <div style={{
            backgroundColor: '#1a1a1a', borderRadius: '16px', padding: '24px',
            width: '80%', maxWidth: '320px', animation: 'fadeIn 0.2s ease-out', border: '1px solid #333'
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '12px', textAlign: 'center', color: confirmAction.type === 'restricted' ? 'var(--accent-primary)' : '#fff' }}>
              {confirmAction.type === 'restricted' ? confirmAction.title : (
                <>
                  {confirmAction === 'clear' && 'Clear All Messages?'}
                  {(confirmAction === 'delete' || confirmAction === 'delete_group') && 'Delete Conversation?'}
                  {confirmAction === 'block' && 'Block Contact?'}
                  {confirmAction === 'delete_contact' && 'Delete Contact?'}
                  {confirmAction === 'leave_group' && 'Leave Group?'}
                  {confirmAction === 'delete_group_admin' && 'Delete Group?'}
                </>
              )}
            </h3>
            <p style={{ color: '#aaa', fontSize: '0.95rem', marginBottom: '24px', textAlign: 'center', lineHeight: '1.5' }}>
              {confirmAction.type === 'restricted' ? confirmAction.message : (
                confirmAction === 'delete_group_admin'
                  ? 'Are you sure you want to delete this group? This action cannot be undone.'
                  : confirmAction === 'delete_contact' 
                    ? 'Are you sure you want to remove this friend? Both users will be unable to send new messages, and the chat will become read-only.'
                    : 'Are you sure you want to proceed with this action? This cannot be undone.'
              )}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button 
                className="btn-primary" 
                style={{ flex: 1, backgroundColor: confirmAction === 'block' || confirmAction === 'delete' || confirmAction === 'delete_contact' || confirmAction === 'delete_group' || confirmAction === 'delete_group_admin' ? '#ff4444' : 'var(--accent-primary)', color: confirmAction === 'block' || confirmAction === 'delete' || confirmAction === 'delete_contact' || confirmAction === 'delete_group' || confirmAction === 'delete_group_admin' ? '#fff' : '#000' }}
                onClick={() => {
                  if (confirmAction.type === 'restricted') {
                    setConfirmAction(null);
                  } else {
                    handleConfirmAction();
                  }
                }}
              >
                {confirmAction.type === 'restricted' ? 'Understood' : 'Confirm'}
              </button>
              {confirmAction.type !== 'restricted' && (
                <button 
                  className="btn-secondary" 
                  style={{ flex: 1, backgroundColor: 'transparent', border: '1px solid #444', color: '#fff' }}
                  onClick={() => setConfirmAction(null)}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQRModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 500,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', backdropFilter: 'blur(12px)',
          animation: 'fadeIn 0.2s ease-out'
        }} onClick={() => setShowQRModal(false)}>
          <div className="glass-box" style={{
            padding: '24px', borderRadius: '32px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '24px', border: 'none',
            animation: 'slideUp 0.3s ease-out'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '20px' }}>
              <QRCodeCanvas 
                value={chat.contact?.shadowId || id}
                size={240}
                level="H"
                includeMargin={false}
              />
            </div>
          </div>
          <p style={{ color: 'var(--text-primary)', fontSize: '1.4rem', fontWeight: 800 }}>{displayName}</p>
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
                  backgroundImage: chat.theme?.backgroundImage ? `url(${chat.theme.backgroundImage})` : 'none',
                  backgroundColor: chat.theme?.backgroundColor || 'var(--bg-secondary)',
                  backgroundSize: 'cover', backgroundPosition: 'center',
                  display: 'flex', flexDirection: 'column', padding: '16px', gap: '8px',
                  border: '1px solid var(--border-color)',
                  boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)'
                }}>
                  {/* Mock Messages */}
                  <div style={{ 
                    alignSelf: 'flex-start', padding: '8px 12px', borderRadius: '12px 12px 12px 4px',
                    backgroundColor: chat.theme?.receiverColor || 'rgba(44, 44, 46, 0.85)',
                    backdropFilter: 'blur(10px)', color: '#fff', fontSize: '0.8rem', maxWidth: '80%',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}>
                    Hey! How does the new theme look?
                  </div>
                  <div style={{ 
                    alignSelf: 'flex-end', padding: '8px 12px', borderRadius: '12px 12px 4px 12px',
                    backgroundColor: chat.theme?.senderColor || 'var(--accent-primary)',
                    color: chat.theme?.senderColor ? '#fff' : '#000', fontSize: '0.8rem', maxWidth: '80%',
                    boxShadow: chat.theme?.senderColor ? `0 4px 12px ${chat.theme.senderColor}44` : 'none'
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
                          onClick={() => updateChatTheme(id, { ...chat.theme, senderColor: col })}
                          style={{ 
                            width: '24px', height: '24px', borderRadius: '50%', backgroundColor: col, cursor: 'pointer',
                            border: chat.theme?.senderColor === col ? '2px solid #fff' : 'none',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
                          }} 
                        />
                      ))}
                      <input 
                        type="color" 
                        value={chat.theme?.senderColor || '#00ff88'} 
                        onChange={(e) => updateChatTheme(id, { ...chat.theme, senderColor: e.target.value })}
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
                          onClick={() => updateChatTheme(id, { ...chat.theme, receiverColor: col })}
                          style={{ 
                            width: '24px', height: '24px', borderRadius: '50%', backgroundColor: col, cursor: 'pointer',
                            border: chat.theme?.receiverColor === col ? '2px solid #fff' : 'none',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
                          }} 
                        />
                      ))}
                      <input 
                        type="color" 
                        value={chat.theme?.receiverColor || '#2C2C2E'} 
                        onChange={(e) => updateChatTheme(id, { ...chat.theme, receiverColor: e.target.value })}
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
                      onClick={() => updateChatTheme(id, { ...chat.theme, backgroundImage: wp.val, backgroundColor: wp.color })}
                      style={{ 
                        height: '80px', borderRadius: '12px', cursor: 'pointer', position: 'relative', overflow: 'hidden',
                        border: chat.theme?.backgroundImage === wp.val ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
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
                      updateChatTheme(id, { ...chat.theme, backgroundImage: publicUrl });
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
      <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
        <p>End-to-End Encrypted</p>
        <p>Designed by Shivanshi Singh</p>
      </div>

      {/* Mute Feedback Toast (Premium Styling) */}
      {muteFeedback && (
        <div style={{
          position: 'fixed', bottom: '100px', left: '50%', transform: 'translateX(-50%)',
          backgroundColor: 'rgba(0,0,0,0.85)', color: '#fff', padding: '12px 24px',
          borderRadius: '20px', zIndex: 10000, fontSize: '0.9rem', fontWeight: 600,
          border: '1px solid var(--accent-primary)', boxShadow: '0 4px 15px rgba(0,255,136,0.2)',
          animation: 'fadeIn 0.3s ease-out'
        }}>
          {muteFeedback}
        </div>
      )}



    </div>
  );
}
