import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft as ArrowLeftIcon, Smartphone, Laptop, Plus as PlusIcon, Trash2 as Trash2Icon } from 'lucide-react';

export default function LinkedDevices() {
  const navigate = useNavigate();

  return (
    <div className="app-container animate-fade-in" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div className="screen-header">
        <button className="icon-btn" onClick={() => navigate(-1)} style={{ margin: 0 }}>
          <ArrowLeftIcon size={24} />
        </button>
        <h1 className="header-title">Linked Devices</h1>
        <div style={{ width: 40 }} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5', padding: '0 4px' }}>
          Connect multiple devices to your account. All your chats and contacts will be securely synced across them using end-to-end encryption.
        </p>

        <div>
          <h2 style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1px', marginBottom: '12px', paddingLeft: '4px' }}>Current Device</h2>
          <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: 'var(--shadow-glow)' }}>
            <div style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', padding: '12px', borderRadius: '12px' }}>
              <Laptop size={32} color="var(--accent-primary)" />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>Windows Desktop</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 500 }}>Active Now • This device</div>
            </div>
          </div>
        </div>

        <div>
          <h2 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1px', marginBottom: '12px', paddingLeft: '4px' }}>Other Devices</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '10px', borderRadius: '12px' }}>
                <Smartphone size={28} color="var(--text-muted)" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>iPhone 15 Pro</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Last active: 2 hours ago</div>
              </div>
              <button className="icon-btn" style={{ color: 'var(--accent-danger)' }}>
                <Trash2Icon size={20} />
              </button>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 'auto', paddingTop: '20px' }}>
          <button className="btn-primary" style={{ gap: '10px', borderRadius: '30px' }}>
            <PlusIcon size={20} /> Link New Device
          </button>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center', marginTop: '16px' }}>
            Multi-device support is in beta. 
          </p>
        </div>
      </div>
    </div>
  );
}
