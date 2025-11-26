import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase, tables } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PUSH_TOKEN_STORAGE_KEY = 'push_token_cache';

// deterministic id helper (reuse in file)
const todayKey = (ts = Date.now()) => {
  const d = new Date(ts);
  return d.toISOString().split('T')[0]; // Using YYYY-MM-DD for consistency
};

// Set up notification handler with enhanced settings
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const notificationType = notification.request.content.data?.type;

    return {
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
      // Priority based on notification type
      priority: notificationType === 'out-of-stock' ? 'high' : 'default',
    };
  },
});

// Notification channels for Android
const NOTIFICATION_CHANNELS = {
  MEDICATION_REMINDERS: {
    id: 'medication-reminders',
    name: 'Medication Reminders',
    description: 'Reminders to take your medications on time',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrate: true,
    badge: true,
  },
  LOW_STOCK_ALERTS: {
    id: 'low-stock-alerts',
    name: 'Low Stock Alerts',
    description: 'Alerts when medication stock is running low',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
    vibrate: true,
    badge: true,
  },
  OUT_OF_STOCK: {
    id: 'out-of-stock',
    name: 'Out of Stock',
    description: 'Critical alerts when medication is out of stock',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    vibrate: [0, 250, 250, 250],
    badge: true,
  },
  GENERAL: {
    id: 'general',
    name: 'General Notifications',
    description: 'General app notifications',
    importance: Notifications.AndroidImportance.DEFAULT,
  },
};

// Helper function to format time (HH:MM to 12-hour format)
const formatTime = (time) => {
  try {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  } catch (error) {
    return time; // Return original if formatting fails
  }
};

// Initialize notification channels for Android
export const initializeNotificationChannels = async () => {
  if (Platform.OS === 'android') {
    for (const channel of Object.values(NOTIFICATION_CHANNELS)) {
      await Notifications.setNotificationChannelAsync(channel.id, {
        name: channel.name,
        description: channel.description,
        importance: channel.importance,
        sound: channel.sound,
        vibrationPattern: channel.vibrate,
        enableBadge: channel.badge,
      });
    }
  }
};

export const registerForPushNotificationsAsync = async () => {
  if (!Device.isDevice) {
    console.warn('Push notifications require device hardware');
    return null;
  }

  // return cached token if found
  try {
    const cached = await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
    if (cached) return cached;
  } catch (e) { /* ignore */ }

  const settings = await Notifications.getPermissionsAsync();
  let finalStatus = settings.status;
  if (finalStatus !== 'granted') {
    const request = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true, allowAnnouncements: true },
    });
    finalStatus = request.status;
  }
  if (finalStatus !== 'granted') {
    console.warn('Push notification permission denied');
    return null;
  }

  await initializeNotificationChannels();

  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
  if (!projectId) {
    console.warn('Expo projectId missing; push token unavailable in Expo Go');
    return null;
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData?.data ?? null;
    if (token) {
      await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
    }
    return token;
  } catch (err) {
    console.warn('Device token registration failed', err);
    return null;
  }
};

export const upsertDeviceToken = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;

  const pushToken = await registerForPushNotificationsAsync();
  if (!pushToken) return null;

  const payload = {
    user_id: session.user.id,
    push_token: pushToken,
    device_id: pushToken, // stable device id
    platform: Platform.OS,
    last_seen: new Date().toISOString(),
  };

  const { error } = await supabase.from(tables.devices).upsert(payload, { onConflict: 'push_token' });
  if (error) {
    console.error('Failed to upsert device token:', error);
    throw error;
  }

  return pushToken;
};

/**
 * Schedule a medication reminder notification
 */
export const scheduleLocalReminder = async ({ id, title, body, trigger, medicineName, type }) => {
  try {
    return await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title: title || '💊 Medication Reminder',
        body: body,
        data: {
          type: type || 'medicine-reminder',
          medicineName: medicineName,
          timestamp: new Date().toISOString(),
        },
        sound: 'default',
        badge: 1,
        categoryIdentifier: 'medication-reminder',
        priority: 'high',
        ...(Platform.OS === 'android' && {
          channelId: NOTIFICATION_CHANNELS.MEDICATION_REMINDERS.id,
        }),
      },
      trigger,
    });
  } catch (error) {
    console.error('Failed to schedule reminder:', error);
    throw error;
  }
};

