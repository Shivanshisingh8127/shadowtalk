import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search as SearchIcon, Users as UsersIcon, Plus as PlusIcon, X as XIcon, MessageSquare as MessageSquareIcon, Globe, UserPlus as UserPlusIcon, QrCode as QrCodeIcon } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export default function Groups() {
  const { chats, user } = useAppContext();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [showStartModal, setShowStartModal] = useState(false);

  const groups = chats.filter(c => c.type === 'group' && c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="animate-fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="screen-header">
        <h1 className="header-title">Groups</h1>
      </div>

      <div style={{ padding: '16px 20px 8px 20px' }}>
        <div style={{ position: 'relative' }}>
          <SearchIcon size={20} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            className="text-input" 
            placeholder="Search groups..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '40px' }}
          />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {groups.length === 0 ? (
          <div className="empty-state">
            <UsersIcon size={48} />
            <p>No groups found</p>
          </div>
        ) : (
          groups.map(group => (
            <div key={group.id} className="chat-list-item" onClick={() => navigate(`/chat/${group.id}`)}>
              <div className="avatar group" style={{ overflow: 'hidden', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {group.avatarUrl ? (
                  <img src={group.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <UsersIcon size={24} />
                )}
              </div>
              
              <div className="chat-info">
                <div className="chat-header">
                  <span className="chat-name">{group.name}</span>
                  <span className="chat-time">
                    {new Date(group.lastActivity).toLocaleDateString()}
                  </span>
                </div>
                <div className="chat-preview-container">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span className="chat-preview" style={{ color: 'var(--accent-secondary)', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                      GID: {group.id.replace('group_', '').substring(0, 16)}...
                    </span>
                    <span className="chat-preview">
                      {group.members.length} members
                    </span>
                  </div>
                  {group.unreadCount > 0 && (
                    <div className="unread-badge">{group.unreadCount}</div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <button className="fab" onClick={() => setShowStartModal(true)}>
        <PlusIcon size={28} />
      </button>

      {/* Start Conversation Modal */}
      {showStartModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)',
          zIndex: 300,
          display: 'flex',
          flexDirection: 'column',
          animation: 'fadeIn 0.2s ease-out',
          backdropFilter: 'blur(5px)'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            marginTop: 'auto',
            borderTopLeftRadius: '24px',
            borderTopRightRadius: '24px',
            padding: '24px',
            maxHeight: '90vh',
            overflowY: 'auto',
            animation: 'slideUp 0.3s ease-out'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Start Conversation</h2>
              <button className="icon-btn" onClick={() => setShowStartModal(false)} style={{ margin: 0 }}>
                <XIcon size={24} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '24px' }}>
              <div 
                style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 0', borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
                onClick={() => navigate('/new-chat')}
              >
                <MessageSquareIcon size={24} color="var(--text-primary)" />
                <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>New Message</span>
              </div>
              <div 
                style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 0', borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
                onClick={() => navigate('/create-group')}
              >
                <UsersIcon size={24} color="var(--text-primary)" />
                <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>Create Group</span>
              </div>
              <div 
                style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 0', borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
              >
                <Globe size={24} color="var(--text-primary)" />
                <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>Join Community</span>
              </div>
              <div 
                style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 0', borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
              >
                <UserPlusIcon size={24} color="var(--text-primary)" />
                <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>Invite a Friend</span>
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '8px' }}>Your Account ID</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px', lineHeight: '1.4' }}>
                Friends can message you by scanning your QR code.
              </p>
              
              <div style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '16px', display: 'flex', justifyContent: 'center' }}>
                <QrCodeIcon size={250} color="#000" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
