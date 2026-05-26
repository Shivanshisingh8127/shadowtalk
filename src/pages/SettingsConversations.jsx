import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft as ArrowLeftIcon, ChevronRight as ChevronRightIcon } from 'lucide-react';

const Toggle = ({ checked, onChange }) => (
  <div onClick={onChange} style={{
    width: '46px',
    height: '26px',
    backgroundColor: checked ? 'var(--accent-primary)' : '#333',
    borderRadius: '13px',
    position: 'relative',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    flexShrink: 0
  }}>
    <div style={{
      position: 'absolute',
      top: '3px',
      left: checked ? '23px' : '3px',
      width: '20px',
      height: '20px',
      backgroundColor: checked ? '#000' : '#888',
      borderRadius: '50%',
      transition: 'left 0.2s'
    }} />
  </div>
);

const SectionTitle = ({ title }) => (
  <div className="section-label">{title}</div>
);

const SettingRow = ({ title, description, rightElement, onClick }) => (
  <div 
    onClick={onClick}
    className={`glass-box ${onClick ? 'hoverable' : ''}`}
    style={{
      padding: '16px',
      margin: '0 12px 12px 12px',
      display: 'flex',
      alignItems: 'center',
      cursor: onClick ? 'pointer' : 'default',
      border: 'none'
    }}
  >
    <div style={{ flex: 1, paddingRight: '16px' }}>
      <div style={{ color: '#fff', fontSize: '1rem', fontWeight: 600, marginBottom: '4px' }}>{title}</div>
      <div style={{ color: '#ddd', fontSize: '0.85rem', lineHeight: '1.4' }}>{description}</div>
    </div>
    {rightElement && <div>{rightElement}</div>}
  </div>
);

import { useAppContext } from '../context/AppContext';

export default function SettingsConversations() {
  const navigate = useNavigate();
  const { settings, setSettings } = useAppContext();

  const toggleSetting = (key) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="app-container animate-fade-in" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="screen-header" style={{ borderBottom: 'none', justifyContent: 'flex-start', padding: '16px' }}>
        <button className="icon-btn" onClick={() => navigate(-1)} style={{ color: '#fff', margin: 0 }}>
          <ArrowLeftIcon size={24} />
        </button>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 auto', transform: 'translateX(-12px)' }}>Conversations</h1>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '30px' }}>
        <SectionTitle title="Message Trimming" />
        <SettingRow 
          title="Trim Communities" 
          description="Auto-delete messages older than 6 months in communities with 2000+ messages."
          rightElement={<Toggle checked={settings.autoTrim} onChange={() => toggleSetting('autoTrim')} />}
        />

        <SectionTitle title="Send with Enter" />
        <SettingRow 
          title="Send with Enter" 
          description="Tapping the Enter Key will send message instead of starting a new line."
          rightElement={<Toggle checked={settings.sendWithEnter} onChange={() => toggleSetting('sendWithEnter')} />}
        />

        <SectionTitle title="Audio Messages" />
        <SettingRow 
          title="Autoplay Audio Messages" 
          description="Autoplay consecutively sent audio messages."
          rightElement={<Toggle checked={settings.autoplayAudio} onChange={() => toggleSetting('autoplayAudio')} />}
        />

        <SectionTitle title="Blocked Contacts" />
        <SettingRow 
          title="Blocked Contacts" 
          description="View and manage blocked contacts."
          rightElement={<ChevronRightIcon size={20} color="#888" />}
          onClick={() => navigate('/settings/blocked-contacts')}
        />
      </div>
    </div>
  );
}