/**
 * Send low stock alert notification
 */
export const sendLowStockAlert = async ({ medicineId, medicineName, currentQuantity, threshold }) => {
  try {
    const id = `low-stock-${medicineId}-${todayKey()}`;
    const lastKey = `last_stock_alert_${medicineId}`;
    const last = await AsyncStorage.getItem(lastKey);
    const now = Date.now();
    const COOLDOWN = 24 * 60 * 60 * 1000;
    if (last && (now - parseInt(last, 10)) < COOLDOWN) {
      console.log(`Low-stock alert already sent today for ${medicineName}`);
      return null;
    }

    const res = await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title: '⚠️ Refill Reminder',
        body: `${medicineName}: ${currentQuantity} dose${currentQuantity !== 1 ? 's' : ''} remaining. Please consider refilling soon.`,
        data: { type: 'low-stock', medicineId, medicineName, currentQuantity, threshold },
        sound: 'default',
        badge: 1,
        priority: 'high',
        ...(Platform.OS === 'android' && { channelId: NOTIFICATION_CHANNELS.LOW_STOCK_ALERTS.id }),
      },
      trigger: null,
    });

    await AsyncStorage.setItem(lastKey, now.toString());
    // also mark as sent today so schedule logic respects it
    await AsyncStorage.setItem(`notification_sent_${id}_${todayKey()}`, 'true');

    return res;
  } catch (error) {
    console.error('Failed to send low stock alert:', error);
    throw error;
  }
};

export const sendOutOfStockAlert = async ({ medicineId, medicineName }) => {
  try {
    const id = `out-of-stock-${medicineId}-${todayKey()}`;
    const lastKey = `last_out_of_stock_${medicineId}`;
    const last = await AsyncStorage.getItem(lastKey);
    const now = Date.now();
    const COOLDOWN = 24 * 60 * 60 * 1000;
    if (last && (now - parseInt(last, 10)) < COOLDOWN) {
      console.log(`Out-of-stock alert already sent today for ${medicineName}`);
      return null;
    }

    const res = await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title: '🚨 Urgent: Medication Out of Stock',
        body: `${medicineName} has run out. Please refill immediately to continue your treatment.`,
        data: { type: 'out-of-stock', medicineId, medicineName },
        sound: 'default',
        badge: 1,
        priority: 'max',
        ...(Platform.OS === 'android' && { channelId: NOTIFICATION_CHANNELS.OUT_OF_STOCK.id }),
      },
      trigger: null,
    });

    await AsyncStorage.setItem(lastKey, now.toString());
    await AsyncStorage.setItem(`notification_sent_${id}_${todayKey()}`, 'true');

    return res;
  } catch (error) {
    console.error('Failed to send out of stock alert:', error);
    throw error;
  }
};

/**
 * Cancel all scheduled notifications for a medicine
 */
export const cancelMedicineNotifications = async (medicineId) => {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const medicineNotifications = scheduled.filter(
      notif => notif.identifier.includes(medicineId)
    );

    for (const notif of medicineNotifications) {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }
  } catch (error) {
    console.error('Failed to cancel notifications:', error);
  }
};

/**
 * Helper to normalize time for IDs (ensure HH:MM format)
 */
