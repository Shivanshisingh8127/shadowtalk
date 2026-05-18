import React, { useState, useEffect, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { 
  MessageSquare as MessageSquareIcon, 
  Inbox as InboxIcon, 
  Users as UsersIcon, 
  User as UserIcon,
  Phone as PhoneIcon
} from 'lucide-react';
import { AppProvider, useAppContext } from './context/AppContext';
import { triggerHaptic } from './utils/haptics';

// Pages imports - Core (Static)
import Splash from './pages/Splash';
import Onboarding from './pages/Onboarding';
import IdentityCreation from './pages/IdentityCreation';
import SecuritySetup from './pages/SecuritySetup';
import Chats from './pages/Chats';
import ChatDetail from './pages/ChatDetail';

// Pages imports - Secondary (Lazy)
const Requests = lazy(() => import('./pages/Requests'));
const Calls = lazy(() => import('./pages/Calls'));
const Groups = lazy(() => import('./pages/Groups'));
const CreateGroup = lazy(() => import('./pages/CreateGroup'));
const Settings = lazy(() => import('./pages/Settings'));
const NewChat = lazy(() => import('./pages/NewChat'));
const SearchContacts = lazy(() => import('./pages/SearchContacts'));
const ContactProfile = lazy(() => import('./pages/ContactProfile'));
const InviteFriend = lazy(() => import('./pages/InviteFriend'));
const JoinCommunity = lazy(() => import('./pages/JoinCommunity'));
const SettingsConversations = lazy(() => import('./pages/SettingsConversations'));
const BlockedContacts = lazy(() => import('./pages/BlockedContacts'));
const RecoveryPassword = lazy(() => import('./pages/RecoveryPassword'));
const SettingsPrivacy = lazy(() => import('./pages/SettingsPrivacy'));
const BackupData = lazy(() => import('./pages/BackupData'));
const LinkedDevices = lazy(() => import('./pages/LinkedDevices'));
const Appearance = lazy(() => import('./pages/Appearance'));

import SecurityLock from './components/SecurityLock';
import CallModal from './modules/calling/components/CallModal';
import IncomingCallPopup from './modules/calling/components/IncomingCallPopup';
import MinimizedCall from './modules/calling/components/MinimizedCall';
import CallNotificationToast from './components/CallNotificationToast';

import './App.css';

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { requests } = useAppContext();
  
  const tabs = [
    { id: 'chats', path: '/chats', icon: <MessageSquareIcon size={24} />, label: 'Chats' },
    { id: 'calls', path: '/calls', icon: <PhoneIcon size={24} />, label: 'Calls', badge: window.AppContextValue?.unreadMissedCalls || 0 },
    { id: 'requests', path: '/requests', icon: <InboxIcon size={24} />, label: 'Requests', badge: requests.length },
    { id: 'groups', path: '/groups', icon: <UsersIcon size={24} />, label: 'Groups' },
    { id: 'settings', path: '/settings', icon: <UserIcon size={24} />, label: 'Profile' }
  ];

  // Hide bottom nav in detail screens like ChatDetail, NewChat
  const hideNavRoutes = ['/chat/', '/new', '/create-group', '/search', '/profile/', '/invite', '/join', '/settings/'];
  if (hideNavRoutes.some(route => location.pathname.includes(route))) return null;

  return (
    <div className="bottom-nav" style={{ justifyContent: 'center', gap: '12px', padding: '0 10px' }}>
      {tabs.map(tab => {
        const isActive = location.pathname.startsWith(tab.path);
        return (
          <button 
            key={tab.id} 
            className={`nav-item ${isActive ? 'active' : ''}`}
            onClick={() => {
              triggerHaptic(15);
              navigate(tab.path);
            }}
            style={{ 
              flexDirection: 'row', 
              gap: '8px', 
              padding: '10px 12px',
              borderRadius: '12px',
              backgroundColor: isActive ? 'rgba(0, 255, 136, 0.1)' : 'transparent',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              flex: 1
            }}
          >
            <div className="nav-icon-wrapper" style={{ display: 'flex', alignItems: 'center', marginBottom: 0 }}>
              {tab.icon}
              {tab.badge > 0 && (
                <span className="nav-badge" style={{ 
                  position: 'absolute', 
                  top: '-8px', 
                  right: '-10px',
                  backgroundColor: 'var(--accent-danger)',
                  color: 'white',
                  fontSize: '0.65rem',
                  padding: '2px 6px',
                  borderRadius: '10px',
                  border: '2px solid var(--bg-secondary)'
                }}>
                  {tab.badge}
                </span>
              )}
            </div>
            <span className="nav-label" style={{ 
              fontSize: '0.85rem', 
              fontWeight: 600,
              opacity: isActive ? 1 : 0.7
            }}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};

const ProtectedRoute = () => {
  const { user, settings, isLoading, isOffline } = useAppContext();
  const location = useLocation();
  const [isAppLocked, setIsAppLocked] = useState(settings.lockApp);

  useEffect(() => {
    // Re-lock if setting changes to true
    if (settings.lockApp) {
      setIsAppLocked(true);
    } else {
      setIsAppLocked(false);
    }
  }, [settings.lockApp]);

  if (isLoading) {
    return (
      <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '20px', backgroundColor: '#000' }}>
        <div className="spinner" style={{ width: 40, height: 40, borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }} />
        <div style={{ color: 'var(--accent-primary)', fontSize: '0.9rem', fontWeight: 600, letterSpacing: '1px' }}>SHADOWTALK IS LOADING...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/splash" replace />;
  
  if (isAppLocked) {
    return <SecurityLock onUnlock={() => setIsAppLocked(false)} />;
  }

  const hideNavRoutes = ['/chat/', '/new', '/create-group', '/search', '/profile/', '/invite', '/join', '/settings/'];
  const isNavHidden = hideNavRoutes.some(route => location.pathname.includes(route));

  return (
    <div className="app-container animate-fade-in">
      {isOffline && (
        <div style={{
          backgroundColor: 'var(--accent-danger)',
          color: '#fff',
          textAlign: 'center',
          padding: '4px',
          fontSize: '0.75rem',
          fontWeight: 'bold',
          position: 'absolute',
          top: 0, left: 0, right: 0,
          zIndex: 200
        }}>
          Offline - Reconnecting...
        </div>
      )}
      <div className={`app-content ${isNavHidden ? 'no-nav' : ''}`} style={{ paddingTop: isOffline ? '24px' : '0' }}>
        <Outlet />
      </div>
    </div>
  );
};

const AppContent = () => {
  const { user, toast, isCalling, isLoading } = useAppContext();
  
  return (
    <>
      <CallModal />
      <IncomingCallPopup />
      <MinimizedCall />
      <CallNotificationToast />
      {toast && (
        <div className="toast-container animate-fade-in" style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: toast.type === 'error' ? 'rgba(255, 68, 68, 0.95)' : 'rgba(0, 255, 136, 0.95)',
          color: toast.type === 'error' ? '#fff' : '#000',
          padding: '12px 24px',
          borderRadius: '12px',
          zIndex: 9999,
          fontWeight: '600',
          boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          minWidth: '280px',
          justifyContent: 'center',
          textAlign: 'center'
        }}>
          {toast.message}
        </div>
      )}
      <Suspense fallback={
        <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}>
          <div className="spinner" style={{ width: 30, height: 30, borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }} />
        </div>
      }>
        <Routes>
          {/* Public Routes */}
          <Route path="/splash" element={user ? <Navigate to="/chats" replace /> : <Splash />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/identity" element={<IdentityCreation />} />
          
          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/chats" element={<Chats />} />
            <Route path="/calls" element={<Calls />} />
            <Route path="/requests" element={<Requests />} />
            <Route path="/groups" element={<Groups />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/settings/conversations" element={<SettingsConversations />} />
            <Route path="/settings/blocked-contacts" element={<BlockedContacts />} />
            <Route path="/settings/recovery-password" element={<RecoveryPassword />} />
            <Route path="/settings/privacy" element={<SettingsPrivacy />} />
            <Route path="/settings/backup" element={<BackupData />} />
            <Route path="/settings/linked-devices" element={<LinkedDevices />} />
            <Route path="/settings/appearance" element={<Appearance />} />
            <Route path="/chat/:id" element={<ChatDetail />} />
            <Route path="/profile/:id" element={<ContactProfile />} />
            <Route path="/new-chat" element={<NewChat />} />
            <Route path="/create-group" element={<CreateGroup />} />
            <Route path="/invite-friend" element={<InviteFriend />} />
            <Route path="/join-community" element={<JoinCommunity />} />
            <Route path="/search" element={<SearchContacts />} />
            <Route path="/" element={<Navigate to="/chats" replace />} />
          </Route>
          
          <Route path="*" element={<Navigate to="/splash" replace />} />
        </Routes>
      </Suspense>
    </>
  );
};

function App() {
  return (
    <AppProvider>
      <HashRouter>
        <AppContent />
      </HashRouter>
    </AppProvider>
  );
}

export default App;
