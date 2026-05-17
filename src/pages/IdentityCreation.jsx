import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Fingerprint, Copy as CopyIcon, CheckCircle, AlertTriangle, ArrowLeft as ArrowLeftIcon, QrCode as QrCodeIcon } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { supabase } from '../supabaseClient';
import { QRCodeCanvas } from 'qrcode.react';

export default function IdentityCreation() {
  const [generated, setGenerated] = useState(false);
  const [copied, setCopied] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [identityId, setIdentityId] = useState('');
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const { loginMockUser, generateRecoveryPhrase, showToast } = useAppContext();
  const navigate = useNavigate();

  const generateRandomHex = (length) => {
    const chars = '0123456789abcdef';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleGenerate = () => {
    const newId = generateRandomHex(64);
    const newPhrase = generateRecoveryPhrase();
    setIdentityId(newId);
    setRecoveryPhrase(newPhrase);
    setGenerated(true);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(identityId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleContinue = async () => {
    if (!username.trim()) {
      showToast('User ID is required for recovery', 'error');
      return;
    }
    if (!identityId) {
      showToast('Please generate a ShadowTalk ID first', 'error');
      return;
    }

    setIsSaving(true);
    const finalUsername = username.trim().toLowerCase();
    try {
      const { error } = await supabase
        .from('users')
        .insert([{ 
          id: finalUsername,          // Short alias used as recoverable DB primary key
          name: displayName || username,
          shadow_id: identityId, // The long secure hex ID
          recovery_key: recoveryPhrase
        }]);

      if (error) {
        if (error.code === '23505') {
          showToast('This User ID is already taken', 'error');
        } else {
          console.error('Supabase error:', error);
          showToast(`Database Error: ${error.message}`, 'error');
          // No longer falling back silently to help debug
        }
        return;
      }

      await loginMockUser(displayName || username, identityId, recoveryPhrase);
      navigate('/chats');
    } catch (err) {
      console.error('Registration failed:', err);
      showToast('Account creation failed. Check connection.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="app-container animate-fade-in" style={{ padding: '20px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      <div style={{ padding: '10px 0', marginBottom: '10px' }}>
        <button className="icon-btn" onClick={() => navigate(-1)} style={{ margin: '0 -10px' }}>
          <ArrowLeftIcon size={24} />
        </button>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--bg-tertiary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px auto',
            color: 'var(--accent-primary)',
            boxShadow: generated ? 'var(--shadow-glow)' : 'none',
            transition: 'all 0.5s ease'
          }}>
            <Fingerprint size={40} />
          </div>
          <h2 style={{ fontSize: '1.8rem', marginBottom: '12px' }}>
            {generated ? 'Identity Created' : 'Create Identity'}
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            {generated ? 'This is your unique ShadowTalk ID. Share it to connect.' : 'Generate a new anonymous identity to start using ShadowTalk.'}
          </p>
        </div>

        {generated && (
          <div className="animate-slide-up" style={{
            backgroundColor: 'var(--bg-secondary)',
            padding: '24px',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
            marginBottom: '30px'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{
                padding: '16px',
                backgroundColor: '#fff',
                borderRadius: '16px',
                marginBottom: '16px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
              }}>
                <div style={{
                  padding: '12px',
                  backgroundColor: '#fff',
                  borderRadius: '12px',
                }}>
                  <QRCodeCanvas 
                    value={identityId}
                    size={180}
                    level="H"
                    includeMargin={false}
                    imageSettings={{
                      src: "/shadowtalk-logo.png", // Fallback to icon if not exists
                      x: undefined,
                      y: undefined,
                      height: 24,
                      width: 24,
                      excavate: true,
                    }}
                  />
                </div>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>Scan this QR to connect securely</p>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>Your ShadowTalk ID</p>
            <div className="glass-morphism" style={{
              fontFamily: 'monospace',
              wordBreak: 'break-all',
              color: 'var(--text-primary)',
              fontSize: '1rem',
              lineHeight: '1.4',
              marginBottom: '20px',
              padding: '16px',
              borderRadius: '16px'
            }}>
              {identityId}
            </div>
            
            <button className="btn-secondary" onClick={handleCopy} style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
              {copied ? <CheckCircle size={20} color="var(--accent-primary)" /> : <CopyIcon size={20} />}
              {copied ? 'Copied to Clipboard' : 'Copy ID'}
            </button>
            
            <div style={{ marginTop: '20px', padding: '12px', backgroundColor: 'rgba(255, 68, 68, 0.1)', borderRadius: 'var(--radius-md)', display: 'flex', gap: '12px' }}>
              <AlertTriangle color="var(--accent-danger)" size={24} style={{ flexShrink: 0 }} />
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Warning: We do not store your ID. You can backup your identity key later in Settings.
              </p>
            </div>

            <div style={{ marginTop: '30px' }}>
              <label className="input-label" style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>User ID (Required for Recovery)</label>
              <input 
                type="text" 
                className="text-input glass-morphism" 
                placeholder="Unique username for recovery..." 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{ width: '100%', padding: '16px', borderRadius: '16px', color: '#fff', border: '1px solid var(--border-color)', marginBottom: '20px' }}
              />

              <label className="input-label" style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>Display Name (Optional)</label>
              <input 
                type="text" 
                className="text-input glass-morphism" 
                placeholder="Enter a display name..." 
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                style={{ width: '100%', padding: '16px', borderRadius: '16px', color: '#fff', border: '1px solid var(--border-color)' }}
              />
            </div>
          </div>
        )}

      </div>

      <div style={{ marginTop: '20px', marginBottom: '20px' }}>
        {!generated ? (
          <button className="btn-primary" onClick={handleGenerate}>
            Generate ShadowTalk ID
          </button>
        ) : (
          <button className="btn-primary" onClick={handleContinue} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Finish Setup'}
          </button>
        )}
      </div>
    </div>
  );
}
