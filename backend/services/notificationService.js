'use strict';

const supabase = require('../config/supabase');
const { logger } = require('../utils/logger');
const { sendNotificationEmail } = require('./emailService');

const notificationPayloads = ({ userId, type, title, message, linkUrl, data }) => {
  const base = {
    type,
    title,
    message,
    data,
  };

  return [
    { ...base, user_id: userId, link_url: linkUrl, is_read: false },
    { ...base, user_id: userId, link: linkUrl, is_read: false },
    { ...base, recipient_id: userId, link_url: linkUrl, read: false },
  ];
};

async function getUserEmail(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    logger.warn({ event: 'notification_email_lookup_failed', userId, err: error.message }, 'Could not load notification recipient email');
    return null;
  }

  return data?.email || null;
}

async function sendEmailBestEffort(notification) {
  try {
    const to = await getUserEmail(notification.userId);
    if (!to) {
      logger.info({ event: 'notification_email_skipped', userId: notification.userId, reason: 'missing_email' });
      return;
    }

    const result = await sendNotificationEmail({
      to,
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      linkUrl: notification.linkUrl,
    });

    if (result?.skipped) {
      logger.debug({ event: 'notification_email_skipped', userId: notification.userId, reason: result.reason });
      return;
    }

    logger.info({
      event: 'notification_email_sent',
      userId: notification.userId,
      provider: result.provider,
      providerMessageId: result.id,
    });
  } catch (err) {
    logger.warn(
      { event: 'notification_email_failed', userId: notification.userId, err },
      'Email notification failed; in-app notification remains available',
    );
  }
}

async function createUserNotification({ userId, type = 'system', title, message, linkUrl = null, data = {}, sendEmail = true }) {
  if (!userId) return { created: false, reason: 'missing_user' };

  const payloads = notificationPayloads({ userId, type, title, message, linkUrl, data });
  let lastError = null;

  for (const payload of payloads) {
    const { data: inserted, error } = await supabase
      .from('notifications')
      .insert(payload)
      .select('id')
      .single();

    if (!error) {
      const notification = {
        id: inserted?.id,
        userId,
        type,
        title,
        message,
        linkUrl,
        data,
      };

      if (sendEmail) {
        setImmediate(() => {
          sendEmailBestEffort(notification).catch(() => undefined);
        });
      }

      return { created: true, notificationId: inserted?.id };
    }

    lastError = error;
  }

  logger.error(
    { event: 'notification_create_failed', userId, err: lastError?.message },
    'Failed to create in-app notification',
  );
  return { created: false, reason: 'insert_failed', error: lastError };
}

module.exports = {
  createUserNotification,
  sendEmailBestEffort,
};
