import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase, tables } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

  const settings = await Notifications.getPermissionsAsync();
  let finalStatus = settings.status;

  if (finalStatus !== 'granted') {
    const request = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        allowAnnouncements: true,
      },
    });
    finalStatus = request.status;
  }

  if (finalStatus !== 'granted') {
    console.warn('Push notification permission denied');
    return null;
  }

  // Initialize channels after permissions granted
  await initializeNotificationChannels();

  const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
  if (!projectId) {
    console.warn('Expo projectId missing; push token unavailable in Expo Go');
    return null;
  }

  let token = null;
  try {
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch (err) {
    console.warn('Device token registration failed', err);
    return null;
  }

  return token;
};

export const upsertDeviceToken = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;

  const pushToken = await registerForPushNotificationsAsync();
  if (!pushToken) return null;

  const deviceId = `${Device.deviceName ?? 'unknown'}-${Device.osInternalBuildId ?? Date.now()}`;

  const { error } = await supabase.from(tables.devices).upsert(
    {
      user_id: session.user.id,
      push_token: pushToken,
      device_id: deviceId,
      platform: Platform.OS,
      last_seen: new Date().toISOString(),
    },
    { onConflict: 'user_id,device_id' },
  );

  if (error) throw error;
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
    return await Notifications.scheduleNotificationAsync({
      identifier: `low-stock-${medicineId}-${Date.now()}`,
      content: {
        title: '⚠️ Refill Reminder',
        body: `${medicineName}: ${currentQuantity} dose${currentQuantity !== 1 ? 's' : ''} remaining. Please consider refilling soon.`,
        data: {
          type: 'low-stock',
          medicineId,
          medicineName,
          currentQuantity,
          threshold,
        },
        sound: 'default',
        badge: 1,
        priority: 'high',
        ...(Platform.OS === 'android' && {
          channelId: NOTIFICATION_CHANNELS.LOW_STOCK_ALERTS.id,
        }),
      },
      trigger: null, // Send immediately
    });
  } catch (error) {
    console.error('Failed to send low stock alert:', error);
    throw error;
  }
};

/**
 * Send out of stock notification
 */
export const sendOutOfStockAlert = async ({ medicineId, medicineName }) => {
  try {
    return await Notifications.scheduleNotificationAsync({
      identifier: `out-of-stock-${medicineId}-${Date.now()}`,
      content: {
        title: '🚨 Urgent: Medication Out of Stock',
        body: `${medicineName} has run out. Please refill immediately to continue your treatment.`,
        data: {
          type: 'out-of-stock',
          medicineId,
          medicineName,
        },
        sound: 'default',
        badge: 1,
        priority: 'max',
        ...(Platform.OS === 'android' && {
          channelId: NOTIFICATION_CHANNELS.OUT_OF_STOCK.id,
        }),
      },
      trigger: null, // Send immediately
    });
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
 * Helper to generate consistent notification IDs
 */
const getNotificationIds = (medicineId, time) => ({
  pre: `${medicineId}-${time}-pre`,
  due: `${medicineId}-${time}-due`,
  post: `${medicineId}-${time}-post`,
  summary: `${medicineId}-${time}-summary`
});

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

/**
 * Schedule all daily reminders for a medicine
 */
export const scheduleAllRemindersForMedicine = async (medicine) => {
  try {
    if (!medicine || !medicine.id || !medicine.times || medicine.times.length === 0) {
      console.log('No times to schedule for medicine:', medicine?.name);
      return;
    }

    // Cancel existing notifications for this medicine first
    await cancelMedicineNotifications(medicine.id);

    const scheduledNotifications = [];

    for (const time of medicine.times) {
      // Parse time (format: "HH:MM")
      const [hours, minutes] = time.split(':').map(Number);
      const formattedTime = formatTime(time);
      const ids = getNotificationIds(medicine.id, time);

      // 1. Pre-Reminder (5 mins before)
      // We need to calculate the trigger carefully. 
      // Since 'repeats: true' with 'hour/minute' works for daily, we can't easily do "5 mins before" using just hour/minute if it crosses midnight.
      // But for simplicity, we'll just subtract 5 mins.
      let preHour = hours;
      let preMinute = minutes - 5;
      if (preMinute < 0) {
        preMinute += 60;
        preHour -= 1;
      }
      if (preHour < 0) preHour += 24;

      await scheduleLocalReminder({
        id: ids.pre,
        title: '⏳ Upcoming Dose',
        body: `Take ${medicine.name} in 5 minutes (${formattedTime})`,
        trigger: { hour: preHour, minute: preMinute, repeats: true },
        medicineName: medicine.name,
        type: 'pre-reminder'
      });

      // 2. Due Reminder (At time)
      await scheduleLocalReminder({
        id: ids.due,
        title: '💊 Time to Take Medicine',
        body: `It's ${formattedTime}. Please take ${medicine.name} now.`,
        trigger: { hour: hours, minute: minutes, repeats: true },
        medicineName: medicine.name,
        type: 'due-reminder'
      });

      // 3. Post-Reminder (5 mins after - Missed)
      let postHour = hours;
      let postMinute = minutes + 5;
      if (postMinute >= 60) {
        postMinute -= 60;
        postHour += 1;
      }
      if (postHour >= 24) postHour -= 24;

      await scheduleLocalReminder({
        id: ids.post,
        title: '⚠️ Missed Dose?',
        body: `Did you take ${medicine.name} at ${formattedTime}? Mark it as taken if you did.`,
        trigger: { hour: postHour, minute: postMinute, repeats: true },
        medicineName: medicine.name,
        type: 'post-reminder'
      });

      // 4. Summary Reminder (9:00 PM)
      // Only schedule if the dose time is BEFORE 9:00 PM (21:00)
      // If dose is at 21:00 or later, a 21:00 summary is confusing or impossible for that day.
      if (hours < 21) {
        await scheduleLocalReminder({
          id: ids.summary,
          title: '🌙 Daily Summary',
          body: `You might have missed ${medicine.name} scheduled for ${formattedTime}. Please check your logs.`,
          trigger: { hour: 21, minute: 0, repeats: true },
          medicineName: medicine.name,
          type: 'summary-reminder'
        });
      }

      scheduledNotifications.push({ id: ids.due, time });
    }

    console.log(`Scheduled advanced reminders for ${medicine.name}`);
    return scheduledNotifications;
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

    // Out of stock - critical alert
    if (quantity === 0) {
      await sendOutOfStockAlert({
        medicineId: medicine.id,
        medicineName: medicine.name,
      });
      console.log(`Out of stock alert sent for ${medicine.name}`);
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

    // Store last reschedule time
    await AsyncStorage.setItem('last_notification_reschedule', new Date().toISOString());
  } catch (error) {
    console.error('Failed to reschedule all notifications:', error);
  }
};
