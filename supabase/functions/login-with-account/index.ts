import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const normalizeAccount = (value: string) => value.trim().normalize('NFKC').toLowerCase();

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ success: false, code: 'invalid_request' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ success: false, code: 'service_unavailable' }, 500);
  }

  let body: { account?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ success: false, code: 'invalid_request' }, 400);
  }

  const account = typeof body.account === 'string' ? normalizeAccount(body.account) : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!account || !password) return json({ success: false, code: 'invalid_credentials' });

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, auth_user_id, status')
    .eq('username', account)
    .maybeSingle();

  if (profileError) return json({ success: false, code: 'service_unavailable' }, 500);
  if (!profile?.auth_user_id) return json({ success: false, code: 'invalid_credentials' });

  const { data: userResult, error: userError } = await adminClient.auth.admin.getUserById(profile.auth_user_id);
  const email = userResult.user?.email;
  if (userError || !email) return json({ success: false, code: 'invalid_credentials' });

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: signInData, error: signInError } = await authClient.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError || !signInData.user || !signInData.session || signInData.user.id !== profile.auth_user_id) {
    return json({ success: false, code: 'invalid_credentials' });
  }
  if (profile.status === 'rejected') return json({ success: false, code: 'rejected' });
  if (profile.status !== 'approved') return json({ success: false, code: 'pending' });

  return json({
    success: true,
    accessToken: signInData.session.access_token,
    refreshToken: signInData.session.refresh_token,
  });
});