const normalizeTimeId = (time) => {
  const [h, m] = time.split(':').map(Number);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

/**
 * Helper to generate consistent notification IDs
 */
const getNotificationIds = (medicineId, time) => {
  const normalizedTime = normalizeTimeId(time);
  return {
    pre: `${medicineId}-${normalizedTime}-pre`,
    due: `${medicineId}-${normalizedTime}-due`,
    post: `${medicineId}-${normalizedTime}-post`,
    summary: `${medicineId}-${normalizedTime}-summary`
  };
};

/**
 * Cancel reminders for a specific dose (called when marked taken)
 */
export const cancelDoseReminders = async (medicineId, scheduledTime) => {
  try {
    if (!scheduledTime) return;

    const ids = getNotificationIds(medicineId, scheduledTime);
    console.log(`Cancelling reminders for ${medicineId} at ${scheduledTime}:`, ids);

    // Cancel 'post' (missed) and 'summary' reminders
    await Notifications.cancelScheduledNotificationAsync(ids.post);
    await Notifications.cancelScheduledNotificationAsync(ids.summary);

    // Also cancel 'due' and 'pre' if they haven't fired yet (optional, but good for cleanup)
    await Notifications.cancelScheduledNotificationAsync(ids.due);
    await Notifications.cancelScheduledNotificationAsync(ids.pre);

  } catch (error) {
    console.error('Failed to cancel dose reminders:', error);
  }
};

/**
 * Cancel a specific notification by ID
 */
export const cancelNotification = async (notificationId) => {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (error) {
    console.error('Failed to cancel notification:', error);
  }
};

/**
 * Get all scheduled notifications
 */
export const getAllScheduledNotifications = async () => {
  try {
    return await Notifications.getAllScheduledNotificationsAsync();
  } catch (error) {
    console.error('Failed to get scheduled notifications:', error);
    return [];
  }
};

/**
 * Clear all notifications from notification center
 */
export const clearAllNotifications = async () => {
  try {
    await Notifications.dismissAllNotificationsAsync();
  } catch (error) {
    console.error('Failed to clear notifications:', error);
  }
};

/**
 * Set up notification response listener
 */
export const addNotificationResponseListener = (callback) => {
  return Notifications.addNotificationResponseReceivedListener(callback);
};

/**
 * Set up notification received listener
 */
export const addNotificationReceivedListener = (callback) => {
  return Notifications.addNotificationReceivedListener(callback);
};

let _receivedSub = null;
let _responseSub = null;

export const startNotificationListeners = () => {
  // if already started, do nothing
  if (_receivedSub || _responseSub) return;

  _receivedSub = Notifications.addNotificationReceivedListener(async (notification) => {
    try {
      const id = notification.request.identifier;
      if (!id) return;
      const key = `notification_sent_${id}_${todayKey()}`;
      await AsyncStorage.setItem(key, 'true');
    } catch (e) {
      console.warn('Failed to mark received', e);
    }
  });

  _responseSub = Notifications.addNotificationResponseReceivedListener(async (response) => {
    try {
      const id = response.notification.request.identifier;
      if (!id) return;
      const key = `notification_sent_${id}_${todayKey()}`;
      await AsyncStorage.setItem(key, 'true');
    } catch (e) {
      console.warn('Failed to mark response', e);
    }
  });

  return () => {
    // cleanup function
    if (_receivedSub) _receivedSub.remove();
    if (_responseSub) _responseSub.remove();
    _receivedSub = null;
    _responseSub = null;
  };
};

/**
 * Schedule all daily reminders for a medicine
 */
/**
 * Helper to get the unique key for a notification sent today
 */
const getSentKey = (id) => {
  return `notification_sent_${id}_${todayKey()}`;
};

/**
 * Check if a notification has already been sent today
 */
export const hasNotificationBeenSentToday = async (id) => {
  try {
    const key = getSentKey(id);
    const sent = await AsyncStorage.getItem(key);
    return sent === 'true';
  } catch (e) {
    console.error('Error checking sent status:', e);
    return false;
  }
};

/**
 * Mark a notification as sent for today
 */
export const markNotificationAsSentToday = async (id) => {
  try {
    const key = getSentKey(id);
    await AsyncStorage.setItem(key, 'true');
  } catch (e) {
    console.error('Error marking notification as sent:', e);
  }
};

/**
 * Clear all notification state and cancel schedules on logout
 */
export const clearNotificationStateOnLogout = async () => {
  try {
    console.log('Clearing all notification state on logout...');
    // Remove server device record
    const token = await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
    if (token) {
      try {
        await supabase.from(tables.devices).delete().eq('push_token', token);
      } catch (e) { console.warn('Failed to delete device row', e); }
    }

    // Cancel scheduled notifications safely
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const s of scheduled) {
      try { await Notifications.cancelScheduledNotificationAsync(s.identifier); } catch (e) { }
    }

    // Dismiss any displayed notifications
    try { await Notifications.dismissAllNotificationsAsync(); } catch (e) { }

    // Clear persisted flags for today and token
    const keys = await AsyncStorage.getAllKeys();
    const removeKeys = keys.filter(k => k.startsWith('notification_sent_') || k.startsWith('last_stock_alert_') || k === 'last_notification_reschedule');
    if (removeKeys.length) await AsyncStorage.multiRemove(removeKeys);

    await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
    console.log('Notification state cleared.');
  } catch (e) {
    console.error('Failed to clear notifications on logout:', e);
  }
};

