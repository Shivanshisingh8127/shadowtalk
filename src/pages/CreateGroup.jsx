import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft as ArrowLeftIcon, Users as UsersIcon, Plus as PlusIcon, X as XIcon, Shield as ShieldIcon, Info as InfoIcon, Check as CheckIcon, UserPlus as UserPlusIcon } from 'lucide-react';
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

export default function CreateGroup() {
  const navigate = useNavigate();
  const { chats, user, createGroup, showToast } = useAppContext();
  const [name, setName] = useState('');
  const [memberInput, setMemberInput] = useState('');
  const [members, setMembers] = useState([]);
  const [allowMemberDMs, setAllowMemberDMs] = useState(true);

  // Extract unique contacts from existing direct chats
  const suggestedContacts = (chats || [])
    .filter(c => c.type === 'direct' && c.id !== user?.id && c.contact?.id !== user?.id)
    .map(c => c.contact)
    .filter(Boolean)
    .reduce((unique, contact) => {
      const id = contact.shadowId || contact.id;
      if (!unique.find(c => (c.shadowId || c.id) === id)) {
        unique.push(contact);
      }
      return unique;
    }, [])
    .filter(contact => {
      const id = contact.shadowId || contact.id;
      return id && !members.includes(id);
    });

  const handleAddMember = (e, suggestedId = null) => {
    if (e) e.preventDefault();
    const id = suggestedId || memberInput.trim();
    if (id && !members.includes(id)) {
      setMembers([...members, id]);
      if (!suggestedId) setMemberInput('');
    }
  };

  const handleRemoveMember = (id) => {
    setMembers(members.filter(m => m !== id));
  };

  const handleCreate = async () => {
    if (name.trim()) {
      try {
        await createGroup(name.trim(), members, allowMemberDMs);
        showToast(`Group "${name}" created successfully!`, 'success');
        navigate('/chats');
      } catch (err) {
        showToast('Failed to create group', 'error');
      }
    }
  };

  return (
    <div className="app-container animate-fade-in" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="screen-header">
        <button className="icon-btn hoverable glass-box" onClick={() => navigate(-1)} style={{ margin: '0 -10px', border: 'none' }}>
          <ArrowLeftIcon size={24} />
        </button>
        <span className="header-title">New Shadow Group</span>
        <div style={{ width: 40 }} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>
        {/* Group Identity Section */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div className="glass-box hoverable" style={{ 
            width: 100, height: 100, borderRadius: '35%', 
            margin: '0 auto 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', color: 'var(--accent-primary)',
            background: 'color-mix(in srgb, var(--accent-primary) 15%, rgba(255, 255, 255, 0.05))'
          }}>
            <UsersIcon size={40} />
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Choose Group Avatar (Optional)</p>
        </div>

        {/* Inputs Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="input-group">
            <label style={{ 
              fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', 
              marginBottom: '10px', display: 'block', textTransform: 'uppercase', letterSpacing: '1.5px' 
            }}>Group Name</label>
            <input 
              type="text" 
              className="text-input" 
              placeholder="e.g. Operation Shadow..." 
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ padding: '16px', fontSize: '1.05rem', borderRadius: '16px' }}
              autoFocus
            />
          </div>

          <div className="input-group">
            <label style={{ 
              fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', 
              marginBottom: '10px', display: 'block', textTransform: 'uppercase', letterSpacing: '1.5px' 
            }}>Add Members by Shadow ID</label>
            <div style={{ position: 'relative' }}>
              <input 
                type="text" 
                className="text-input" 
                placeholder="Enter Shadow ID..." 
                value={memberInput}
                onChange={(e) => setMemberInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddMember()}
                style={{ padding: '16px', paddingRight: '60px', fontSize: '1.05rem', borderRadius: '16px' }}
              />
              <button 
                onClick={handleAddMember}
                style={{ 
                  position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                  backgroundColor: 'var(--accent-primary)', color: '#000', border: 'none',
                  width: '36px', height: '36px', borderRadius: '10px', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                }}
              >
                <PlusIcon size={20} />
              </button>
            </div>
            
            {members.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '16px' }}>
                {members.map(mid => {
                  const contactInfo = (chats || []).flatMap(c => c.type === 'direct' ? [c.contact] : []).find(c => c && (c.shadowId === mid || c.id === mid));
                  const displayName = contactInfo?.nickname || contactInfo?.name || mid;
                  
                  return (
                    <div key={mid} style={{ 
                      display: 'flex', alignItems: 'center', gap: '8px', 
                      backgroundColor: 'var(--bg-tertiary)', padding: '6px 12px', 
                      borderRadius: '12px', border: '1px solid var(--border-color)',
                      fontSize: '0.85rem', animation: 'scaleIn 0.2s ease-out'
                    }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', overflow: 'hidden' }}>
                        {contactInfo?.avatarUrl ? (
                          <img src={contactInfo.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <DefaultAvatar name={displayName} size={20} />
                        )}
                      </div>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {displayName.length > 12 ? displayName.substring(0, 12) + '...' : displayName}
                      </span>
                      <XIcon size={14} style={{ cursor: 'pointer', color: 'var(--accent-danger)' }} onClick={() => handleRemoveMember(mid)} />
                    </div>
                  );
                })}
              </div>
            )}

            {suggestedContacts.length > 0 && (
              <div style={{ marginTop: '24px' }}>
                <label style={{ 
                  fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', 
                  marginBottom: '12px', display: 'block', textTransform: 'uppercase', letterSpacing: '1px' 
                }}>Suggestions</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {suggestedContacts.slice(0, 5).map(contact => {
                    const id = contact.shadowId || contact.id || '';
                    const name = contact.nickname || contact.name || 'Unknown';
                    return (
                      <div 
                        key={id}
                        className="settings-item hoverable"
                        onClick={() => handleAddMember({ preventDefault: () => {} }, id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '12px',
                          padding: '12px 16px',
                          borderRadius: '16px', border: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden' }}>
                          {contact.avatarUrl ? (
                            <img src={contact.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <DefaultAvatar name={name} size={40} />
                          )}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{id.length > 20 ? id.substring(0, 20) + '...' : id}</div>
                        </div>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%', backgroundColor: 'var(--bg-tertiary)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)'
                        }}>
                          <UserPlusIcon size={16} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Privacy Settings */}
          <div className="glass-box" style={{ 
            borderRadius: '24px', 
            padding: '24px', border: 'none',
            marginTop: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ 
                  width: 44, height: 44, borderRadius: '14px', 
                  backgroundColor: 'color-mix(in srgb, var(--accent-primary) 15%, transparent)', 
                  color: 'var(--accent-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <ShieldIcon size={22} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>Allow Member DMs</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Allow group members to DM each other</div>
                </div>
              </div>
              <div 
                onClick={() => setAllowMemberDMs(!allowMemberDMs)}
                className="toggle-switch active"
                style={{ 
                  width: '46px', height: '24px', 
                  backgroundColor: allowMemberDMs ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)', 
                  borderRadius: '12px', position: 'relative', cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
              >
                <div style={{ 
                  position: 'absolute', left: allowMemberDMs ? '24px' : '2px', 
                  top: '2px', width: '20px', height: '20px', 
                  backgroundColor: allowMemberDMs ? '#000' : 'var(--text-muted)', 
                  borderRadius: '50%', transition: 'all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)'
                }} />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'start', gap: '12px', padding: '16px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <InfoIcon size={18} color="var(--accent-primary)" style={{ marginTop: '2px', flexShrink: 0 }} />
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, lineHeight: '1.5' }}>
                As the creator, you are the **Admin**. Admins can add/remove members and change group settings.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div style={{ padding: '24px 20px', borderTop: '1px solid var(--border-color)', background: 'transparent', backdropFilter: 'blur(20px)' }}>
        <button 
          className="btn-primary" 
          disabled={!name.trim() || members.length === 0}
          onClick={handleCreate}
          style={{ 
            height: '56px', borderRadius: '18px', fontSize: '1.05rem', 
            fontWeight: 700, display: 'flex', alignItems: 'center', 
            justifyContent: 'center', gap: '10px',
            opacity: (!name.trim() || members.length === 0) ? 0.5 : 1,
            backgroundColor: (name.trim() && members.length > 0) ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)',
            color: (name.trim() && members.length > 0) ? '#000' : 'var(--text-muted)',
            border: 'none'
          }}
        >
          {name.trim() && members.length > 0 ? <CheckIcon size={22} /> : null}
          Create Shadow Group
        </button>
      </div>

      <style>{`
        @keyframes scaleIn {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
