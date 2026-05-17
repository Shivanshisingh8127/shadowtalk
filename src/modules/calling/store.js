import { create } from 'zustand';

export const useCallStore = create((set) => ({
  // Core State
  isCalling: false,
  callStatus: 'idle', // 'idle', 'ringing', 'connecting', 'connected', 'busy', 'ended'
  callType: 'voice', 
  isInitiator: false,
  channelName: null,
  
  // Peer Info
  remoteUser: null, // { id, name, avatarUrl }
  
  // Media State
  localAudioTrack: null,
  remoteAudioTrack: null,
  isMuted: false,
  isSpeakerOn: true,
  
  // UI State
  isMinimized: false,
  showIncomingPopup: false,
  callDuration: 0,
  
  // Actions
  setCallStatus: (status) => set({ callStatus: status }),
  setCallData: (data) => set((state) => ({ ...state, ...data })),
  
  startCall: (remoteUser, channelName) => set({
    isCalling: true,
    isInitiator: true,
    callType: 'voice',
    remoteUser,
    channelName,
    callStatus: 'ringing',
    showIncomingPopup: false
  }),
  
  receiveCall: (remoteUser, channelName) => set({
    isCalling: true,
    isInitiator: false,
    callType: 'voice',
    remoteUser,
    channelName,
    callStatus: 'ringing',
    showIncomingPopup: false
  }),
  
  acceptCall: () => set({
    showIncomingPopup: false,
    callStatus: 'connecting'
  }),
  
  endCall: () => set({
    isCalling: false,
    callStatus: 'idle',
    channelName: null,
    remoteUser: null,
    localAudioTrack: null,
    remoteAudioTrack: null,
    showIncomingPopup: false,
    isMinimized: false,
    isMuted: false
  }),
  
  setLocalAudioTrack: (track) => set({ localAudioTrack: track }),
  setRemoteAudioTrack: (track) => set({ remoteAudioTrack: track }),
  toggleMute: () => set((state) => {
    const nextMuted = !state.isMuted;
    if (state.localAudioTrack) {
      try {
        state.localAudioTrack.setEnabled(!nextMuted);
      } catch (e) {
        console.error('[CallStore] Failed to toggle mute:', e);
      }
    }
    return { isMuted: nextMuted };
  }),
  toggleSpeaker: () => set((state) => {
    const nextValue = !state.isSpeakerOn;
    if (state.remoteAudioTrack) {
      // Simulate loudspeaker vs earpiece by scaling volume
      state.remoteAudioTrack.setVolume(nextValue ? 100 : 25);
    }
    return { isSpeakerOn: nextValue };
  }),
  setMinimized: (minimized) => set({ isMinimized: minimized }),
  setShowIncomingPopup: (show) => set({ showIncomingPopup: show })
}));
