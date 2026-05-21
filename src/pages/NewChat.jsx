import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, 
  X, 
  ExternalLink, 
  QrCode,
  Share2,
  Copy,
  Check,
  Loader2
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { supabase } from '../supabaseClient';
import { QRCodeCanvas } from 'qrcode.react';

export default function NewChat() {
  const navigate = useNavigate();
  const location = useLocation();
  const { chats, setChats, user, encrypt, showToast, inviteFriend, lastSyncRef } = useAppContext();
  const [copied, setCopied] = useState(false);

  const presetId = location.state?.presetId;
  const autoSubmit = location.state?.autoSubmit;
  
  // Handle URL query params (e.g. ?id=...)
  const queryParams = new URLSearchParams(location.search);
  const scannedId = queryParams.get('id');
  
  const [sessionId, setSessionId] = useState(presetId || scannedId || '');
  const [initialMessage, setInitialMessage] = useState('');
  const [tab, setTab] = useState('Enter Account ID');
  const [isSearching, setIsSearching] = useState(false);
  const [showMsgInput, setShowMsgInput] = useState(false);

  const handleStartChat = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    console.log('[NewChat] handleStartChat triggered', { sessionId, user_id: user?.id });

    if (!sessionId.trim() || isSearching || !user?.id) {
      console.log('[NewChat] Validation failed', { sessionId, isSearching, user_id: user?.id });
      if (!user?.id) showToast('Session expired. Please log in again.', 'error');
      return;
    }
    
    setIsSearching(true);
    console.log('[NewChat] Searching for sender record...');

    try {
      // First: look up the SENDER's actual DB record to get their real primary key
      const { data: senderDbRecord, error: senderLookupError } = await supabase
        .from('users')
        .select('*')
        .or(`id.eq."${user?.id}",shadow_id.eq."${user?.id}"`)
        .maybeSingle();
      
      if (senderLookupError) {
        console.error('[NewChat] Sender lookup error:', senderLookupError);
      }

      // The actual DB primary key for the sender (what the FK constraint requires)
      const senderDbId = senderDbRecord?.id || user?.id;
      console.log('[NewChat] Sender identified:', senderDbId);

      // 1. Search for user in DB (Either by simple ID or long shadow_id)
      console.log('[NewChat] Searching for target user:', sessionId);
      const { data: targetUser, error: searchError } = await supabase
        .from('users')
        .select('*')
        .or(`id.eq."${sessionId.trim()}",shadow_id.eq."${sessionId.trim()}"`)
        .maybeSingle();

      if (searchError) {
        console.error('[NewChat] Search error:', searchError);
        showToast(`Search failed: ${searchError.message}`, 'error');
        setIsSearching(false);
        return;
      }

      if (!targetUser) {
        console.log('[NewChat] Target user not found');
        showToast('User not found. Check the ID.', 'error');
        setIsSearching(false);
        return;
      }

      const receiverDbId = targetUser.id;
      const senderDbIdLower = senderDbId.toLowerCase();
      const receiverDbIdLower = receiverDbId.toLowerCase();
      console.log('[NewChat] IDs identified:', { senderDbId, receiverDbId, senderDbIdLower, receiverDbIdLower });
      
      if (senderDbIdLower === receiverDbIdLower) {
        showToast("You cannot send a connection request to yourself.", "info");
        setIsSearching(false);
        return;
      }

      // 2. Check if already connected (Only skip if it's NOT deleted, rejected or blocked)
      const existing = (chats || []).find(c => {
        const targetId = targetUser?.id?.toLowerCase();
        return c.type === 'direct' && (
          String(c.id).toLowerCase() === targetId || 
          String(c.contact?.id).toLowerCase() === targetId ||
          String(c.contact?.shadowId).toLowerCase() === targetId
        );
      });

      if (existing && 
          existing.status !== 'deleted' && 
          existing.status !== 'rejected' && 
          !existing.isBlockedByOther && 
          !existing.isBlocked && 
          !existing.isDeletedByOther) {
        navigate(`/chat/${existing.id || existing.contact?.id}`);
        return;
      }

      // 3. Check if a request already exists from ME to THEM
      const { data: existingReq, error: checkReqError } = await supabase
        .from('requests')
        .select('*')
        .eq('sender_id', senderDbId)
        .eq('receiver_id', targetUser?.id)
        .maybeSingle();

      if (checkReqError) console.error('Check request error:', checkReqError);

      if (existingReq && existingReq.status === 'pending') {
        console.log('[NewChat] Pending request already exists, ensuring chat record is updated...');
        // We will continue to update chats instead of returning
      }

      // 3.5 Check if they already sent ME a request
      const { data: inverseReq } = await supabase
        .from('requests')
        .select('*')
        .eq('sender_id', targetUser?.id)
        .eq('receiver_id', senderDbId)
        .maybeSingle();

      if (inverseReq && inverseReq.status === 'pending') {
        console.log('[NewChat] Inverse pending request already exists, ensuring chat record is updated...');
        // We will continue to update chats instead of returning
      }

      // 3.6 Check if either side is blocked
      const { data: blockerCheck } = await supabase
        .from('chats')
        .select('chat_data')
        .eq('owner_id', receiverDbId)
        .eq('chat_id', senderDbId)
        .maybeSingle();
      
      if (blockerCheck?.chat_data?.isBlocked) {
        console.log('[NewChat] I am blocked by them');
        showToast('This user is not accepting requests right now.', 'error');
        setIsSearching(false);
        return;
      }

      const { data: selfBlockCheck } = await supabase
        .from('chats')
        .select('chat_data')
        .eq('owner_id', senderDbId)
        .eq('chat_id', receiverDbId)
        .maybeSingle();

      if (selfBlockCheck?.chat_data?.isBlocked) {
        console.log('[NewChat] I blocked them');
        showToast('You have blocked this contact. Unblock them first.', 'error');
        setIsSearching(false);
        return;
      }
      
      // 3.7 Check for group restriction (allow_member_dm = false)
      const isSelfMessage = user.id.toLowerCase() === receiverDbId.toLowerCase() ||
                            (user.shadowId && user.shadowId.toLowerCase() === receiverDbId.toLowerCase());

      const blockingGroup = !isSelfMessage ? (chats || []).find(c => {
        if (!c || c.type !== 'group') return false;
        const isDisabled = c.allow_member_dm === false || c.allowMemberDMs === false;
        if (!isDisabled) return false;

        const myId = user.id.toLowerCase();
        const myShadowId = user.shadowId ? user.shadowId.toLowerCase() : null;
        const otherId = receiverDbId.toLowerCase();
        const otherShadowId = targetUser.shadow_id ? targetUser.shadow_id.toLowerCase() : null;

        const myMatch = (c.members || []).some(m => m && (
          String(m.id).toLowerCase() === myId ||
          String(m.shadowId).toLowerCase() === myId ||
          (myShadowId && String(m.id).toLowerCase() === myShadowId) ||
          (myShadowId && String(m.shadowId).toLowerCase() === myShadowId)
        ));
        const otherMatch = (c.members || []).some(m => m && (
          String(m.id).toLowerCase() === otherId ||
          String(m.shadowId).toLowerCase() === otherId ||
          (otherShadowId && String(m.id).toLowerCase() === otherShadowId) ||
          (otherShadowId && String(m.shadowId).toLowerCase() === otherShadowId)
        ));

        const isSelfAdmin = String(c.adminId).toLowerCase() === myId ||
                            (myShadowId && String(c.adminId).toLowerCase() === myShadowId) ||
                            (c.members || []).some(m => m && (String(m.id).toLowerCase() === myId || (myShadowId && String(m.id).toLowerCase() === myShadowId)) && m.role === 'admin');
        const isOtherAdmin = String(c.adminId).toLowerCase() === otherId ||
                             (otherShadowId && String(c.adminId).toLowerCase() === otherShadowId) ||
                             (c.members || []).some(m => m && (String(m.id).toLowerCase() === otherId || (otherShadowId && String(m.id).toLowerCase() === otherShadowId)) && m.role === 'admin');

        return myMatch && otherMatch && !isSelfAdmin && !isOtherAdmin;
      }) : null;

      if (blockingGroup) {
        console.log('[NewChat] DM restricted by group admin');
        showToast('The group admin has disabled DMs between members.', 'error');
        setIsSearching(false);
        return;
      }

      console.log('[NewChat] Upserting request record...');
      const { error: reqError } = await supabase
        .from('requests')
        .upsert({
          sender_id: senderDbId,
          receiver_id: receiverDbId,
          status: 'pending'
        }, { onConflict: 'sender_id, receiver_id' });

      if (reqError) {
        console.error('[NewChat] Request upsert error:', reqError);
        if (reqError.code === '23505') {
          console.log('[NewChat] Duplicate request (23505)');
          if (existingReq) {
            console.log('[NewChat] Request already exists in DB, ensuring chat status is pending...');
            // We will continue to the chat-update logic below instead of returning
          }
        } else {
          showToast(`Failed to send request: ${reqError.message}`, 'error');
          setIsSearching(false);
          return;
        }
      }
      console.log('[NewChat] Request upserted successfully');

      // 4. Create a "Pending" chat for SENDER
      const trimmedMsg = (initialMessage || '').trim();
      console.log('[NewChat] Creating pending chat entries...', { trimmedMsg });

      const senderChat = existing ? {
        ...existing,
        status: 'pending_sent',
        isDeletedByMe: false,
        isDeletedByOther: false, // Start fresh
        lastActivity: Date.now()
      } : {
        id: receiverDbIdLower, 
        type: 'direct',
        status: 'pending_sent', 
        clearedAt: 0, // Ensure initial message is visible regardless of clock skew
        contact: { 
          id: receiverDbIdLower, 
          shadowId: targetUser.shadow_id,
          name: targetUser.name || 'ShadowTalk User', 
          isOnline: false 
        },
        messages: [],
        unreadCount: 0,
        lastActivity: Date.now()
      };
      
      // 5. Create or Update "Pending" chat for RECEIVER
      const { data: existingReceiverRecord } = await supabase
        .from('chats')
        .select('id, chat_data')
        .eq('owner_id', receiverDbIdLower)
        .eq('chat_id', senderDbIdLower)
        .maybeSingle();

      const receiverChat = existingReceiverRecord?.chat_data ? {
        ...existingReceiverRecord.chat_data,
        status: 'pending_received',
        isDeletedByMe: false, // User B is receiving, so they aren't "deleted" anymore
        isDeletedByOther: false,
        unreadCount: trimmedMsg ? (existingReceiverRecord.chat_data.unreadCount || 0) + 1 : (existingReceiverRecord.chat_data.unreadCount || 0),
        lastActivity: Date.now()
      } : {
        id: senderDbIdLower,
        type: 'direct',
        status: 'pending_received',
        isDeletedByMe: false,
        isDeletedByOther: false,
        contact: {
          id: senderDbIdLower,
          shadowId: user?.shadowId || user?.id,
          name: user?.name || 'Anonymous',
          isOnline: true
        },
        messages: [],
        unreadCount: trimmedMsg ? 1 : 0,
        lastActivity: Date.now()
      };

      console.log('[NewChat] Persisting metadata to Supabase...');
      const { error: senderChatError } = await supabase.from('chats').upsert({
        id: existing?.dbRowId, // IMPORTANT: Use internal ID if it exists!
        owner_id: senderDbIdLower,
        chat_id: receiverDbIdLower,
        chat_data: senderChat
      });
      
      if (senderChatError) console.error('[NewChat] Sender chat error:', senderChatError);

      const { error: receiverChatError } = await supabase.from('chats').upsert({
        id: existingReceiverRecord?.id, // IMPORTANT: Use internal ID if it exists!
        owner_id: receiverDbIdLower,
        chat_id: senderDbIdLower,
        chat_data: receiverChat
      });

      if (receiverChatError) {
        console.error('[NewChat] Receiver chat upsert error:', receiverChatError);
      }

      // Update sync cooldown to prevent immediate overwrite by background fetch
      if (lastSyncRef) lastSyncRef.current = Date.now();

      // 6. Insert initial message into atomic table if exists
      if (trimmedMsg) {
        console.log('[NewChat] Sending initial message...');
        const msgId = `m_${Date.now()}`;
        const encryptedText = encrypt(trimmedMsg, receiverDbIdLower);
        
        const { error: msgError } = await supabase.from('messages').insert({
          id: msgId,
          chat_id: receiverDbIdLower,
          sender_id: senderDbIdLower,
          content: {
            id: msgId,
            text: encryptedText,
            senderId: senderDbIdLower,
            timestamp: Date.now(),
            status: 'sent'
          }
        });
        if (msgError) console.error('[NewChat] Initial message error:', msgError);
      } else {
        console.log('[NewChat] Sending system connection message...');
        // System message for connection request (unencrypted)
        const sysId = `sys_${Date.now()}`;
        const { error: sysError } = await supabase.from('messages').insert({
          id: sysId,
          chat_id: receiverDbIdLower,
          sender_id: 'system',
          content: {
            id: sysId,
            text: encrypt(`${user?.name || 'Someone'} wants to connect with you.`, receiverDbIdLower),
            senderId: 'system',
            partnerId: user.id, // CRITICAL: Identify the partner for the receiver
            timestamp: Date.now()
          }
        });
        if (sysError) console.error('[NewChat] System message error:', sysError);
      }

      // 📡 7. Broadcast new request to receiver for real-time update
      const privacyChannel = supabase.channel(`privacy_${receiverDbIdLower}`);
      privacyChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await privacyChannel.send({
            type: 'broadcast',
            event: 'status_change',
            payload: { userId: user.id, status: 'pending_received' }
          });
          setTimeout(() => supabase.removeChannel(privacyChannel), 3000);
        }
      });

      setChats(prev => {
        const filtered = (prev || []).filter(c => c.id !== senderChat.id);
        return [senderChat, ...filtered];
      });
      showToast('Request sent!', 'success');
      
      console.log('[NewChat] Navigating to:', senderChat.id);
      // Ensure we use the partner's ID for navigation
      const navId = senderChat.contact?.id || senderChat.id;
      navigate(`/chat/${navId}`, { replace: true });
    } catch (err) {
      console.error('NewChat catch block:', err);
      showToast(`An unexpected error occurred: ${err.message || 'Check console'}`, 'error');
    } finally {
      setIsSearching(false);
    }
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(user?.shadowId || user?.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (presetId && autoSubmit && !isSearching) {
      handleStartChat({ preventDefault: () => {} });
    }
  }, [presetId, autoSubmit]);
  return (
    <div className="app-container animate-fade-in" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="screen-header">
        <button className="icon-btn hoverable glass-box" onClick={() => navigate(-1)} style={{ margin: '0 -10px', border: 'none' }}>
          <ArrowLeft size={24} />
        </button>
        <span className="header-title">New Message</span>
        <button className="icon-btn hoverable glass-box" onClick={() => navigate('/chats')} style={{ margin: '0 -10px', border: 'none' }}>
          <X size={24} />
        </button>
      </div>

      <div className="glass-box" style={{ display: 'flex', border: 'none', margin: '16px 20px', borderRadius: '16px', padding: '4px' }}>
        <button 
          className="hoverable"
          style={{ flex: 1, padding: '12px', background: tab === 'Enter Account ID' ? 'var(--accent-primary)' : 'transparent', border: 'none', color: tab === 'Enter Account ID' ? '#000' : 'var(--text-muted)', borderRadius: '12px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
          onClick={() => setTab('Enter Account ID')}
        >
          Enter ID
        </button>
        <button 
          className="hoverable"
          style={{ flex: 1, padding: '12px', background: tab === 'Scan QR Code' ? 'var(--accent-primary)' : 'transparent', border: 'none', color: tab === 'Scan QR Code' ? '#000' : 'var(--text-muted)', borderRadius: '12px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
          onClick={() => setTab('Scan QR Code')}
        >
          Scan QR
        </button>
      </div>

      <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {tab === 'Enter Account ID' && (
          <form onSubmit={handleStartChat} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: '24px' }}>
              <div className="glass-box" style={{ 
                padding: '20px 16px',
                marginBottom: '16px',
                transition: 'all 0.3s',
                border: 'none'
              }}>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 700, marginBottom: '8px', display: 'block' }}>Recipient ID</label>
                <input 
                  type="text" 
                  placeholder="Enter Account ID or ONS" 
                  value={sessionId}
                  onChange={(e) => {
                    setSessionId(e.target.value);
                    if (e.target.value.length > 5) setShowMsgInput(true);
                  }}
                  style={{ 
                    width: '100%', 
                    background: 'transparent', 
                    border: 'none', 
                    color: '#fff', 
                    outline: 'none', 
                    fontSize: '1rem' 
                  }}
                  autoFocus
                />
              </div>

              {showMsgInput && (
                <div className="glass-box" style={{ 
                  padding: '20px 16px',
                  marginBottom: '16px',
                  animation: 'slideDown 0.3s ease-out',
                  border: 'none'
                }}>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 700, marginBottom: '8px', display: 'block' }}>Initial Message</label>
                  <textarea 
                    placeholder="Say something to introduce yourself..." 
                    value={initialMessage}
                    onChange={(e) => setInitialMessage(e.target.value)}
                    style={{ 
                      width: '100%', 
                      background: 'transparent', 
                      border: 'none', 
                      color: '#fff', 
                      outline: 'none', 
                      fontSize: '1rem',
                      resize: 'none',
                      minHeight: '80px'
                    }}
                  />
                </div>
              )}
              
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: '1.5', padding: '0 20px' }}>
                Start a new conversation by entering your friend's Account ID, ONS or scanning their QR code. <ExternalLink size={12} style={{ display: 'inline', marginBottom: '-2px' }} />
              </p>
            </div>

            <div style={{ marginTop: 'auto', marginBottom: '20px', display: 'flex', justifyContent: 'center' }}>
              <button 
                type="submit" 
                disabled={!sessionId.trim() || isSearching}
                style={{ 
                  width: '100%', maxWidth: '300px', padding: '14px', borderRadius: '30px', 
                  backgroundColor: sessionId.trim() ? 'var(--accent-primary)' : 'transparent', 
                  border: sessionId.trim() ? 'none' : '1px solid #666',
                  color: sessionId.trim() ? '#000' : '#666', fontSize: '1rem', fontWeight: 600,
                  cursor: sessionId.trim() ? 'pointer' : 'default',
                  opacity: sessionId.trim() ? 1 : 0.5,
                  transition: 'all 0.3s'
                }}
              >
                {isSearching ? 'Processing...' : 'Send Request'}
              </button>
            </div>
          </form>
        )}
        
        {tab === 'Scan QR Code' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 20px' }}>
            <div style={{ 
              backgroundColor: '#fff', 
              padding: '20px',
              borderRadius: '24px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              marginBottom: '24px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
            }}>
              <QRCodeCanvas value={user?.shadowId || user?.id || ''} size={180} />
            </div>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Your ShadowTalk QR</h2>
            
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
              <button 
                className="btn-secondary" 
                onClick={() => inviteFriend()} 
                style={{ width: 'auto', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}
              >
                <Share2 size={14} /> Share Link
              </button>
              <button 
                className="btn-secondary" 
                onClick={handleCopyId} 
                style={{ width: 'auto', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}
              >
                {copied ? <Check size={14} color="var(--accent-primary)" /> : <Copy size={14} />} 
                {copied ? 'Copied' : 'Copy ID'}
              </button>
            </div>

            <p style={{ color: '#aaa', fontSize: '0.8rem', marginBottom: '32px', wordBreak: 'break-all', fontFamily: 'monospace', maxWidth: '280px' }}>
              {user?.shadowId || user?.id}
            </p>
            <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '32px', lineHeight: '1.4' }}>
              Show this code to a friend or scan theirs to instantly connect securely.
            </p>
            <button 
              className="btn-primary" 
              onClick={() => navigate('/settings?scan=true')}
              style={{ padding: '16px 32px', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', width: 'auto' }}
            >
              <QrCode size={20} />
              Open Camera Scanner
            </button>
          </div>
        )}
      </div>

      {isSearching && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10000,
        }}>
          <div className="glass-box" style={{
            padding: '32px',
            borderRadius: '24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            maxWidth: '320px',
            width: '90%',
            textAlign: 'center'
          }}>
            <Loader2 size={36} className="animate-spin" style={{ color: 'var(--accent-primary)' }} />
            <div>
              <h3 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 600, marginBottom: '8px' }}>Processing</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.4' }}>
                Please wait while we process your request. This may take a few seconds.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
