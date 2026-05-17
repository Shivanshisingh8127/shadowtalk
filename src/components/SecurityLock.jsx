import React, { useState, useEffect } from 'react';
import { Lock as LockIcon, Fingerprint, X as XIcon, ArrowLeft as ArrowLeftIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

export default function SecurityLock({ onUnlock }) {
  const navigate = useNavigate();
  const { settings } = useAppContext();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const correctPin = settings.appPin || '1234'; 

  useEffect(() => {
    if (pin.length === 4) {
      if (pin === correctPin) {
        onUnlock();
      } else {
        setError(true);
        setTimeout(() => {
          setPin('');
          setError(false);
        }, 500);
      }
    }
  }, [pin, onUnlock]);

  const handleKeyPress = (num) => {
    if (pin.length < 4) {
      setPin(prev => prev + num);
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: '#000',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff'
    }}>
      {/* Back Button */}
      <button 
        onClick={() => navigate(-1)}
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          background: 'none',
          border: 'none',
          color: '#fff',
          cursor: 'pointer',
          padding: '8px'
        }}
      >
        <ArrowLeftIcon size={28} />
      </button>

      <LockIcon size={48} color="var(--accent-primary)" style={{ marginBottom: '32px' }} />
      <h2 style={{ fontSize: '1.4rem', fontWeight: 600, marginBottom: '8px' }}>Enter PIN</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '40px' }}>Please unlock ShadowTalk to continue</p>
      
      {/* PIN Dots */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '60px' }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={`pulse-red ${error ? 'error-shake' : ''}`} style={{
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            backgroundColor: i < pin.length ? 'var(--accent-primary)' : 'transparent',
            border: `2px solid ${i < pin.length ? 'var(--accent-primary)' : '#555'}`,
            transition: 'all 0.2s',
            animation: error ? 'shake 0.4s' : 'none'
          }} />
        ))}
      </div>

      {/* Numpad */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '24px',
        width: '280px'
      }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
          <button
            key={num}
            onClick={() => handleKeyPress(num)}
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              backgroundColor: '#1c1c1e',
              border: 'none',
              color: '#fff',
              fontSize: '1.8rem',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
            className="hoverable"
          >
            {num}
          </button>
        ))}
        
        {/* Empty spot for layout */}
        <button style={{
            width: '72px', height: '72px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }} onClick={() => alert('Biometric authentication is not supported in this demo.')}>
           <Fingerprint size={32} color="var(--accent-primary)" />
        </button>
        
        <button
          onClick={() => handleKeyPress(0)}
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            backgroundColor: '#1c1c1e',
            border: 'none',
            color: '#fff',
            fontSize: '1.8rem',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
          className="hoverable"
        >
          0
        </button>

        <button
          onClick={handleDelete}
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            backgroundColor: 'transparent',
            border: 'none',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
          className="hoverable"
        >
          <XIcon size={32} />
        </button>
      </div>
      
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }
      `}</style>
    </div>
  );
}
