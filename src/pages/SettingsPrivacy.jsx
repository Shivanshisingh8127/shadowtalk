import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft as ArrowLeftIcon, MoreHorizontal, ChevronRight as ChevronRightIcon } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

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
  <div style={{ padding: '24px 16px 8px', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px' }}>
    {title}
  </div>
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
    {rightElement && <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>{rightElement}</div>}
  </div>
);

export default function SettingsPrivacy() {
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
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 auto', transform: 'translateX(-12px)' }}>Privacy</h1>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '30px' }}>
        <SectionTitle title="Voice and Video Calls (Beta)" />
        <SettingRow 
          title="Voice and Video Calls" 
          description="Enables voice and video calls to and from other users."
          rightElement={<Toggle checked={settings.voiceVideo || false} onChange={() => toggleSetting('voiceVideo')} />}
        />



        {/* Blocking section removed as requested */}

        <SectionTitle title="Read Receipts" />
        <SettingRow 
          title="Read Receipts" 
          description="Show read receipts for all messages you send and receive."
          rightElement={<Toggle checked={settings.readReceipts} onChange={() => toggleSetting('readReceipts')} />}
        />

        <SectionTitle title="Typing Indicators" />
        <SettingRow 
          title="Typing Indicators" 
          description="See and share typing indicators."
          rightElement={
            <>
              <div style={{ 
                backgroundColor: '#333', 
                borderRadius: '16px', 
                padding: '4px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}>
                <MoreHorizontal size={16} color="#aaa" />
              </div>
              <Toggle checked={settings.typingIndicators} onChange={() => toggleSetting('typingIndicators')} />
            </>
          }
        />
      </div>
    </div>
  );
}
