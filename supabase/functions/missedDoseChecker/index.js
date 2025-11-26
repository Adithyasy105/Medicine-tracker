import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const header = req.headers.get('Authorization') ?? '';
  if (header.replace('Bearer ', '') !== serviceRoleKey) return new Response('Forbidden', { status: 403 });

  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: logs, error } = await supabaseAdmin
    .from('medicine_logs')
    .select('id, medicine_id, user_id, follow_up_sent, time_scheduled, status')
    .eq('status', 'missed')
    .eq('follow_up_sent', false)
    .lte('time_scheduled', tenMinutesAgo);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  let reminders = 0;
  const medicineNames = await loadMedicines(logs ?? []);

  for (const log of logs ?? []) {
    const tokens = await getTokens(log.user_id);
    if (!tokens.length) continue;
    await sendPush(tokens, {
      title: 'Missed dose',
      body: `You missed ${medicineNames.get(log.medicine_id) ?? 'a dose'} scheduled at ${new Date(log.time_scheduled).toLocaleTimeString()}.`,
      data: { type: 'missed', logId: log.id, medicineId: log.medicine_id },
    });
    await supabaseAdmin.from('medicine_logs').update({ follow_up_sent: true }).eq('id', log.id);
    reminders += 1;
  }

  return new Response(JSON.stringify({ reminders }), {
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

const loadMedicines = async (logs) => {
  const ids = Array.from(new Set(logs.map((log) => log.medicine_id)));
  if (!ids.length) return new Map();
  const { data } = await supabaseAdmin.from('medicines').select('id, name').in('id', ids);
  const map = new Map();
  data?.forEach((row) => map.set(row.id, row.name));
  return map;
};

