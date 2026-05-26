import React, { useState, useEffect, useRef } from 'react';
import { Phone as PhoneIcon, Video as VideoIcon, VideoOff, Mic as MicIcon, MicOff, Volume2 as Volume2Icon, VolumeX as VolumeXIcon, X as XIcon, User as UserIcon, Plus as PlusIcon, Check as CheckIcon, PhoneMissed, PhoneForwarded, Clock as ClockIcon, ShieldAlert as ShieldAlertIcon, RefreshCw, ShieldCheck as ShieldCheckIcon } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { supabase } from '../supabaseClient';

// Helper: Format call duration
const formatCallTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// Twilio Credentials (loaded from environment variables)
const TWILIO_SID = import.meta.env.VITE_TWILIO_SID;
const TWILIO_TOKEN = import.meta.env.VITE_TWILIO_TOKEN;

export default function CallScreen() {
  const { isCalling, callData, endCall, user, chats, showToast, setChats } = useAppContext();
  const [callStatus, setCallStatus] = useState('Calling...');
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [callTime, setCallTime] = useState(0);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [hasAccepted, setHasAccepted] = useState(false);

  // Sync hasAccepted with callData (especially for initiator)
  useEffect(() => {
    if (callData?.isInitiator) {
      setHasAccepted(true);
    }
  }, [callData]);
  const [error, setError] = useState(null);
  const [signalingStatus, setSignalingStatus] = useState('');
  const [debugInfo, setDebugInfo] = useState('');
  const [durationLogged, setDurationLogged] = useState(false);
  const [facingMode, setFacingMode] = useState('user');
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  
  const ringtoneRef = useRef(null);
  const callingToneRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const userCallsChannelRef = useRef(null);
  const remoteChannelRef = useRef(null);
  const timeoutRef = useRef(null);
  const callRecordIdRef = useRef(null);
  const iceCandidateQueue = useRef(callData?.initialCandidates || []);
  const peerReadyRef = useRef(false);
  const bufferedCandidatesRef = useRef([]);
  const resendIntervalRef = useRef(null);
  const isCallingRef = useRef(isCalling);
  const callEndedRef = useRef(false); // Synchronous kill switch — set immediately on end
  useEffect(() => { isCallingRef.current = isCalling; }, [isCalling]);

  const [iceConfig, setIceConfig] = useState({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:stun.services.mozilla.com' },
      { urls: 'stun:stun.stunprotocol.org' },
    ],
    iceCandidatePoolSize: 10,
    iceTransportPolicy: 'all'
  });

  const isVideo = false; // Force audio-only mode

  

  useEffect(() => {
    if (!isCalling || !callData || !user) return;

    // 1. Initialize Signaling (Global Channel)
    const signalingChannel = supabase.channel('shadowtalk-global-signaling')
      .on('broadcast', { event: 'call-busy' }, ({ payload }) => {
        if (payload.targetId === user.id || payload.targetId === user.shadowId) {
          setCallStatus('User is Busy');
          setTimeout(() => handleEndCall(true, 'declined'), 1000);
        }
      })
      .on('broadcast', { event: 'call-declined' }, ({ payload }) => {
        if (payload.targetId === user.id || payload.targetId === user.shadowId) {
          setCallStatus('Call Declined');
          handleEndCall(true, 'declined');
        }
      })
      .on('broadcast', { event: 'end-call' }, ({ payload }) => {
        if (payload.targetId === user.id || payload.targetId === user.shadowId) {
          setCallStatus('Call Ended');
          handleEndCall(true, 'remote');
        }
      })
      .on('broadcast', { event: 'call-canceled' }, ({ payload }) => {
        if (payload.targetId === user.id || payload.targetId === user.shadowId) {
          setCallStatus('Canceled');
          handleEndCall(true, 'remote-cancel');
        }
      })
      .on('broadcast', { event: 'call-answer' }, async ({ payload }) => {
        if (payload.targetId === user.id || payload.targetId === user.shadowId) {
          if (pcRef.current && payload.sdp && !hasAccepted) {
            console.log('[ShadowTalk] Answer Received!');
            try {
              await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
              setHasAccepted(true);
              setCallStatus('00:00');
            } catch (e) { console.error('Answer set failed:', e); }
          }
        }
      })
      .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        if (payload.targetId === user.id || payload.targetId === user.shadowId) {
          if (payload.candidate && pcRef.current && pcRef.current.remoteDescription) {
             try {
               await pcRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
             } catch (e) { console.warn('ICE fail:', e); }
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(signalingChannel); };
  }, [isCalling, callData, user, hasAccepted]);

  // Handle Call Initialization (Media + WebRTC)
  useEffect(() => {
    if (isCalling && !pcRef.current && (callData?.isInitiator || hasAccepted)) {
      initCall();
    }
  }, [isCalling, hasAccepted]);

  // ── KILL SWITCH: Stop retry interval the moment isCalling turns false from outside ──
  useEffect(() => {
    if (!isCalling) {
      callEndedRef.current = true;
      if (resendIntervalRef.current) {
        clearInterval(resendIntervalRef.current);
        resendIntervalRef.current = null;
      }
    }
  }, [isCalling]);

  // Ensure cleanup on component unmount
  useEffect(() => {
    return () => {
      callEndedRef.current = true;
      if (resendIntervalRef.current) {
        clearInterval(resendIntervalRef.current);
        resendIntervalRef.current = null;
      }
    };
  }, []); // Handle UI State & Call Timeouts
  // Handle UI State & Call Timeouts
  useEffect(() => {
    if (!isCalling || !callData) return;

    if (callData.isInitiator) {
      setHasAccepted(true);
      setCallStatus('Ringing...');
      timeoutRef.current = setTimeout(() => {
        setCallStatus('No Answer');
        handleEndCall(true, 'timeout');
      }, 45000);
    } else {
      setCallStatus('Incoming Call...');
      timeoutRef.current = setTimeout(() => {
        if (!hasAccepted) handleEndCall(true, 'timeout');
      }, 60000);
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isCalling, callData]);

  // Handle Call Tones
  useEffect(() => {
    if (!isCalling || !callData) {
      if (callingToneRef.current) { callingToneRef.current.pause(); callingToneRef.current = null; }
      if (ringtoneRef.current) { ringtoneRef.current.pause(); ringtoneRef.current = null; }
      return;
    }

    if (callData.isInitiator) {
      if (callStatus === 'Ringing...' || callStatus === 'Connecting...') {
        if (!callingToneRef.current) {
          callingToneRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/1358/1358-preview.mp3');
          callingToneRef.current.loop = true;
          callingToneRef.current.play().catch(() => {});
        }
      } else {
        if (callingToneRef.current) {
          callingToneRef.current.pause();
          callingToneRef.current = null;
        }
      }
    } else {
      if (!hasAccepted && callStatus === 'Incoming Call...') {
        if (!ringtoneRef.current) {
          ringtoneRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/1359/1359-preview.mp3');
          ringtoneRef.current.loop = true;
          ringtoneRef.current.play().catch(() => {});
        }
      } else {
        if (ringtoneRef.current) {
          ringtoneRef.current.pause();
          ringtoneRef.current = null;
        }
      }
    }
  }, [isCalling, callData, callStatus, hasAccepted]);
  // Duration Timer
  useEffect(() => {
    let interval;
    const activeStates = ['00:00', 'Connected'];
    const isDurationState = activeStates.includes(callStatus) || (!isNaN(parseInt(callStatus)) && !callStatus.includes(' '));
    
    if (isDurationState) {
      interval = setInterval(() => {
        setCallTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [callStatus]);

  // Helper to strip heavy SDP to fit Supabase limits
  const optimizeSDP = (sdp) => {
    if (!sdp || !sdp.sdp) return sdp;
    let s = sdp.sdp;
    // Strip ONLY metadata (extmap) to keep payload small but valid
    s = s.split('\r\n').filter(line => 
      !line.startsWith('a=extmap:') &&
      !line.startsWith('a=msid-semantic:')
    ).join('\r\n');
    return { type: sdp.type, sdp: s };
  };

  const initCall = async () => {
    if (pcRef.current) return;
    callEndedRef.current = false; // Reset kill switch for new call
    try {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setSignalingStatus('Initializing...');

      // 1. Capture Media First
      if (!localStreamRef.current) {
        try {
          setSignalingStatus('Accessing Camera/Mic...');
          const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }, 
            video: callData.type === 'video' ? { facingMode, width: { ideal: 640 }, height: { ideal: 480 } } : false 
          });
          localStreamRef.current = stream;
          if (callData.type === 'video' && localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
        } catch (mediaErr) {
          console.error('Media error:', mediaErr);
          setSignalingStatus('Media Permission Denied');
          throw mediaErr;
        }
      }

      // 2. Fetch Twilio Relay with 4s Fast Timeout
      let currentIceConfig = { ...iceConfig };
      try {
        setSignalingStatus('Optimizing Path...');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        
        const response = await fetch(
          `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Tokens.json`)}`,
          {
            method: 'POST',
            signal: controller.signal,
            headers: { 'Authorization': 'Basic ' + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`) }
          }
        );
        clearTimeout(timeoutId);
        if (response.ok) {
          const data = await response.json();
          if (data.ice_servers) {
            currentIceConfig.iceServers = [...currentIceConfig.iceServers, ...data.ice_servers];
            setIceConfig(currentIceConfig);
            setDebugInfo('Relay: OK');
          }
        }
      } catch (err) {
        console.warn('Relay skip:', err.message);
        setDebugInfo('Relay: Skipped');
      }

      // 3. Setup Peer Connection
      const pc = new RTCPeerConnection(currentIceConfig);
      pcRef.current = pc;
      setSignalingStatus('Negotiating...');

      // Add local tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));
      }

      // 4. WebRTC Handlers
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const chan = supabase.channel('shadowtalk-global-signaling');
          chan.send({
            type: 'broadcast',
            event: 'ice-candidate',
            payload: { 
              targetId: callData.remoteId, 
              candidate: event.candidate, 
              from: user.id 
            }
          });
        }
      };

      pc.ontrack = (event) => {
        const remoteStream = event.streams[0] || new MediaStream([event.track]);
        if (callData.type === 'video') {
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
        } else {
          if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream;
        }
        setCallStatus('Connected');
        updateCallRecord('accepted');
      };

      pc.onconnectionstatechange = () => {
        console.log('[WebRTC] State:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          setCallStatus('00:00');
        } else if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
          setTimeout(() => {
            if (pcRef.current && ['failed', 'closed'].includes(pcRef.current.connectionState)) {
              handleEndCall(true, 'remote-drop');
            }
          }, 5000);
        }
      };

      // 5. Signaling (Initiator vs Receiver)
      if (callData.isInitiator) {
        const offer = await pc.createOffer();
        const optimizedOffer = optimizeSDP(offer);
        await pc.setLocalDescription(offer);

        const broadcastOffer = async () => {
          const chan = supabase.channel('shadowtalk-global-signaling');
          await chan.send({
            type: 'broadcast',
            event: 'call-offer',
            payload: {
              targetId: callData.remoteId,
              type: callData.type,
              sender: { id: user.id, name: user.name, avatarUrl: user.avatarUrl, shadowId: user.shadowId },
              senderId: user.id,
              sdp: optimizedOffer,
              timestamp: Date.now()
            }
          });
          setSignalingStatus('Ringing...');
        };

        // Resend every 2s until connected, ended, or killed
        broadcastOffer();
        if (resendIntervalRef.current) clearInterval(resendIntervalRef.current);
        resendIntervalRef.current = setInterval(() => {
          // callEndedRef is set synchronously on end - most reliable check
          if (callEndedRef.current || pc.connectionState === 'connected' || pc.connectionState === 'failed') {
            clearInterval(resendIntervalRef.current);
            resendIntervalRef.current = null;
            return;
          }
          console.log('[ShadowTalk] Resending offer...');
          broadcastOffer();
        }, 2000);
        // Hard stop after 40s regardless
        setTimeout(() => {
          if (resendIntervalRef.current) {
            clearInterval(resendIntervalRef.current);
            resendIntervalRef.current = null;
          }
        }, 40000);
      } else if (callData.sdp) {
        // Receiver setup
        await pc.setRemoteDescription(new RTCSessionDescription(callData.sdp));
        const answer = await pc.createAnswer();
        const optimizedAnswer = optimizeSDP(answer);
        await pc.setLocalDescription(answer);

        const sendAnswer = async () => {
          const chan = supabase.channel('shadowtalk-global-signaling');
          await chan.send({
            type: 'broadcast',
            event: 'call-answer',
            payload: { 
              targetId: callData.remoteId,
              sdp: optimizedAnswer, 
              from: user.id 
            }
          });
          setSignalingStatus('Answer Sent');
        };

        sendAnswer();
        setTimeout(sendAnswer, 1000); // Resend once for reliability
      }

    } catch (err) {
      console.error('Call initialization failed:', err);
      setCallStatus('Call Error');
      setTimeout(() => handleEndCall(true, 'error'), 3000);
    }
  };

  const cleanup = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current = null;
    }
    if (callingToneRef.current) {
      callingToneRef.current.pause();
      callingToneRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (userCallsChannelRef.current) {
      supabase.removeChannel(userCallsChannelRef.current);
    }
    if (remoteChannelRef.current) {
      supabase.removeChannel(remoteChannelRef.current);
    }
    if (resendIntervalRef.current) {
      clearInterval(resendIntervalRef.current);
      resendIntervalRef.current = null;
    }
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
  };

  const handleEndCall = async (immediate = false, intent = null, forcedDuration = null) => {
    // Kill the retry interval SYNCHRONOUSLY first — before any async work or state updates
    callEndedRef.current = true;
    if (resendIntervalRef.current) {
      clearInterval(resendIntervalRef.current);
      resendIntervalRef.current = null;
    }

    if (!immediate && !intent) {
      setCallStatus('Blocked Accidental Drop');
      return;
    }
    
    // Instantly stop audio/video tracks to cut perception immediately
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (remoteAudioRef.current) remoteAudioRef.current.pause();
    if (remoteVideoRef.current) remoteVideoRef.current.pause();
    
    const isError = callStatus.includes('Error') || callStatus === 'No Answer' || callStatus === 'User is Busy';
    const isConnectedState = callStatus === 'Connected' || callStatus === '00:00' || (!isNaN(parseInt(callStatus)) && !callStatus.includes(' '));
    const isFinished = !isError && (callTime > 0 || isConnectedState);
    
    // Determine the status to log based on intent first (avoids async state issues)
    let logStatus = null;
    if (intent === 'decline' || intent === 'remote-decline' || intent === 'declined') {
      logStatus = 'declined';
    } else if (intent === 'canceled' || (intent === 'manual' && !isConnectedState && callData.isInitiator)) {
      logStatus = callData.isInitiator ? 'canceled' : 'missed';
    } else if (intent === 'manual' && !isConnectedState && !callData.isInitiator) {
      logStatus = 'declined';
    } else if (intent === 'remote' || intent === 'timeout' || intent === 'missed') {
      logStatus = 'missed';
    } else if (isFinished || intent === 'finished') {
      logStatus = 'finished';
    } else {
      // Fallback to state checks
      if (callStatus === 'No Answer' && callData.isInitiator) {
        logStatus = 'missed';
      } else if (callStatus === 'Missed Call' || (callStatus === 'Incoming Call...' && !hasAccepted)) {
        logStatus = 'missed';
      } else if (callStatus === 'Call Declined') {
        logStatus = 'declined';
      } else if (callData.isInitiator && !isFinished) {
        logStatus = 'canceled';
      }
    }

    const finalDuration = forcedDuration !== null ? forcedDuration : callTime;

    if (logStatus) {
      logCallStatus(logStatus, finalDuration);
    }

    // Update UI status
    if (isFinished) {
      setCallStatus(`Call Finished (${formatCallTime(finalDuration)})`);
    } else if (!isError) {
      setCallStatus('Call Ended');
    }
    
    // Notify peer
    if (user) {
      const isCanceled = callData.isInitiator && !hasAccepted;
      const isDeclined = !callData.isInitiator && !hasAccepted;
      const event = isDeclined ? 'call-declined' : (isCanceled ? 'call-canceled' : 'end-call');
      const reason = isDeclined ? 'declined' : (isCanceled ? 'canceled' : 'finished');
                      
      const sendSignal = async () => {
        try {
          const chan = supabase.channel('shadowtalk-global-signaling');
          await chan.send({
            type: 'broadcast',
            event: event,
            payload: { 
              targetId: callData.remoteId, 
              from: user.id, 
              type: callData.type, 
              reason,
              senderName: user.name
            }
          });
        } catch (err) {
          console.warn('Signal fail:', err);
        }
      };

      // Send multiple times for absolute reliability across network conditions
      sendSignal();
      setTimeout(sendSignal, 500);
      setTimeout(sendSignal, 1500);
    }

    cleanup();
    endCall();
  };

  const updateCallRecord = async (status, duration = 0) => {
    if (!callRecordIdRef.current) return;
    try {
      const updates = { status };
      if (status === 'ended' || status === 'finished') {
        updates.ended_at = new Date().toISOString();
        updates.duration = duration;
        updates.status = 'ended';
      }
      await supabase.from('calls').update(updates).eq('id', callRecordIdRef.current);
    } catch (err) {
      console.error('Failed to update call record:', err);
    }
  };

  const logCallStatus = async (status, finalDuration = 0) => {
    if (durationLogged) return;
    setDurationLogged(true);

    // Sync to calls table
    if (callData.isInitiator) {
      updateCallRecord(status, finalDuration);
    }

    try {
      const durationStr = finalDuration > 0 ? ` (${formatCallTime(finalDuration)})` : '';
      let messageContent = '';
      
      if (status === 'missed') messageContent = `Missed ${callData.type} call`;
      else if (status === 'declined') messageContent = `${callData.type.charAt(0).toUpperCase() + callData.type.slice(1)} call declined`;
      else if (status === 'canceled') messageContent = `Canceled ${callData.type} call`;
      else if (status === 'finished') messageContent = `${callData.type.charAt(0).toUpperCase() + callData.type.slice(1)} call finished${durationStr}`;

      const newMessage = {
        id: `m_${Date.now()}`,
        text: messageContent,
        type: 'call',
        senderId: user.id,
        timestamp: Date.now(),
        metadata: { call_status: status, call_type: callData.type, duration: finalDuration }
      };

      const isMissedCall = status === 'missed' && !callData.isInitiator;

      // 1. Update LOCAL state
      setChats(prev => prev.map(chat => {
        if (chat.id === callData.remoteId) {
          return { 
            ...chat, 
            messages: [...(chat.messages || []), newMessage], 
            unreadCount: isMissedCall ? (chat.unreadCount || 0) + 1 : chat.unreadCount,
            lastActivity: Date.now() 
          };
        }
        return chat;
      }));

      // 2. Update ONLY MY Supabase record
      const { data: myChat } = await supabase.from('chats')
        .select('chat_data')
        .eq('owner_id', user.id)
        .eq('chat_id', callData.remoteId)
        .maybeSingle();

      if (myChat) {
        const myData = myChat.chat_data || {};
        await supabase.from('chats').update({ 
          chat_data: { 
            ...myData, 
            messages: [...(myData.messages || []), newMessage], 
            unreadCount: isMissedCall ? (myData.unreadCount || 0) + 1 : myData.unreadCount,
            lastActivity: Date.now() 
          } 
        }).eq('owner_id', user.id).eq('chat_id', callData.remoteId);
      }
    } catch (err) {
      console.error('Call Log Error:', err);
    }
  };

  const toggleMute = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    setIsMuted(prev => {
      if (localStreamRef.current) {
        const audioTrack = localStreamRef.current.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = prev; // If prev is true (muted), we enable it.
        }
      }
      return !prev;
    });
  };

  const toggleSpeaker = async (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    const nextValue = !isSpeaker;
    setIsSpeaker(nextValue);
    
    // Try to use setSinkId for speaker switching where supported
    if (remoteAudioRef.current && remoteAudioRef.current.setSinkId) {
      try {
        // Most browsers require searching for the speaker device ID.
        // For simplicity, we toggle between default (earpiece/system) and common speaker modes.
        // Note: Real device ID selection usually requires enumerateDevices().
        const devices = await navigator.mediaDevices.enumerateDevices();
        const speakers = devices.filter(d => d.kind === 'audiooutput');
        const target = nextValue ? speakers.find(s => s.label.toLowerCase().includes('speaker')) : speakers[0];
        
        if (target) {
          await remoteAudioRef.current.setSinkId(target.deviceId);
        }
      } catch (err) {
        console.warn('Speaker switch failed:', err);
      }
    } else {
      showToast(nextValue ? 'Speaker On' : 'Earpiece Mode', 'info');
    }
  };

  const toggleVideo = (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    setIsVideoEnabled(prev => {
      if (localStreamRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.enabled = !prev; // If prev is true (enabled), we disable it (!prev = false).
        }
      }
      return !prev;
    });
  };

  const switchCamera = async (e) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (callData.type !== 'video' || !localStreamRef.current) return;
    
    // Disable UI interaction temporarily while switching
    const newFacingMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newFacingMode);
    
    try {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.stop();
        localStreamRef.current.removeTrack(videoTrack);
      }
      const newStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: newFacingMode } });
      const newVideoTrack = newStream.getVideoTracks()[0];
      localStreamRef.current.addTrack(newVideoTrack);
      
      if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;

      // Replace track on RTCPeerConnection safely
      if (pcRef.current) {
        const sender = pcRef.current.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender) {
          await sender.replaceTrack(newVideoTrack).catch(err => console.warn('Replace track warning:', err));
        }
      }
    } catch (err) {
      console.error('Camera switch error:', err);
    }
  };

  if (!isCalling || !callData) return null;

  const { contact, type } = callData;
  const name = contact?.nickname || contact?.name || 'Shadow User';
  const isVideoIncoming = type === 'video';

  // Keep streams synced if React re-renders the video tags
  useEffect(() => {
    if (isVideo && hasAccepted) {
      if (localVideoRef.current && localStreamRef.current && localVideoRef.current.srcObject !== localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
    }
  }, [isVideo, hasAccepted, isVideoEnabled]);

  const statusDisplay = (callStatus === '00:00' || (!isNaN(parseInt(callStatus)) && !callStatus.includes(' '))) 
    ? formatCallTime(callTime) 
    : callStatus;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: '#050505',
      zIndex: 9999, // Ensure it's above everything
      display: 'flex',
      flexDirection: 'column',
      color: '#fff',
      animation: 'fadeIn 0.3s ease-out',
      fontFamily: 'Inter, sans-serif',
      overflow: 'hidden'
    }}>
      {/* Hidden audio element to actually play audio streams reliably */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* Background/Video Layers */}
      {isVideo && hasAccepted && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
          <video 
            ref={remoteVideoRef} 
            autoPlay 
            playsInline 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
          />
          <div style={{
            position: 'absolute', top: '40px', right: '20px',
            width: '120px', height: '180px', borderRadius: '16px',
            overflow: 'hidden', border: '2px solid rgba(255,255,255,0.2)',
            backgroundColor: '#111', zIndex: 10,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
          }}>
            <video 
              ref={localVideoRef} 
              autoPlay 
              playsInline 
              muted 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            />
          </div>
          <div style={{ 
            position: 'absolute', inset: 0, 
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.6) 100%)',
            zIndex: 5
          }} />
        </div>
      )}

      {/* Main Content UI */}
      <div style={{ 
        position: 'relative', zIndex: 20, flex: 1,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: isVideo ? '60px 20px 60px 20px' : '80px 20px 100px 20px'
      }}>
        
        {/* Top Section: Identity */}
        <div style={{ textAlign: 'center' }}>
          {!isVideo || !hasAccepted ? (
            <div style={{
              width: '160px', height: '160px', borderRadius: '50%',
              backgroundColor: '#111', margin: '0 auto 40px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', border: '2px solid var(--accent-primary)',
              boxShadow: '0 0 50px rgba(0, 255, 136, 0.1)',
              position: 'relative'
            }}>
              {contact?.avatarUrl || contact?.avatar_url ? (
                <img src={contact.avatarUrl || contact.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ fontSize: '5rem', fontWeight: 700, color: 'var(--accent-primary)', opacity: 0.8 }}>
                  {(name || '?').charAt(0).toUpperCase()}
                </div>
              )}
              {callStatus === 'Ringing...' && (
                <div className="ring-pulse" style={{ position: 'absolute', inset: -10, border: '4px solid var(--accent-primary)', borderRadius: '50%', opacity: 0.5 }} />
              )}
            </div>
          ) : null}
          
          <h2 style={{ 
            fontSize: (isVideo && hasAccepted) ? '1.5rem' : '2.5rem', 
            fontWeight: 800, 
            marginBottom: '10px',
            textShadow: '0 2px 10px rgba(0,0,0,0.8)'
          }}>
            {name}
          </h2>
          
          <div 
            onClick={() => {
              if (callData.isInitiator && (callStatus === 'Ringing...' || callStatus === 'Connecting...')) {
                showToast('Retrying signaling...', 'success');
                initCall();
              }
            }}
            style={{ 
              fontSize: '1.2rem', 
              color: callStatus === 'User is Busy' ? '#ff3b30' : 'var(--accent-primary)', 
              fontWeight: 600,
              textShadow: '0 2px 5px rgba(0,0,0,0.8)',
              cursor: callData.isInitiator ? 'pointer' : 'default'
            }}
          >
            {statusDisplay}
            {callData.isInitiator && (callStatus === 'Ringing...' || callStatus === 'Connecting...') && (
              <div style={{ fontSize: '0.6rem', color: 'var(--accent-primary)', marginTop: '4px', opacity: 0.8 }}>
                Tap to Resend Signal
              </div>
            )}
          </div>

          <div style={{ fontSize: '0.6rem', opacity: 0.4, marginTop: '8px', letterSpacing: '1px' }}>
            {signalingStatus}
          </div>
          {debugInfo && (
            <div style={{ fontSize: '0.5rem', opacity: 0.3, marginTop: '4px', fontFamily: 'monospace' }}>
              {debugInfo}
            </div>
          )}

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            marginTop: '15px',
            opacity: 0.6,
            transition: 'all 0.5s ease'
          }}>
            <ShieldCheckIcon size={14} color={(callStatus === 'Connected' || callTime > 0) ? 'var(--accent-primary)' : '#666'} />
            <span style={{ 
              fontSize: '0.75rem', 
              fontWeight: 500, 
              letterSpacing: '0.5px', 
              textTransform: 'uppercase',
              color: (callStatus === 'Connected' || callTime > 0) ? 'var(--accent-primary)' : '#666'
            }}>
              {(callStatus === 'Connected' || callTime > 0) ? 'Secure P2P Connection' : 'Securing Signal...'}
            </span>
          </div>
        </div>

        {/* Bottom Section: Controls */}
        <div style={{ width: '100%', maxWidth: '400px', margin: '0 auto' }}>
          {!hasAccepted && !callData.isInitiator ? (
            <div style={{ 
              display: 'flex', justifyContent: 'space-around', alignItems: 'center',
              backgroundColor: 'rgba(255,255,255,0.05)', padding: '30px', borderRadius: '30px',
              backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)',
              animation: 'slideUp 0.5s ease-out'
            }}>
              <div style={{ textAlign: 'center' }}>
                <button onClick={() => { setCallStatus('Call Declined'); handleEndCall(true, 'decline'); }} style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#ff3b30', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', marginBottom: '12px', boxShadow: '0 8px 24px rgba(255,59,48,0.4)' }}>
                  <XIcon size={40} />
                </button>
                <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Decline</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <button onClick={() => { setHasAccepted(true); initCall(); }} style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', marginBottom: '12px', boxShadow: '0 8px 24px rgba(0,255,136,0.4)' }}>
                  <PhoneIcon size={40} />
                </button>
                <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Accept</div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '30px', flexWrap: 'wrap' }}>
                <button type="button" onClick={toggleMute} style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: isMuted ? '#fff' : 'rgba(255,255,255,0.1)', color: isMuted ? '#000' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}>
                  {isMuted ? <MicOff size={24} /> : <MicIcon size={24} />}
                </button>
                {isVideo ? (
                  <>
                    <button type="button" onClick={toggleVideo} style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: !isVideoEnabled ? '#fff' : 'rgba(255,255,255,0.1)', color: !isVideoEnabled ? '#000' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}>
                      {!isVideoEnabled ? <VideoOff size={24} /> : <VideoIcon size={24} />}
                    </button>
                    <button type="button" onClick={switchCamera} style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}>
                      <RefreshCw size={24} />
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={toggleSpeaker} style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: isSpeaker ? '#fff' : 'rgba(255,255,255,0.1)', color: isSpeaker ? '#000' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}>
                    {isSpeaker ? <Volume2Icon size={24} /> : <VolumeXIcon size={24} />}
                  </button>
                )}
              </div>
              <button type="button" onClick={() => handleEndCall(true, 'manual')} style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#ff3b30', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', margin: '0 auto', boxShadow: '0 10px 40px rgba(255, 59, 48, 0.4)' }}>
                <PhoneIcon size={36} style={{ transform: 'rotate(135deg)' }} />
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .ring-pulse { animation: ring 2s infinite; }
        @keyframes ring {
          0% { transform: scale(1); opacity: 0.5; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes slideUp {
          from { transform: translateY(50px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
