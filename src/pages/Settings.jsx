import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  User as UserIcon, 
  Shield as ShieldIcon, 
  Moon as MoonIcon, 
  Sun as SunIcon, 
  Smartphone as SmartphoneIcon, 
  Trash2 as Trash2Icon, 
  Key as KeyIcon, 
  DatabaseBackup as DatabaseBackupIcon, 
  Power as PowerIcon, 
  Edit2 as Edit2Icon, 
  QrCode as QrCodeIcon, 
  Share2 as Share2Icon, 
  Copy as CopyIcon, 
  UserPlus as UserPlusIcon, 
  Bell as BellIcon, 
  MessageCircle as MessageCircleIcon, 
  Check as CheckIcon, 
  X as XIcon, 
  ScanLine as ScanLineIcon, 
  Camera as CameraIcon, 
  Image as ImageIcon,
  Play as PlayIcon, 
  ArrowLeft as ArrowLeftIcon, 
  Fingerprint as FingerprintIcon 
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { supabase } from '../supabaseClient';
import { QRCodeCanvas } from 'qrcode.react';
import { Html5Qrcode } from 'html5-qrcode';

const SettingItem = ({ icon, title, subtitle, onClick, rightElement, danger }) => (
  <div onClick={onClick} className="setting-item" style={{
    display: 'flex',
    alignItems: 'center',
    padding: '16px 20px',
    marginBottom: '8px',
    cursor: onClick ? 'pointer' : 'default'
  }}>
    <div style={{ color: danger ? 'var(--accent-danger)' : 'var(--text-muted)', marginRight: '16px' }}>
      {icon}
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: '1rem', fontWeight: 500, color: danger ? 'var(--accent-danger)' : 'var(--text-primary)' }}>{title}</div>
      {subtitle && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>{subtitle}</div>}
    </div>
    {rightElement && <div>{rightElement}</div>}
  </div>
);

const Toggle = ({ checked, onChange }) => (
  <div onClick={onChange} style={{
    width: '44px',
    height: '24px',
    backgroundColor: checked ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
    borderRadius: '12px',
    position: 'relative',
    cursor: 'pointer',
    transition: 'background-color 0.3s'
  }}>
    <div style={{
      position: 'absolute',
      top: '2px',
      left: checked ? '22px' : '2px',
      width: '20px',
      height: '20px',
      backgroundColor: checked ? '#000' : 'var(--text-muted)',
      borderRadius: '50%',
      transition: 'left 0.3s'
    }} />
  </div>
);

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