/**
 * Schedule all daily reminders for a medicine
 */
export const scheduleAllRemindersForMedicine = async (medicine) => {
  try {
    if (!medicine || !medicine.id || !medicine.times || medicine.times.length === 0) {
      console.log('No times to schedule for medicine:', medicine?.name);
      return;
    }

    // 1. Calculate all EXPECTED notification IDs for this medicine
    const expectedIds = new Set();
    const notificationsToSchedule = [];

    for (const time of medicine.times) {
      const ids = getNotificationIds(medicine.id, time);
      const [hours, minutes] = time.split(':').map(Number);
      const formattedTime = formatTime(time);

      // Pre-calculation logic...
      let preHour = hours;
      let preMinute = minutes - 5;
      if (preMinute < 0) { preMinute += 60; preHour -= 1; }
      if (preHour < 0) preHour += 24;

      let postHour = hours;
      let postMinute = minutes + 5;
      if (postMinute >= 60) { postMinute -= 60; postHour += 1; }
      if (postHour >= 24) postHour -= 24;

      // Define expected notifications
      const items = [
        {
          id: ids.pre,
          content: { title: '⏳ Upcoming Dose', body: `Take ${medicine.name} in 5 minutes (${formattedTime})`, type: 'pre-reminder' },
          trigger: { hour: preHour, minute: preMinute, repeats: true }
        },
        {
          id: ids.due,
          content: { title: '💊 Time to Take Medicine', body: `It's ${formattedTime}. Please take ${medicine.name} now.`, type: 'due-reminder' },
          trigger: { hour: hours, minute: minutes, repeats: true }
        },
        {
          id: ids.post,
          content: { title: '⚠️ Missed Dose?', body: `Did you take ${medicine.name} at ${formattedTime}? Mark it as taken if you did.`, type: 'post-reminder' },
          trigger: { hour: postHour, minute: postMinute, repeats: true }
        }
      ];

      // Removed per-medicine summary to prevent flooding
      // if (hours < 21) { ... }

      const now = new Date();

      // Use for...of loop to handle async checks correctly
      for (const item of items) {
        // FLOOD PROTECTION 1: STRICT TIME VALIDATION
        const triggerDate = new Date();
        triggerDate.setHours(item.trigger.hour, item.trigger.minute, 0, 0);

        if (triggerDate < now) {
          // Time has passed for today. Skip.
          continue;
        }

        // FLOOD PROTECTION 2: PERSISTENT SENT FLAG
        const alreadySent = await hasNotificationBeenSentToday(item.id);
        if (alreadySent) {
          console.log(`Skipping already sent notification: ${item.id}`);
          continue;
        }

        expectedIds.add(item.id);
        notificationsToSchedule.push(item);
      }
    }

    // 2. Fetch ALL existing notifications
    const allScheduled = await Notifications.getAllScheduledNotificationsAsync();

    // 3. Identify notifications related to this medicine
    const medicineNotifications = allScheduled.filter(n =>
      n.identifier.startsWith(`${medicine.id}-`) || n.identifier.includes(medicine.id)
    );

    // 4. Cancel UNEXPECTED notifications (cleanup duplicates/old times)
    for (const notif of medicineNotifications) {
      if (!expectedIds.has(notif.identifier)) {
        console.log(`Cancelling obsolete notification: ${notif.identifier}`);
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }

    // 5. Schedule MISSING notifications
    const existingIdSet = new Set(medicineNotifications.map(n => n.identifier));

    for (const item of notificationsToSchedule) {
      if (!existingIdSet.has(item.id)) {
        try {
          console.log(`Scheduling missing notification: ${item.id}`);
          await scheduleLocalReminder({
            id: item.id,
            ...item.content,
            trigger: item.trigger,
            medicineName: medicine.name
          });
          // tiny throttle to avoid bursts on some devices
          await new Promise(r => setTimeout(r, 40));
        } catch (e) {
          console.warn('Failed to schedule single notification, continuing:', item.id, e);
        }
      }
    }

    console.log(`Synced reminders for ${medicine.name}`);
    return notificationsToSchedule;
  } catch (error) {
    console.error('Failed to schedule reminders for medicine:', error);
    throw error;
  }
};

/**
 * Check stock levels and send appropriate alerts
 */
export const checkAndSendStockAlerts = async (medicine) => {
  try {
    if (!medicine || medicine.quantity === undefined) {
      return;
    }

    const quantity = medicine.quantity;
    const threshold = medicine.refill_threshold || 5; // Default threshold of 5

    // Check cooldown to prevent flooding (max 1 alert per medicine per day)
    const lastAlertKey = `last_stock_alert_${medicine.id}`;
    const lastAlert = await AsyncStorage.getItem(lastAlertKey);
    const now = Date.now();
    const COOLDOWN = 24 * 60 * 60 * 1000; // 24 hours

    if (lastAlert && (now - parseInt(lastAlert, 10)) < COOLDOWN) {
      console.log(`Skipping stock alert for ${medicine.name} (cooldown active)`);
      return;
    }

    // Out of stock - critical alert
    if (quantity === 0) {
      await sendOutOfStockAlert({
        medicineId: medicine.id,
        medicineName: medicine.name,
      });
      console.log(`Out of stock alert sent for ${medicine.name}`);
      await AsyncStorage.setItem(lastAlertKey, now.toString());
    }
    // Low stock - warning alert
    else if (quantity <= threshold && quantity > 0) {
      await sendLowStockAlert({
        medicineId: medicine.id,
        medicineName: medicine.name,
        currentQuantity: quantity,
        threshold: threshold,
      });
      console.log(`Low stock alert sent for ${medicine.name} (${quantity} left)`);
      await AsyncStorage.setItem(lastAlertKey, now.toString());
    }
  } catch (error) {
    console.error('Failed to send stock alerts:', error);
  }
};

/**
 * Reschedule all notifications for all medicines
 * Call this on app start to ensure notifications are always scheduled
 */
export const rescheduleAllMedicineNotifications = async () => {
  try {
    console.log('Rescheduling all medicine notifications...');

    const last = await AsyncStorage.getItem('last_notification_reschedule');
    if (last) {
      const lastDate = new Date(last);
      // Check if it was rescheduled today
      if (lastDate.toISOString().split('T')[0] === todayKey()) {
        console.log('Reschedule already ran today; skipping');
        return;
      }
    }

    // Get current user session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      console.log('No user session, skipping notification rescheduling');
      return;
    }

    // Fetch all medicines for the user
    const { data: medicines, error } = await supabase
      .from(tables.medicines)
      .select('*')
      .eq('user_id', session.user.id);

    if (error) {
      console.error('Error fetching medicines for rescheduling:', error);
      return;
    }

    if (!medicines || medicines.length === 0) {
      console.log('No medicines to schedule notifications for');
      return;
    }

    // Schedule notifications for each medicine
    let totalScheduled = 0;
    for (const medicine of medicines) {
      const scheduled = await scheduleAllRemindersForMedicine(medicine);
      totalScheduled += scheduled?.length || 0;
    }

    console.log(`Successfully rescheduled ${totalScheduled} notifications for ${medicines.length} medicines`);

    // Schedule a single daily summary for the user
    const scheduleDailySummaryIfMissing = async (userId) => {
      try {
        const summaryId = `daily-summary-${userId}`;
        const scheduled = await Notifications.getAllScheduledNotificationsAsync();
        if (!scheduled.some(n => n.identifier === summaryId)) {
          await scheduleLocalReminder({
            id: summaryId,
            title: '🌙 Daily Summary',
            body: "Check today's missed doses and refill suggestions.",
            type: 'daily-summary',
            trigger: { hour: 21, minute: 0, repeats: true },
          });
        }
      } catch (e) { console.warn('Failed scheduleDailySummaryIfMissing', e); }
    };

    await scheduleDailySummaryIfMissing(session.user.id);

    // Store last reschedule time
    await AsyncStorage.setItem('last_notification_reschedule', new Date().toISOString());
  } catch (error) {
    console.error('Failed to reschedule all notifications:', error);
  }
};
