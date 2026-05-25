import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft as ArrowLeftIcon, Check as CheckIcon, Image as ImageIcon } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { triggerHaptic } from '../utils/haptics';

const ThemeOption = ({ name, theme: t, variant: v, active, onClick }) => {
  const isDark = t === 'dark';
  const isOcean = v === 'ocean';
  
  // Preview colors
  const bgColor = isDark ? (isOcean ? '#0a1428' : '#000') : (isOcean ? '#eef5ff' : '#fff');
  const barColor = isDark ? '#333' : '#eee';
  const accentPreview = isOcean ? '#00bfff' : '#00d28d';
  
  return (
    <div 
      onClick={onClick}
      className="hoverable"
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '14px 16px',
        backgroundColor: 'transparent',
        borderBottom: '1px solid var(--border-color)'
      }}
    >
      <div style={{
        width: '48px',
        height: '40px',
        borderRadius: '8px',
        backgroundColor: bgColor,
        marginRight: '16px',
        display: 'flex',
        flexDirection: 'column',
        padding: '8px',
        gap: '6px',
        border: '1px solid var(--border-color)',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{ width: '60%', height: '4px', backgroundColor: barColor, borderRadius: '2px' }} />
        <div style={{ width: '100%', height: '4px', backgroundColor: accentPreview, borderRadius: '2px', alignSelf: 'flex-end' }} />
      </div>
      <div style={{ flex: 1, color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.95rem' }}>{name}</div>
      <div style={{
        width: '22px',
        height: '22px',
        borderRadius: '50%',
        border: `2px solid ${active ? 'var(--accent-primary)' : 'var(--text-muted)'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s'
      }}>
        {active && <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)' }} />}
      </div>
    </div>
  );
};

export default function Appearance() {
  const navigate = useNavigate();
  const { 
    theme, setTheme, 
    themeVariant, setThemeVariant, 
    primaryColor, setPrimaryColor,
    globalWallpaper, setGlobalWallpaper,
    followSystem, setFollowSystem,
    showToast
  } = useAppContext();

  const fileInputRef = useRef(null);

  const colors = [
    '#00ff88', // Green
    '#00ccff', // Light Blue
    '#ffcc00', // Yellow
    '#ff66cc', // Pink
    '#8b5cf6', // Purple
    '#ff9900', // Orange
    '#ff4444', // Red
  ];

  const handleThemeChange = (t, v) => {
    triggerHaptic(15);
    setTheme(t);
    setThemeVariant(v);
  };

  const handleCustomWallpaper = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      if (showToast) showToast('Please select an image file', 'error');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      if (showToast) showToast('Image is too large (max 2MB)', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Scale down if too large
        const MAX_DIM = 1200;
        if (width > height && width > MAX_DIM) {
          height *= MAX_DIM / width;
          width = MAX_DIM;
        } else if (height > MAX_DIM) {
          width *= MAX_DIM / height;
          height = MAX_DIM;
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Compress as JPEG
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setGlobalWallpaper(dataUrl);
        if (showToast) showToast('Custom wallpaper applied!', 'success');
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset input
  };

  return (
    <div className="app-container animate-fade-in" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div className="screen-header">
        <button className="icon-btn" onClick={() => navigate(-1)} style={{ margin: 0 }}>
          <ArrowLeftIcon size={24} />
        </button>
        <h1 className="header-title">Appearance</h1>
        <div style={{ width: 40 }} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        <div className="section-label">Themes</div>
        <div className="glass-box" style={{ borderRadius: '24px', overflow: 'hidden', border: 'none', marginBottom: '32px' }}>
          <ThemeOption 
            name="Classic Dark" 
            theme="dark" variant="classic" 
            active={theme === 'dark' && themeVariant === 'classic'} 
            onClick={() => handleThemeChange('dark', 'classic')} 
          />
          <ThemeOption 
            name="Classic Light" 
            theme="light" variant="classic" 
            active={theme === 'light' && themeVariant === 'classic'} 
            onClick={() => handleThemeChange('light', 'classic')} 
          />
          <ThemeOption 
            name="Ocean Dark" 
            theme="dark" variant="ocean" 
            active={theme === 'dark' && themeVariant === 'ocean'} 
            onClick={() => handleThemeChange('dark', 'ocean')} 
          />
          <ThemeOption 
            name="Ocean Light" 
            theme="light" variant="ocean" 
            active={theme === 'light' && themeVariant === 'ocean'} 
            onClick={() => handleThemeChange('light', 'ocean')} 
          />
        </div>

        <div className="section-label">Primary Color</div>
        
        {/* Preview Section */}
        <div style={{ 
          backgroundColor: 'var(--bg-secondary)', 
          padding: '24px', 
          borderRadius: '20px', 
          border: '1px solid var(--border-color)',
          marginBottom: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div style={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
            <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '12px 16px', borderRadius: '16px', borderBottomLeftRadius: '4px', fontSize: '0.9rem', position: 'relative' }}>
               <div style={{ position: 'absolute', left: '-8px', top: '4px', width: '2px', height: '16px', backgroundColor: primaryColor, borderRadius: '2px' }} />
               <div style={{ fontWeight: 600, fontSize: '0.75rem', marginBottom: '4px' }}>You</div>
               <div>How are you?</div>
               <div style={{ color: 'var(--text-secondary)', marginTop: '4px', fontSize: '0.85rem' }}>I'm good thanks, you?</div>
            </div>
          </div>
          
          <div style={{ alignSelf: 'flex-end', maxWidth: '85%' }}>
            <div style={{ 
              backgroundColor: primaryColor, 
              color: '#000', 
              padding: '12px 18px', 
              borderRadius: '16px', 
              borderBottomRightRadius: '4px', 
              fontSize: '0.9rem',
              fontWeight: 600,
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}>
              I'm doing great, thanks.
            </div>
          </div>
        </div>

        {/* Color Picker Circles */}
        <div style={{ display: 'flex', gap: '14px', marginBottom: '32px', flexWrap: 'wrap', alignItems: 'center' }}>
          {colors.map(color => (
            <div 
              key={color}
              onClick={() => {
                triggerHaptic(10);
                setPrimaryColor(color);
              }}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: color,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                transition: 'transform 0.2s'
              }}
            >
              {primaryColor === color && (
                <div style={{ 
                  position: 'absolute', 
                  width: '42px', 
                  height: '42px', 
                  borderRadius: '50%', 
                  border: '2px solid var(--text-primary)',
                  backgroundColor: 'transparent'
                }} />
              )}
            </div>
          ))}
          <label style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
            border: !colors.includes(primaryColor) ? '2px solid var(--text-primary)' : '2px solid transparent',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
          }}>
            <input 
              type="color" 
              value={primaryColor} 
              onChange={(e) => setPrimaryColor(e.target.value)} 
              style={{ opacity: 0, width: '100%', height: '100%', cursor: 'pointer', position: 'absolute', inset: 0 }} 
            />
          </label>
        </div>

        <div className="section-label">Global Wallpaper</div>
        
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          accept="image/*"
          onChange={handleCustomWallpaper}
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '32px' }}>
          <div 
            onClick={() => fileInputRef.current?.click()}
            style={{ 
              height: '80px', borderRadius: '12px', cursor: 'pointer', position: 'relative', overflow: 'hidden',
              border: '1px dashed var(--border-color)',
              backgroundColor: 'var(--bg-secondary)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)', transition: 'all 0.2s'
            }}
            className="hoverable"
          >
            <ImageIcon size={24} style={{ marginBottom: '4px' }} />
            <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>Custom</span>
          </div>
          {[
            { name: 'None', val: '', color: 'var(--bg-primary)' },
            { name: 'Liquid Dark', val: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1920&q=80', color: '#1a1a2e' },
            { name: 'Purple Gradient', val: 'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=1920&q=80', color: '#1b0922' },
            { name: 'Starry Subtle', val: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?auto=format&fit=crop&w=1920&q=80', color: '#0f1423' },
            { name: 'Dark Mesh', val: 'https://images.unsplash.com/photo-1604871000636-074fa5117945?auto=format&fit=crop&w=1920&q=80', color: '#1a1c29' },
            { name: 'Blue Texture', val: 'https://images.unsplash.com/photo-1518655048521-f130df041f66?auto=format&fit=crop&w=1920&q=80', color: '#151d29' },
            { name: 'Velvet', val: 'https://images.unsplash.com/photo-1511447333015-45b65e60f6d5?auto=format&fit=crop&w=1920&q=80', color: '#1f132e' },
            { name: 'Deep Space', val: 'https://images.unsplash.com/photo-1523821741446-edb2fc823bc2?auto=format&fit=crop&w=1920&q=80', color: '#0a0a0a' },
            { name: 'Dark Geo', val: 'https://images.unsplash.com/photo-1505909182942-e2f09aee3e89?auto=format&fit=crop&w=1920&q=80', color: '#1c1c1c' },
            { name: 'Dark Waves', val: 'https://images.unsplash.com/photo-1491895200222-0fc4a4c35e18?auto=format&fit=crop&w=1920&q=80', color: '#1a1a1a' },
            { name: 'Minimal Blur', val: 'https://images.unsplash.com/photo-1634152962476-4b8a00e1915c?auto=format&fit=crop&w=1920&q=80', color: '#0b2415' },
            { name: 'Dark Gradient', val: 'https://images.unsplash.com/photo-1587595431973-160d0d94add1?auto=format&fit=crop&w=1920&q=80', color: '#1f2a3a' },
            { name: 'Soft Mesh', val: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&w=1920&q=80', color: '#2c2514' },
            { name: 'Frosted Dark', val: 'https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?auto=format&fit=crop&w=1920&q=80', color: '#1a1014' },
            { name: 'Vivid Blur', val: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1920&q=80', color: '#2e1c14' },
            { name: 'Topographic', val: 'https://images.unsplash.com/photo-1604147495798-57beb5d6af73?auto=format&fit=crop&w=1920&q=80', color: '#0a0a2a' },
            { name: '3D Waves', val: 'https://images.unsplash.com/photo-1633613286991-611fe299c4bf?auto=format&fit=crop&w=1920&q=80', color: '#2d3436' },
            { name: 'Minimal Night', val: 'https://images.unsplash.com/photo-1502657877623-f66bf489d236?auto=format&fit=crop&w=1920&q=80', color: '#031424' },
            { name: 'Dark Gold', val: 'https://images.unsplash.com/photo-1550684376-ef3b2f11595a?auto=format&fit=crop&w=1920&q=80', color: '#27ae60' },
            { name: 'Crimson Night', val: 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?auto=format&fit=crop&w=1920&q=80', color: '#4a1525' }
          ].map(wp => (
            <div 
              key={wp.name}
              onClick={() => setGlobalWallpaper(wp.val)}
              style={{ 
                height: '80px', borderRadius: '12px', cursor: 'pointer', position: 'relative', overflow: 'hidden',
                border: globalWallpaper === wp.val ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                backgroundImage: wp.val ? `url(${wp.val.replace('w=1920', 'w=200')})` : 'none',
                backgroundColor: wp.color,
                backgroundSize: 'cover', backgroundPosition: 'center',
                boxShadow: globalWallpaper === wp.val ? '0 0 0 2px var(--bg-primary), 0 0 0 4px var(--accent-primary)' : 'none',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '0.65rem', textAlign: 'center', fontWeight: 600 }}>
                {wp.name}
              </div>
            </div>
          ))}
        </div>

        <div className="section-label">Auto Dark Mode</div>
        <div 
          onClick={() => setFollowSystem(!followSystem)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--bg-secondary)', padding: '18px 16px', borderRadius: '16px', border: '1px solid var(--border-color)', cursor: 'pointer' }}
        >
          <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Follow System Settings</span>
          <div style={{ 
            width: '46px', 
            height: '24px', 
            backgroundColor: followSystem ? 'var(--accent-primary)' : 'var(--bg-tertiary)', 
            borderRadius: '12px', 
            position: 'relative',
            transition: 'background-color 0.2s'
          }}>
             <div style={{ 
               position: 'absolute', 
               left: followSystem ? '24px' : '2px', 
               top: '2px', 
               width: '20px', 
               height: '20px', 
               backgroundColor: followSystem ? '#000' : 'var(--text-muted)', 
               borderRadius: '50%',
               transition: 'all 0.2s'
             }} />
          </div>
        </div>
      </div>
    </div>
  );
}
