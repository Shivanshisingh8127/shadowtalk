import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRoundIcon, ShieldCheckIcon, CheckIcon, ArrowLeftIcon } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export default function SecuritySetup() {
  const [step, setStep] = useState(1);
  const [copied, setCopied] = useState(false);
  const { user } = useAppContext();
  const navigate = useNavigate();

  const handleCopyPhrase = () => {
    navigator.clipboard.writeText(user.recoveryKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFinish = () => {
    navigate('/chats');
  };

  return (
    <div className="app-container animate-fade-in" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px 0', marginBottom: '10px' }}>
        <button className="icon-btn" onClick={() => step === 2 ? setStep(1) : navigate(-1)} style={{ margin: '0 -10px' }}>
          <ArrowLeftIcon size={24} />
        </button>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
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
          }}>
            {step === 1 ? <KeyRoundIcon size={40} /> : <ShieldCheckIcon size={40} />}
          </div>
          <h2 style={{ fontSize: '1.8rem', marginBottom: '12px' }}>
            {step === 1 ? 'Identity Key' : 'Setup Complete'}
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            {step === 1 
              ? 'Write down this phrase. It is the ONLY way to recover your account if you lose your device.' 
              : 'Your ShadowTalk identity is secure. You can now start messaging privately.'}
          </p>
        </div>

        {step === 1 && (
          <div className="animate-slide-up" style={{
            backgroundColor: 'var(--bg-secondary)',
            padding: '24px',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '12px',
              marginBottom: '24px'
            }}>
              {user?.recoveryKey.split(' ').map((word, i) => (
                <div key={i} style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  padding: '8px',
                  borderRadius: 'var(--radius-sm)',
                  textAlign: 'center',
                  fontSize: '0.9rem',
                  fontWeight: '500'
                }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginRight: '4px' }}>{i + 1}</span>
                  {word}
                </div>
              ))}
            </div>
            
            <button className="btn-secondary" onClick={handleCopyPhrase} style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
              {copied ? <CheckIcon size={20} color="var(--accent-primary)" /> : <KeyRoundIcon size={20} />}
              {copied ? 'Key Copied' : 'Copy Identity Key'}
            </button>
          </div>
        )}

      </div>

      <button className="btn-primary" onClick={() => step === 1 ? setStep(2) : handleFinish()}>
        {step === 1 ? 'I Saved My Key' : 'Enter ShadowTalk'}
      </button>
    </div>
  );
}
