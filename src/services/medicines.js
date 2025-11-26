import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import { supabase, tables } from '../lib/supabase';
import { enqueueAction, processQueue, getQueue } from './offlineQueue';
import { scheduleAllRemindersForMedicine, checkAndSendStockAlerts, cancelMedicineNotifications, cancelDoseReminders } from './notifications';
import { getLocalDayRange, isSameDay } from '../utils/time';

const CACHE_KEY = 'medicine-tracker-cache';

// In-memory cache for logs to prevent UI flickering on tab switch
const logsCache = {};

export const fetchMedicines = async () => {
  console.log('Fetching medicines...');
  const state = await Network.getNetworkStateAsync();
  if (!state.isConnected) {
    console.log('Offline, loading from cache');
    return loadCachedMedicines();
  }
  const { data, error } = await supabase
    .from(tables.medicines)
    .select('*, profiles:profiles(display_name, relation)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching medicines:', error);
    throw error;
  }
  console.log('Medicines fetched:', data?.length, 'records');

  // De-duplicate medicines by ID just in case
  const uniqueMedicines = data ? Array.from(new Map(data.map(m => [m.id, m])).values()) : [];

  if (uniqueMedicines.length > 0) {
    console.log('Sample medicine:', JSON.stringify(uniqueMedicines[0], null, 2));
  }
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(uniqueMedicines));
  return uniqueMedicines;
};

export const loadCachedMedicines = async () => {
  const cached = await AsyncStorage.getItem(CACHE_KEY);
  return cached ? JSON.parse(cached) : [];
};

// Simple UUID v4 generator
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const saveMedicine = async (payload) => {
  console.log('saveMedicine service called with:', payload);
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    console.error('No authenticated user found');
    throw new Error('Not authenticated');
  }

  // Use a valid UUID even for offline records so Supabase accepts it later
  const record = {
    id: payload.id ?? generateUUID(),
    ...payload,
    user_id: session.user.id,
  };

  try {
    console.log('Upserting to Supabase:', record);
    const { error, data } = await supabase.from(tables.medicines).upsert(record).select().single();
    if (error) {
      console.error('Supabase upsert error:', error);
      throw error;
    }
    console.log('Supabase upsert success:', data);

    // Schedule notifications for this medicine
    try {
      await scheduleAllRemindersForMedicine(data);
      console.log('Notifications scheduled for:', data.name);
    } catch (notifError) {
      console.warn('Failed to schedule notifications:', notifError);
      // Don't fail the whole operation if notifications fail
    }

    return data;
  } catch (err) {
    console.warn('Offline fallback triggered due to:', err);
    await enqueueAction({ type: 'UPSERT_MEDICINE', payload: record });
    return record;
  }
};

