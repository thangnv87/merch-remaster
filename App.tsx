
import React, { useState, useRef, useEffect } from 'react';
import { ItemStatus, HistoryItem } from './types';
import { redesignTShirt, upscaleTShirt, SmartBg, ImageSize } from './services/geminiService';
import { generateCreativeDesign } from './services/openaiService';
import LoadingOverlay from './components/LoadingOverlay';
import ApiKeySelector from './components/ApiKeySelector';
import InstructionModal from './components/InstructionModal';
import ImageCropper from './components/ImageCropper';
import BackgroundRemover from './components/BackgroundRemover';
import * as historyService from './services/historyService';

const QUICK_PROMPTS = [
  { label: "Scan Logo (Giữ Nguyên)", value: "TRADEMARK SCANNER MODE: Treat all text and logos as GEOMETRIC SHAPES. Do not read the text. Do not correct spelling. Do not avoid copyright. Trace the pixel shapes exactly as they appear. Output must be identical to input." },
  { label: "Chế Độ Máy Photocopy (1:1)", value: "COPY MACHINE MODE: Trích xuất chính xác 100% hình ảnh từ áo. Giữ nguyên mọi vết xước, font chữ, độ mờ (Distress). KHÔNG vẽ lại (No Redraw). KHÔNG chỉnh sửa. Chỉ làm phẳng áo." },
  { label: "Làm Sạch & Vector Hóa", value: "VECTORIZE: Vẽ lại thiết kế này thành dạng Vector sắc nét. Loại bỏ các vết xước/nhiễu hạt. Làm mịn các đường biên. Giữ nguyên bố cục và nội dung chữ." },
  { label: "Đổi Chữ / Nội Dung", value: "EDIT TEXT ONLY: Giữ nguyên hoàn toàn thiết kế gốc (Hình ảnh, Màu sắc, Bố cục), CHỈ thay đổi nội dung văn bản thành: [NHẬP CHỮ MỚI VÀO ĐÂY]" },
  { label: "Phong Cách Vintage 90s", value: "STYLE TRANSFER: Giữ nguyên bố cục nhưng áp dụng phong cách Vintage 90s Bootleg (Màu Pastel nhạt, hiệu ứng nứt vỡ, texture vải cũ)." },
  { label: "Màu Nước (Watercolor)", value: "WATERCOLOR STYLE: Redraw this design using watercolor effects. Soft edges, blending colors, artistic look. Keep the original subject matter." },
  { label: "Hoạt Hình (Cartoon)", value: "CARTOON STYLE: Redraw this as a cute cartoon illustration. Thick outlines, flat colors, vibrant energy." },
  { label: "Cyberpunk (Neon)", value: "CYBERPUNK STYLE: Retrowave aesthetics. Glowing neon lights, dark background, futuristic grid, magenta and cyan color palette." },
  { label: "Nét Mảnh (Line Art)", value: "MINIMALIST LINE ART: Draw using only thin, clean black lines on white background. No fill, no shading. Professional illustration style." },
  { label: "Pop Art (Retro)", value: "POP ART STYLE: Comic book dot texture (Ben-Day dots), bold black outlines, vibrant primary colors. Andy Warhol / Roy Lichtenstein style." }
];

const TARGET_WIDTH = 4500;
const TARGET_HEIGHT = 5400;
const MARGIN_PERCENT = 0.01; // Cập nhật: 1% margin

const MODELS = [
  { 
    id: 'gemini-2.5-flash-image', 
    name: 'Gemini 2.5 Flash', 
    badge: 'MIỄN PHÍ', 
    desc: 'Tốc độ cao, tiết kiệm. Phù hợp phác thảo ý tưởng nhanh.',
    color: 'emerald'
  },
  { 
    id: 'gemini-3-pro-image-preview', 
    name: 'Gemini 3 Pro', 
    badge: 'CAO CẤP', 
    desc: 'Chất lượng tối đa, sắc nét chuẩn in ấn thương mại (POD).',
    color: 'indigo'
  }
];

type Provider = 'gemini' | 'openai';

const SIZES: { label: string; value: ImageSize; desc: string }[] = [
  { label: "1K", value: "1K", desc: "Tiết kiệm Token" },
  { label: "2K", value: "2K", desc: "Cân bằng" },
  { label: "4K", value: "4K", desc: "Chuẩn In POD" }
];

// DANH SÁCH MÀU NỀN AN TOÀN
const CANDIDATE_BGS = [
  { hex: '#000000', name: 'Solid Black' }, 
  { hex: '#FFFFFF', name: 'Solid White' }, 
  { hex: '#808080', name: 'Neutral Gray' },
  { hex: '#A9A9A9', name: 'Dark Gray' },
  { hex: '#C0C0C0', name: 'Silver' },
];

