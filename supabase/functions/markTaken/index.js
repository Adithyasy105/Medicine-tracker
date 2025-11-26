import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

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

  const { logId, quantity = 1, medicineId } = await req.json().catch(() => ({}));
  if (!medicineId) return new Response('medicineId is required', { status: 400 });

  const { data: medicine, error: medError } = await supabaseAdmin
    .from('medicines')
    .select('id, quantity, refill_threshold, refill_alert_sent, name, dosage, user_id')
    .eq('id', medicineId)
    .single();
  if (medError || !medicine) return new Response('Medicine not found', { status: 404 });

  if (medicine.user_id !== user.id) return new Response('Forbidden', { status: 403 });

  const newQuantity = Math.max(0, (medicine.quantity ?? 0) - quantity);
  await supabaseAdmin.from('medicines').update({ quantity: newQuantity }).eq('id', medicineId);

  if (logId) {
    await supabaseAdmin
      .from('medicine_logs')
      .update({ status: 'taken', time_taken: new Date().toISOString() })
      .eq('id', logId)
      .eq('user_id', user.id);
  } else {
    await supabaseAdmin.from('medicine_logs').insert({
      user_id: user.id,
      medicine_id: medicineId,
      time_scheduled: new Date().toISOString(),
      time_taken: new Date().toISOString(),
      status: 'taken',
    });
  }

  let refillTriggered = false;
  if (newQuantity <= (medicine.refill_threshold ?? 0) && !medicine.refill_alert_sent) {
    refillTriggered = true;
    await supabaseAdmin.from('medicines').update({ refill_alert_sent: true }).eq('id', medicineId);
    await notifyUser(user.id, {
      title: 'Refill reminder',
      body: `${medicine.name} is running low (${newQuantity} left).`,
      data: { type: 'refill', medicineId },
    });
  }

  return new Response(JSON.stringify({ quantity: newQuantity, refillTriggered }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

const notifyUser = async (userId, message) => {
  const { data: devices } = await supabaseAdmin.from('devices').select('push_token').eq('user_id', userId);
  const tokens = devices?.map((d) => d.push_token).filter(Boolean) ?? [];
  if (!tokens.length) return;
  await fetch(`${supabaseUrl}/functions/v1/sendPush`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ tokens, message }),
  });
};

