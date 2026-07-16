
import React, { useRef, useEffect, useState } from 'react';

interface BackgroundRemoverProps {
  src: string;
  onConfirm: (processedBase64: string) => void;
  onCancel: () => void;
  onUpscale?: (image: string) => void;
}

type ToolType = 'wand' | 'eraser' | 'restore';

const BackgroundRemover: React.FC<BackgroundRemoverProps> = ({ src, onConfirm, onCancel, onUpscale }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tolerance, setTolerance] = useState<number>(30); // Giảm mặc định xuống 30 để an toàn hơn
  const [isContiguous, setIsContiguous] = useState<boolean>(true); 
  const [tool, setTool] = useState<ToolType>('wand');
  const [brushSize, setBrushSize] = useState<number>(50);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [smoothEdges, setSmoothEdges] = useState(true);

  useEffect(() => {
    const img = new Image();
    img.src = src;
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const maxWidth = 1200;
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        const ratio = maxWidth / width;
        width = maxWidth;
        height = img.height * ratio;
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      
      ctx.drawImage(img, 0, 0, width, height);
      const initialData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setHistory([initialData]);
      setHistoryIndex(0);
    };
  }, [src]);

  const saveStateToHistory = (newData: ImageData) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newData);
    if (newHistory.length > 20) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        ctx.putImageData(history[newIndex], 0, 0);
      }
    }
  };

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `magic_wand_edit_${Date.now()}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  // NÂNG CẤP: Redmean Color Distance
  // Công thức này mô phỏng mắt người tốt hơn Euclidean thường
  // Giúp phân biệt tốt hơn giữa nền kem/trắng ngà và chữ trắng
  const colorDistance = (r1: number, g1: number, b1: number, r2: number, g2: number, b2: number) => {
    const rmean = (r1 + r2) / 2;
    const r = r1 - r2;
    const g = g1 - g2;
    const b = b1 - b2;
    // Trọng số: Mắt người nhạy cảm nhất với màu xanh lá (Green), rồi đến Đỏ, rồi đến Xanh dương
    return Math.sqrt((((512 + rmean) * r * r) >> 8) + 4 * g * g + (((767 - rmean) * b * b) >> 8));
  };

  // Hàm làm mịn cạnh (Blur Alpha channel)
  const applyEdgeSmoothing = (data: Uint8ClampedArray, width: number, height: number) => {
      // Copy kênh Alpha
      const alphaChannel = new Uint8Array(width * height);
      for (let i = 0; i < width * height; i++) {
          alphaChannel[i] = data[i * 4 + 3];
      }

      // Box Blur 3x3 đơn giản trên kênh Alpha để làm mềm răng cưa
      for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
              const idx = y * width + x;
              // Chỉ xử lý các điểm có alpha thay đổi (cạnh)
              if (alphaChannel[idx] > 0 && alphaChannel[idx] < 255) {
                   // Bỏ qua, đã bán trong suốt
              } else if (alphaChannel[idx] === 0) {
                   // Kiểm tra hàng xóm, nếu hàng xóm đặc, thì ta là cạnh ngoài
                   let hasOpaqueNeighbor = false;
                   const neighbors = [
                       idx - 1, idx + 1, idx - width, idx + width
                   ];
                   for (const n of neighbors) {
                       if (alphaChannel[n] === 255) { hasOpaqueNeighbor = true; break; }
                   }
                   if (hasOpaqueNeighbor) {
                        // Làm mềm nhẹ pixel này
                        data[idx * 4 + 3] = 64; // Fade nhẹ
                   }
              } else {
                  // Pixel đặc (255)
                  // Kiểm tra hàng xóm, nếu hàng xóm rỗng, ta là cạnh trong
                  let hasTransparentNeighbor = false;
                   const neighbors = [
                       idx - 1, idx + 1, idx - width, idx + width
                   ];
                   for (const n of neighbors) {
                       if (alphaChannel[n] === 0) { hasTransparentNeighbor = true; break; }
                   }
                   if (hasTransparentNeighbor) {
                       data[idx * 4 + 3] = 192; // Fade nhẹ cạnh trong
                   }
              }
          }
      }
  };

  const performWandAction = (startX: number, startY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const w = canvas.width, h = canvas.height;
    const startIdx = (startY * w + startX) * 4;
    const tr = data[startIdx], tg = data[startIdx+1], tb = data[startIdx+2];
    
    // Redmean max dist is approx 765. 
    // Tolerance 0-100 needs to map to roughly 0-200 range logic effectively.
    // Tăng scale lên một chút để match với slider 0-100
    const threshold = tolerance * tolerance * 0.2 + tolerance * 2; 

    if (isContiguous) {
      // Flood Fill (Vùng dính liền) - Stack Based
      const stack = [startIdx];
      const visited = new Uint8Array(w * h); // Đánh dấu pixel đã duyệt để tránh lặp vô tận
      visited[startIdx / 4] = 1;
      
      while (stack.length > 0) {
        const idx = stack.pop()!;
        data[idx + 3] = 0; // Xóa (Alpha = 0)
        
        const neighbors = [idx+4, idx-4, idx+w*4, idx-w*4];
        for (const nIdx of neighbors) {
          const pixelIndex = nIdx / 4;
          // Boundary check
          if (pixelIndex >= 0 && pixelIndex < w * h && !visited[pixelIndex]) {
             // Chỉ duyệt nếu pixel chưa bị xóa
             if (data[nIdx+3] !== 0) {
                const dist = colorDistance(data[nIdx], data[nIdx+1], data[nIdx+2], tr, tg, tb);
                if (dist <= threshold) {
                  visited[pixelIndex] = 1;
                  stack.push(nIdx);
                }
             }
          }
        }
      }
    } else {
      // Global Replace (Giống Auto nhưng chọn màu thủ công)
      for (let i = 0; i < data.length; i += 4) {
        if (data[i+3] !== 0) {
            const dist = colorDistance(data[i], data[i+1], data[i+2], tr, tg, tb);
            if (dist <= threshold) data[i+3] = 0;
        }
      }
    }

    if (smoothEdges) {
        applyEdgeSmoothing(data, w, h);
    }

    ctx.putImageData(imageData, 0, 0);
    saveStateToHistory(imageData);
  };

  const handleTrim = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setIsLoading(true);
    setTimeout(() => {
      const w = canvas.width, h = canvas.height;
      const data = ctx.getImageData(0, 0, w, h).data;
      let minX = w, minY = h, maxX = 0, maxY = 0, found = false;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (data[(y*w+x)*4+3] > 10) {
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
            found = true;
          }
        }
      }
      if (!found) { setIsLoading(false); return; }
      const bW = maxX - minX + 1, bH = maxY - minY + 1;
      const temp = document.createElement('canvas');
      temp.width = 4500; temp.height = 5400;
      const tCtx = temp.getContext('2d');
      if (tCtx) {
        const scale = Math.min(4300 / bW, 5200 / bH);
        tCtx.drawImage(canvas, minX, minY, bW, bH, (4500-bW*scale)/2, (5400-bH*scale)/2, bW*scale, bH*scale);
        canvas.width = 4500; canvas.height = 5400;
        ctx.putImageData(tCtx.getImageData(0, 0, 4500, 5400), 0, 0);
        saveStateToHistory(tCtx.getImageData(0, 0, 4500, 5400));
      }
      setIsLoading(false);
    }, 100);
  };

  const applyBrush = (cx: number, cy: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const r = brushSize / 2;
    ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
    
    // Nếu là restore (khôi phục), ta cần vẽ lại từ ảnh gốc. 
    // Tuy nhiên implementation hiện tại chưa lưu ảnh gốc để restore từng phần. 
    // Tạm thời 'restore' sẽ hoạt động như một brush vẽ đè màu trắng (hoặc có thể bỏ qua nếu chưa cần).
    // Ở đây ta giữ logic Eraser vs Brush thường.
    
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  };

  const getCoords = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#020617] p-4 font-['Inter']">
      <div className="w-full max-w-5xl bg-slate-900/95 border border-slate-800 p-6 rounded-[2.5rem] shadow-[0_0_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl mb-4">
        <div className="flex justify-between items-center mb-6">
          <div className="flex flex-col">
              <h2 className="text-white font-black uppercase tracking-widest text-xs flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                Bộ Xử Lý Nền AI (Magic Wand)
              </h2>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter mt-1">Chọn thủ công & Cắt tự động 4500x5400</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleUndo} disabled={historyIndex <= 0} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-[10px] font-black uppercase disabled:opacity-20 border border-slate-700 transition-all">Hoàn tác</button>
            <button onClick={handleDownload} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-[10px] font-black uppercase border border-slate-700 transition-all flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                Tải về (PNG)
            </button>
            <button onClick={handleTrim} className="px-4 py-2 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white rounded-xl text-[10px] font-black uppercase border border-indigo-500/30 transition-all">Trim (4500x5400)</button>
            <button onClick={onCancel} className="px-4 py-2 bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase border border-slate-700">Hủy</button>
            <button onClick={() => onConfirm(canvasRef.current!.toDataURL())} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase border border-indigo-400 shadow-xl shadow-indigo-600/30 hover:scale-[1.02] transition-all">Xác nhận</button>
          </div>
        </div>

        <div className="flex gap-8 items-center bg-slate-950/50 p-4 rounded-2xl border border-slate-800/50">
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button onClick={() => setTool('wand')} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${tool === 'wand' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Đũa thần</button>
            <button onClick={() => setTool('eraser')} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${tool === 'eraser' ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Tẩy</button>
          </div>
          
          <div className="flex items-center gap-6 flex-1">
            <div className="flex-1 flex flex-col gap-1.5">
              <div className="flex justify-between text-[9px] font-black uppercase text-slate-500 tracking-widest">
                  <span>Ngưỡng (Tolerance)</span>
                  <span className="text-emerald-400">{tolerance}</span>
              </div>
              <input type="range" min="1" max="100" value={tolerance} onChange={(e) => setTolerance(Number(e.target.value))} className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
            </div>

            <div className="h-10 w-px bg-slate-800"></div>

            <label className="flex items-center gap-3 cursor-pointer group">
                <div className="flex flex-col text-right">
                    <span className="text-[9px] font-black uppercase text-slate-400 group-hover:text-emerald-400 transition-colors">Làm mịn biên</span>
                    <span className="text-[7px] text-slate-600 uppercase font-bold">Anti-alias</span>
                </div>
                <input 
                    type="checkbox" 
                    checked={smoothEdges} 
                    onChange={(e) => setSmoothEdges(e.target.checked)} 
                    className="w-5 h-5 rounded-lg border-slate-700 bg-slate-800 text-emerald-600 focus:ring-emerald-500/30 cursor-pointer"
                />
            </label>

            {tool === 'wand' && (
              <button onClick={() => setIsContiguous(!isContiguous)} className={`px-3 py-2.5 rounded-xl text-[9px] font-black uppercase border transition-all ${isContiguous ? 'border-indigo-500/50 text-indigo-400 bg-indigo-500/5' : 'border-slate-700 text-slate-500'}`}>
                {isContiguous ? "Vùng dính liền (Contiguous)" : "Tất cả màu (Global)"}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="relative flex-1 w-full bg-[#010409] border-2 border-dashed border-slate-800 rounded-[3rem] overflow-hidden flex items-center justify-center cursor-crosshair bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px]">
        {isLoading && (
            <div className="absolute inset-0 bg-slate-950/80 z-50 flex flex-col items-center justify-center backdrop-blur-md">
                <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.4em] animate-pulse">Đang xử lý...</p>
            </div>
        )}
        <canvas 
          ref={canvasRef} 
          onMouseDown={(e) => {
            const {x, y} = getCoords(e);
            if (tool === 'wand') performWandAction(Math.floor(x), Math.floor(y));
            else { setIsDragging(true); applyBrush(x, y); }
          }}
          onMouseMove={(e) => { if (isDragging) { const {x, y} = getCoords(e); applyBrush(x, y); } }}
          onMouseUp={() => { if (isDragging) { setIsDragging(false); saveStateToHistory(canvasRef.current!.getContext('2d')!.getImageData(0,0,canvasRef.current!.width,canvasRef.current!.height)); } }}
          className="max-w-full max-h-[80vh] object-contain shadow-[0_0_100px_rgba(0,0,0,0.5)] transition-all duration-300" 
        />
        
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-xl px-8 py-4 rounded-full border border-slate-700 text-[10px] text-slate-400 pointer-events-none shadow-2xl flex gap-6 font-bold uppercase tracking-widest border-b-emerald-500/50">
            <span className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                Magic Wand Pro
            </span>
        </div>
      </div>
    </div>
  );
};

export default BackgroundRemover;