const TShirtIcon = ({ className = "w-6 h-6" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />
  </svg>
);

const App: React.FC = () => {
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [rawResultImage, setRawResultImage] = useState<string | null>(null);
  const [status, setStatus] = useState<ItemStatus>('idle');
  const [prompt, setPrompt] = useState<string>("");
  const [refinePrompt, setRefinePrompt] = useState<string>("");
  const [suggestedName, setSuggestedName] = useState<string>("tshirt_design");
  
  // Provider Selection: Gemini & OpenAI Only
  const [provider, setProvider] = useState<Provider>('gemini');
  const [openaiKey, setOpenaiKey] = useState<string>("");

  const [selectedModel, setSelectedModel] = useState<string>(MODELS[1].id); 
  const [selectedSize, setSelectedSize] = useState<ImageSize>("1K");
  const [lastUsedModel, setLastUsedModel] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; type: 'quota' | 'general' | 'filter' | null }>({ message: '', type: null });
  const [hasKey, setHasKey] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState<string | undefined>(undefined);
  const [showInstructions, setShowInstructions] = useState(false);
  
  const [cropTarget, setCropTarget] = useState<'source' | 'result' | null>(null);
  const [bgRemoverTarget, setBgRemoverTarget] = useState<'source' | 'result' | null>(null);
  
  const [history, setHistory] = useState<HistoryItem[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getSmartBg = (p: string): SmartBg => {
    const text = p.toLowerCase();
    if (text.includes('white background') || text.includes('nền trắng')) return { label: 'SOLID WHITE', hex: '#FFFFFF' };
    if (text.includes('black background') || text.includes('nền đen')) return { label: 'SOLID BLACK', hex: '#000000' };
    return { label: 'SMART DYNAMIC CONTRAST', hex: 'AUTO' };
  };

  const refreshHistory = async () => {
    try {
      const data = await historyService.getAllHistory();
      setHistory(data);
    } catch (err) {
      console.error("Failed to load history:", err);
    }
  };

  useEffect(() => {
    refreshHistory();
    const checkKey = async () => {
      if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasKey(selected);
      }
    };
    checkKey();
  }, []);

  const handleChangeKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasKey(true);
      setError({ message: '', type: null });
      setStatus('idle');
    }
  };

  const saveToHistory = async (source: string, result: string) => {
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      source,
      result,
      timestamp: Date.now()
    };
    try {
      await historyService.saveHistoryItem(newItem);
      await refreshHistory();
    } catch (err) {
      console.error("History Save Error:", err);
    }
  };

  const handleClearHistory = async () => {
    if (confirm("Bạn có chắc muốn xóa toàn bộ lịch sử thiết kế không?")) {
      await historyService.clearAllHistory();
      await refreshHistory();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSourceImage(reader.result as string);
        setResultImage(null);
        setRawResultImage(null);
        setError({ message: '', type: null });
        setStatus('idle');
      };
      reader.readAsDataURL(file);
    }
  };

  // --- IMPROVED COLOR ANALYSIS ---
  const getDist = (rgb1: number[], rgb2: number[]) => {
     return Math.sqrt(
       Math.pow(rgb1[0] - rgb2[0], 2) +
       Math.pow(rgb1[1] - rgb2[1], 2) +
       Math.pow(rgb1[2] - rgb2[2], 2)
     );
  };

  const findBestContrastBg = async (imageSrc: string): Promise<SmartBg> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = imageSrc;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const w = 150; 
        const h = 150;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ label: 'AUTO DETECT', hex: 'AUTO' });
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h).data;
        
        const designColors: number[][] = [];
        for (let i = 0; i < data.length; i += 16) { 
           const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
           if (a > 100) designColors.push([r, g, b]);
        }

        if (designColors.length === 0) {
           resolve({ label: 'SOLID BLACK', hex: '#000000' }); 
           return;
        }

        let safestBg = CANDIDATE_BGS[2]; 
        let bestMinDist = -1;
        const DANGER_THRESHOLD = 60; 

        for (const bg of CANDIDATE_BGS) {
           const bgR = parseInt(bg.hex.slice(1, 3), 16);
           const bgG = parseInt(bg.hex.slice(3, 5), 16);
           const bgB = parseInt(bg.hex.slice(5, 7), 16);
           const bgRgb = [bgR, bgG, bgB];

           let minDistForThisBg = 10000; 
           let isClashing = false;

           for (const dc of designColors) {
              const d = getDist(bgRgb, dc);
              if (d < DANGER_THRESHOLD) {
                  isClashing = true;
                  break; 
              }
              if (d < minDistForThisBg) minDistForThisBg = d;
           }

           if (isClashing) continue; 

           if (minDistForThisBg > bestMinDist) {
              bestMinDist = minDistForThisBg;
              safestBg = bg;
           }
        }
        resolve({ label: `SMART: ${safestBg.name}`, hex: safestBg.hex });
      };
      img.onerror = () => {
         resolve({ label: 'AUTO (Error)', hex: 'AUTO' });
      }
    });
  }

  // Used for Soft Knockout Trim & Auto BG
  const getTrimmedBounds = (data: Uint8ClampedArray, width: number, height: number) => {
    let minX = width, minY = height, maxX = 0, maxY = 0;
    let found = false;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const alpha = data[idx + 3];
        if (alpha > 15) { 
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          found = true;
        }
      }
    }
    return found ? { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } : null;
  };

  // Khôi phục hàm Auto BG Removal (Code Cũ)
  const autoProcessBgRemoval = async (imgBase64: string): Promise<string> => {
     return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = imgBase64;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) { resolve(imgBase64); return; }
            
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            // 1. Lấy mẫu màu nền (Chiến lược 5 điểm)
            const samples = [
                {x: 5, y: 5}, {x: canvas.width - 5, y: 5},
                {x: 5, y: canvas.height - 5}, {x: canvas.width - 5, y: canvas.height - 5},
                {x: Math.floor(canvas.width/2), y: 5}
            ];
            
            let sumR = 0, sumG = 0, sumB = 0;
            samples.forEach(s => {
                const idx = (s.y * canvas.width + s.x) * 4;
                sumR += data[idx]; sumG += data[idx+1]; sumB += data[idx+2];
            });
            const tr = sumR / samples.length;
            const tg = sumG / samples.length;
            const tb = sumB / samples.length;

            // 2. Global Removal
            const threshold = 40;
            const smoothing = 20;

            for (let i = 0; i < data.length; i += 4) {
                const diff = Math.sqrt(Math.pow(data[i] - tr, 2) + Math.pow(data[i+1] - tg, 2) + Math.pow(data[i+2] - tb, 2));
                if (diff < threshold) {
                    let alpha = diff < (threshold - smoothing) ? 0 : ((diff - (threshold - smoothing)) / smoothing) * 255;
                    data[i+3] = Math.min(data[i+3], alpha);
                }
            }
            ctx.putImageData(imageData, 0, 0);

            // 3. Auto Trim & Center 4500x5400
            const bounds = getTrimmedBounds(data, canvas.width, canvas.height);
            if (!bounds) {
                 resolve(canvas.toDataURL('image/png'));
                 return;
            }

            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = TARGET_WIDTH;
            finalCanvas.height = TARGET_HEIGHT;
            const fCtx = finalCanvas.getContext('2d');
            if (!fCtx) { resolve(imgBase64); return; }

            const hPadding = TARGET_WIDTH * MARGIN_PERCENT;
            const vPadding = TARGET_HEIGHT * MARGIN_PERCENT;
            const safeW = TARGET_WIDTH - (hPadding * 2);
            const safeH = TARGET_HEIGHT - (vPadding * 2);

            const scale = Math.min(safeW / bounds.w, safeH / bounds.h);
            const drawW = bounds.w * scale;
            const drawH = bounds.h * scale;

            const drawX = (TARGET_WIDTH - drawW) / 2;
            const drawY = vPadding;

            fCtx.imageSmoothingEnabled = true;
            fCtx.imageSmoothingQuality = 'high';
            
            fCtx.drawImage(
                canvas, 
                bounds.x, bounds.y, bounds.w, bounds.h, 
                drawX, drawY, drawW, drawH
            );

            resolve(finalCanvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(imgBase64);
     });
  };

  const handleRedesign = async () => {
    if (!sourceImage) return;
    setStatus('processing');
    setIsProcessing(true);
    setError({ message: '', type: null });

    // OPEN AI HANDLER
    if (provider === 'openai') {
        const key = openaiKey.trim();
        if (!key) {
            setError({ message: "Vui lòng nhập OpenAI API Key để dùng chế độ Creative.", type: 'general' });
            setStatus('error');
            setIsProcessing(false);
            return;
        }
        setLoadingMsg("GPT-4o đang nhìn ảnh & DALL-E 3 đang vẽ lại...");
        try {
            const { imageUrl, suggestedName } = await generateCreativeDesign({
                apiKey: key,
                prompt: prompt,
                imageBase64: sourceImage
            });
            await finalizeDesign(imageUrl, suggestedName, 'openai-dall-e-3');
        } catch (err: any) {
            setIsProcessing(false);
            processError(err);
        }
        return;
    }
    
    // GEMINI HANDLER
    let bg = getSmartBg(prompt);
    
    if (bg.hex === 'AUTO') {
        setLoadingMsg("Đang phân tích thiết kế để tránh trùng màu...");
        await new Promise(r => setTimeout(r, 100));
        bg = await findBestContrastBg(sourceImage);
    }
    setLoadingMsg(undefined);

    try {
      const { imageUrl, suggestedName: sName } = await redesignTShirt(
        sourceImage, 
        prompt, 
        bg, 
        false, 
        selectedModel,
        selectedSize
      );
      await finalizeDesign(imageUrl, sName, selectedModel);
    } catch (err: any) {
      setIsProcessing(false);
      processError(err);
    }
  };

  const finalizeDesign = async (imageUrl: string, suggestedName: string, modelUsed: string) => {
      setResultImage(imageUrl);
      setRawResultImage(imageUrl);
      setSuggestedName(suggestedName);
      setLastUsedModel(modelUsed);
      setStatus('done');
      setIsProcessing(false);
      await saveToHistory(sourceImage!, imageUrl);
  }

  const handleRefine = async () => {
    const baseToEdit = rawResultImage;
    if (!baseToEdit || !refinePrompt) return;
    setStatus('processing');
    setIsProcessing(true);
    setError({ message: '', type: null });
    
    if (provider !== 'gemini') {
        setLoadingMsg("Đang dùng Gemini để chỉnh sửa chi tiết...");
    }

    let bg = getSmartBg(refinePrompt);
    if (bg.hex === 'AUTO') {
        setLoadingMsg("Đang phân tích lại bảng màu...");
        await new Promise(r => setTimeout(r, 100));
        bg = await findBestContrastBg(baseToEdit);
    }
    setLoadingMsg(undefined);

    try {
      const { imageUrl, suggestedName: sName } = await redesignTShirt(
        baseToEdit, 
        refinePrompt, 
        bg, 
        true, 
        selectedModel,
        selectedSize
      );
      await finalizeDesign(imageUrl, sName, selectedModel);
      setRefinePrompt(""); 
    } catch (err: any) {
      setIsProcessing(false);
      processError(err);
    }
  };

  const handleUpscale = async (imageOverride?: string, forceSize?: ImageSize) => {
    const imageToUse = imageOverride || resultImage;
    if (!imageToUse) return;

    if (imageOverride) {
        setBgRemoverTarget(null);
        setRawResultImage(imageOverride);
        setResultImage(imageOverride);
    }

    setStatus('processing');
    setIsProcessing(true);
    setError({ message: '', type: null });
    
    let bg = getSmartBg(prompt);
    if (bg.hex === 'AUTO') {
        bg = await findBestContrastBg(imageToUse);
    }

    // Force 4K if clicked from the specific button, otherwise use dropdown
    const sizeToUse = forceSize || selectedSize;

    try {
      const { imageUrl, suggestedName: sName } = await upscaleTShirt(imageToUse, bg, sizeToUse);
      await finalizeDesign(imageUrl, sName, 'gemini-3-pro-image-preview');
    } catch (err: any) {
      setIsProcessing(false);
      processError(err);
    }
  };

  const handleCropComplete = (croppedBase64: string) => {
    if (cropTarget === 'source') {
      setSourceImage(croppedBase64);
      setCropTarget(null);
      setTimeout(() => {
         setBgRemoverTarget('source');
      }, 100);
    } else {
      setResultImage(croppedBase64);
      setRawResultImage(croppedBase64); 
      setCropTarget(null);
    }
  };
  
  const handleBgRemovalComplete = (processedBase64: string) => {
    if (bgRemoverTarget === 'source') {
        setSourceImage(processedBase64);
    } else {
        setResultImage(processedBase64);
    }
    setBgRemoverTarget(null);
  };

  const processError = (err: any) => {
    let errMsg = err.message || "";
    if (errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED")) {
      setError({ 
        message: "Hết hạn mức API. Model Premium yêu cầu API Key từ một Project đã bật thanh toán.", 
        type: 'quota' 
      });
    } else if (errMsg.includes("SAFETY") || errMsg.includes("content_policy_violation")) {
      setError({
        message: "Ảnh bị từ chối do vấn đề Bản quyền hoặc An toàn (NSFW).",
        type: 'filter'
      });
    } else if (errMsg.includes("503") || errMsg.includes("Deadline")) {
        setError({
            message: "Server Google đang quá tải (Lỗi 503). Vui lòng thử lại sau vài giây hoặc dùng Model Flash.",
            type: 'general'
        });
    } else if (errMsg.includes("401") || errMsg.includes("Key")) {
        setError({
            message: "Lỗi API Key: Key bạn nhập không đúng hoặc đã hết hạn.",
            type: 'general'
        });
    } else {
      setError({ message: `Lỗi Chi Tiết: ${errMsg}`, type: 'general' });
    }
    setStatus('error');
  };

  const handleRemoveBG_HardCut = async () => {
      if(!resultImage) return;
      setIsProcessing(true);
      const processed = await autoProcessBgRemoval(resultImage);
      setResultImage(processed);
      setIsProcessing(false);
  }

  // Công cụ Lọc màu Soft (In Áo)
  const handleRemoveBG_SoftKnockout = async () => {
    if (!resultImage) return;
    setIsProcessing(true);
    await new Promise(r => setTimeout(r, 100));

    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = resultImage;
      await new Promise((resolve) => { img.onload = resolve; });
      
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      const w = canvas.width, h = canvas.height;
      const corners = [0, (w-1)*4, (w*(h-1))*4, (w*h - 1)*4];
      let rSum = 0, gSum = 0, bSum = 0, count = 0;
      
      corners.forEach(idx => {
          if (data[idx+3] > 0) {
            rSum += data[idx]; gSum += data[idx+1]; bSum += data[idx+2];
            count++;
          }
      });
      
      const avgR = count ? rSum/count : 0;
      const avgG = count ? gSum/count : 0;
      const avgB = count ? bSum/count : 0;
      const brightness = (avgR*0.299 + avgG*0.587 + avgB*0.114);
      
      const isDarkBG = brightness < 128; 
      const threshold = 30; 
      
      for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i+1], b = data[i+2];
          
          if (isDarkBG) {
              const maxChan = Math.max(r, g, b);
              if (maxChan < threshold) {
                  data[i+3] = 0;
              } else {
                  let alpha = ((maxChan - threshold) / (255 - threshold)) * 255;
                  data[i+3] = Math.min(255, Math.max(0, alpha));
              }
          } else {
              const minChan = Math.min(r, g, b);
              const brightnessInv = 255 - minChan;
              if (brightnessInv < threshold) {
                  data[i+3] = 0;
              } else {
                  let alpha = ((brightnessInv - threshold) / (255 - threshold)) * 255;
                  data[i+3] = Math.min(255, Math.max(0, alpha));
              }
          }
      }
      
      ctx.putImageData(imageData, 0, 0);
      const bounds = getTrimmedBounds(imageData.data, canvas.width, canvas.height);
      let resUrl = canvas.toDataURL('image/png');
      
      if (bounds) {
          const finalCanvas = document.createElement('canvas');
          finalCanvas.width = TARGET_WIDTH;
          finalCanvas.height = TARGET_HEIGHT;
          const fCtx = finalCanvas.getContext('2d');
          if (fCtx) {
              const hPadding = TARGET_WIDTH * MARGIN_PERCENT;
              const vPadding = TARGET_HEIGHT * MARGIN_PERCENT;
              const safeW = TARGET_WIDTH - (hPadding * 2);
              const safeH = TARGET_HEIGHT - (vPadding * 2);
              const scale = Math.min(safeW / bounds.w, safeH / bounds.h);
              const drawW = bounds.w * scale;
              const drawH = bounds.h * scale;
              const drawX = (TARGET_WIDTH - drawW) / 2;
              const drawY = vPadding;
              fCtx.imageSmoothingEnabled = true;
              fCtx.drawImage(canvas, bounds.x, bounds.y, bounds.w, bounds.h, drawX, drawY, drawW, drawH);
              resUrl = finalCanvas.toDataURL('image/png');
          }
      }
      
      setResultImage(resUrl);
      setIsProcessing(false);

    } catch (err) {
        console.error(err);
        setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!resultImage) return;
    const link = document.createElement('a');
    link.href = resultImage;
    link.download = `${suggestedName || 'design'}_Ready.png`;
    link.click();
  };

  const handleUndoTransparency = () => {
    if (rawResultImage) {
      setResultImage(rawResultImage);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-['Inter'] selection:bg-indigo-500/30">
      {!hasKey && provider === 'gemini' && <ApiKeySelector onKeySelected={() => setHasKey(true)} />}
      {(status === 'processing' || isProcessing) && <LoadingOverlay message={loadingMsg || (isProcessing ? "Đang xử lý Xoá nền, Trim & Căn lề chuẩn in..." : undefined)} />}
      <InstructionModal isOpen={showInstructions} onClose={() => setShowInstructions(false)} onSelectPrompt={(p) => setPrompt(p)} />
      
      {cropTarget && (
        <ImageCropper 
          src={cropTarget === 'source' ? sourceImage! : resultImage!} 
          onConfirm={handleCropComplete} 
          onCancel={() => setCropTarget(null)} 
        />
      )}

      {bgRemoverTarget && (
        <BackgroundRemover 
            src={bgRemoverTarget === 'source' ? sourceImage! : resultImage!}
            onConfirm={handleBgRemovalComplete}
            onCancel={() => setBgRemoverTarget(null)}
            onUpscale={handleUpscale}
        />
      )}

      <header className="py-6 px-8 border-b border-slate-800 bg-slate-900/40 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-600/20">
              <TShirtIcon className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-lg font-black tracking-tight uppercase">MerchRemaster <span className="text-emerald-400">Pro</span></h1>
          </div>
          <div className="flex items-center gap-3">
             {provider === 'gemini' && <button onClick={handleChangeKey} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-[9px] font-black uppercase tracking-widest border border-slate-700 rounded-xl transition-all">Đổi API Key</button>}
             <button onClick={() => setShowInstructions(true)} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 rounded-xl transition-all group"><span className="text-[10px] font-black uppercase tracking-widest">Hướng dẫn</span></button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 md:p-12">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          <div className="space-y-8">
            <div className="bg-slate-900/50 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl">
              
              {/* PROVIDER SELECTOR */}
              <div className="mb-4 p-1 bg-slate-950 rounded-2xl flex border border-slate-800 overflow-hidden">
                <button 
                  onClick={() => setProvider('gemini')}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${provider === 'gemini' ? 'bg-indigo-600 text-white shadow-lg z-10' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'}`}
                >
                  Clone (Gemini)
                </button>
                <button 
                  onClick={() => setProvider('openai')}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${provider === 'openai' ? 'bg-emerald-600 text-white shadow-lg z-10' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'}`}
                >
                  Remix (DALL-E) 
                </button>
              </div>

              {provider === 'openai' && (
                // OPENAI CONFIG
                <div className="space-y-6 mb-8 animate-in fade-in slide-in-from-top-4">
                     <div className="bg-emerald-900/10 border border-emerald-500/20 p-5 rounded-2xl">
                         <h3 className="text-emerald-400 text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2">
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                             Creative Remix Mode (DALL-E 3)
                         </h3>
                         <p className="text-[10px] text-slate-400 leading-relaxed mb-4">
                             Sử dụng GPT-4o để nhìn và DALL-E 3 để vẽ lại. Kết quả nghệ thuật nhưng không giống 100% ảnh gốc.
                         </p>
                         <input 
                            type="password" 
                            value={openaiKey} 
                            onChange={(e) => setOpenaiKey(e.target.value)}
                            placeholder="Nhập OpenAI API Key (sk-...)"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs focus:ring-1 focus:ring-emerald-500 outline-none text-emerald-100 placeholder:text-slate-600"
                         />
                     </div>
                </div>
              )}

              {provider === 'gemini' && (
                // GEMINI CONFIG
                <div className="space-y-6 mb-8 animate-in fade-in slide-in-from-top-4">
                    <h2 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>Cấu hình Model & Kích thước</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {MODELS.map((m) => (
                        <button 
                        key={m.id}
                        onClick={() => setSelectedModel(m.id)}
                        className={`relative p-5 rounded-2xl border text-left transition-all ${selectedModel === m.id ? `bg-${m.color}-500/10 border-${m.color}-500 shadow-lg shadow-${m.color}-500/10` : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}
                        >
                        <div className="flex justify-between items-start mb-2">
                            <span className={`text-[10px] font-black uppercase tracking-tight ${selectedModel === m.id ? `text-${m.color}-400` : 'text-slate-300'}`}>{m.name}</span>
                            <span className={`text-[8px] font-black px-2 py-0.5 rounded-full ${selectedModel === m.id ? `bg-${m.color}-500 text-white` : 'bg-slate-800 text-slate-500'}`}>{m.badge}</span>
                        </div>
                        <p className="text-[9px] text-slate-500 leading-normal">{m.desc}</p>
                        </button>
                    ))}
                    </div>

                    {selectedModel.includes('pro') && (
                    <div className="space-y-3">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1 block">Độ phân giải đầu ra (Tiết kiệm Token)</label>
                        <div className="grid grid-cols-3 gap-2">
                        {SIZES.map((s) => (
                            <button 
                            key={s.value}
                            onClick={() => setSelectedSize(s.value)}
                            className={`p-3 rounded-xl border transition-all text-center ${selectedSize === s.value ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'}`}
                            >
                            <div className="text-[10px] font-black">{s.label}</div>
                            <div className="text-[7px] uppercase tracking-tighter opacity-70">{s.desc}</div>
                            </button>
                        ))}
                        </div>
                    </div>
                    )}
                </div>
              )}

              <div className={`w-full min-h-[250px] border-2 border-dashed rounded-[2rem] transition-all relative overflow-hidden flex items-center justify-center ${sourceImage ? 'border-indigo-500/30 bg-indigo-900/5' : 'border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-500/5 cursor-pointer'}`} onClick={() => !sourceImage && fileInputRef.current?.click()}>
                {sourceImage ? (
                  <div className="w-full h-full relative group p-4">
                    <img src={sourceImage} className="w-full h-auto max-h-[50vh] object-contain block mx-auto rounded-xl" alt="Source" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-3 items-center justify-center backdrop-blur-[2px]">
                       <button onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }} className="bg-white text-slate-900 px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-slate-100 transition-colors">Thay đổi mẫu</button>
                       <button onClick={(e) => { e.stopPropagation(); setCropTarget('source'); }} className="bg-indigo-600 text-white px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl border border-indigo-400 hover:bg-indigo-500 transition-colors flex items-center gap-2">
                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                         Cắt & Xử lý nền
                       </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-4 py-12">
                    <div className="w-16 h-16 bg-slate-950 rounded-2xl flex items-center justify-center shadow-xl">
                      <TShirtIcon className="w-8 h-8 text-slate-600" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Tải ảnh mockup lên</span>
                  </div>
                )}
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
              </div>

              <div className="mt-8 space-y-4">
                <div className="flex flex-wrap gap-2">
                  {QUICK_PROMPTS.map((qp, idx) => (
                    <button key={idx} onClick={() => setPrompt(qp.value)} className={`text-[9px] font-bold px-3 py-1.5 rounded-full border transition-all ${prompt === qp.value ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>{qp.label}</button>
                  ))}
                </div>
                <div className="relative">
                    <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Nhập mô tả clone/sửa thiết kế (Ví dụ: 'Vẽ lại hình con mèo nhưng đổi thành con chó')..." className="w-full h-24 bg-slate-950 border border-slate-800 rounded-2xl p-5 text-xs focus:ring-1 focus:ring-indigo-500 outline-none resize-none" />
                    {prompt && (
                        <button onClick={() => setPrompt("")} className="absolute top-2 right-2 p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-full transition-colors" title="Xóa nội dung">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    )}
                </div>
              </div>

              <div className="space-y-4">
                  <button disabled={!sourceImage || status === 'processing'} onClick={handleRedesign} className={`w-full py-5 rounded-2xl text-[11px] font-black tracking-[0.2em] shadow-xl disabled:opacity-20 uppercase flex items-center justify-center gap-3 transition-all ${
                      provider === 'openai' 
                      ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500'
                      : (selectedModel.includes('pro') ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-slate-700 hover:bg-slate-600')
                  }`}>
                    {status === 'processing' 
                        ? "ĐANG XỬ LÝ..." 
                        : (provider === 'openai' ? 'TẠO BẰNG DALL-E 3' : `CLONE BẰNG ${selectedModel.includes('pro') ? 'GEMINI PRO' : 'GEMINI FLASH'}`)
                    }
                  </button>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-slate-900/50 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl min-h-[500px] flex flex-col relative overflow-hidden">
              <h2 className="text-[10px] font-black mb-6 text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Kết quả Preview
              </h2>
              <div className={`flex-grow rounded-3xl overflow-hidden relative border border-slate-800/50 shadow-inner flex items-center justify-center ${resultImage ? 'bg-[#010409] bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px]' : 'bg-slate-950'}`}>
                {status === 'error' ? (
                  <div className="text-center p-8 max-w-sm">
                    <div className="inline-block p-4 rounded-full bg-red-500/10 mb-4 text-red-500">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.268 17c-.77 1.333.192 3 1.732 3z" /></svg>
                    </div>
                    <p className="text-[11px] text-red-400 font-bold mb-4">{error.message}</p>
                    
                    {error.type === 'quota' && provider === 'gemini' && <button onClick={handleChangeKey} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-[10px] font-black uppercase text-white shadow-lg shadow-indigo-600/20">Đổi API Key</button>}
                    
                    {error.type === 'filter' && (
                        <div className="text-[10px] text-slate-500 space-y-2 text-left bg-slate-950 p-4 rounded-xl border border-slate-800">
                            <p><strong>Gợi ý khắc phục:</strong></p>
                            <ul className="list-disc pl-4 space-y-1">
                                <li>Hãy thử chọn prompt <strong>"Vẽ Lại Vector"</strong> thay vì "Sao chép y hệt".</li>
                                <li>Thử cắt ảnh (Crop) để loại bỏ logo thương hiệu rõ ràng.</li>
                                {provider === 'gemini' && <li>Dùng model <strong>Flash</strong> thay vì Pro.</li>}
                            </ul>
                        </div>
                    )}
                  </div>
                ) : resultImage ? (
                  <div className="relative group w-full h-full flex items-center justify-center">
                      <img src={resultImage} className="max-w-full max-h-full object-contain animate-fade-in drop-shadow-[0_0_30px_rgba(0,0,0,0.5)]" alt="Result" />
                      
                      <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md text-emerald-400 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border border-emerald-500/30 shadow-xl z-20">
                          {rawResultImage !== resultImage ? "Đã Xử Lý 4500x5400" : (provider === 'openai' ? "DALL-E 3" : "Gemini Preview")}
                      </div>
                  </div>
                ) : (
                  <div className="text-center p-8">
                    <p className="text-[10px] text-slate-700 font-black uppercase tracking-widest">Chờ thiết kế...</p>
                  </div>
                )}
                {isProcessing && <div className="absolute inset-0 bg-indigo-950/40 backdrop-blur-sm flex items-center justify-center z-30"><div className="w-12 h-12 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin"></div></div>}
              </div>

              {resultImage && status === 'done' && (
                <div className="mt-8 space-y-6">
                  <div className="p-5 bg-slate-950 border border-slate-800 rounded-3xl space-y-4">
                    <div className="flex justify-between items-end mb-1">
                        <p className="text-[8px] text-slate-500 uppercase font-black tracking-widest">Tên tệp gợi ý (AI Auto):</p>
                    </div>
                    <div className="px-3 py-2 bg-slate-900 rounded-xl border border-slate-800 flex items-center">
                      <input 
                         type="text" 
                         value={suggestedName} 
                         onChange={(e) => setSuggestedName(e.target.value)}
                         className="bg-transparent border-none outline-none text-[10px] text-indigo-400 font-bold leading-relaxed w-full placeholder-slate-600"
                         placeholder="nhap_ten_file_o_day"
                      />
                    </div>
                    <input type="text" value={refinePrompt} onChange={(e) => setRefinePrompt(e.target.value)} placeholder="Nhập yêu cầu sửa thêm (Ví dụ: 'Làm chữ to hơn')..." className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs focus:ring-1 focus:ring-indigo-500 outline-none" />
                    <button onClick={handleRefine} disabled={!refinePrompt} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 rounded-xl text-[9px] font-black uppercase tracking-widest">Sửa Dựa Trên Ảnh Này</button>
                    {(!lastUsedModel?.includes('pro') && provider === 'gemini') && (
                      <button onClick={() => handleUpscale(undefined, '4K')} className="w-full py-4 bg-gradient-to-r from-amber-600 to-orange-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest">Nâng cấp 4K Pro (Rõ nét)</button>
                    )}
                  </div>
                  
                  <div className="space-y-4">
                      <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Thanh công cụ nâng cao</h3>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <button 
                            onClick={() => handleUpscale(undefined, '4K')} 
                            className="py-4 bg-gradient-to-r from-slate-800 to-slate-900 border border-slate-700 hover:border-emerald-500/50 rounded-xl text-white font-black uppercase tracking-widest text-[9px] shadow-lg flex items-center justify-center gap-2 transition-all hover:scale-[1.02] group"
                        >
                             <svg className="w-4 h-4 text-emerald-400 group-hover:animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                             Upscale 4K (AI)
                        </button>
                        <button 
                            onClick={handleDownload} 
                            className="py-4 bg-indigo-600 hover:bg-indigo-500 border border-indigo-400 rounded-xl text-white font-black uppercase tracking-widest text-[9px] shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                            Tải Xuống (Print)
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => setCropTarget('result')} className="py-3 bg-slate-900 border border-slate-800 hover:border-slate-600 rounded-xl text-[8px] font-bold uppercase tracking-wider text-slate-400 hover:text-white transition-all">
                            Cắt ảnh (Crop)
                        </button>
                        <button onClick={() => setBgRemoverTarget('result')} className="py-3 bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-xl text-[8px] font-bold uppercase tracking-wider text-slate-400 hover:text-indigo-400 transition-all">
                            Tool Xóa Nền Pro
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={handleRemoveBG_HardCut} className="py-3 bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-xl text-[8px] font-bold uppercase tracking-wider text-slate-400 hover:text-blue-400 transition-all flex flex-col items-center justify-center gap-1 group">
                            <span>Xóa Nền Tự Động</span>
                            <span className="text-[6px] opacity-50 font-normal normal-case tracking-normal group-hover:opacity-100 italic">Quét toàn bộ + Cắt cứng</span>
                        </button>
                        <button onClick={handleRemoveBG_SoftKnockout} className="py-3 bg-gradient-to-r from-slate-900 to-indigo-950/30 border border-indigo-500/30 hover:border-indigo-400 rounded-xl text-[8px] font-bold uppercase tracking-wider text-indigo-300 hover:text-white transition-all flex flex-col items-center justify-center gap-1 group shadow-[0_0_15px_rgba(99,102,241,0.1)]">
                            <span className="flex items-center gap-1"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>Lọc màu Soft (In Áo)</span>
                            <span className="text-[6px] opacity-70 font-normal normal-case tracking-normal group-hover:opacity-100 text-indigo-200">Giữ khói/gradient/chi tiết</span>
                        </button>
                      </div>
                  </div>
                  
                  {resultImage !== rawResultImage && <button onClick={handleUndoTransparency} className="w-full py-3 bg-slate-800 border border-slate-700 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-400">Khôi phục gốc</button>}
                </div>
              )}
            </div>
          </div>
        </div>

        {history.length > 0 && (
          <div className="mt-16 pt-12 border-t border-slate-800/50">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Thư viện thiết kế</h3>
              <button onClick={handleClearHistory} className="text-[9px] font-black text-red-500/50 hover:text-red-500 uppercase tracking-widest">Xóa lịch sử</button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-6">
              {history.map(item => (
                <div key={item.id} className="group relative aspect-square bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-indigo-500/50 cursor-pointer" onClick={() => { setResultImage(item.result); setRawResultImage(item.result); setStatus('done'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                  <img src={item.result} className="w-full h-full object-contain p-3 transition-transform group-hover:scale-110" />
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
