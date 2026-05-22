import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft as ArrowLeftIcon, MoreVertical as MoreVerticalIcon, Shield as ShieldIcon, User as UserIcon, Trash2 as Trash2Icon, X as XIcon } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export default function BlockedContacts() {
  const navigate = useNavigate();
  const { chats, unblockContact } = useAppContext();
  const [contextMenu, setContextMenu] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);

  const blockedList = (chats || []).filter(c => c.isBlocked);

  const handleContextMenu = (e, contact) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, contact });
  };

  const handleUnblockClick = () => {
    if (contextMenu) {
      setConfirmModal(contextMenu.contact);
      setContextMenu(null);
    }
  };

  const confirmUnblock = async () => {
    if (confirmModal) {
      await unblockContact(confirmModal.id);
      setConfirmModal(null);
    }
  };

  return (
    <div className="app-container animate-fade-in" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column' }}>
      <div className="screen-header" style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', justifyContent: 'flex-start' }}>
        <button className="icon-btn" onClick={() => navigate(-1)} style={{ color: 'var(--text-primary)', margin: 0 }}>
          <ArrowLeftIcon size={24} />
        </button>
        <h1 className="header-title" style={{ flex: 1, textAlign: 'center', marginRight: '40px' }}>Blocked Contacts</h1>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        <div style={{ 
          backgroundColor: 'var(--bg-secondary)', 
          padding: '16px', 
          borderRadius: '16px', 
          marginBottom: '24px',
          border: '1px solid var(--accent-primary)',
          display: 'flex',
          gap: '12px'
        }}>
          <ShieldIcon size={20} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
            Blocked contacts cannot message you, see your online status, or view your profile updates.
          </p>
        </div>

        {blockedList.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '60px', opacity: 0.5 }}>
            <ShieldIcon size={64} style={{ marginBottom: '16px' }} />
            <p>No blocked contacts yet</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {blockedList.map(chat => (
              <div 
                key={chat.id}
                onContextMenu={(e) => handleContextMenu(e, chat)}
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  padding: '16px',
                  borderRadius: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  border: '1px solid var(--border-color)',
                  transition: 'transform 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0, overflow: 'hidden' }}>
                  <div style={{ width: '48px', height: '48px', flexShrink: 0, borderRadius: '50%', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {chat.contact?.avatarUrl ? (
                      <img src={chat.contact.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <UserIcon size={24} color="var(--text-muted)" />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {chat.contact?.nickname || chat.contact?.name || 'Unknown'}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                      {chat.contact?.shadowId || chat.id}
                    </div>
                  </div>
                </div>
                <button className="icon-btn" onClick={(e) => handleContextMenu(e, chat)} style={{ margin: 0, flexShrink: 0 }}>
                  <MoreVerticalIcon size={20} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {contextMenu && (
        <div 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={() => setContextMenu(null)}
        >
          <div 
            style={{ 
              position: 'fixed', 
              top: Math.min(contextMenu.y, window.innerHeight - 100), 
              left: Math.min(contextMenu.x, window.innerWidth - 180),
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '16px',
              padding: '8px',
              zIndex: 1001,
              boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
              border: '1px solid var(--border-color)',
              minWidth: '160px',
              animation: 'scaleIn 0.2s ease-out'
            }}
            onClick={e => e.stopPropagation()}
          >
            <button 
              onClick={handleUnblockClick}
              style={{ 
                backgroundColor: 'transparent', border: 'none', color: 'var(--accent-primary)', 
                padding: '12px 16px', textAlign: 'left', fontWeight: 600, width: '100%',
                display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer'
              }}
            >
              <ShieldIcon size={18} />
              Unblock
            </button>
            <button 
              onClick={() => setContextMenu(null)}
              style={{ 
                backgroundColor: 'transparent', border: 'none', color: 'var(--text-muted)', 
                padding: '12px 16px', textAlign: 'left', width: '100%',
                display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer'
              }}
            >
              <XIcon size={18} />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 2000, padding: '20px',
          backdropFilter: 'blur(10px)', animation: 'fadeIn 0.2s'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)', borderRadius: '24px', padding: '32px',
            width: '100%', maxWidth: '360px', textAlign: 'center', border: '1px solid var(--border-color)',
            animation: 'slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(0, 255, 136, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
              <ShieldIcon size={32} color="var(--accent-primary)" />
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '12px' }}>Unblock Contact?</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '32px', lineHeight: '1.5' }}>
              Are you sure you want to unblock <strong style={{ color: 'var(--text-primary)' }}>{confirmModal.contact?.nickname || confirmModal.contact?.name || 'this user'}</strong>? 
              They will be able to message you again.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn-secondary" onClick={() => setConfirmModal(null)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn-primary" onClick={confirmUnblock} style={{ flex: 1 }}>Unblock</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes scaleIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
