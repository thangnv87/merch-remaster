
export interface OpenAIOptions {
  apiKey: string;
  prompt: string;
  imageBase64: string;
}

/**
 * Sử dụng OpenAI (GPT-4o + DALL-E 3) để tái tạo thiết kế chuẩn in ấn (POD).
 * Quy trình nâng cấp:
 * 1. GPT-4o: Đóng vai chuyên gia in ấn, loại bỏ nhiễu (nếp nhăn áo), trích xuất ý tưởng đồ họa.
 * 2. DALL-E 3: Vẽ lại theo phong cách Vector Flat, Spot Color (Màu bệt), không Gradient 3D.
 */
export async function generateCreativeDesign({ apiKey, prompt, imageBase64 }: OpenAIOptions): Promise<{ imageUrl: string; suggestedName: string }> {
  
  // 1. Phân tích ảnh bằng GPT-4o (Vision)
  // Prompt được tối ưu để AI "nhìn" ra file thiết kế gốc thay vì nhìn ra cái áo.
  const visionBody = {
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a Senior Print-on-Demand (POD) Designer. 
        Your job is to reverse-engineer T-shirt mockups into prompt descriptions for vector recreation.
        
        RULES:
        1. IGNORE fabric wrinkles, lighting, models, and shirt folds. Look at the GRAPHIC only.
        2. IDENTIFY the specific Art Style (e.g., Distressed Vintage, Clean Vector, Kawaii, Typography-based).
        3. EXTRACT the exact text content found in the design.
        4. ANALYZE the Color Palette (List main 3-4 colors).
        5. OUTPUT a detailed descriptive prompt that a blind artist could use to redraw this exact logo.`
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Analyze this T-shirt mockup. Extract the graphic artwork description for reproduction. Focus on Line work, Composition, and Colors." },
          { type: "image_url", image_url: { url: imageBase64 } }
        ]
      }
    ],
    max_tokens: 400
  };

  const visionRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify(visionBody)
  });

  const visionData = await visionRes.json();
  if (visionData.error) throw new Error(`OpenAI Vision Error: ${visionData.error.message}`);
  
  const description = visionData.choices[0].message.content;
  console.log("GPT-4o Expert Analysis:", description);

  // 2. Tạo ảnh bằng DALL-E 3
  // Super Prompt cho in ấn áo thun: Vector, Flat, No Shading, Solid Background.
  const finalPrompt = `
    T-SHIRT VECTOR GRAPHIC DESIGN.
    
    CONTENT DESCRIPTION: ${description}.
    
    USER OVERRIDE INSTRUCTION: ${prompt || "Maintain the original composition and style exactly."}.
    
    TECHNICAL STYLE (MANDATORY):
    - TYPE: Professional Vector Illustration / Adobe Illustrator style.
    - COLORING: Flat Spot Colors (Screen Print Style). NO gradients, NO photorealistic shading, NO 3D rendering.
    - LINES: Clean, bold, defined outlines.
    - BACKGROUND: PURE SOLID WHITE (Hex #FFFFFF) ONLY. Do not render a t-shirt or model. DRAW ONLY THE ARTWORK.
    - QUALITY: High definition, sharp edges, ready for vectorization.
  `;

  const imageBody = {
    model: "dall-e-3",
    prompt: finalPrompt,
    n: 1,
    size: "1024x1024",
    response_format: "b64_json",
    quality: "hd",
    style: "vivid" // Vivid giúp màu sắc tách bạch hơn cho in ấn
  };

  const imageRes = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify(imageBody)
  });

  const imageData = await imageRes.json();
  if (imageData.error) throw new Error(`DALL-E 3 Error: ${imageData.error.message}`);

  const b64 = imageData.data[0].b64_json;
  const resultUrl = `data:image/png;base64,${b64}`;

  return {
    imageUrl: resultUrl,
    suggestedName: "dalle3_vector_remix"
  };
}
