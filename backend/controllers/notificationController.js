const supabase = require('../config/supabase');
const { asyncHandler } = require('../utils/errorHandler');

const normalizeNotification = (notification) => ({
  id: notification.id,
  type: notification.type || 'system',
  title: notification.title || 'Notification',
  message: notification.message || '',
  linkUrl: notification.link_url || notification.link || null,
  read: Boolean(notification.is_read ?? notification.read),
  createdAt: notification.created_at || new Date().toISOString(),
  data: notification.data || {},
});

exports.getNotifications = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const response = await loadNotificationsForUser(userId);

  res.json({ success: true, data: response });
});

const loadNotificationsForUser = async (userId) => {
  const queries = [
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false })
      .limit(30),
  ];

  const byId = new Map();
  for (const query of queries) {
    const { data, error } = await query;
    if (!error) {
      (data || []).forEach(notification => {
        if (notification?.id) byId.set(notification.id, normalizeNotification(notification));
      });
    }
  }

  const notifications = Array.from(byId.values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 30);

  return {
    notifications,
    unreadCount: notifications.filter(notification => !notification.read).length,
  };
};

exports.streamNotifications = asyncHandler(async (req, res) => {
  const token = req.query.token;
  if (!token || typeof token !== 'string') {
    return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
  }

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  let previousSignature = '';
  const sendSnapshot = async () => {
    const payload = await loadNotificationsForUser(user.id);
    const signature = JSON.stringify({
      unreadCount: payload.unreadCount,
      ids: payload.notifications.map(notification => `${notification.id}:${notification.read}`),
    });
    if (signature === previousSignature) return;
    previousSignature = signature;
    res.write(`event: notifications\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  await sendSnapshot();
  const interval = setInterval(() => {
    sendSnapshot().catch(() => undefined);
  }, 10_000);

  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
});

exports.markNotificationRead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const updates = [
    supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', userId)
      .select('id'),
    supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .eq('recipient_id', userId)
      .select('id'),
  ];

  for (const update of updates) {
    const { data, error } = await update;
    if (!error && data?.length) return res.json({ success: true });
  }

  res.json({ success: true });
});

exports.markAllNotificationsRead = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId);
  await supabase.from('notifications').update({ read: true }).eq('recipient_id', userId);

  res.json({ success: true });
});
