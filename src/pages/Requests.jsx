import React, { useState } from 'react';
import { ShieldAlert as ShieldAlertIcon } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

const DefaultAvatar = ({ name, size = 40 }) => {
  const colors = ['#FF5733', '#4ECCA3', '#3357FF', '#F333FF', '#FF33A8', '#33FFF5', '#FFD369', '#FF8C33', '#8C33FF', '#33FF8C'];
  const charCode = (name || '?').charCodeAt(0);
  const color = colors[charCode % colors.length];
  const initial = (name || '?').charAt(0).toUpperCase();
  return (
    <div style={{ width: `${size}px`, height: `${size}px`, borderRadius: '50%', backgroundColor: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: `${size / 2}px`, flexShrink: 0, textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
      {initial}
    </div>
  );
};

export default function Requests() {
  const { requests, acceptRequest, rejectRequest } = useAppContext();
  const [confirmAction, setConfirmAction] = useState(null);

  return (
    <div className="animate-fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="screen-header">
        <h1 className="header-title">Message Requests</h1>
      </div>

      <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
        <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '16px', borderRadius: 'var(--radius-md)', marginBottom: '24px', display: 'flex', gap: '12px' }}>
          <ShieldAlertIcon size={24} color="var(--accent-secondary)" style={{ flexShrink: 0 }} />
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            These are message requests from unknown IDs. Accept to securely connect, or reject to drop the connection. They will not know you rejected them.
          </p>
        </div>

        {requests.length === 0 ? (
          <div className="empty-state">
            <p>No pending requests</p>
          </div>
        ) : (
          requests.map(req => (
            <div key={req.id} style={{ 
              backgroundColor: 'var(--bg-secondary)', 
              borderRadius: '20px', 
              padding: '20px', 
              marginBottom: '16px',
              border: '1px solid var(--border-color)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <DefaultAvatar name={req.senderName} size={48} />
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>{req.senderName || 'Shadow User'}</div>
                  <div style={{ fontFamily: 'monospace', color: 'var(--accent-primary)', fontSize: '0.75rem', opacity: 0.8 }}>
                    {req.senderShadowId || req.senderId}
                  </div>
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {new Date(req.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px', padding: '12px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '12px', borderLeft: '3px solid var(--accent-primary)' }}>
                "{req.preview || 'Wants to connect with you'}"
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  className="btn-secondary" 
                  style={{ flex: 1, padding: '10px', backgroundColor: 'var(--bg-primary)', color: 'var(--accent-danger)', fontWeight: 600 }}
                  onClick={() => setConfirmAction({ type: 'reject', request: req })}
                >
                  Reject
                </button>
                <button 
                  className="btn-primary" 
                  style={{ flex: 1, padding: '10px', color: '#000', fontWeight: 600 }}
                  onClick={() => setConfirmAction({ type: 'accept', request: req })}
                >
                  Accept
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmAction && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 400,
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
            <h2 style={{ fontSize: '1.2rem', marginBottom: '12px' }}>
              {confirmAction.type === 'accept' ? 'Accept Request?' : 'Reject Request?'}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px', lineHeight: '1.4' }}>
              {confirmAction.type === 'accept' 
                ? `Do you want to accept this message request from ${confirmAction.request.senderId.substring(0, 10)}...?`
                : `Are you sure you want to reject this message request? They won't be notified.`
              }
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                className="btn-secondary" 
                onClick={() => setConfirmAction(null)}
                style={{ flex: 1, padding: '12px' }}
              >
                Cancel
              </button>
              <button 
                className="btn-primary" 
                onClick={() => {
                  if (confirmAction.type === 'accept') {
                    acceptRequest(confirmAction.request);
                  } else {
                    rejectRequest(confirmAction.request);
                  }
                  setConfirmAction(null);
                }}
                style={{ 
                  flex: 1, 
                  padding: '12px', 
                  backgroundColor: confirmAction.type === 'reject' ? 'var(--accent-danger)' : 'var(--accent-primary)',
                  color: confirmAction.type === 'reject' ? '#fff' : '#000'
                }}
              >
                {confirmAction.type === 'accept' ? 'Accept' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
