import React from 'react';

// Official JDE Peet's Logo as base64 data URI to guarantee instant zero-latency loading and 100% reliable PDF exports (no CORS/cross-origin issues)
export const JDE_PEETS_LOGO_BASE64 = 'data:image/webp;base64,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';

interface SheLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtext?: boolean;
  className?: string;
}

export const SheLogo: React.FC<SheLogoProps> = ({ size = 'md', showSubtext = true, className = '' }) => {
  const isSm = size === 'sm';
  const isLg = size === 'lg';

  // Specific height scales maintaining aspect ratio (~2.31:1):
  // sm: 24px (~55px width)
  // md: 32px (~74px width)
  // lg: 48px (~111px width)
  const imgHeight = isSm ? '24px' : isLg ? '48px' : '32px';

  return (
    <div
      className={`flex items-center select-none shrink-0 whitespace-nowrap ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 0,
        whiteSpace: 'nowrap'
      }}
    >
      {/* Official JDE Peet's Brand Logo */}
      <img
        src={JDE_PEETS_LOGO_BASE64}
        alt="JDE Peet's"
        className="object-contain shrink-0"
        style={{
          height: imgHeight,
          width: 'auto',
          display: 'block',
          flexShrink: 0
        }}
      />

      {showSubtext && (
        <div
          className="flex flex-col border-l border-slate-200 pl-2.5 sm:pl-3 ml-2.5 sm:ml-3 shrink-0 whitespace-nowrap text-left"
          style={{
            display: 'flex',
            flexDirection: 'column',
            borderLeft: '1px solid #cbd5e1',
            paddingLeft: '10px',
            marginLeft: '10px',
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            flexShrink: 0,
            textAlign: 'left'
          }}
        >
          <span
            className={`font-black text-slate-800 tracking-tight whitespace-nowrap shrink-0 ${isSm ? 'text-xs' : isLg ? 'text-lg' : 'text-sm'}`}
            style={{ color: '#0f172a' }}
          >
            SHE SYSTEM
          </span>
          <span
            className="hidden xl:block text-[10px] text-slate-400 font-medium tracking-wide mt-0.5 whitespace-nowrap shrink-0"
            style={{ color: '#94a3b8' }}
          >
            Safety &bull; Health &bull; Environment
          </span>
        </div>
      )}
    </div>
  );
};
