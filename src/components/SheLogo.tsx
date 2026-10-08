import React from 'react';

interface SheLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtext?: boolean;
}

export const SheLogo: React.FC<SheLogoProps> = ({ size = 'md', showSubtext = true }) => {
  const isSm = size === 'sm';
  const isLg = size === 'lg';

  return (
    <div className="flex items-center space-x-2.5 select-none">
      {/* Stylized Typography Emblem for SHE */}
      <div
        className={`relative flex items-center justify-center rounded-2xl bg-linear-to-tr from-red-600 via-rose-600 to-amber-500 shadow-md shadow-red-500/25 border border-white/20 text-white font-black tracking-tighter ${
          isSm ? 'w-8 h-8 text-sm' : isLg ? 'w-14 h-14 text-2xl' : 'w-10 h-10 text-lg'
        }`}
      >
        <span className="drop-shadow-sm font-extrabold tracking-tight">SHE</span>
        {/* Subtle glowing corner dot */}
        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse"></span>
      </div>

      {showSubtext && (
        <div className="flex flex-col">
          <div className="flex items-center space-x-1.5">
            <span className={`font-black text-slate-800 tracking-tight ${isSm ? 'text-sm' : isLg ? 'text-xl' : 'text-base'}`}>
              SHE SYSTEM
            </span>
            <span className="text-[10px] bg-red-100 text-red-700 font-bold px-1.5 py-0.2 rounded-md">
              SAFETY
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-medium tracking-wide">
            Safety &bull; Health &bull; Environment
          </span>
        </div>
      )}
    </div>
  );
};
