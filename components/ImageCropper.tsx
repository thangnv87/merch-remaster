
import React, { useState, useRef, useEffect } from 'react';

interface ImageCropperProps {
  src: string;
  onConfirm: (croppedBase64: string) => void;
  onCancel: () => void;
}

const ImageCropper: React.FC<ImageCropperProps> = ({ src, onConfirm, onCancel }) => {
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentPos, setCurrentPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Tính toán hình chữ nhật vùng chọn dựa trên điểm bắt đầu và điểm hiện tại
  const getSelectionRect = () => {
    if (!startPos || !currentPos) return null;
    const x = Math.min(startPos.x, currentPos.x);
    const y = Math.min(startPos.y, currentPos.y);
    const width = Math.abs(currentPos.x - startPos.x);
    const height = Math.abs(currentPos.y - startPos.y);
    return { x, y, width, height };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setStartPos({ x, y });
    setCurrentPos({ x, y });
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
    setCurrentPos({ x, y });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleCrop = () => {
    const selection = getSelectionRect();
    const img = imgRef.current;
    if (!selection || !img || selection.width < 10 || selection.height < 10) {
        alert("Vui lòng chọn vùng ảnh cần cắt lớn hơn.");
        return;
    }

    const canvas = document.createElement('canvas');
    const scaleX = img.naturalWidth / img.width;
    const scaleY = img.naturalHeight / img.height;

    canvas.width = selection.width * scaleX;
    canvas.height = selection.height * scaleY;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.drawImage(
        img,
        selection.x * scaleX,
        selection.y * scaleY,
        selection.width * scaleX,
        selection.height * scaleY,
        0,
        0,
        canvas.width,
        canvas.height
      );
      onConfirm(canvas.toDataURL('image/png'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4 select-none">
      <div className="w-full max-w-3xl mb-4 flex justify-between items-center">
        <h3 className="text-white font-bold uppercase tracking-widest text-sm">Công cụ cắt ảnh</h3>
        <div className="flex gap-3">
            <button onClick={onCancel} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold uppercase">Hủy bỏ</button>
            <button onClick={handleCrop} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold uppercase shadow-lg shadow-indigo-500/20">Áp dụng cắt</button>
        </div>
      </div>
      
      <div 
        ref={containerRef}
        className="relative border-2 border-slate-700 shadow-2xl cursor-crosshair overflow-hidden bg-black"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img 
            ref={imgRef}
            src={src} 
            className="max-h-[75vh] max-w-full object-contain pointer-events-none block" 
            alt="Crop source"
        />
        
        {/* Lớp phủ tối */}
        {startPos && currentPos && (
            <div className="absolute inset-0 bg-black/50 pointer-events-none">
                {/* Vùng sáng (Vùng chọn) */}
                <div 
                    style={{
                        position: 'absolute',
                        left: getSelectionRect()?.x,
                        top: getSelectionRect()?.y,
                        width: getSelectionRect()?.width,
                        height: getSelectionRect()?.height,
                        boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
                    }}
                    className="border-2 border-white bg-transparent"
                >
                    {/* Grid lines */}
                    <div className="absolute inset-0 flex flex-col">
                        <div className="flex-1 border-b border-white/30"></div>
                        <div className="flex-1 border-b border-white/30"></div>
                        <div className="flex-1"></div>
                    </div>
                    <div className="absolute inset-0 flex">
                        <div className="flex-1 border-r border-white/30"></div>
                        <div className="flex-1 border-r border-white/30"></div>
                        <div className="flex-1"></div>
                    </div>
                </div>
            </div>
        )}
        
        {(!startPos) && (
             <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                 <span className="bg-black/60 text-white px-3 py-1 rounded text-[10px] backdrop-blur-sm">Kéo chuột để chọn vùng cắt</span>
             </div>
        )}
      </div>
    </div>
  );
};

export default ImageCropper;
