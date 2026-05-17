/**
 * Global AudioContext manager to handle browser autoplay restrictions
 */
class AudioManager {
  constructor() {
    this.audioContext = null;
  }

  getAudioContext() {
    if (!this.audioContext) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioContext = new AudioContext();
      }
    }
    return this.audioContext;
  }

  async resumeAudio() {
    const ctx = this.getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      try {
        await ctx.resume();
        console.log('[AudioManager] AudioContext resumed successfully');
      } catch (e) {
        console.warn('[AudioManager] Failed to resume AudioContext:', e);
      }
    }
  }
}

export const audioManager = new AudioManager();