export const markDoseTaken = async ({ quantity, medicineId, scheduledTime, note }) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('No user logged in');

    const timeTaken = new Date().toISOString();
    const { start, end } = getLocalDayRange();

    // Convert scheduledTime (HH:MM) to full ISO timestamp for DB compatibility
    let scheduledTimestamp = scheduledTime;
    if (scheduledTime && scheduledTime.includes(':') && !scheduledTime.includes('T')) {
      const [hours, minutes] = scheduledTime.split(':').map(Number);
      const d = new Date();
      d.setHours(hours);
      d.setMinutes(minutes);
      d.setSeconds(0);
      d.setMilliseconds(0);
      scheduledTimestamp = d.toISOString();
    }

    // Validate that the scheduled time is actually in the medicine's schedule
    if (scheduledTime) {
      const { data: medicineData, error: medicineError } = await supabase
        .from(tables.medicines)
        .select('times')
        .eq('id', medicineId)
        .single();

      if (medicineError) throw medicineError;

      // Check if the scheduled time exists in the medicine's times array
      if (!medicineData.times || !medicineData.times.includes(scheduledTime)) {
        throw new Error(`This medicine is not scheduled for ${scheduledTime}. Please mark doses only at scheduled times.`);
      }

      // Check if this dose has already been taken today for this scheduled time
      const { data: existingLog, error: checkError } = await supabase
        .from(tables.logs)
        .select('id')
        .eq('medicine_id', medicineId)
        .gte('time_taken', start)
        .lte('time_taken', end)
        .eq('status', 'taken');

      if (existingLog && existingLog.length > 0) {
        // Filter in JS to find if any log matches our scheduled time slot
        const alreadyTaken = existingLog.some(log => {
          if (!log.time_scheduled) return false;
          // Extract HH:MM from log.time_scheduled
          let logTime = log.time_scheduled;
          if (log.time_scheduled.includes('T')) {
            const d = new Date(log.time_scheduled);
            const h = String(d.getHours()).padStart(2, '0');
            const m = String(d.getMinutes()).padStart(2, '0');
            logTime = `${h}:${m}`;
          }
          return logTime === scheduledTime;
        });

        if (alreadyTaken) {
          throw new Error('This dose has already been taken for this scheduled time today');
        }
      }
    }

    const logEntry = {
      user_id: session.user.id,
      medicine_id: medicineId,
      status: 'taken',
      time_taken: timeTaken,
      time_scheduled: scheduledTimestamp || timeTaken,
      note: note || null,
    };

    // 1. Create log entry
    const { data: newLog, error: logError } = await supabase
      .from(tables.logs)
      .insert(logEntry)
      .select()
      .single();

    if (logError) throw logError;

    // 2. Decrement quantity
    const { data: med, error: fetchError } = await supabase
      .from(tables.medicines)
      .select('quantity')
      .eq('id', medicineId)
      .single();

    if (fetchError) throw fetchError;

    const newQuantity = Math.max(0, (med.quantity || 0) - quantity);

    const { error: updateError } = await supabase
      .from(tables.medicines)
      .update({ quantity: newQuantity })
      .eq('id', medicineId);

    if (updateError) throw updateError;

    // Check stock levels and send alerts if needed
    const { data: updatedMedicine, error: medicineError } = await supabase
      .from(tables.medicines)
      .select('*')
      .eq('id', medicineId)
      .single();

    if (!medicineError && updatedMedicine) {
      try {
        await checkAndSendStockAlerts(updatedMedicine);
      } catch (alertError) {
        console.warn('Failed to send stock alerts:', alertError);
        // Don't fail the whole operation if alerts fail
      }
    }

    // Cancel reminders for this dose
    if (scheduledTime) {
      try {
        await cancelDoseReminders(medicineId, scheduledTime);
      } catch (cancelError) {
        console.warn('Failed to cancel dose reminders:', cancelError);
      }
    }

    await AsyncStorage.removeItem(CACHE_KEY); // Invalidate cache

    // Update cache immediately
    const currentCache = logsCache[medicineId] || [];
    logsCache[medicineId] = [newLog, ...currentCache];

    return { success: true, log: newLog, offline: false };

  } catch (err) {
    console.warn('Error marking dose taken:', err);
    if (err.message.includes('already been taken') || err.message.includes('not scheduled')) {
      throw err;
    }

    // Construct a temporary log object for optimistic UI update
    let scheduledTimestamp = scheduledTime;
    if (scheduledTime && scheduledTime.includes(':') && !scheduledTime.includes('T')) {
      const [hours, minutes] = scheduledTime.split(':').map(Number);
      const d = new Date();
      d.setHours(hours);
      d.setMinutes(minutes);
      d.setSeconds(0);
      d.setMilliseconds(0);
      scheduledTimestamp = d.toISOString();
    }

    const tempLog = {
      id: `temp-${Date.now()}`,
      medicine_id: medicineId,
      status: 'taken',
      time_taken: new Date().toISOString(),
      time_scheduled: scheduledTimestamp,
      note: note,
      is_offline: true
    };

    // Update cache immediately for offline too
    const currentCache = logsCache[medicineId] || [];
    logsCache[medicineId] = [tempLog, ...currentCache];

    // Even if offline, try to cancel local notifications (they are local!)
    if (scheduledTime) {
      try {
        await cancelDoseReminders(medicineId, scheduledTime);
      } catch (cancelError) {
        console.warn('Failed to cancel dose reminders (offline):', cancelError);
      }
    }

    await enqueueAction({ type: 'MARK_TAKEN', payload: { quantity, medicineId, scheduledTime, note } });
    return { success: true, log: tempLog, offline: true, error: err.message };
  }
};

