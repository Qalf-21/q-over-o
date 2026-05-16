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

  for (const query of queries) {
    const { data, error } = await query;
    if (!error) {
      const notifications = (data || []).map(normalizeNotification);
      return res.json({
        success: true,
        data: {
          notifications,
          unreadCount: notifications.filter(notification => !notification.read).length,
        },
      });
    }
  }

  res.json({ success: true, data: { notifications: [], unreadCount: 0 } });
});

exports.markNotificationRead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const updates = [
    supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', userId),
    supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .eq('recipient_id', userId),
  ];

  for (const update of updates) {
    const { error } = await update;
    if (!error) return res.json({ success: true });
  }

  res.json({ success: true });
});

exports.markAllNotificationsRead = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId);
  await supabase.from('notifications').update({ read: true }).eq('recipient_id', userId);

  res.json({ success: true });
});
