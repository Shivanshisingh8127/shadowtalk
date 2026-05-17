import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft as ArrowLeftIcon, Download, Upload, ShieldCheck as ShieldCheckIcon } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export default function BackupData() {
  const navigate = useNavigate();
  const { user, chats, settings, setSettings, setChats, setUser, showToast, showConfirm } = useAppContext();
  const fileInputRef = useRef(null);

  const handleExport = async () => {
    const confirmed = await showConfirm({
      title: 'Download Backup?',
      message: 'Do you want to download the backup file?',
      icon: Download
    });
    if (!confirmed) return;
    try {
      const backupData = {
        version: '1.0.0',
        timestamp: Date.now(),
        user: {
          id: user?.id,
          name: user.name,
          shadowId: user?.shadowId,
          phrase: user.phrase
        },
        chats: chats,
        settings: settings
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `shadowtalk_backup_${user?.id}_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      showToast('Backup exported successfully!', 'success');
    } catch (err) {
      console.error('Export error:', err);
      showToast('Failed to export backup.', 'error');
    }
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        
        if (!data.user || !data.chats || !data.settings) {
          showToast('Invalid backup file format.', 'error');
          return;
        }

        // Warning: This will overwrite current data
        if (window.confirm('This will overwrite your current local data. Continue?')) {
          setUser(data.user);
          setChats(data.chats);
          setSettings(data.settings);
          showToast('Data restored successfully!', 'success');
          navigate('/settings');
        }
      } catch (err) {
        console.error('Import error:', err);
        showToast('Failed to parse backup file.', 'error');
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  return (
    <div className="app-container animate-fade-in" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div className="screen-header">
        <button className="icon-btn" onClick={() => navigate(-1)} style={{ margin: 0 }}>
          <ArrowLeftIcon size={24} />
        </button>
        <h1 className="header-title">Backup Data</h1>
        <div style={{ width: 40 }} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '16px', borderRadius: 'var(--radius-md)', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <ShieldCheckIcon size={24} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
            Your backups are encrypted with your identity key. Keep your phrase safe to restore your data.
          </p>
        </div>

        <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-soft)' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '12px' }}>Export Data</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px', lineHeight: '1.5' }}>
            Save an encrypted copy of your chats, contacts, and settings. You can use this file to move your data to another device.
          </p>
          <button className="btn-primary" style={{ gap: '10px' }} onClick={handleExport}>
            <Download size={20} /> Export Backup File
          </button>
        </div>

        <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-soft)' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '12px' }}>Restore Data</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px', lineHeight: '1.5' }}>
            Import an existing backup file to restore your account data. This will overwrite your current local data.
          </p>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImport} 
            accept=".json" 
            style={{ display: 'none' }} 
          />
          <button 
            className="btn-secondary" 
            style={{ gap: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}
            onClick={() => fileInputRef.current.click()}
          >
            <Upload size={20} /> Import Backup File
          </button>
        </div>
      </div>
    </div>
  );
}
