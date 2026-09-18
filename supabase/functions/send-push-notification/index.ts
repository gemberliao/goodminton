import { createClient } from 'npm:@supabase/supabase-js@2.112.0';
import webpush from 'npm:web-push@3.6.7';

type WebhookPayload = {
  type?: string;
  record?: { id?: string };
};

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  expiration_time: number | null;
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8' },
});

const getJwtRole = (request: Request): string => {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return '';
  try {
    const payload = token.split('.')[1];
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    return JSON.parse(atob(padded)).role || '';
  } catch {
    return '';
  }
};

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (getJwtRole(request) !== 'service_role') return json({ error: 'Service role required' }, 403);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@goodminton.app';

  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey) {
    return json({ error: 'Push notification secrets are incomplete' }, 500);
  }

  const payload = await request.json() as WebhookPayload;
  const notificationId = payload.record?.id;
  if (!notificationId || (payload.type && payload.type !== 'INSERT')) {
    return json({ error: 'An inserted notification record is required' }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: notification, error: notificationError } = await admin
    .from('push_notifications')
    .select('id,user_id,kind,title,body,url,tag,created_at')
    .eq('id', notificationId)
    .single();

  if (notificationError || !notification) {
    return json({ error: notificationError?.message || 'Notification not found' }, 404);
  }

  const [{ data: subscriptions, error: subscriptionsError }, { count: unreadCount }] = await Promise.all([
    admin
      .from('push_subscriptions')
      .select('id,endpoint,p256dh,auth,expiration_time')
      .eq('user_id', notification.user_id),
    admin
      .from('push_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', notification.user_id)
      .is('read_at', null),
  ]);

  if (subscriptionsError) return json({ error: subscriptionsError.message }, 500);
  if (!subscriptions?.length) {
    await admin.from('push_notifications').update({
      push_status: 'no_subscription',
      push_error: 'No active push subscription',
    }).eq('id', notification.id);
    return json({ delivered: 0, status: 'no_subscription' });
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  const message = JSON.stringify({
    notificationId: notification.id,
    kind: notification.kind,
    title: notification.title,
    body: notification.body,
    url: notification.url,
    tag: notification.tag || `goodminton-${notification.id}`,
    unreadCount: unreadCount || 1,
    timestamp: new Date(notification.created_at).getTime(),
  });

  let delivered = 0;
  const failures: string[] = [];
  await Promise.all((subscriptions as PushSubscriptionRow[]).map(async (subscription) => {
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        expirationTime: subscription.expiration_time,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      }, message, { TTL: 60 * 60 * 24 });
      delivered += 1;
    } catch (error) {
      const statusCode = Number((error as { statusCode?: number }).statusCode || 0);
      if (statusCode === 404 || statusCode === 410) {
        await admin.from('push_subscriptions').delete().eq('id', subscription.id);
      }
      failures.push(statusCode ? `HTTP ${statusCode}` : String(error));
    }
  }));

  const status = delivered === subscriptions.length ? 'sent' : delivered > 0 ? 'partial' : 'failed';
  await admin.from('push_notifications').update({
    push_status: status,
    push_sent_at: delivered > 0 ? new Date().toISOString() : null,
    push_error: failures.length ? failures.join('; ').slice(0, 500) : null,
  }).eq('id', notification.id);

  return json({ delivered, failed: failures.length, status });
});
