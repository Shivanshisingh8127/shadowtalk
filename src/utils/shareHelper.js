/**
 * Centralized Native Web Share utility for ShadowTalk.
 * Integrates native share sheet features (AirDrop, Messages, Mail, WhatsApp, Files) on iOS and Android,
 * with fully automated, safe clipboards and URL fallbacks for unsupported platforms.
 */

/**
 * Shares text, URLs, or files using the native system share dialog if supported,
 * falling back to clipboard copying or URL-only sharing if needed.
 * 
 * @param {Object} options
 * @param {string} [options.title] - Share title
 * @param {string} [options.text] - Share body text
 * @param {string} [options.url] - URL link to share
 * @param {string} [options.mediaUrl] - URL of remote media attachment to download and share
 * @param {string} [options.fileName] - Custom filename for attachment
 * @param {string} [options.mimeType] - MIME type for attachment
 * @returns {Promise<{success: boolean, reason?: string, message?: string}>} Result of sharing action
 */
export const shareContent = async ({ title, text, url, mediaUrl, fileName, mimeType }) => {
  // Detect Web Share API support
  if (!navigator.share) {
    // Fallback: Copy to Clipboard
    const copyText = text || url || mediaUrl;
    if (copyText) {
      try {
        await navigator.clipboard.writeText(copyText);
        return { 
          success: false, 
          reason: 'unsupported', 
          message: 'Sharing is not supported on this browser. Link/text has been copied to your clipboard.' 
        };
      } catch (copyErr) {
        return { 
          success: false, 
          reason: 'unsupported', 
          message: 'Sharing is not supported on this browser.' 
        };
      }
    }
    return { success: false, reason: 'unsupported', message: 'Sharing is not supported on this browser.' };
  }

  const shareData = {};
  if (title) shareData.title = title;
  if (text) shareData.text = text;
  if (url) shareData.url = url;

  // File Sharing: Fetch media in background if present
  if (mediaUrl) {
    try {
      const response = await fetch(mediaUrl);
      const blob = await response.blob();
      
      const cleanFileName = fileName || mediaUrl.split('/').pop() || 'attachment';
      const fileType = blob.type || mimeType || 'application/octet-stream';
      const file = new File([blob], cleanFileName, { type: fileType });

      // Verify that the browser can natively share this file
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        shareData.files = [file];
      } else {
        // Fallback: Add media link to shared text or url
        if (!shareData.url) shareData.url = mediaUrl;
      }
    } catch (err) {
      console.warn('[ShareHelper] CORS/fetch error preparing file sharing. Falling back to URL.', err);
      if (!shareData.url) shareData.url = mediaUrl;
    }
  }

  try {
    await navigator.share(shareData);
    return { success: true };
  } catch (err) {
    // User cancelled the share dialog
    if (err.name === 'AbortError') {
      return { success: false, reason: 'cancelled' };
    }

    // iOS/Safari or specific browser limits may refuse file sharing but accept text/URL sharing
    if (shareData.files) {
      try {
        const fallbackData = {
          title: shareData.title,
          text: shareData.text || shareData.title,
          url: shareData.url || mediaUrl
        };
        await navigator.share(fallbackData);
        return { success: true, reason: 'file_fallback' };
      } catch (fallbackErr) {
        if (fallbackErr.name === 'AbortError') {
          return { success: false, reason: 'cancelled' };
        }
        throw fallbackErr;
      }
    }

    throw err;
  }
};
