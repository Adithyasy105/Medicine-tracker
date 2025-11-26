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

  const rawText = visionApiKey ? await runVisionOcr(signed.signedUrl) : null;
  const parsed = llmApiKey ? await runLlmParser(rawText ?? '', signed.signedUrl) : fallbackParse();

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

const runLlmParser = async (text, signedUrl) => {
  const prompt = [
    {
      role: 'system',
      content:
        'Extract medicine metadata as JSON with keys name, brand, dosage, form, times (array of HH:MM), unit_per_dose, quantity, refill_threshold, expiry_date, manufacturer, instructions. Return ai_confidence between 0 and 1.',
    },
    {
      role: 'user',
      content: `Image url: ${signedUrl}\nExtracted OCR text:\n${text}`,
    },
  ];

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${llmApiKey}`,
    },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages: prompt, temperature: 0.2 }),
  });
  const json = await res.json();
  try {
    const content = json.choices?.[0]?.message?.content ?? '{}';
    return JSON.parse(content);
  } catch {
    return fallbackParse();
  }
};

const fallbackParse = () => ({
  name: '',
  dosage: '',
  form: '',
  times: ['08:00', '20:00'],
  ai_confidence: 0,
});

