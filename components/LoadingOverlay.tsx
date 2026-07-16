
import React, { useState, useEffect } from 'react';

interface LoadingOverlayProps {
  message?: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ message }) => {
  const [messageIndex, setMessageIndex] = useState(0);
  const defaultMessages = [
    "Đang phân tích bố cục thiết kế...",
    "Trích xuất các thành phần đồ họa...",
    "Đang vẽ lại chi tiết ở độ phân giải 4500x5400...",
    "Làm sắc nét các mảng màu và chữ...",
    "Xử lý bề mặt thiết kế chuẩn MBA...",
    "Hoàn thiện bản in chất lượng cao 300DPI...",
    "Sắp xong rồi, đang đóng gói thiết kế..."
  ];

  const currentMessages = message ? [message] : defaultMessages;

  useEffect(() => {
    if (message) return;
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % defaultMessages.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [message, defaultMessages.length]);

  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-md">
      <div className="relative">
        <div className="w-24 h-24 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <svg className="w-10 h-10 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />
          </svg>
        </div>
      </div>
      <p className="mt-8 text-xl font-medium text-slate-200 animate-pulse text-center px-4 max-w-sm">
        {currentMessages[messageIndex]}
      </p>
      <p className="mt-2 text-sm text-slate-500">Đang thiết kế chuẩn in ấn cao cấp nhất</p>
    </div>
  );
};

export default LoadingOverlay;
