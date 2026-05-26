import AgoraRTC from 'agora-rtc-sdk-ng';
import { supabase } from '../../supabaseClient';
import { useCallStore } from './store';
import { sendPushNotification } from '../../utils/pushNotification';

class CallService {
  constructor() {
    this.client = null;
    this.localAudioTrack = null;
    this.appId = (import.meta.env.VITE_AGORA_APP_ID || '').trim().replace(/^["'](.+)["']$/, '$1');
    this.channel = null;
    this.shadowChannel = null;
    this.currentUserId = null;
    this.currentShadowId = null;
    this.callSessionId = null;
    this.callTimeout = null;
    this.encryptor = null;
    this.callStartTime = null;
    this.durationInterval = null;
    console.log('[Agora] Service initialized. SDK Version:', AgoraRTC.VERSION);
  }

  setEncryptor(fn) {
    this.encryptor = fn;
  }

  async initialize(userId, shadowId = null) {
    if (this.currentUserId === userId && this.channel) {
      console.log('[Agora] Already initialized for user:', userId);
      return;
    }

    console.log('[Agora] Initializing for user:', userId, shadowId ? `and shadow: ${shadowId}` : '');
    
    // Cleanup existing channels
    if (this.channel) supabase.removeChannel(this.channel);
    if (this.shadowChannel) supabase.removeChannel(this.shadowChannel);
    
    this.currentUserId = userId;
    this.currentShadowId = shadowId;

    // Refresh appId
    const rawId = import.meta.env.VITE_AGORA_APP_ID || '';
    this.appId = rawId.trim().replace(/^["'](.+)["']$/, '$1');

    const setupChannel = (id) => {
      if (!id) return null;
      const chan = supabase.channel(`calling:${id.toLowerCase().trim()}`, {
        config: { broadcast: { self: false } }
      });
      
      chan
        .on('broadcast', { event: 'call-invite' }, (payload) => this.handleIncomingCall(payload))
        .on('broadcast', { event: 'call-accept' }, (payload) => this.handleCallAccepted(payload))
        .on('broadcast', { event: 'call-reject' }, (payload) => this.handleCallRejected(payload))
        .on('broadcast', { event: 'call-busy' }, (payload) => this.handleCallBusy(payload))
        .on('broadcast', { event: 'call-end' }, (payload) => this.handleCallEnded(payload))
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log(`[Signaling] Subscribed to channel: calling:${id}`);
          }
        });
      return chan;
    };

    this.channel = setupChannel(userId);
    if (shadowId && shadowId.toLowerCase() !== userId.toLowerCase()) {
      this.shadowChannel = setupChannel(shadowId);
    }

    // Initialize Agora Client
    this.client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    
    this.client.on('user-published', async (user, mediaType) => {
      await this.client.subscribe(user, mediaType);
      if (mediaType === 'audio') {
        user.audioTrack.play();
        useCallStore.getState().setRemoteAudioTrack(user.audioTrack);
      }
    });

    this.client.on('user-unpublished', (user) => {
      console.log('[Agora] Remote user unpublished');
      if (user.audioTrack) user.audioTrack.stop();
      useCallStore.getState().setRemoteAudioTrack(null);
    });

    this.client.on('user-left', (user) => {
      const remoteName = useCallStore.getState().remoteUser?.name || 'Remote user';
      console.log(`[Agora] User left the channel: ${user.uid} (${remoteName})`);
      
      // If we were connected and they left, end the call
      if (useCallStore.getState().callStatus === 'connected' || useCallStore.getState().callStatus === 'connecting') {
        window.showToast(`Call ended (${remoteName} left)`, 'info');
        this.endCall();
      }
    });

    this.client.on('connection-state-change', (curState, revState, reason) => {
      console.log('[Agora] Connection state changed:', curState, reason);
      if (curState === 'DISCONNECTED' && useCallStore.getState().isCalling) {
        // Handle unexpected disconnect
      }
    });
  }

  // --- Signaling Handlers ---

  async handleIncomingCall(event) {
    const data = event?.payload || event || {};
    const { from, channelName, callerInfo, callType } = data;
    const callSessionId = data.callSessionId || data.sessionId;
    const store = useCallStore.getState();
    const { isCalling } = store;

    console.log(`[Signaling] Incoming call from ${from} for session ${callSessionId} (${callType}). Current isCalling: ${isCalling}`);
    
    // 1. CRITICAL: Handle duplicate invites for the SAME session immediately
    // Moving this to the top prevents race conditions where a second invite arrives before the first one sets this.callSessionId
    if (this.callSessionId === callSessionId) {
      console.log('[Signaling] Ignoring duplicate invite for active session:', callSessionId);
      return;
    }

    if (isCalling) {
      const currentRemoteId = String(store.remoteUser?.id || '').toLowerCase().trim();
      const incomingId = String(from || '').toLowerCase().trim();
      const isSamePerson = currentRemoteId === incomingId;
      const isRinging = store.callStatus === 'ringing';

      // If same person calls again while we're still ringing (stale session), override it
      if (isSamePerson && isRinging) {
        console.log('[Signaling] New call from same person while ringing, overriding stale session');
        this.cleanup();
        // Allow it to proceed and create a new session
      } else {
        console.log(`[Signaling] User is already in a call with ${currentRemoteId}, sending busy to ${incomingId}`);
        this.sendSignaling(from, 'call-busy', { sessionId: callSessionId });
        return;
      }
    }

    // 2. Set session state IMMEDIATELY to prevent race conditions
    // Ensure we never use the string "null"
    const finalSessionId = String(callSessionId || '').trim();
    if (!finalSessionId || finalSessionId === 'null' || finalSessionId === 'undefined') {
      console.error('[Signaling] REJECTING incoming call: invalid sessionId', { callSessionId });
      return;
    }
    console.log('[Signaling] Setting active callSessionId to:', finalSessionId);
    this.callSessionId = finalSessionId;

    // Trigger in-app notification
    if (window.AppContextValue?.addCallNotification) {
      window.AppContextValue.addCallNotification({
        type: 'incoming',
        callType: callType || 'audio',
        from: callerInfo,
        sessionId: callSessionId
      });
    }

    // Show Android drawer notification when app is in background
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
      const callIcon = callType === 'video' ? '📹' : '📞';
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(registration => {
          registration.showNotification(`${callIcon} Incoming ${callType === 'video' ? 'Video' : 'Audio'} Call`, {
            body: `${callerInfo?.name || 'Someone'} is calling you`,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: 'incoming-call',
            renotify: true,
            requireInteraction: true
          });
        }).catch(() => {});
      }
    }

