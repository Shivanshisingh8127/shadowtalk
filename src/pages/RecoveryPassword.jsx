import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft as ArrowLeftIcon, Shield as ShieldIcon } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { QRCodeCanvas } from 'qrcode.react';

export default function RecoveryPassword() {
  const navigate = useNavigate();
  const { user } = useAppContext();
  
  // Real phrase from user context
  const phrase = user?.phrase || '';
  
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [showHideConfirm, setShowHideConfirm] = useState(false);

  const handleCopy = () => {
    if (!user?.shadowId) return;
    navigator.clipboard.writeText(user?.shadowId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleHideConfirm = () => {
    setIsHidden(true);
    setShowHideConfirm(false);
  };

  return (
    <div className="app-container animate-fade-in" style={{ backgroundColor: '#000', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <div className="screen-header" style={{ borderBottom: 'none', backgroundColor: '#000', justifyContent: 'flex-start', padding: '16px' }}>
        <button className="icon-btn" onClick={() => navigate(-1)} style={{ color: '#fff', margin: 0 }}>
          <ArrowLeftIcon size={24} />
        </button>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 auto', transform: 'translateX(-12px)' }}>Identity Backup Key</h1>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Main Card */}
        <div style={{ 
          backgroundColor: '#1a1a1a', 
          borderRadius: '16px', 
          padding: '24px',
          border: '1px solid #2a2a2c'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Identity Backup Key</h2>
            <ShieldIcon size={18} color="#fff" />
          </div>
          
          {isHidden ? (
            <div style={{ padding: '40px 0', textAlign: 'center', animation: 'fadeIn 0.3s ease-out' }}>
              <ShieldIcon size={48} color="var(--accent-danger)" style={{ marginBottom: '16px', opacity: 0.8 }} />
              <p style={{ color: '#ddd', fontSize: '1rem', fontWeight: 500 }}>
                Your recovery password is permanently hidden on this device.
              </p>
            </div>
          ) : (
            <>
              <p style={{ color: '#ddd', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '16px' }}>
                Use your identity backup key to load your account on new devices.
              </p>
              
              <p style={{ color: '#ddd', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '24px' }}>
                Your account cannot be recovered without your identity backup key. Make sure it's stored somewhere safe and secure — and don't share it with anyone.
              </p>

              <div style={{ 
                backgroundColor: '#121212', 
                border: '1px solid #333', 
                borderRadius: '12px', 
                padding: '20px', 
                marginBottom: '24px',
                textAlign: 'center'
              }}>
                <p style={{ 
                  color: 'var(--accent-primary)', 
                  fontFamily: 'monospace', 
                  fontSize: '0.95rem', 
                  lineHeight: '1.6',
                  margin: 0,
                  wordSpacing: '4px',
                  userSelect: 'all',
                  wordBreak: 'break-all',
                  overflowWrap: 'anywhere'
                }}>
                  {user?.shadowId || 'Shadow ID not found'}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  onClick={handleCopy}
                  style={{ 
                    flex: 1, padding: '12px', borderRadius: '30px', 
                    backgroundColor: 'transparent', border: '1px solid #fff',
                    color: '#fff', fontSize: '0.95rem', fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button 
                  onClick={() => setShowQR(true)}
                  style={{ 
                    flex: 1, padding: '12px', borderRadius: '30px', 
                    backgroundColor: 'transparent', border: '1px solid #fff',
                    color: '#fff', fontSize: '0.95rem', fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  View QR
                </button>
              </div>
            </>
          )}
        </div>

        {/* Hide Card */}
        {!isHidden && (
          <div style={{ 
            backgroundColor: '#1a1a1a', 
            borderRadius: '16px', 
            padding: '24px',
            border: '1px solid #2a2a2c',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ flex: 1, paddingRight: '16px' }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 4px 0' }}>Hide Identity Backup Key</h2>
              <p style={{ color: '#ddd', fontSize: '0.9rem', lineHeight: '1.4', margin: 0 }}>
                Permanently hide your identity backup key on this device.
              </p>
            </div>
            <button 
              onClick={() => setShowHideConfirm(true)}
              style={{ 
                padding: '10px 24px', 
                borderRadius: '30px', 
                backgroundColor: 'transparent', 
                border: '1px solid var(--accent-danger)',
                color: 'var(--accent-danger)', 
                fontSize: '0.95rem', 
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Hide
            </button>
          </div>
        )}
      </div>

      {/* QR Modal pop up at top */}
      {showQR && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          zIndex: 200,
          padding: '60px 20px',
          animation: 'fadeIn 0.2s ease-out',
          backdropFilter: 'blur(5px)'
        }} onClick={() => setShowQR(false)}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '16px',
            padding: '32px',
            width: '100%',
            maxWidth: '340px',
            textAlign: 'center',
            border: '1px solid var(--border-color)',
            animation: 'slideDown 0.3s ease-out'
          }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '24px' }}>Recovery QR</h2>
            <div style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '12px', display: 'inline-block' }}>
              <QRCodeCanvas value={user?.shadowId || ''} size={200} />
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '24px' }}>
              Scan to securely transfer your identity backup key.
            </p>
            <button 
              className="btn-primary" 
              onClick={() => setShowQR(false)}
              style={{ marginTop: '24px', padding: '12px', borderRadius: '30px' }}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Hide Confirmation Modal */}
      {showHideConfirm && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 200,
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
            <h2 style={{ fontSize: '1.2rem', marginBottom: '12px' }}>Hide Identity Backup Key?</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px', lineHeight: '1.4' }}>
              Are you sure you want to permanently hide your identity backup key on this device? You will no longer be able to view or copy it from this device. <strong style={{ color: 'var(--accent-danger)' }}>This cannot be undone.</strong>
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                className="btn-secondary" 
                onClick={() => setShowHideConfirm(false)}
                style={{ flex: 1, padding: '12px' }}
              >
                Cancel
              </button>
              <button 
                className="btn-primary" 
                onClick={handleHideConfirm}
                style={{ flex: 1, padding: '12px', backgroundColor: 'var(--accent-danger)', color: '#fff', border: 'none' }}
              >
                Hide
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideDown {
          from { transform: translateY(-50px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