export default function Settings() {
  const { 
    user, setUser, theme, setTheme, settings, setSettings, 
    logout, chats, unblockContact, showToast, inviteFriend, loginMockUser,
    broadcastProfileUpdate
  } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  
  useEffect(() => {
    if (user?.name) setEditName(user.name);
  }, [user?.name]);
  
  const queryParams = new URLSearchParams(location.search);
  const [showQRModal, setShowQRModal] = useState(queryParams.get('scan') === 'true');
  const [qrFilter, setQrFilter] = useState(queryParams.get('scan') === 'true' ? 'scan' : 'view'); 
  const [confirmModal, setConfirmModal] = useState(null); // { type: 'logout' | 'clear' }
  const [activeSubView, setActiveSubView] = useState(null); // 'blocked'
  const [isUploadingPic, setIsUploadingPic] = useState(false);

  const [copied, setCopied] = useState(false);
  const avatarInputRef = useRef(null);

  const [isScannerRunning, setIsScannerRunning] = useState(false);
  const [scannerError, setScannerError] = useState(null);
  const scannerRef = useRef(null);

  const stopScanner = async () => {
    if (scannerRef.current && isScannerRunning) {
      try {
        await scannerRef.current.stop();
        setIsScannerRunning(false);
        setScannerError(null);
      } catch (err) {
        console.error('Stop scanner error:', err);
      }
    }
  };

  const startScanner = async () => {
    if (!scannerRef.current) {
      scannerRef.current = new Html5Qrcode("reader");
    }
    
    setScannerError(null);
    try {
      await scannerRef.current.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          stopScanner();
          setShowQRModal(false);
          navigate(`/new-chat?id=${decodedText}`);
        },
        (errorMessage) => {
          // ignore scan noise
        }
      );
      setIsScannerRunning(true);
    } catch (err) {
      console.error('Start scanner error:', err);
      setScannerError('Could not access camera. Please check permissions.');
      setIsScannerRunning(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Stop camera if running
    if (isScannerRunning) {
      await stopScanner();
    }

    if (!scannerRef.current) {
      scannerRef.current = new Html5Qrcode("reader");
    }

    try {
      // 1. First try direct scan
      try {
        const decodedText = await scannerRef.current.scanFile(file, true);
        setShowQRModal(false);
        navigate(`/new-chat?id=${decodedText}`);
        return;
      } catch (e) {
        console.log('Direct scan failed, trying preprocessing...');
      }

      // 2. Preprocessing Fallback: Grayscale + Optimize
      const image = new Image();
      const reader = new FileReader();
      
      reader.onload = (event) => {
        image.onload = async () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // Limit size for better performance/accuracy
          const maxDim = 800;
          let width = image.width;
          let height = image.height;
          
          if (width > height && width > maxDim) {
            height *= maxDim / width;
            width = maxDim;
          } else if (height > maxDim) {
            width *= maxDim / height;
            height = maxDim;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          // Grayscale filter
          ctx.filter = 'grayscale(1) contrast(1.2)';
          ctx.drawImage(image, 0, 0, width, height);
          
          canvas.toBlob(async (blob) => {
            if (!blob) return;
            const processedFile = new File([blob], "processed.png", { type: "image/png" });
            
            try {
              const decodedText = await scannerRef.current.scanFile(processedFile, true);
              setShowQRModal(false);
              navigate(`/new-chat?id=${decodedText}`);
            } catch (err) {
              console.error('Final scan error:', err);
              showToast('Could not find a valid QR code. Try a clearer screenshot.', 'error');
            }
          }, 'image/png');
        };
        image.src = event.target.result;
      };
      reader.readAsDataURL(file);

    } catch (err) {
      console.error('File scan overall error:', err);
      showToast('Error processing image. Try another one.', 'error');
    } finally {
      e.target.value = '';
    }
  };

  useEffect(() => {
    if (showQRModal && qrFilter === 'scan') {
      // Auto-start only if it's explicitly a scan request
      startScanner();
    }
    return () => {
      if (scannerRef.current && isScannerRunning) {
        scannerRef.current.stop().catch(e => console.error(e));
      }
    };
  }, [showQRModal, qrFilter]);

  const handleProfilePicUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. Validation
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file.', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image is too large. Max size 5MB.', 'error');
      return;
    }

    try {
      setIsUploadingPic(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}_${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // 2. Upload to Supabase Storage
      const { error: uploadError } = await supabase
        .storage
        .from('attachments')
        .upload(filePath, file, { 
          upsert: true,
          contentType: file.type 
        });

      if (uploadError) {
        console.error('[ShadowTalk] Upload error:', uploadError);
        const msg = uploadError.message || 'Upload failed';
        showToast(`Upload failed: ${msg}`, 'error');
        return;
      }

      // 3. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('attachments')
        .getPublicUrl(filePath);

      if (!publicUrl) {
        showToast('Failed to retrieve public URL for image.', 'error');
        return;
      }

      // 4. Update user in DB - Use canonical primary key
      const { data: dbUser } = await supabase
        .from('users')
        .select('id')
        .or(`id.eq."${user?.id}",shadow_id.eq."${user?.id}"`)
        .maybeSingle();

      const targetId = dbUser?.id || user?.id;

      const { error: dbError } = await supabase
        .from('users')
        .update({ avatar_url: publicUrl })
        .eq('id', targetId);
      
      if (dbError) {
        console.error('[ShadowTalk] DB Update error:', dbError);
        showToast(`Image uploaded but failed to update profile: ${dbError.message}`, 'error');
        return;
      }

      // 5. Success - Update local state and trigger a deep refresh
      setUser(prev => ({ ...prev, avatarUrl: publicUrl, avatar_url: publicUrl }));
      
      // 6. Broadcast change to contacts
      if (broadcastProfileUpdate) {
        broadcastProfileUpdate({ avatarUrl: publicUrl });
      }

      if (loginMockUser) {
        await loginMockUser(user.name, targetId, user.phrase, true);
      }
      showToast('Profile picture updated!', 'success');
      
    } catch (err) {
      console.error('[ShadowTalk] Unexpected error during upload:', err);
      showToast('An unexpected error occurred.', 'error');
    } finally {
      setIsUploadingPic(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleLogout = () => {
    setConfirmModal({ 
      type: 'logout', 
      title: 'Log Out?', 
      message: 'Are you sure you want to log out? You will need your Identity Key to sign back in.' 
    });
  };

  const handleClearData = () => {
    setConfirmModal({ 
      type: 'clear', 
      title: 'Clear All Local Data?', 
      message: 'This will permanently delete all chats, contacts, and settings on this device. This cannot be undone.' 
    });
  };

  const executeConfirmedAction = () => {
    if (confirmModal.type === 'logout' || confirmModal.type === 'clear') {
      if (confirmModal.type === 'clear') {
        localStorage.clear();
        // Also clear in-memory state if possible, though reload/navigate is safer
        window.location.href = '/splash'; 
        return;
      }
      logout();
      navigate('/splash');
    }
    setConfirmModal(null);
  };

  const toggleSetting = (key) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSaveName = async () => {
    try {
      const { data: dbUser } = await supabase
        .from('users')
        .select('id')
        .or(`id.eq."${user?.id}",shadow_id.eq."${user?.id}"`)
        .maybeSingle();

      const targetId = dbUser?.id || user?.id;

      const { error } = await supabase
        .from('users')
        .update({ name: editName })
        .eq('id', targetId);

      if (error) throw error;
      
      const updatedUser = { ...user, name: editName };
      setUser(updatedUser);
      localStorage.setItem('shadowtalk_user', JSON.stringify(updatedUser)); // Immediate local persistence
      
      if (loginMockUser) {
        await loginMockUser(editName, targetId, user.phrase, true);
      }

      // 5. Broadcast change to contacts
      if (broadcastProfileUpdate) {
        broadcastProfileUpdate({ name: editName });
      }
      
      setIsEditing(false);
      showToast('Profile name updated!', 'success');
    } catch (err) {
      console.error('Save name error:', err);
      showToast('Failed to update name', 'error');
    }
  };

  const handleCancelEdit = () => {
    setEditName(user.name);
    setIsEditing(false);
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(user?.shadowId || user?.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareId = () => {
    inviteFriend();
  };

  const handleInviteFriend = () => {
    inviteFriend();
  };

  return (
    <div className="app-container animate-fade-in" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="screen-header">
        <button className="icon-btn" onClick={() => navigate(-1)} style={{ marginRight: '8px' }}>
          <ArrowLeftIcon size={24} />
        </button>
        <h1 className="header-title" style={{ flex: 1 }}>Settings</h1>
        <div className="header-actions">
          <button className="icon-btn" onClick={() => setIsEditing(true)}>
            <Edit2Icon size={20} />
          </button>
          <button className="icon-btn" onClick={() => setShowQRModal(true)}>
            <QrCodeIcon size={20} />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        
        <div className="glass-box" style={{ 
          padding: '40px 20px', 
          textAlign: 'center', 
          borderRadius: '0 0 32px 32px',
          marginBottom: '20px',
          borderTop: 'none',
          borderLeft: 'none',
          borderRight: 'none'
        }}>
          <div 
            className="avatar" 
            onClick={() => !isUploadingPic && avatarInputRef.current.click()}
            style={{ 
              width: 120, height: 120, margin: '0 auto 12px', fontSize: '3rem', 
              position: 'relative', cursor: 'pointer', overflow: 'hidden',
              border: '2px solid rgba(124, 77, 255, 0.5)',
              boxShadow: '0 0 20px rgba(124, 77, 255, 0.3)',
              background: 'var(--bg-tertiary)',
              transition: 'transform 0.3s ease',
              borderRadius: '50%',
              opacity: isUploadingPic ? 0.7 : 1
            }}
          >
            {user?.avatarUrl || user?.avatar_url ? (
              <img src={user.avatarUrl || user.avatar_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ transform: 'scale(3)' }}>
                <DefaultAvatar name={user.name} size={40} />
              </div>
            )}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              backgroundColor: 'rgba(0,0,0,0.7)', padding: '8px',
              display: 'flex', justifyContent: 'center', alignItems: 'center',
              backdropFilter: 'blur(4px)',
              transition: 'opacity 0.3s',
              opacity: isUploadingPic ? 1 : 0
            }}>
              <div className="spinner" style={{ width: 18, height: 18, borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }} />
            </div>
          </div>
          
          <button 
            className="hoverable" 
            onClick={() => avatarInputRef.current.click()}
            disabled={isUploadingPic}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: 'var(--accent-primary)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              marginBottom: '20px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <CameraIcon size={16} />
            {isUploadingPic ? 'Uploading...' : 'Change Photo'}
          </button>
          <input type="file" ref={avatarInputRef} hidden accept="image/*" onChange={handleProfilePicUpload} />
          
          {isEditing ? (
            <div style={{ marginBottom: '16px' }}>
              <input 
                type="text"
                className="text-input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                style={{ textAlign: 'center', marginBottom: '12px' }}
                autoFocus
              />
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                <button className="btn-secondary" onClick={handleCancelEdit} style={{ padding: '8px 16px', width: 'auto' }}>Cancel</button>
                <button className="btn-primary" onClick={handleSaveName} style={{ padding: '8px 16px', width: 'auto' }}>Save</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.5px' }}>{user.name}</h2>
              <button 
                className="icon-btn" 
                onClick={() => setIsEditing(true)}
                style={{ width: 28, height: 28, backgroundColor: 'rgba(255,255,255,0.05)' }}
              >
                <Edit2Icon size={14} color="var(--accent-primary)" />
              </button>
            </div>
          )}

          <div className="glass-morphism-light" style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '8px', 
            padding: '6px 12px', 
            borderRadius: 'var(--radius-full)',
            marginBottom: '20px',
            border: '1px solid rgba(124, 77, 255, 0.3)'
          }}>
            <FingerprintIcon size={14} color="var(--accent-primary)" />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-primary)', fontFamily: 'monospace' }}>
              {user?.shadowId?.substring(0, 16)}...
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
            <button className="btn-secondary" onClick={handleShareId} style={{ width: 'auto', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
              <Share2Icon size={16} /> Share
            </button>
            <button className="btn-secondary" onClick={handleCopyId} style={{ width: 'auto', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
              {copied ? <CheckIcon size={16} color="var(--accent-primary)" /> : <CopyIcon size={16} />} 
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>



        <div style={{ padding: '20px 20px 8px', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px' }}>
          Appearance
        </div>
        <SettingItem 
          icon={theme === 'dark' ? <MoonIcon size={24} /> : <SunIcon size={24} />} 
          title="Appearance" 
          subtitle={`${theme.charAt(0).toUpperCase() + theme.slice(1)} Mode`}
          onClick={() => navigate('/settings/appearance')}
        />

        <div style={{ padding: '20px 20px 8px', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px' }}>
          Account
        </div>
        <SettingItem 
          icon={<ShieldIcon size={24} />} 
          title="Privacy" 
          subtitle="Manage privacy settings"
          onClick={() => navigate('/settings/privacy')}
        />
        <SettingItem 
          icon={<MessageCircleIcon size={24} />} 
          title="Conversation Settings" 
          subtitle="Manage chats and message behavior"
          onClick={() => navigate('/settings/conversations')}
        />
        <SettingItem 
          icon={<KeyIcon size={24} />} 
          title="Identity Key" 
          subtitle="View your backup key"
          onClick={() => navigate('/settings/recovery-password')}
        />
        <SettingItem 
          icon={<UserPlusIcon size={24} />} 
          title="Invite" 
          subtitle="Share ShadowTalk with friends"
          onClick={handleInviteFriend}
        />
        {/* Backup Data removed as requested */}
        
        <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)' }}>
          <SettingItem 
            icon={<PowerIcon size={24} />} 
            title="Log Out" 
            danger={true}
            onClick={handleLogout}
          />
          <SettingItem 
            icon={<Trash2Icon size={24} />} 
            title="Clear All Local Data" 
            danger={true}
            onClick={handleClearData}
          />
        </div>
        
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          <p>ShadowTalk v1.0.0</p>
          <p>End-to-End Encrypted</p>
          <p>Designed by Shivanshi Singh</p>
        </div>
      </div>

      {/* Blocked Contacts View */}
      {activeSubView === 'blocked' && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'var(--bg-primary)',
          zIndex: 300,
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideInRight 0.3s ease-out'
        }}>
          <div className="screen-header">
            <button className="icon-btn" onClick={() => setActiveSubView(null)}>
              <ArrowLeftIcon size={24} />
            </button>
            <h1 className="header-title">Blocked Contacts</h1>
            <div style={{ width: 40 }} />
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div style={{ padding: '20px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Blocked contacts cannot message you. They will not see your online status or profile updates.
            </div>
            
            {chats.filter(c => c.isBlocked).length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <ShieldIcon size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
                <p>No blocked contacts</p>
              </div>
            ) : (
              chats.filter(c => c.isBlocked).map(chat => (
                <div key={chat.id} style={{ 
                  display: 'flex', alignItems: 'center', padding: '16px 20px', 
                  borderBottom: '1px solid var(--border-color)', gap: '16px' 
                }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {chat.contact?.avatarUrl ? (
                      <img src={chat.contact.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <UserIcon size={20} color="var(--text-muted)" />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{chat.contact?.nickname || chat.contact?.name || 'Unknown'}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{chat.contact?.shadowId || chat.id}</div>
                  </div>
                  <button 
                    onClick={() => unblockContact(chat.id)}
                    style={{ color: 'var(--accent-primary)', fontSize: '0.9rem', fontWeight: 600 }}
                  >
                    Unblock
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQRModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'var(--bg-primary)',
          zIndex: 300,
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideUp 0.3s ease-out'
        }}>
          <div className="screen-header">
            <button className="icon-btn" onClick={async () => {
              await stopScanner();
              setShowQRModal(false);
              navigate('/'); // Navigate to home (chats) instead of -1 to avoid history issues
            }}>
              <XIcon size={24} />
            </button>
            <h1 className="header-title">QR Code</h1>
            <div style={{ width: 40 }} />
          </div>

          <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            {/* Tabs */}
            <div style={{ display: 'flex', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: '4px', marginBottom: '32px' }}>
              <button 
                style={{ flex: 1, padding: '12px', borderRadius: 'var(--radius-sm)', backgroundColor: qrFilter === 'view' ? 'var(--bg-secondary)' : 'transparent', color: qrFilter === 'view' ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: qrFilter === 'view' ? 600 : 400, transition: 'all 0.2s' }}
                onClick={() => setQrFilter('view')}
              >
                View
              </button>
              <button 
                style={{ flex: 1, padding: '12px', borderRadius: 'var(--radius-sm)', backgroundColor: qrFilter === 'scan' ? 'var(--bg-secondary)' : 'transparent', color: qrFilter === 'scan' ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: qrFilter === 'scan' ? 600 : 400, transition: 'all 0.2s' }}
                onClick={() => setQrFilter('scan')}
              >
                Scan
              </button>
            </div>

            {/* Content */}
            {qrFilter === 'view' ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.3s ease-out' }}>
                <div className="glass-box" style={{ 
                  padding: '24px', 
                  borderRadius: '32px', 
                  marginBottom: '32px', 
                  border: 'none'
                }}>
                  <div style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '20px' }}>
                    <QRCodeCanvas value={user?.shadowId || user?.id} size={220} />
                  </div>
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>Your Shadow ID</h3>
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', maxWidth: '80%', fontSize: '0.9rem', marginBottom: '24px' }}>
                  Friends can scan this to add you instantly.
                </p>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                  <button className="btn-secondary" onClick={handleShareId} style={{ width: 'auto', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
                    <Share2Icon size={16} /> Share Link
                  </button>
                  <button className="btn-secondary" onClick={handleCopyId} style={{ width: 'auto', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
                    {copied ? <CheckIcon size={16} color="var(--accent-primary)" /> : <CopyIcon size={16} />} 
                    {copied ? 'Copied' : 'Copy ID'}
                  </button>
                </div>
                <div style={{ 
                  fontFamily: 'monospace', 
                  color: 'var(--accent-primary)', 
                  fontSize: '0.8rem', 
                  padding: '12px 20px',
                  backgroundColor: 'var(--bg-tertiary)',
                  borderRadius: '12px',
                  border: '1px solid rgba(124, 77, 255, 0.2)',
                  wordBreak: 'break-all', 
                  textAlign: 'center' 
                }}>
                  {user?.shadowId || user?.id}
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ 
                  width: '100%', maxWidth: '340px',
                  aspectRatio: '1',
                  borderRadius: '24px', 
                  position: 'relative',
                  overflow: 'hidden',
                  backgroundColor: '#000',
                  boxShadow: '0 0 30px rgba(0,0,0,0.5)',
                  border: isScannerRunning ? '2px solid var(--accent-primary)' : '2px solid var(--border-color)',
                  transition: 'all 0.3s'
                }}>
                  <div id="reader" style={{ width: '100%', height: '100%' }} />
                  
                  {isScannerRunning && (
                    <div style={{
                      position: 'absolute',
                      top: 0, left: 0, right: 0,
                      height: '2px',
                      background: 'linear-gradient(to right, transparent, var(--accent-primary), transparent)',
                      boxShadow: '0 0 10px var(--accent-primary)',
                      zIndex: 10,
                      animation: 'scanLine 3s linear infinite'
                    }} />
                  )}

                  {!isScannerRunning && !scannerError && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 20 }}>
                      <CameraIcon size={48} color="var(--text-muted)" style={{ marginBottom: '16px' }} />
                      <button className="btn-primary" onClick={startScanner} style={{ width: 'auto', padding: '12px 24px' }}>
                        Start Camera
                      </button>
                    </div>
                  )}

                  {scannerError && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 20, padding: '20px', textAlign: 'center' }}>
                      <ShieldIcon size={48} color="var(--accent-danger)" style={{ marginBottom: '16px' }} />
                      <p style={{ color: '#fff', fontSize: '0.9rem', marginBottom: '20px' }}>{scannerError}</p>
                      <button className="btn-secondary" onClick={startScanner} style={{ width: 'auto', padding: '10px 20px' }}>
                        Try Again
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', maxWidth: '340px' }}>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button 
                      className="btn-secondary" 
                      onClick={() => document.getElementById('qr-upload').click()}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px' }}
                    >
                      <ImageIcon size={20} />
                      Upload Image
                    </button>
                    {isScannerRunning && (
                      <button 
                        className="btn-secondary" 
                        onClick={stopScanner}
                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px', color: 'var(--accent-danger)' }}
                      >
                        <XIcon size={20} />
                        Stop
                      </button>
                    )}
                  </div>
                  <input id="qr-upload" type="file" accept="image/*" hidden onChange={handleFileUpload} />
                  
                  <p style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.85rem' }}>
                    Point your camera at a QR code or upload an image from your device.
                  </p>
                </div>
              </div>
            )}
          </div>

          <style>{`
            :root {
          --shadow-glow: 0 0 15px rgba(0, 210, 255, 0.3);
        }
        @keyframes scanLine {
          from { transform: translateY(0); }
          to { transform: translateY(340px); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
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
            <h2 style={{ fontSize: '1.2rem', marginBottom: '12px', color: 'var(--accent-danger)' }}>
              {confirmModal.title}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px', lineHeight: '1.4' }}>
              {confirmModal.message}
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                className="btn-secondary" 
                onClick={() => setConfirmModal(null)}
                style={{ flex: 1, padding: '12px' }}
              >
                Cancel
              </button>
              <button 
                className="btn-primary" 
                onClick={executeConfirmedAction}
                style={{ 
                  flex: 1, 
                  padding: '12px', 
                  backgroundColor: 'var(--accent-danger)',
                  color: '#fff',
                  border: 'none'
                }}
              >
                {confirmModal.type === 'logout' ? 'Log Out' : 'Clear Everything'}
              </button>
            </div>
          </div>
        </div>
      )}
    <style>{`
        #reader video {
          object-fit: cover !important;
          width: 100% !important;
          height: 100% !important;
          border-radius: 24px;
        }
        @keyframes scanLine {
          from { top: 0; }
          to { top: 100%; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
