import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';

const QUEUE_KEY = 'medicine-tracker-offline-queue';

export const enqueueAction = async (action) => {
  const queue = await getQueue();
  queue.push({ ...action, createdAt: Date.now() });
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

export const getQueue = async () => {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

export const clearQueue = async () => {
  await AsyncStorage.removeItem(QUEUE_KEY);
};

export const processQueue = async (processor) => {
  const state = await Network.getNetworkStateAsync();
  if (!state.isConnected) return { processed: 0, remaining: await getQueue() };

  const queue = await getQueue();
  const remaining = [];
  let processed = 0;

  for (const action of queue) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await processor(action);
      processed += 1;
    } catch (err) {
      console.warn('Queue action failed, will retry', err);
      remaining.push(action);
    }
  }

  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  return { processed, remaining };
};

