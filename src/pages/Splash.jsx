import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Sparkles } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export default function Splash() {
  const navigate = useNavigate();
  const { user } = useAppContext();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    // If user is already logged in, skip splash and go straight to chats
    if (user) {
      navigate('/chats', { replace: true });
    }
  }, [user, navigate]);

  return (
    <div className="app-container" style={{
      display: 'flex', flexDirection: 'column',
      justifyContent: 'center', alignItems: 'center',
      padding: '40px 20px', textAlign: 'center',
      position: 'relative', overflow: 'hidden'
    }}>
      {/* Ambient Cyberpunk Background */}
      <div className="ambient-particles" />
      
      {/* Glow Effect */}
      <div style={{
        position: 'absolute', top: '30%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '300px', height: '300px',
        background: 'radial-gradient(circle, rgba(124, 77, 255, 0.15) 0%, transparent 70%)',
        filter: 'blur(40px)', zIndex: 0
      }} />

      <div style={{ zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '400px' }} className="animate-slide-up">
        <div style={{
          width: '90px', height: '90px',
          background: 'var(--bg-glass-light)',
          backdropFilter: 'blur(12px)',
          borderRadius: '24px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: '32px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          border: '1px solid rgba(124, 77, 255, 0.3)',
          position: 'relative'
        }}>
          <Shield size={44} color="#7C4DFF" strokeWidth={1.5} />
          <Sparkles size={20} color="#4DA3FF" style={{ position: 'absolute', top: '-10px', right: '-10px', animation: 'float 3s infinite' }} />
        </div>

        <h1 style={{ 
          fontSize: '2.5rem', fontWeight: 800, 
          marginBottom: '16px', letterSpacing: '-0.03em',
          lineHeight: '1.2'
        }}>
          Private by <span className="text-gradient-primary">Design.</span>
        </h1>
        
        <p style={{ 
          color: 'var(--text-secondary)', fontSize: '1.05rem', 
          marginBottom: '48px', maxWidth: '280px',
          lineHeight: '1.6'
        }}>
          End-to-end encrypted.<br/>No trackers. No data. Just privacy.
        </p>

        <button 
          onClick={() => navigate('/onboarding')}
          className="btn-primary"
          style={{ width: '100%', maxWidth: '300px', fontSize: '1.1rem' }}
        >
          Get Started
        </button>
      </div>

      <style>{`
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