    useCallStore.getState().receiveCall(callerInfo, channelName);
    
    // NOTE: Receiver does NOT create a message record. 
    // They will receive the initiator's record via real-time sync.
    // This ensures senderId is correctly set to the initiator, so the UI shows "Incoming".

    // Auto-end after 40 seconds if not answered
    if (this.callTimeout) clearTimeout(this.callTimeout);
    this.callTimeout = setTimeout(() => {
      if (useCallStore.getState().callStatus === 'ringing') {
        this.updateCallMessage('MISSED', 'Missed call');
        window.AppContextValue?.addCallNotification?.({ type: 'MISSED', from: callerInfo });
        this.endCall(from, 'missed');
      }
    }, 40000);
  }

  async handleCallAccepted(event) {
    clearTimeout(this.callTimeout);
    const data = event?.payload || event || {};
    const { channelName, sessionId } = data;
    const store = useCallStore.getState();

    console.log(`[Signaling] Received call-accept for session ${sessionId}. Current status: ${store.callStatus}`);

    // Session validation
    if (this.callSessionId && sessionId && this.callSessionId !== sessionId) {
      console.log('[Signaling] Ignoring call-accept for different session');
      return;
    }

    if (store.callStatus === 'ringing' && store.isInitiator) {
      console.log('[Signaling] Call accepted, joining channel:', channelName);
      store.setCallStatus('connecting');
      try {
        await this.joinChannel(channelName);
        
        // Race condition check: Did the call end while we were joining?
        if (!useCallStore.getState().isCalling) {
          console.log('[Agora] Call was ended while joining. Cleaning up.');
          this.cleanup();
          return;
        }

        store.setCallStatus('connected');
        this.callStartTime = Date.now();
        this.startDurationTimer();
        this.updateCallMessage('ACCEPTED', 'Call in progress');
      } catch (err) {
        console.error('[Agora] Failed to join after acceptance:', err);
        this.endCall();
      }
    }
  }

  async handleCallRejected(event) {
    clearTimeout(this.callTimeout);
    const store = useCallStore.getState();
    const remoteUser = store.remoteUser;
    
    // Support both direct payload and nested payload.payload
    const data = event?.payload || event || {};
    const sessionId = data.sessionId || data.callSessionId;
    
    console.log(`[Signaling] Received call-reject from ${remoteUser?.id || 'unknown'} for session ${sessionId}`);
    
    // If we have a session ID, verify it matches to avoid closing wrong calls
    if (this.callSessionId && sessionId && this.callSessionId !== sessionId) {
      console.log('[Signaling] Ignoring reject for different session');
      return;
    }

    this.updateCallMessage('REJECTED', 'Rejected audio call');
    window.AppContextValue?.addCallNotification?.({ type: 'REJECTED', from: remoteUser });
    window.showToast('Call declined', 'info');
    this.cleanup();
  }

  async handleCallBusy(event) {
    clearTimeout(this.callTimeout);
    const store = useCallStore.getState();
    const remoteUser = store.remoteUser;
    const data = event?.payload || event || {};
    const sessionId = data.sessionId || data.callSessionId;

    console.log(`[Signaling] Received call-busy from ${remoteUser?.id || 'unknown'} for session ${sessionId}`);

    store.endCall();
    this.updateCallMessage('BUSY', 'User is busy');
    window.AppContextValue?.addCallNotification?.({ type: 'BUSY', from: remoteUser });
    window.showToast('User is busy', 'info');
    this.cleanup();
  }

  handleCallEnded({ payload }) {
    const { sessionId } = payload;
    if (this.callSessionId && sessionId && this.callSessionId !== sessionId) {
      console.log('[Signaling] Ignoring call-end for different session');
      return;
    }
    console.log('[Signaling] Call ended by remote peer');
    clearTimeout(this.callTimeout);
    this.cleanup();
  }

  // --- Actions ---

  async startCall(targetId, type, callerInfo) {
    if (!this.appId) {
      window.showToast('Agora App ID missing. Check .env', 'error');
      return;
    }

    // Use a much shorter channel name to stay well within Agora's 64-byte limit.
    // Format: c_<8-char-random>_<timestamp-ms-last-6>
    const randomPart = Math.random().toString(36).substr(2, 8);
    const timePart = Date.now().toString().slice(-6);
    const channelName = `c_${randomPart}_${timePart}`;

    // Resolve target user profile correctly
    const { chats } = window.AppContextValue || { chats: [] };
    const chat = chats.find(c => String(c.id).toLowerCase() === String(targetId).toLowerCase() || 
                                String(c.contact?.id).toLowerCase() === String(targetId).toLowerCase());
    const targetUser = chat?.contact || { id: targetId, name: 'User' };

    this.callSessionId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    useCallStore.getState().startCall(targetUser, channelName);

    // Create the message record as the initiator.
    // Neutral text allows the UI to prepend "Incoming" or "Outgoing" correctly.
    await this.createCallMessage(targetId, 'call', `${type === 'video' ? 'Video' : 'Audio'} call`, { 
      status: 'CALLING', 
      channelName, 
      call_type: type 
    });

    const { user } = window.AppContextValue || {};
    const myId = user?.id || this.currentUserId;
    
    this.sendSignaling(targetId, 'call-invite', {
      from: myId,
      channelName,
      callType: type,
      callSessionId: this.callSessionId,
      callerInfo: {
        id: myId,
        name: user?.name || 'Someone',
        avatarUrl: user?.avatarUrl
      }
    });

    // Push notification for offline receiver
    sendPushNotification(
      targetId,
      `📞 Incoming ${type === 'video' ? 'Video' : 'Audio'} Call`,
      `${user?.name || 'Someone'} is calling you`,
      { type: 'call', callType: type, callerId: myId }
    );

    // Auto-timeout if no answer (increased to 40 sec)
    if (this.callTimeout) clearTimeout(this.callTimeout);
    this.callTimeout = setTimeout(() => {
      const currentStore = useCallStore.getState();
      if (currentStore.callStatus === 'ringing') {
        window.showToast('No answer', 'info');
        this.updateCallMessage('MISSED', 'Missed call');
        window.AppContextValue?.addCallNotification?.({ type: 'MISSED', from: currentStore.remoteUser });
        this.endCall(targetId, 'missed');
      }
    }, 40000);
  }

  async acceptCall() {
    clearTimeout(this.callTimeout);
    const { channelName, remoteUser } = useCallStore.getState();

    useCallStore.getState().acceptCall();
    useCallStore.getState().setCallStatus('connecting');

    try {
      await this.joinChannel(channelName);
      
      // Race condition check
      if (!useCallStore.getState().isCalling) {
        this.cleanup();
        return;
      }

      const acceptPayload = { channelName, sessionId: this.callSessionId };
      this.sendSignaling(remoteUser.id, 'call-accept', acceptPayload);
      // Send again after a short delay for reliability
      setTimeout(() => this.sendSignaling(remoteUser.id, 'call-accept', acceptPayload), 500);
      setTimeout(() => this.sendSignaling(remoteUser.id, 'call-accept', acceptPayload), 1500);

      useCallStore.getState().setCallStatus('connected');
      this.callStartTime = Date.now();
      this.startDurationTimer();
      this.updateCallMessage('ACCEPTED', 'Call in progress');
    } catch (err) {
      console.error('[Agora] Failed to accept call:', err);
      this.endCall();
    }
  }

  async endCall(targetId, reason = null) {
    const store = useCallStore.getState();
    const id = targetId || store.remoteUser?.id;

    console.log('[CallService] Ending call session...', { status: store.callStatus, isInitiator: store.isInitiator, reason });

    if (store.callStatus === 'ringing' && !store.isInitiator) {
      // Receiver declining manually or missed
      if (reason !== 'missed') {
        this.updateCallMessage('REJECTED', 'Rejected audio call');
      }
      if (id) {
        const payload = { sessionId: this.callSessionId };
        this.sendSignaling(id, 'call-reject', payload);
        setTimeout(() => this.sendSignaling(id, 'call-reject', payload), 500);
      }
      this.cleanup();
      return;
    } else if (store.callStatus === 'connected' && this.callStartTime) {
      // Call ended after connection (either side can trigger this)
      const duration = Math.floor((Date.now() - this.callStartTime) / 1000);
      const formattedDuration = this.formatDuration(duration);
      this.updateCallMessage('ENDED', `Connected call • ${formattedDuration}`, duration);
    } else if (store.callStatus === 'ringing' && store.isInitiator && reason !== 'missed') {
      // Initiator cancelling before pickup
      this.updateCallMessage('CANCELLED', 'Cancelled call');
    }

    if (id) {
      console.log('[CallService] Sending call-end signals to:', id);
      const signalPayload = { sessionId: this.callSessionId };
      this.sendSignaling(id, 'call-end', signalPayload);
      // Send again after a short delay for reliability
      setTimeout(() => this.sendSignaling(id, 'call-end', signalPayload), 500);
      setTimeout(() => this.sendSignaling(id, 'call-end', signalPayload), 1500);
    }
    this.cleanup();
  }

  startDurationTimer() {
    this.stopDurationTimer();
    useCallStore.setState({ callDuration: 0 });
    this.durationInterval = setInterval(() => {
      useCallStore.setState((state) => ({ callDuration: state.callDuration + 1 }));
    }, 1000);
  }

  stopDurationTimer() {
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }
  }

  formatDuration(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  async createCallMessage(targetId, type, text, metadata = {}) {
    if (!this.currentUserId || !targetId || !this.callSessionId) return;

    const myId = this.currentUserId.toLowerCase().trim();
    const otherId = targetId.toLowerCase().trim();
    
    const messageId = this.callSessionId;
    const content = {
      id: messageId,
      type: type,
      text: this.encryptor ? this.encryptor(text, otherId) : text,
      timestamp: Date.now(),
      senderId: myId,
      metadata: {
        ...metadata,
        callSessionId: this.callSessionId,
        call_type: metadata.call_type || 'audio',
        direction: metadata.direction || 'outgoing'
      }
    };

    try {
      await supabase.from('messages').insert({
        id: messageId,
        chat_id: otherId,
        sender_id: myId,
        content: content
      });
    } catch (err) {
      console.error('[CallService] Failed to insert call message:', err);
    }
  }

  async updateCallMessage(status, text, duration = null) {
    // 📸 CAPTURE session ID at start: prevent race condition where this.callSessionId 
    // is cleared by cleanup() while we are awaiting database operations.
    const sessionId = this.callSessionId;
    const normStatus = String(status || '').toUpperCase();
    
    if (!sessionId || sessionId === 'null' || sessionId === '') {
      console.warn('[CallService] updateCallMessage ABORTED: invalid session ID', { id: sessionId, status: normStatus });
      return;
    }

    console.log(`[CallService] Updating message ${sessionId} status to ${normStatus}`);

    const store = useCallStore.getState();
    const myId = (this.currentUserId || '').toLowerCase().trim();
    
    // 🚀 BROADCAST IMMEDIATELY: Ensure the other side sees this UI update
    const targetId = store.remoteUser?.id;
    if (targetId) {
      const chatSub = supabase.channel('db_changes');
      if (chatSub.state === 'joined') {
        chatSub.send({
          type: 'broadcast',
          event: 'CALL_STATUS_UPDATE',
          payload: {
            messageId: sessionId,
            status: normStatus,
            text: text,
            duration: duration !== null ? duration : (store.callDuration || 0),
            targetId: targetId
          }
        }).catch(err => console.warn('[CallService] Broadcast failed:', err));
      }
    }
    
    try {
      // 1. Check for existing message to preserve metadata
      const { data: existingMsg, error: fetchError } = await supabase
        .from('messages')
        .select('*')
        .eq('id', sessionId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      const encryptionKey = existingMsg?.chat_id || targetId;
      const isMine = existingMsg ? (String(existingMsg.sender_id).toLowerCase() === myId) : (status !== 'REJECTED' && status !== 'MISSED');

      const content = existingMsg 
        ? (typeof existingMsg.content === 'string' ? JSON.parse(existingMsg.content) : existingMsg.content)
        : { 
            type: 'call', 
            metadata: { 
              callSessionId: sessionId,
              direction: isMine ? 'outgoing' : 'incoming'
            } 
          };

      const updatedContent = {
        ...content,
        text: this.encryptor ? this.encryptor(text, encryptionKey) : text,
        status: normStatus,
        metadata: {
          ...(content.metadata || {}),
          status: normStatus
        },
        duration: duration !== null ? duration : (content.duration || 0),
        timestamp: content.timestamp || Date.now()
      };

      if (existingMsg) {
        await supabase
          .from('messages')
          .update({ content: updatedContent })
          .eq('id', sessionId);
      } else {
        await supabase.from('messages').insert({
          id: sessionId,
          chat_id: targetId,
          sender_id: isMine ? myId : targetId,
          content: updatedContent
        });
      }
        
      console.log(`[CallService] Call message ${sessionId} persisted to DB as ${normStatus}`);
    } catch (err) {
      console.error('[CallService] Error in updateCallMessage:', err);
    }
  }

  // --- Internals ---

  async joinChannel(channelName) {
    // Re-fetch appId to ensure we have the latest from environment
    const rawId = import.meta.env.VITE_AGORA_APP_ID || '';
    this.appId = rawId.trim().replace(/^["'](.+)["']$/, '$1');

    if (!this.appId || this.appId === 'your_agora_app_id_here') {
      console.error('[Agora] Invalid App ID');
      window.showToast('Agora App ID not configured in .env', 'error');
      this.cleanup();
      return;
    }

    if (!this.currentUserId) {
      console.error('[Agora] Missing currentUserId during join');
      window.showToast('User identification error. Please refresh.', 'error');
      this.cleanup();
      return;
    }

    try {
      // 1. Ensure Channel Name is safe and within limits
      // Agora supports: a-z, A-Z, 0-9, space, and characters like !, #, $, %, &, (, ), +, -, :, ;, <, =, >, ?, @, [, ], ^, _, {, }, |, ~, ,
      // We'll allow alphanumeric and underscores, and cap at 64 bytes.
      const safeChannelName = channelName.replace(/[^a-zA-Z0-9_]/g, '').substring(0, 64);
      
      // 2. Convert UUID to a Numeric UID
      const numericUid = Math.abs(String(this.currentUserId).split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0)) % 1000000;
      
      const maskedAppId = (this.appId || '').substring(0, 5);
      console.log(`[Agora] Joining - AppID: ${maskedAppId}***, Channel: ${safeChannelName}, UID: ${this.currentUserId} (Numeric: ${numericUid})`);

      // Join the channel
      await this.client.join(this.appId, safeChannelName, null, numericUid);
      
      // State Check 1: Did the call end while we were joining?
      if (!useCallStore.getState().isCalling) {
        console.log('[Agora] Call ended during join. Leaving channel.');
        await this.client.leave().catch(() => {});
        return;
      }

      console.log('[Agora] Join successful with numeric UID:', numericUid);

      // 3. Create local audio track with enhanced processing
      this.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack({
        // Optimize for speech with low latency
        encoderConfig: 'speech_low_latency',
        // Enable all built-in processing
        AEC: true, // Acoustic Echo Cancellation
        ANS: true, // Automatic Noise Suppression
        AGC: true, // Automatic Gain Control
        // Some browsers prefer these standard WebRTC property names
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      });

      // State Check 2: Did the call end while creating tracks?
      if (!useCallStore.getState().isCalling) {
        console.log('[Agora] Call ended before publish. Cleaning up.');
        if (this.localAudioTrack) {
          this.localAudioTrack.stop();
          this.localAudioTrack.close();
          this.localAudioTrack = null;
        }
        await this.client.leave().catch(() => {});
        return;
      }

      // Publish the track
      await this.client.publish([this.localAudioTrack]);
      useCallStore.getState().setLocalAudioTrack(this.localAudioTrack);

    } catch (e) {
      // Suppress error toast if the call was intentionally ended/rejected
      if (!useCallStore.getState().isCalling) {
        console.log('[Agora] Suppressing error toast as call has ended:', e.message || e.code);
        return;
      }

      console.error('[Agora] Detailed Error:', e);
      let errorMsg = `Call Error: ${e.message || e.code || 'Failed to connect'}`;

      if (e.code === 'PERMISSION_DENIED' || String(e).includes('Permission denied')) {
        errorMsg = 'Microphone blocked! Please allow microphone access in your browser settings and refresh.';
      } else if (String(e).includes('101') || String(e).includes('dynamic')) {
        errorMsg = 'Agora Auth Error: New project requires "App ID only" mode.';
      }

      window.showToast(errorMsg, 'error', 6000);
      this.endCall();
    }
  }

  async sendSignaling(targetId, event, payload) {
    if (!targetId) return;
    const cleanId = String(targetId).toLowerCase().trim();
    const channelName = `calling:${cleanId}`;
    
    console.log(`[Signaling] Attempting to broadcast ${event} to ${channelName}...`);

    const fullPayload = { 
      ...payload, 
      sessionId: payload.sessionId || payload.callSessionId || this.callSessionId,
      from: this.currentUserId 
    };

    if (this.currentUserId && this.currentUserId.toLowerCase() === cleanId && this.channel) {
      try {
        await this.channel.send({
          type: 'broadcast',
          event,
          payload: fullPayload
        });
      } catch (err) {
        console.error(`[Signaling] Failed to send ${event}:`, err);
      }
      return;
    }

    const txChannel = supabase.channel(channelName);
    txChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[Signaling] Channel SUBSCRIBED. Sending ${event} to ${channelName}`, fullPayload);

        try {
          await txChannel.send({
            type: 'broadcast',
            event, // We send the event name
            payload: fullPayload
          });
          console.log(`[Signaling] ${event} broadcast sent successfully to ${channelName}`);
        } catch (err) {
          console.error(`[Signaling] Failed to send ${event}:`, err);
        } finally {
          // Cleanup the transmission channel quickly
          setTimeout(() => {
            supabase.removeChannel(txChannel);
          }, 1000);
        }
      }
    });
  }

  cleanup() {
    if (this.callTimeout) {
      clearTimeout(this.callTimeout);
      this.callTimeout = null;
    }
    if (this.localAudioTrack) {
      this.localAudioTrack.stop();
      this.localAudioTrack.close();
      this.localAudioTrack = null;
    }
    if (this.client) {
      this.client.leave().catch(() => {});
    }
    useCallStore.getState().endCall();
    this.callStartTime = null;
    this.callSessionId = null;
    this.stopDurationTimer();
    useCallStore.setState({ callDuration: 0 });
  }
}

export const callService = new CallService();