export const fetchMedicineLogs = async (medicineId) => {
  const { data: serverLogs, error } = await supabase
    .from(tables.logs)
    .select('*')
    .eq('medicine_id', medicineId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Fetch from Offline Queue
  const queue = await getQueue();
  const offlineLogs = queue
    .filter(action =>
      action.type === 'MARK_TAKEN' &&
      action.payload.medicineId === medicineId
    )
    .map(action => {
      let scheduledTimestamp = action.payload.scheduledTime;
      if (scheduledTimestamp && scheduledTimestamp.includes(':') && !scheduledTimestamp.includes('T')) {
        const [hours, minutes] = scheduledTimestamp.split(':').map(Number);
        const d = new Date(action.createdAt);
        d.setHours(hours);
        d.setMinutes(minutes);
        d.setSeconds(0);
        d.setMilliseconds(0);
        scheduledTimestamp = d.toISOString();
      }

      return {
        id: `offline-${action.createdAt}`,
        medicine_id: action.payload.medicineId,
        status: 'taken',
        time_taken: new Date(action.createdAt).toISOString(),
        time_scheduled: scheduledTimestamp,
        note: action.payload.note,
        is_offline: true
      };
    });

  const allLogs = [...offlineLogs, ...(serverLogs || [])];

  // De-duplicate logs by ID
  const uniqueLogs = Array.from(new Map(allLogs.map(log => [log.id, log])).values());

  // Update cache
  logsCache[medicineId] = uniqueLogs;

  return uniqueLogs;
};

// Synchronous accessor for cache
export const getCachedTodaysLogs = (medicineId) => {
  return logsCache[medicineId] || [];
};

export const getTodaysLogs = async (medicineId) => {
  const { start, end } = getLocalDayRange();

  // 1. Fetch from Supabase
  const { data: serverLogs, error } = await supabase
    .from(tables.logs)
    .select('*')
    .eq('medicine_id', medicineId)
    .gte('time_taken', start)
    .lte('time_taken', end)
    .eq('status', 'taken');

  if (error) throw error;

  // 2. Fetch from Offline Queue
  const queue = await getQueue();
  const offlineLogs = queue
    .filter(action =>
      action.type === 'MARK_TAKEN' &&
      action.payload.medicineId === medicineId
    )
    .map(action => {
      let scheduledTimestamp = action.payload.scheduledTime;
      if (scheduledTimestamp && scheduledTimestamp.includes(':') && !scheduledTimestamp.includes('T')) {
        const [hours, minutes] = scheduledTimestamp.split(':').map(Number);
        const d = new Date(action.createdAt);
        d.setHours(hours);
        d.setMinutes(minutes);
        d.setSeconds(0);
        d.setMilliseconds(0);
        scheduledTimestamp = d.toISOString();
      }

      return {
        id: `offline-${action.createdAt}`,
        medicine_id: action.payload.medicineId,
        status: 'taken',
        time_taken: new Date(action.createdAt).toISOString(),
        time_scheduled: scheduledTimestamp,
        note: action.payload.note,
        is_offline: true
      };
    })
    .filter(log => isSameDay(log.time_taken, new Date()));

  // 3. Merge and return
  const allLogs = [...(serverLogs || []), ...offlineLogs];

  // Update cache
  const currentCache = logsCache[medicineId] || [];
  const uniqueLogs = [...allLogs];
  currentCache.forEach(cachedLog => {
    if (!uniqueLogs.find(l => l.id === cachedLog.id)) {
      uniqueLogs.push(cachedLog);
    }
  });
  logsCache[medicineId] = uniqueLogs;

  return allLogs;
};

export const syncOfflineQueue = () =>
  processQueue(async (action) => {
    if (action.type === 'UPSERT_MEDICINE') {
      await supabase.from(tables.medicines).upsert(action.payload);
    }
    if (action.type === 'MARK_TAKEN') {
      await supabase.functions.invoke('markTaken', { body: action.payload });
    }
  });

export const deleteMedicine = async (id) => {
  try {
    // Cancel all notifications for this medicine first
    try {
      await cancelMedicineNotifications(id);
      console.log('Notifications cancelled for medicine:', id);
    } catch (notifError) {
      console.warn('Failed to cancel notifications:', notifError);
      // Continue with deletion even if notification cancellation fails
    }

    const { error } = await supabase.from(tables.medicines).delete().eq('id', id);
    if (error) throw error;
    await AsyncStorage.removeItem(CACHE_KEY); // Invalidate cache
    delete logsCache[id]; // Clear memory cache
    return true;
  } catch (err) {
    console.warn('Failed to delete medicine:', err);
    throw err;
  }
};
