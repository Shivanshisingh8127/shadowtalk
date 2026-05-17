import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft as ArrowLeftIcon, X as XIcon, RefreshCw } from 'lucide-react';

export default function JoinCommunity() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('Community URL');
  const [url, setUrl] = useState('');

  const suggestedCommunities = [
    { id: 'lokinet', name: 'Lokinet Updates', iconColor: '#fff' },
    { id: 'session_network', name: 'Session Network Upda...', iconColor: 'var(--accent-primary)' },
    { id: 'session', name: 'Session Updates', iconColor: 'var(--accent-primary)' }
  ];

  return (
    <div className="app-container animate-fade-in" style={{ backgroundColor: '#121212', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <div className="screen-header" style={{ borderBottom: 'none', justifyContent: 'space-between', padding: '16px 20px', backgroundColor: '#121212' }}>
        <button className="icon-btn" onClick={() => navigate(-1)} style={{ margin: '0 -10px', color: '#fff' }}>
          <ArrowLeftIcon size={24} />
        </button>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Join Community</h1>
        <button className="icon-btn" onClick={() => navigate('/chats')} style={{ margin: '0 -10px', color: '#fff' }}>
          <XIcon size={24} />
        </button>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid #333' }}>
        <button 
          style={{ flex: 1, padding: '16px', background: 'none', border: 'none', color: tab === 'Community URL' ? '#fff' : '#aaa', borderBottom: tab === 'Community URL' ? '2px solid var(--accent-primary)' : '2px solid transparent', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer' }}
          onClick={() => setTab('Community URL')}
        >
          Community URL
        </button>
        <button 
          style={{ flex: 1, padding: '16px', background: 'none', border: 'none', color: tab === 'Scan QR Code' ? '#fff' : '#aaa', borderBottom: tab === 'Scan QR Code' ? '2px solid var(--accent-primary)' : '2px solid transparent', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer' }}
          onClick={() => setTab('Scan QR Code')}
        >
          Scan QR Code
        </button>
      </div>

      <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {tab === 'Community URL' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ 
              backgroundColor: '#1a1a1a', 
              borderRadius: '12px', 
              padding: '20px 16px',
              border: '1px solid #333',
              marginBottom: '32px'
            }}>
              <input 
                type="text" 
                placeholder="Enter Community URL" 
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                style={{ 
                  width: '100%', 
                  background: 'transparent', 
                  border: 'none', 
                  color: '#fff', 
                  outline: 'none', 
                  fontSize: '1rem' 
                }}
              />
            </div>

            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '20px' }}>Or join one of these...</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                {suggestedCommunities.map(comm => (
                  <button 
                    key={comm.id}
                    onClick={() => setUrl(comm.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 20px',
                      borderRadius: '30px',
                      backgroundColor: 'transparent',
                      border: '1px solid #333',
                      color: '#fff',
                      fontSize: '0.95rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                  >
                    <RefreshCw size={16} color={comm.iconColor} />
                    {comm.name}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 'auto', marginBottom: '20px', display: 'flex', justifyContent: 'center' }}>
              <button 
                disabled={!url.trim()}
                style={{ 
                  width: '100%', maxWidth: '300px', padding: '14px', borderRadius: '30px', 
                  backgroundColor: 'transparent', border: '1px solid #666',
                  color: url.trim() ? '#fff' : '#666', fontSize: '1rem', fontWeight: 600,
                  cursor: url.trim() ? 'pointer' : 'default',
                  opacity: url.trim() ? 1 : 0.5
                }}
                onClick={() => {
                  alert(`Joining community: ${url}`);
                  navigate('/chats');
                }}
              >
                Join
              </button>
            </div>
          </div>
        )}

        {tab === 'Scan QR Code' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
             <div style={{ width: '250px', height: '250px', border: '2px dashed #666', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
               Camera View
             </div>
             <p style={{ marginTop: '24px', color: '#aaa', textAlign: 'center' }}>Point your camera at a community QR code.</p>
          </div>
        )}
      </div>
    </div>
  );
}
