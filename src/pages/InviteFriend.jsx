import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft as ArrowLeftIcon, X as XIcon } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export default function InviteFriend() {
  const navigate = useNavigate();
  const { user } = useAppContext();
  const [copied, setCopied] = useState(false);

  const accountId = user?.id || '054ce2ff6e978f74c1d86c4ff4852678be48536e1a9321aeeb5bfffdce9247912b';

  const handleCopy = () => {
    navigator.clipboard.writeText(accountId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join me on ShadowTalk',
          text: `Hey! Connect with me securely on ShadowTalk using my Account ID:\n\n${accountId}`,
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Error sharing:', err);
        }
      }
    } else {
      handleCopy();
      alert('Sharing is not supported on your current browser. Your ID has been copied to your clipboard instead!');
    }
  };

  return (
    <div className="app-container animate-fade-in" style={{ backgroundColor: '#121212', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <div className="screen-header" style={{ borderBottom: 'none', justifyContent: 'space-between', padding: '16px 20px', backgroundColor: '#121212' }}>
        <button className="icon-btn" onClick={() => navigate(-1)} style={{ margin: '0 -10px', color: '#fff' }}>
          <ArrowLeftIcon size={24} />
        </button>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Invite a Friend</h1>
        <button className="icon-btn" onClick={() => navigate('/chats')} style={{ margin: '0 -10px', color: '#fff' }}>
          <XIcon size={24} />
        </button>
      </div>

      <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ 
          backgroundColor: '#1a1a1a', 
          borderRadius: '12px', 
          padding: '24px 16px',
          border: '1px solid #333',
          marginBottom: '24px',
          textAlign: 'center',
          wordBreak: 'break-all',
          fontFamily: 'monospace',
          fontSize: '0.95rem',
          lineHeight: '1.5',
          marginTop: '16px'
        }}>
          {accountId}
        </div>
        
        <p style={{ fontSize: '0.9rem', color: '#aaa', textAlign: 'center', lineHeight: '1.5', padding: '0 10px', marginBottom: '32px' }}>
          Invite your friend to chat with you on Session by sharing<br />your Account ID with them.
        </p>

        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
          <button 
            onClick={handleShare}
            style={{ 
              flex: 1, padding: '14px', borderRadius: '30px', 
              backgroundColor: 'transparent', border: '1px solid #fff',
              color: '#fff', fontSize: '1rem', fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Share
          </button>
          <button 
            onClick={handleCopy}
            style={{ 
              flex: 1, padding: '14px', borderRadius: '30px', 
              backgroundColor: 'transparent', border: '1px solid #fff',
              color: '#fff', fontSize: '1rem', fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  );
}
