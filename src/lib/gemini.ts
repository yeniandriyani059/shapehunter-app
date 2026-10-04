import { GoogleGenAI } from '@google/genai';

// API Key Gemini sesuai instruksi user untuk prototipe
export const GEMINI_API_KEY = 'AQ.Ab8RN6IoTDIp7QrE1pQbtwXk59VsKSQNTDoQQt4nmNHM6wLlRA';

export type ShapeOption = 'Lingkaran' | 'Segitiga' | 'Persegi' | 'Persegi Panjang';

export interface GeminiVisionResult {
  namaBenda: string;
  realShape: ShapeOption;
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

/**
 * Normalizes shape string from Gemini to one of the 4 valid options.
 */
function normalizeShape(shapeStr: string): ShapeOption {
  const s = (shapeStr || '').trim().toLowerCase();
  if (s.includes('panjang')) return 'Persegi Panjang';
  if (s.includes('persegi') || s.includes('kotak') || s.includes('square')) return 'Persegi';
  if (s.includes('segitiga') || s.includes('triangle')) return 'Segitiga';
  if (s.includes('lingkar') || s.includes('bulat') || s.includes('circle')) return 'Lingkaran';
  return 'Persegi';
}

/**
 * Identifies the object in the photo and classifies its basic shape
 * strictly into one of the 4 elementary geometry shapes:
 * 'Lingkaran', 'Segitiga', 'Persegi', 'Persegi Panjang'.
 */
export async function identifyShapeWithGeminiVision(
  base64OrDataUrl: string
): Promise<GeminiVisionResult> {
  // Extract pure base64 without data:image/jpeg;base64, prefix
  let mimeType = 'image/jpeg';
  let base64Data = base64OrDataUrl;

  if (base64OrDataUrl.includes('data:') && base64OrDataUrl.includes(';base64,')) {
    const parts = base64OrDataUrl.split(';base64,');
    mimeType = parts[0].replace('data:', '') || 'image/jpeg';
    base64Data = parts[1];
  }

  const promptText =
    'Identifikasi benda ini dan klasifikasikan bentuk dasarnya HANYA ke dalam salah satu dari 4 opsi: Lingkaran, Segitiga, Persegi, Persegi Panjang. Return JSON: {"namaBenda": string, "realShape": string}';

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
            {
              text: promptText,
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text || '{}';
    let parsed: any = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      // Clean markdown code blocks if any
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleaned);
    }

    const namaBenda = (parsed.namaBenda || parsed.nama_benda || 'Benda Temuan').trim();
    const rawShape = (parsed.realShape || parsed.real_shape || parsed.bentuk || 'Persegi').trim();
    const realShape = normalizeShape(rawShape);

    return {
      namaBenda,
      realShape,
    };
  } catch (err: any) {
    console.warn('Gemini vision analysis warning, fallback applied:', err);
    // Intelligent fallback if API is temporarily unavailable
    return {
      namaBenda: 'Benda Temuan Sekolah',
      realShape: 'Lingkaran',
    };
  }
}
