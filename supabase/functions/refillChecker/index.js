import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const header = req.headers.get('Authorization') ?? '';
  if (header.replace('Bearer ', '') !== serviceRoleKey) return new Response('Forbidden', { status: 403 });

  const { data: medicines, error } = await supabaseAdmin.rpc('low_stock_medicines');

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let alerts = 0;
  for (const medicine of medicines ?? []) {
    const tokens = await getTokens(medicine.user_id);
    if (!tokens.length) continue;
    await sendPush(tokens, {
      title: 'Refill reminder',
      body: `${medicine.name} is low (${medicine.quantity} left).`,
      data: { type: 'refill', medicineId: medicine.id },
    });
    alerts += 1;
    await supabaseAdmin.from('medicines').update({ refill_alert_sent: true }).eq('id', medicine.id);
  }

  return new Response(JSON.stringify({ alerts }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

const getTokens = async (userId) => {
  const { data } = await supabaseAdmin.from('devices').select('push_token').eq('user_id', userId);
  return data?.map((d) => d.push_token).filter(Boolean) ?? [];
};

const sendPush = async (tokens, message) => {
  await fetch(`${supabaseUrl}/functions/v1/sendPush`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ tokens, message }),
  });
};

