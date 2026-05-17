/**
 * Triggers a short vibration (haptic feedback) if supported by the device.
 * @param {number|number[]} pattern - Vibration pattern in ms.
 */
export const triggerHaptic = (pattern = 10) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      // Ignore vibration errors
    }
  }
};
