
export interface FluxOptions {
  apiKey: string;
  prompt: string;
  imageBase64: string; 
  aspectRatio?: string;
  useProxy?: boolean;
}

// Hàm nén ảnh cực mạnh (Aggressive Compression)
async function resizeImageForApi(base64Str: string, maxDim: number = 768): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      let w = img.width;
      let h = img.height;
      // Resize xuống tối đa 768px (đủ cho AI nhìn, rất nhẹ)
      if (w <= maxDim && h <= maxDim) {
         // Vẫn vẽ lại để nén JPEG
      } else {
        if (w > h) {
           if (w > maxDim) { h *= maxDim / w; w = maxDim; }
        } else {
           if (h > maxDim) { w *= maxDim / h; h = maxDim; }
        }
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = "#FFFFFF"; // Nền trắng để tránh lỗi alpha
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        // Quality 0.6 = 60% -> File cực nhẹ (<100KB)
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => resolve(base64Str);
  });
}

export async function generateFluxDesign({ apiKey, prompt, imageBase64, useProxy = true }: FluxOptions): Promise<{ imageUrl: string; suggestedName: string }> {
  
  // 0. Tối ưu hóa ảnh đầu vào (Siêu nhẹ)
  const optimizedImage = await resizeImageForApi(imageBase64, 768);

  const body = {
    input: {
      prompt: `T-shirt design, flat vector style, white background, high quality. ${prompt}`,
      image: optimizedImage, 
      prompt_strength: 0.85, 
      num_inference_steps: 28,
      guidance_scale: 3.5,
      output_format: "png",
      safety_tolerance: 5,
      disable_safety_checker: true
    }
  };

  const baseUrl = "https://api.replicate.com/v1/models/black-forest-labs/flux-dev/predictions";
  
  // Encode URL
  const targetUrl = useProxy ? `https://corsproxy.io/?${encodeURIComponent(baseUrl)}` : baseUrl;
  
  const headers: any = {
      "Authorization": `Token ${apiKey.trim()}`,
      "Content-Type": "application/json"
  };

  try {
      const startRes = await fetch(targetUrl, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(body)
      });

      if (!startRes.ok) {
        const errText = await startRes.text();
        let errMsg = startRes.statusText;
        try {
            const errJson = JSON.parse(errText);
            errMsg = errJson.detail || errJson.error || JSON.stringify(errJson);
        } catch (e) {
            errMsg = errText || errMsg;
        }
        
        // Phân loại lỗi chính xác hơn
        if (startRes.status === 401) throw new Error(`Lỗi API Key (401): Key không hợp lệ hoặc hết hạn.`);
        if (startRes.status === 402) throw new Error(`Lỗi Thanh Toán (402): Tài khoản Replicate hết tiền.`);
        if (startRes.status === 422) throw new Error(`Lỗi Dữ Liệu (422): Ảnh input có thể bị lỗi.`);
        
        if (errMsg.includes("CORS") || errMsg.includes("Failed to fetch")) {
            throw new Error(`Lỗi Kết Nối Mạng (Network/Proxy). Hãy thử tắt Proxy và bật Extension 'Allow CORS'.`);
        }
        throw new Error(`Replicate Error (${startRes.status}): ${errMsg}`);
      }

      let prediction = await startRes.json();
      const predictionId = prediction.id;

      let attempts = 0;
      while (prediction.status !== "succeeded" && prediction.status !== "failed" && prediction.status !== "canceled") {
        if (attempts++ > 45) throw new Error("Replicate Timeout: Server xử lý quá lâu > 90s.");
        await new Promise(r => setTimeout(r, 2000));
        
        const checkBaseUrl = `https://api.replicate.com/v1/predictions/${predictionId}`;
        const checkUrl = useProxy ? `https://corsproxy.io/?${encodeURIComponent(checkBaseUrl)}` : checkBaseUrl;

        const checkRes = await fetch(checkUrl, {
          headers: { "Authorization": `Token ${apiKey.trim()}` }
        });
        
        if (!checkRes.ok) continue; 
        prediction = await checkRes.json();
      }

      if (prediction.status === "failed") {
        throw new Error(`Flux Generation Failed: ${JSON.stringify(prediction.error)}`);
      }

      let outputUrl = "";
      if (Array.isArray(prediction.output)) outputUrl = prediction.output[0];
      else outputUrl = prediction.output;

      if (!outputUrl) throw new Error("Replicate không trả về URL ảnh.");

      const imageTargetUrl = useProxy ? `https://corsproxy.io/?${encodeURIComponent(outputUrl)}` : outputUrl;
      const imageRes = await fetch(imageTargetUrl);
      const imageBlob = await imageRes.blob();
      
      return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
              resolve({
                  imageUrl: reader.result as string,
                  suggestedName: "flux_dev_replicate_remix"
              });
          };
          reader.readAsDataURL(imageBlob);
      });
  } catch (error: any) {
      // Bắt lỗi mức thấp nhất (Network offline, DNS probe...)
      if (error.message.includes("Failed to fetch")) {
          throw new Error(`Lỗi Mạng Nghiêm Trọng: Không thể kết nối tới ${useProxy ? 'Proxy' : 'Replicate'}. Kiểm tra lại Internet hoặc Extension.`);
      }
      throw error;
  }
}
