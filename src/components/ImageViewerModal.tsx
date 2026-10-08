import React, { useState, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, Download, Maximize2 } from 'lucide-react';

interface ImageViewerModalProps {
  imageUrl: string | null;
  title?: string;
  onClose: () => void;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  imageUrl,
  title,
  onClose
}) => {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!imageUrl) return null;

  const handleZoomIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    setScale(prev => Math.min(prev + 0.3, 3));
  };

  const handleZoomOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    setScale(prev => Math.max(prev - 0.3, 0.5));
  };

  const handleResetZoom = (e: React.MouseEvent) => {
    e.stopPropagation();
    setScale(1);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex flex-col items-center justify-between p-4 animate-in fade-in"
    >
      {/* Top Bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl flex items-center justify-between py-2 px-4 bg-slate-900/80 rounded-2xl border border-slate-700/60 text-white z-10"
      >
        <div className="flex items-center space-x-2">
          <Maximize2 className="w-4 h-4 text-red-400" />
          <span className="text-sm font-medium truncate max-w-md">
            {title || 'ดูรูปภาพขนาดใหญ่'}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleZoomIn}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition"
            title="ขยาย (+)"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition"
            title="ย่อ (-)"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <button
            onClick={handleResetZoom}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition"
            title="รีเซ็ตขนาด (100%)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <a
            href={imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            download="she_image.jpg"
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition"
            title="ดาวน์โหลด / เปิดแท็บใหม่"
          >
            <Download className="w-5 h-5" />
          </a>
          <button
            onClick={onClose}
            className="p-2 text-red-400 hover:text-white hover:bg-red-600/80 rounded-xl transition ml-2"
            title="ปิดหน้าต่าง (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Image Container */}
      <div
        className="flex-1 w-full flex items-center justify-center overflow-auto p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <img
          src={imageUrl}
          alt={title || 'รูปภาพขยาย'}
          style={{ transform: `scale(${scale})`, transition: 'transform 0.15s ease-out' }}
          className="max-h-[82vh] max-w-full object-contain rounded-xl shadow-2xl cursor-grab active:cursor-grabbing select-none"
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* Bottom Hint */}
      <div className="text-[11px] text-slate-400 py-1">
        กด Esc หรือคลิกพื้นที่ว่างภายนอกเพื่อปิดหน้าต่าง
      </div>
    </div>
  );
};
