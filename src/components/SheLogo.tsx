import React from 'react';

interface SheLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtext?: boolean;
}

export const SheLogo: React.FC<SheLogoProps> = ({ size = 'md', showSubtext = true }) => {
  const isSm = size === 'sm';
  const isLg = size === 'lg';

  return (
    <div className="flex items-center space-x-2.5 select-none" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
      {/* Stylized Typography Emblem for SHE */}
      <div
        className={`relative flex items-center justify-center rounded-2xl bg-red-600 text-white font-black tracking-tighter ${
          isSm ? 'w-8 h-8 text-sm' : isLg ? 'w-14 h-14 text-2xl' : 'w-10 h-10 text-lg'
        }`}
        style={{
          backgroundColor: '#dc2626',
          backgroundImage: 'linear-gradient(135deg, #dc2626 0%, #e11d48 50%, #f59e0b 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}
      >
        <span className="drop-shadow-sm font-extrabold tracking-tight" style={{ color: '#ffffff' }}>SHE</span>
        {/* Subtle glowing corner dot */}
        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse"></span>
      </div>

      {showSubtext && (
        <div className="flex flex-col" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="flex items-center space-x-1.5" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '6px' }}>
            <span className={`font-black text-slate-800 tracking-tight ${isSm ? 'text-sm' : isLg ? 'text-xl' : 'text-base'}`} style={{ color: '#0f172a' }}>
              SHE SYSTEM
            </span>
            <span className="text-[10px] bg-red-100 text-red-700 font-bold px-1.5 py-0.2 rounded-md" style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}>
              SAFETY
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-medium tracking-wide" style={{ color: '#94a3b8' }}>
            Safety &bull; Health &bull; Environment
          </span>
        </div>
      )}
    </div>
  );
};
