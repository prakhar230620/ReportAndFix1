// lib/aiDetection.ts
// Multi-layer detection system for AI-generated images and forged payment proofs.

export type AiDetectionResult = {
  isAiGenerated: boolean;
  confidence: number; // 0 to 1
  reason: string;
};

// Known AI generation software and model signatures
const AI_SIGNATURE_PATTERNS = [
  /midjourney/i,
  /dall[-_]?e/i,
  /stable[-_]?diffusion/i,
  /stablediffusion/i,
  /novelai/i,
  /civitai/i,
  /automatic1111/i,
  /comfyui/i,
  /invokeai/i,
  /flux\.1/i,
  /bfl_flux/i,
  /adobe firefly/i,
  /ideogram/i,
  /imagen/i,
  /photoshop neural/i,
  /synthetic/i,
  /ai generated/i,
];

/**
 * Checks a file buffer for AI generator signatures in metadata and PNG/JPEG chunks.
 */
export async function detectAiGeneratedImage(
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<AiDetectionResult> {
  // 1. Text header & Exif metadata inspection
  const headerSlice = buffer.subarray(0, Math.min(buffer.length, 65536)).toString("latin1");
  const footerSlice = buffer
    .subarray(Math.max(0, buffer.length - 8192))
    .toString("latin1");
  const fullTextScan = headerSlice + " " + footerSlice;

  for (const pattern of AI_SIGNATURE_PATTERNS) {
    if (pattern.test(fullTextScan)) {
      return {
        isAiGenerated: true,
        confidence: 0.99,
        reason: `AI generation metadata detected matching signature: ${pattern.source}`,
      };
    }
  }

  // 2. Check for PNG tEXt chunks with generator parameters
  if (contentType === "image/png" || filename.toLowerCase().endsWith(".png")) {
    const pngStr = buffer.toString("binary");
    if (
      pngStr.includes("tEXtparameters") ||
      pngStr.includes("tEXtprompt") ||
      pngStr.includes("tEXtWorkflow") ||
      pngStr.includes("Steps: ") ||
      pngStr.includes("Sampler: ") ||
      pngStr.includes("CFG scale: ")
    ) {
      return {
        isAiGenerated: true,
        confidence: 0.98,
        reason: "Diffusion generation parameters chunk found inside PNG metadata.",
      };
    }
  }

  // 3. Fallback: Optional Gemini Flash Vision verification if API key is present
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (geminiKey) {
    try {
      const base64Data = buffer.toString("base64");
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text:
                    "You are a forensic document authenticator. Analyze this payment proof (UPI, Netbanking, or Card receipt). Check for signs of AI image generation (e.g., distorted fonts, unnatural blur, irregular logos, diffusion noise, prompt artifacts). Reply ONLY with valid JSON in this exact structure: {\"isAiGenerated\": boolean, \"confidence\": number, \"reason\": string}.",
                },
                {
                  inlineData: {
                    mimeType: contentType || "image/jpeg",
                    data: base64Data,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
          },
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text);
          if (typeof parsed.isAiGenerated === "boolean") {
            return {
              isAiGenerated: parsed.isAiGenerated,
              confidence: parsed.confidence ?? 0.9,
              reason: parsed.reason ?? "Forensic model assessment completed.",
            };
          }
        }
      }
    } catch (e) {
      console.warn("[ai-detection] Gemini vision check skipped or error:", e);
    }
  }

  // 4. Default authentic
  return {
    isAiGenerated: false,
    confidence: 0.1,
    reason: "No AI signatures or synthetic artifacts detected.",
  };
}
