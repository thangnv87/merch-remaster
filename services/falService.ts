
export interface FalOptions {
  apiKey: string;
  prompt: string;
  imageBase64: string;
  useProxy?: boolean;
}

// Hàm nén ảnh cực mạnh
async function resizeImageForApi(base64Str: string, maxDim: number = 768): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      let w = img.width;
      let h = img.height;
      if (w <= maxDim && h <= maxDim) {
         // Resize anyway to compress
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
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => resolve(base64Str);
  });
}

export async function generateFalDesign({ apiKey, prompt, imageBase64, useProxy = true }: FalOptions): Promise<{ imageUrl: string; suggestedName: string }> {
  const optimizedImage = await resizeImageForApi(imageBase64, 768);

  const body = {
    prompt: `T-shirt design, flat vector style, white background, high quality. ${prompt}`,
    image_url: optimizedImage,
    strength: 0.85,
    guidance_scale: 3.5,
    num_inference_steps: 28,
    enable_safety_checker: false,
    output_format: "png"
  };

  const baseUrl = "https://queue.fal.run/fal-ai/flux/dev";
  const targetUrl = useProxy ? `https://corsproxy.io/?${encodeURIComponent(baseUrl)}` : baseUrl;

  try {
      const queueRes = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Authorization": `Key ${apiKey.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body)
      });

      if (!queueRes.ok) {
        const errText = await queueRes.text();
        if (queueRes.status === 401) throw new Error("Lỗi API Key (401): Sai Fal Key.");
        throw new Error(`Fal.ai Error (${queueRes.status}): ${errText}`);
      }

      const queueData = await queueRes.json();
      const requestId = queueData.request_id;

      let result = null;
      let attempts = 0;
      
      while (!result && attempts < 40) {
        attempts++;
        await new Promise(r => setTimeout(r, 1000));

        const statusBaseUrl = `https://queue.fal.run/fal-ai/flux/dev/requests/${requestId}/status`;
        const statusUrl = useProxy ? `https://corsproxy.io/?${encodeURIComponent(statusBaseUrl)}` : statusBaseUrl;

        const statusRes = await fetch(statusUrl, {
          headers: { "Authorization": `Key ${apiKey.trim()}` }
        });

        if (statusRes.ok) {
            const statusData = await statusRes.json();
            if (statusData.status === "COMPLETED") {
                const responseBaseUrl = `https://queue.fal.run/fal-ai/flux/dev/requests/${requestId}`;
                const responseUrl = useProxy ? `https://corsproxy.io/?${encodeURIComponent(responseBaseUrl)}` : responseBaseUrl;
                
                const finalRes = await fetch(responseUrl, {
                    headers: { "Authorization": `Key ${apiKey.trim()}` }
                });
                result = await finalRes.json();
            } else if (statusData.status === "FAILED") {
                throw new Error(`Fal.ai Task Failed: ${statusData.error}`);
            }
        }
      }

      if (!result || !result.images || result.images.length === 0) {
          throw new Error("Fal.ai Timeout hoặc không trả về ảnh.");
      }

      const outputBaseUrl = result.images[0].url;
      const imageTargetUrl = useProxy ? `https://corsproxy.io/?${encodeURIComponent(outputBaseUrl)}` : outputBaseUrl;

      const imageRes = await fetch(imageTargetUrl);
      const imageBlob = await imageRes.blob();

      return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
              resolve({
                  imageUrl: reader.result as string,
                  suggestedName: "flux_fal_remix"
              });
          };
          reader.readAsDataURL(imageBlob);
      });
  } catch (error: any) {
       if (error.message.includes("Failed to fetch")) {
          throw new Error(`Lỗi Mạng Fal.ai: Không kết nối được. Kiểm tra Proxy/Extension.`);
      }
      throw error;
  }
}
