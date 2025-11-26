import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || '';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { messages } = await req.json();

        if (!GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY is not set');
        }

        // Convert messages to Gemini format
        // Expected format: { role: 'user' | 'model', parts: [{ text: string }] }
        const contents = messages.map((msg) => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }],
        }));

        let response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: contents,
                    generationConfig: { maxOutputTokens: 500 },
                }),
            }
        );

        if (!response.ok) {
            // If the model fails (404 or 429), try to list available models to help debug
            const listModelsResp = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`
            );

            let availableModels = "Could not list models";
            if (listModelsResp.ok) {
                const listData = await listModelsResp.json();
                availableModels = listData.models?.map((m) => m.name).join(', ') || "No models found";
            }

            const errorText = await response.text();
            throw new Error(`Gemini API Error: ${response.status} - ${errorText}. \n\nAVAILABLE MODELS: ${availableModels}`);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, I couldn't generate a response.";

        return new Response(JSON.stringify({ text }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
