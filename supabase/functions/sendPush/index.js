import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const expoPushEndpoint = 'https://exp.host/--/api/v2/push/send';

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

const assertAuthorized = (req) => {
  const header = req.headers.get('Authorization') ?? '';
  if (!header.startsWith('Bearer ')) return false;
  const token = header.replace('Bearer ', '');
  return token === serviceRoleKey;
};

serve(async (req) => {
  if (!assertAuthorized(req)) return new Response('Forbidden', { status: 403 });
  const payload = await req.json();
  const tokens = payload.tokens ?? [];
  const message = payload.message ?? {};
  if (!tokens.length) {
    return new Response(JSON.stringify({ sent: 0 }), { headers: { 'Content-Type': 'application/json' } });
  }

  const chunks = chunk(tokens, 99);
  let sent = 0;
  const invalid = [];

  for (const chunkTokens of chunks) {
    const res = await fetch(expoPushEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        chunkTokens.map((token) => ({
          to: token,
          title: message.title,
          body: message.body,
          data: message.data ?? {},
          sound: 'default',
        })),
      ),
    });
    const json = await res.json();
    json.data?.forEach((item, idx) => {
      if (item.status === 'ok') {
        sent += 1;
      } else if (item.details?.error === 'DeviceNotRegistered') {
        invalid.push(chunkTokens[idx]);
      }
    });
  }

  if (invalid.length) {
    await supabaseAdmin.from('devices').delete().in('push_token', invalid);
  }

  return new Response(JSON.stringify({ sent, invalid }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

const chunk = (arr, size) => {
  const res = [];
  for (let i = 0; i < arr.length; i += size) {
    res.push(arr.slice(i, i + size));
  }
  return res;
};

