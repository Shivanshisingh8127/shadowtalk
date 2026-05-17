import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EyeOffIcon, UserXIcon, LockIcon, ArrowLeftIcon } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAppContext } from '../context/AppContext';

const slides = [
  {
    icon: <EyeOffIcon size={60} />,
    title: 'No Phone, No Email',
    desc: 'ShadowTalk requires absolutely no personal information to sign up.'
  },
  {
    icon: <LockIcon size={60} />,
    title: 'Fully Private',
    desc: 'End-to-end encryption ensures only you and the recipient can read messages.'
  },
  {
    icon: <UserXIcon size={60} />,
    title: 'Own Your Identity',
    desc: 'You control your ShadowTalk ID. Share it only with those you trust.'
  }
];

export default function Onboarding() {
  const [current, setCurrent] = useState(0);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoverIds, setRecoverIds] = useState({ userId: '', shadowId: '' });
  const [isVerifying, setIsVerifying] = useState(false);
  const { loginMockUser, showToast } = useAppContext();
  const navigate = useNavigate();

  const nextSlide = () => {
    if (current === slides.length - 1) {
      navigate('/identity');
    } else {
      setCurrent(current + 1);
    }
  };

  const handleRecover = async (e) => {
    e.preventDefault();
    if (!recoverIds.userId || !recoverIds.shadowId) {
      showToast('Both ID and Recovery Key are required', 'error');
      return;
    }
    
    setIsVerifying(true);
      try {
        // CheckIcon if input is either id or shadow_id
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .or(`id.eq."${recoverIds.userId}",shadow_id.eq."${recoverIds.userId}"`)
          .maybeSingle();

        if (error || !data) {
          showToast('User not found with this ID', 'error');
          setIsVerifying(false);
          return;
        }

        // Now verify the recovery key or shadow_id matches
        const keyMatch = data.recovery_key === recoverIds.shadowId || data.shadow_id === recoverIds.shadowId;

        if (!keyMatch) {
          showToast('Invalid Recovery Key or Shadow ID', 'error');
          setIsVerifying(false);
          return;
        }

        // Successfully recovered
        await loginMockUser(data.name, data.id, data.recovery_key);
        navigate('/chats');
      } catch (err) {
        console.error('Recovery error:', err);
        alert('An error occurred during recovery. Please try again.');
      } finally {
        setIsVerifying(false);
      }
  };

  return (
    <div className="app-container animate-fade-in" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="icon-btn" onClick={() => current > 0 ? setCurrent(current - 1) : navigate(-1)} style={{ margin: '0 -10px' }}>
          <ArrowLeftIcon size={24} />
        </button>
        <button onClick={() => navigate('/identity')} style={{ color: 'var(--text-muted)', fontWeight: 500, padding: '10px' }}>
          Skip
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ 
          color: 'var(--accent-secondary)', 
          marginBottom: '40px',
          animation: 'float 4s ease-in-out infinite'
        }} key={current}>
          <div style={{
            width: '120px', height: '120px',
            background: 'var(--bg-glass-light)',
            backdropFilter: 'blur(12px)',
            borderRadius: '30px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 10px 40px rgba(77, 163, 255, 0.2)',
            border: '1px solid rgba(77, 163, 255, 0.3)'
          }}>
            {slides[current].icon}
          </div>
        </div>
        
        <h2 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)' }}>
          {slides[current].title}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', maxWidth: '300px', lineHeight: '1.6' }}>
          {slides[current].desc}
        </p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '40px' }}>
        {slides.map((_, i) => (
          <div key={i} style={{
            width: i === current ? '24px' : '8px',
            height: '8px',
            borderRadius: '4px',
            backgroundColor: i === current ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
            transition: 'all 0.3s ease'
          }} />
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <button className="btn-primary" onClick={nextSlide}>
          {current === slides.length - 1 ? 'Get Started' : 'Next'}
        </button>
        
        {current === slides.length - 1 && (
          <button 
            className="btn-secondary" 
            onClick={() => setShowRecovery(true)}
            style={{ border: 'none', backgroundColor: 'transparent', color: 'var(--accent-primary)', fontWeight: 600 }}
          >
            Recover Existing Account
          </button>
        )}
      </div>

      {/* Recovery Modal */}
      {showRecovery && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(6, 7, 10, 0.8)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(20px)', padding: '20px'
        }} onClick={() => setShowRecovery(false)}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)', borderRadius: '32px', padding: '32px',
            width: '100%', maxWidth: '400px', border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-soft)',
            animation: 'slideUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
          }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px', textAlign: 'center' }}>Account Recovery</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', marginBottom: '32px' }}>
              Enter your credentials to restore your chats.
            </p>

            <form onSubmit={handleRecover} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', display: 'block', fontWeight: 600, letterSpacing: '0.5px' }}>USER ID</label>
                <input 
                  type="text" 
                  className="text-input glass-morphism" 
                  placeholder="Enter your username" 
                  value={recoverIds.userId}
                  onChange={e => setRecoverIds({...recoverIds, userId: e.target.value})}
                  required
                  style={{ width: '100%', padding: '16px', borderRadius: '16px', color: '#fff', border: '1px solid var(--border-color)' }}
                />
              </div>
 
              <div className="input-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', display: 'block', fontWeight: 600, letterSpacing: '0.5px' }}>RECOVERY KEY</label>
                <input 
                  type="text" 
                  className="text-input glass-morphism" 
                  placeholder="Paste your 12-word phrase" 
                  value={recoverIds.shadowId}
                  onChange={e => setRecoverIds({...recoverIds, shadowId: e.target.value})}
                  required
                  style={{ fontFamily: 'monospace', width: '100%', padding: '16px', borderRadius: '16px', color: '#fff', border: '1px solid var(--border-color)' }}
                />
              </div>

              <button type="submit" className="btn-primary" style={{ marginTop: '12px' }} disabled={isVerifying}>
                {isVerifying ? 'Verifying...' : 'Verify & Restore'}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowRecovery(false)}>
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
