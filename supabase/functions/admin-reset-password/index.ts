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

const accountToInternalAuthEmail = async (account: string) => {
  const normalized = account.trim().normalize('NFKC').toLowerCase();
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `u_${hash}@goodminton.invalid`;
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: '管理服務尚未完成設定。' }, 500);
  }

  const authorization = request.headers.get('Authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return json({ error: '請先登入。' }, 401);

  const callerClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: callerData, error: callerError } = await callerClient.auth.getUser(token);
  if (callerError || !callerData.user) return json({ error: '登入階段已失效，請重新登入。' }, 401);

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: callerProfile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, role, status')
    .eq('auth_user_id', callerData.user.id)
    .maybeSingle();

  if (profileError) return json({ error: '無法驗證管理員權限。' }, 500);
  if (callerProfile?.role !== 'admin' || callerProfile.status !== 'approved') {
    return json({ error: '只有已核准的管理員可以管理登入帳號。' }, 403);
  }

  let body: { action?: unknown; profileId?: unknown; newPassword?: unknown; newUsername?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: '請求內容不是有效的 JSON。' }, 400);
  }

  const action = body.action === 'delete_member'
    ? 'delete_member'
    : body.action === 'rename_account'
      ? 'rename_account'
      : 'set_password';
  const profileId = typeof body.profileId === 'string' ? body.profileId.trim() : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
  const newUsername = typeof body.newUsername === 'string'
    ? body.newUsername.trim().normalize('NFKC').toLowerCase()
    : '';
  if (!profileId) return json({ error: '隊員編號不能空白。' }, 400);
  if (action === 'set_password' && !newPassword) return json({ error: '新密碼不能空白。' }, 400);
  if (action === 'set_password' && newPassword.length < 6) return json({ error: '新密碼至少要有 6 碼。' }, 400);
  if (action === 'rename_account' && !newUsername) return json({ error: '新帳號不能空白。' }, 400);

  const { data: targetProfile, error: targetError } = await adminClient
    .from('profiles')
    .select('id, auth_user_id, username, name, level, gender, role, status')
    .eq('id', profileId)
    .maybeSingle();
  if (targetError) return json({ error: '無法查詢目標隊員。' }, 500);
  if (!targetProfile) return json({ error: '找不到這筆隊員資料。' }, 404);
  if (typeof targetProfile.username !== 'string' || !targetProfile.username.trim()) {
    return json({ error: '這筆隊員資料沒有可用的帳號，請先補上帳號。' }, 400);
  }

  if (action === 'delete_member') {
    if (targetProfile.id === callerProfile.id) {
      return json({ error: '不能刪除目前登入中的自己。' }, 400);
    }
    if (targetProfile.role === 'admin' && targetProfile.status === 'approved') {
      const { count, error: countError } = await adminClient
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'admin')
        .eq('status', 'approved')
        .not('auth_user_id', 'is', null)
        .neq('id', targetProfile.id);
      if (countError) return json({ error: '無法確認剩餘管理員人數。' }, 500);
      if (!count) return json({ error: '不能刪除最後一位可登入的管理員。' }, 400);
    }

    if (targetProfile.auth_user_id) {
      const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(targetProfile.auth_user_id);
      if (authDeleteError) return json({ error: '登入帳號刪除失敗，請稍後再試。' }, 400);
    }

    const { error: profileDeleteError } = await adminClient
      .from('profiles')
      .delete()
      .eq('id', targetProfile.id);
    if (profileDeleteError) {
      return json({
        error: targetProfile.auth_user_id
          ? `登入帳號已刪除，但隊員資料清理失敗：${profileDeleteError.message}`
          : `隊員資料刪除失敗：${profileDeleteError.message}`,
      }, 500);
    }

    return json({ success: true, deleted: true, profileId: targetProfile.id });
  }

  if (action === 'rename_account') {
    const { data: allProfiles, error: usernamesError } = await adminClient
      .from('profiles')
      .select('id, username');
    if (usernamesError) return json({ error: '無法確認帳號是否重複。' }, 500);
    const duplicated = allProfiles?.some((profile) =>
      profile.id !== targetProfile.id
      && typeof profile.username === 'string'
      && profile.username.trim().normalize('NFKC').toLowerCase() === newUsername
    );
    if (duplicated) return json({ error: '這個帳號已被其他隊員使用。' }, 409);

    let previousAuthEmail: string | undefined;
    if (targetProfile.auth_user_id) {
      const { data: authUserData, error: authUserError } = await adminClient.auth.admin.getUserById(targetProfile.auth_user_id);
      if (authUserError || !authUserData.user) {
        return json({ error: '找不到要修改的登入帳號。' }, 400);
      }
      previousAuthEmail = authUserData.user.email;
      const nextInternalEmail = await accountToInternalAuthEmail(newUsername);
      const { error: authRenameError } = await adminClient.auth.admin.updateUserById(
        targetProfile.auth_user_id,
        { email: nextInternalEmail, email_confirm: true },
      );
      if (authRenameError) return json({ error: '登入帳號更新失敗；新帳號可能已被使用。' }, 400);
    }

    const { error: profileRenameError } = await adminClient
      .from('profiles')
      .update({ username: newUsername })
      .eq('id', targetProfile.id);
    if (profileRenameError) {
      if (targetProfile.auth_user_id && previousAuthEmail) {
        await adminClient.auth.admin.updateUserById(
          targetProfile.auth_user_id,
          { email: previousAuthEmail, email_confirm: true },
        );
      }
      return json({ error: `隊員帳號更新失敗：${profileRenameError.message}` }, 500);
    }

    return json({ success: true, renamed: true, profileId: targetProfile.id, username: newUsername });
  }

  const internalEmail = await accountToInternalAuthEmail(targetProfile.username);
  if (targetProfile.auth_user_id) {
    const { data: updated, error: updateError } = await adminClient.auth.admin.updateUserById(
      targetProfile.auth_user_id,
      {
        password: newPassword,
        email: internalEmail,
        email_confirm: true,
      },
    );
    if (updateError || !updated.user) {
      return json({ error: '密碼更新失敗，請換一組密碼後再試。' }, 400);
    }
    return json({ success: true, authUserId: updated.user.id, usernameLoginReady: true, created: false });
  }

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email: internalEmail,
    password: newPassword,
    email_confirm: true,
    user_metadata: {
      username: targetProfile.username,
      name: targetProfile.name,
      level: targetProfile.level,
      gender: targetProfile.gender,
    },
  });
  if (createError || !created.user) {
    return json({ error: '登入帳號建立失敗；帳號可能已存在，或密碼不符合要求。' }, 400);
  }

  // handle_new_user creates a temporary profile for every Auth user. When an
  // administrator is linking a legacy profile, remove only that temporary row
  // and keep the original profile ID referenced by attendance and fee records.
  if (created.user.id !== targetProfile.id) {
    const { error: cleanupError } = await adminClient.from('profiles').delete().eq('id', created.user.id);
    if (cleanupError) {
      await adminClient.auth.admin.deleteUser(created.user.id);
      return json({ error: '建立登入帳號時無法完成資料整理，已取消本次建立。' }, 500);
    }
  }

  const { error: linkError } = await adminClient
    .from('profiles')
    .update({ auth_user_id: created.user.id })
    .eq('id', targetProfile.id);
  if (linkError) {
    await adminClient.auth.admin.deleteUser(created.user.id);
    return json({ error: '登入帳號已取消：無法連結原隊員資料。' }, 500);
  }

  return json({ success: true, authUserId: created.user.id, usernameLoginReady: true, created: true });
});
