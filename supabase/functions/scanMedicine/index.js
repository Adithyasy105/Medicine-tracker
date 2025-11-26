import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const storageBucket = Deno.env.get('STORAGE_BUCKET') ?? 'medicine-images';
const visionApiKey = Deno.env.get('VISION_API_KEY') ?? '';
const llmApiKey = Deno.env.get('OPENAI_API_KEY') ?? Deno.env.get('GEMINI_API_KEY') ?? '';

const createSupabaseClient = (authHeader) =>
  createClient(supabaseUrl, serviceRoleKey, {
    global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
  });

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createSupabaseClient(authHeader);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return new Response('Unauthorized', { status: 401 });

  const { imagePath } = await req.json().catch(() => ({}));
  if (!imagePath) return new Response('imagePath is required', { status: 400 });

  const { data: signed, error: signedError } = await supabaseAdmin.storage
    .from(storageBucket)
    .createSignedUrl(imagePath, 60);
  if (signedError || !signed?.signedUrl) {
    return new Response(`Unable to sign url: ${signedError?.message}`, { status: 500 });
  }

  // Use Gemini if available, otherwise fallback or error
  let parsed;
  try {
    if (llmApiKey) {
      // Optional: Run Vision OCR if key is present, otherwise rely on Gemini's vision
      const text = visionApiKey ? await runVisionOcr(signed.signedUrl) : '';
      parsed = await runGeminiParser(text, signed.signedUrl);
    } else {
      console.log('No API key found, using fallback');
      parsed = fallbackParse();
    }
  } catch (e) {
    console.error('LLM Parse Error:', e);
    parsed = fallbackParse();
  }

  await supabaseAdmin.from('scans').insert({
    user_id: user.id,
    image_path: imagePath,
    parsed,
    confidence: parsed.ai_confidence ?? null,
  });

  return new Response(JSON.stringify({ parsed }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

const runVisionOcr = async (signedUrl) => {
  if (!visionApiKey) return '';

  const endpoint = `https://vision.googleapis.com/v1/images:annotate?key=${visionApiKey}`;
  const body = {
    requests: [
      {
        image: { source: { imageUri: signedUrl } },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
      },
    ],
  };
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return json?.responses?.[0]?.fullTextAnnotation?.text ?? '';
};

const runGeminiParser = async (text, signedUrl) => {
  const prompt = `
    Extract medicine metadata from this medicine label/package.
    Return ONLY valid JSON with these keys:
    - name (string)
    - brand (string)
    - dosage (string)
    - form (string, e.g. tablet, syrup)
    - times (array of strings in HH:MM format, e.g. ["08:00", "20:00"])
    - unit_per_dose (number)
    - quantity (number)
    - refill_threshold (number)
    - expiry_date (YYYY-MM-DD string)
    - manufacturer (string)
    - instructions (string)
    - purpose (string)
    - frequency (string)
    - ai_confidence (number between 0 and 1)

    OCR Text (if any): ${text}
  `;

  const imageResp = await fetch(signedUrl);
  const imageBlob = await imageResp.blob();
  const arrayBuffer = await imageBlob.arrayBuffer();
  const base64Image = btoa(
    new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
  );

  const body = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: "image/jpeg", data: base64Image } }
      ]
    }],
    generationConfig: {
      response_mime_type: "application/json"
    }
  };

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${llmApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API Error: ${res.status} ${errText}`);
  }

  const json = await res.json();
  let content = json.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!content) throw new Error('No content from Gemini');

  // Sanitize: Remove markdown code blocks if present
  content = content.replace(/```json\n?|```/g, '').trim();

  try {
    return JSON.parse(content);
  } catch (e) {
    console.error('JSON Parse Error:', content);
    throw new Error('Failed to parse Gemini response as JSON');
  }
};

const fallbackParse = () => ({
  name: '',
  dosage: '',
  form: '',
  times: ['08:00', '20:00'],
  ai_confidence: 0,
});
