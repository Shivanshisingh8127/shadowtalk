import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search as SearchIcon, X as XIcon } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

const DefaultAvatar = ({ name, size = 40 }) => {
  const colors = [
    '#FF5733', '#4ECCA3', '#3357FF', '#F333FF', '#FF33A8', 
    '#33FFF5', '#FFD369', '#FF8C33', '#8C33FF', '#33FF8C'
  ];
  const charCode = (name || '?').charCodeAt(0);
  const color = colors[charCode % colors.length];
  const initial = (name || '?').charAt(0).toUpperCase();

  return (
    <div style={{
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: '50%',
      backgroundColor: color,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontWeight: 'bold',
      fontSize: `${size / 2}px`,
      flexShrink: 0,
      textShadow: '0 1px 2px rgba(0,0,0,0.2)'
    }}>
      {initial}
    </div>
  );
};

// Mock list based on the user image
// Removed dummy INITIAL_CONTACTS as requested

export default function SearchContacts() {
  const navigate = useNavigate();
  const { user, chats = [], setChats, blockContact, deleteChat, showToast } = useAppContext();
  console.log('SearchContacts render:', { user, chatsCount: chats?.length });
  const [query, setQuery] = useState('');
  
  const [selectedChat, setSelectedChat] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [longPressTimer, setLongPressTimer] = useState(null);

  const handleContextMenu = (e, chat) => {
    e.preventDefault();
    setSelectedChat(chat);
  };

  const handleTouchStart = (chat) => {
    const timer = setTimeout(() => {
      setSelectedChat(chat);
    }, 600); // 600ms for long press
    setLongPressTimer(timer);
  };

  const handleTouchEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const handleContactClick = (chat) => {
    navigate(`/chat/${chat.id}`);
  };

  const filteredChats = (chats || []).filter(chat => {
    if (!chat) return false;
    const isDirect = chat.type === 'direct';
    let contactName = chat.contact?.nickname || chat.contact?.name || chat.id || '';
    if (chat.id === user?.id || chat.contact?.id === user?.id) contactName = 'Note to Self';
    
    return isDirect && contactName.toLowerCase().includes((query || '').toLowerCase());
  });

  // Group chats by first letter
  const grouped = filteredChats.reduce((acc, chat) => {
    let name = chat?.contact?.nickname || chat?.contact?.name || chat?.id || 'Unknown';
    const isGroup = chat?.type === 'group';
    const isNoteToSelf = !isGroup && chat.id.toLowerCase() === (user?.shortId || user?.id || '').toLowerCase();
    if (isNoteToSelf) name = 'Note to Self';
    const letter = (name.charAt(0) || '?').toUpperCase();
    if (!acc[letter]) acc[letter] = [];
    acc[letter].push({ ...chat, displayName: name });
    return acc;
  }, {});

  const sortedLetters = Object.keys(grouped).sort();

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', color: 'var(--text-primary)', padding: '16px', overflow: 'hidden' }} className="app-container animate-fade-in">
      
      {/* Search Bar Area */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <div className="glass-box" style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          padding: '10px 16px',
          border: 'none',
          borderRadius: '16px'
        }}>
          <SearchIcon size={20} color="var(--text-muted)" />
          <input 
            type="text" 
            placeholder="Search" 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              fontSize: '1rem',
              padding: '0 8px',
              outline: 'none'
            }}
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ color: 'var(--text-muted)', display: 'flex' }}>
              <XIcon size={18} />
            </button>
          )}
        </div>
        <button 
          onClick={() => navigate(-1)} 
          className="glass-box hoverable icon-btn"
          style={{ width: '42px', height: '42px', border: 'none', borderRadius: '12px' }}
        >
          <XIcon size={20} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '20px', marginLeft: '8px' }}>Contacts</h2>

        {/* Contacts will be listed here */}

        {/* Grouped Contacts */}
        {sortedLetters.map(letter => (
          <div key={letter} style={{ marginBottom: '20px' }}>
            <div style={{ color: 'var(--accent-primary)', fontSize: '0.85rem', fontWeight: 600, marginBottom: '12px', marginLeft: '12px', textTransform: 'uppercase' }}>
              {letter}
            </div>
            {grouped[letter].map(chat => {
              const name = chat.displayName;
              return (
                <div 
                  key={chat.id} 
                  className="chat-list-item"
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '16px', 
                    marginBottom: '8px', 
                    padding: '12px 16px', 
                    cursor: 'pointer', 
                    userSelect: 'none',
                    border: 'none',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => handleContactClick(chat)}
                  onContextMenu={(e) => handleContextMenu(e, chat)}
                  onTouchStart={() => handleTouchStart(chat)}
                  onTouchEnd={() => handleTouchEnd()}
                  onMouseDown={() => handleTouchStart(chat)}
                  onMouseUp={() => handleTouchEnd()}
                  onMouseLeave={() => handleTouchEnd()}
                >
                  <div className="avatar" style={{ width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {chat.contact?.avatarUrl ? (
                      <img src={chat.contact.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <DefaultAvatar name={name} size={48} />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>{chat.displayName}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{(chat.isSelf || chat.id === user?.id) ? 'Saved messages' : (chat.contact?.shadowId || chat.id)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {filteredChats.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            No contacts found matching "{query}"
          </div>
        )}
      </div>

      {/* Bottom Sheet for Right Click */}
      {selectedChat && !confirmAction && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 300,
          display: 'flex',
          flexDirection: 'column'
        }} onClick={() => setSelectedChat(null)}>
          <div style={{
            marginTop: 'auto',
            backgroundColor: 'var(--bg-secondary)',
            borderTopLeftRadius: '24px',
            borderTopRightRadius: '24px',
            padding: '24px',
            animation: 'slideUp 0.2s ease-out',
            boxShadow: '0 -4px 20px rgba(0,0,0,0.5)',
            border: '1px solid var(--border-color)'
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '24px', fontSize: '1.2rem', textAlign: 'center', color: 'var(--text-primary)' }}>{selectedChat?.contact?.name || selectedChat?.id || 'Unknown'}</h3>
            <button 
              className="btn-secondary" 
              style={{ backgroundColor: 'var(--bg-tertiary)', marginBottom: '16px', color: 'var(--accent-danger)', border: '1px solid var(--border-color)', width: '100%', padding: '14px', borderRadius: '12px', fontWeight: 600 }}
              onClick={() => setConfirmAction({ type: 'delete', chat: selectedChat })}
            >
              Delete Contact
            </button>
            <button 
              className="btn-secondary" 
              style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--accent-danger)', border: '1px solid var(--border-color)', width: '100%', padding: '14px', borderRadius: '12px', fontWeight: 600 }}
              onClick={() => setConfirmAction({ type: 'block', chat: selectedChat })}
            >
              Block
            </button>
          </div>
        </div>
      )}

      {/* Center Confirmation Modal */}
      {confirmAction && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          zIndex: 400,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(5px)',
          animation: 'fadeIn 0.2s ease-out'
        }} onClick={() => setConfirmAction(null)}>
          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '24px',
            padding: '32px 24px',
            width: '85%',
            maxWidth: '340px',
            textAlign: 'center',
            border: '1px solid var(--border-color)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '12px', color: 'var(--text-primary)' }}>
              {confirmAction.type === 'delete' ? 'Delete Contact?' : 'Block Contact?'}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '32px', lineHeight: '1.5' }}>
              Are you sure you want to {confirmAction.type} <strong>{confirmAction.chat?.contact?.name || confirmAction.chat?.id || 'this contact'}</strong>? This action will remove the conversation.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                className="btn-secondary" 
                style={{ flex: 1, padding: '14px', borderRadius: '12px', fontWeight: 600 }}
                onClick={() => {
                  setConfirmAction(null);
                  setSelectedChat(null);
                }}
              >
                Cancel
              </button>
              <button 
                className="btn-danger" 
                style={{ flex: 1, padding: '14px', borderRadius: '12px', fontWeight: 600, backgroundColor: 'var(--accent-danger)', color: '#fff' }}
                onClick={() => {
                  if (confirmAction.type === 'delete') {
                    deleteChat(confirmAction.chat.id);
                    showToast('Contact deleted', 'info');
                  } else {
                    blockContact(confirmAction.chat.id);
                    showToast('Contact blocked', 'info');
                  }
                  setConfirmAction(null);
                  setSelectedChat(null);
                  navigate('/chats');
                }}
              >
                {confirmAction.type === 'delete' ? 'Delete' : 'Block'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
