import { useCallback, useEffect, useState } from 'react';
import { fetchMedicines, saveMedicine, syncOfflineQueue } from '../services/medicines';

export const useMedicines = () => {
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchMedicines();
      setMedicines(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    await syncOfflineQueue();
    await load();
  }, [load]);

  const createOrUpdate = useCallback(
    async (payload) => {
      try {
        console.log('Saving medicine:', payload);
        const saved = await saveMedicine(payload);
        console.log('Medicine saved:', saved);
        setMedicines((prev) => {
          const idx = prev.findIndex((item) => item.id === saved.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = saved;
            return next;
          }
          return [saved, ...prev];
        });
      } catch (err) {
        console.error('Failed to save medicine in hook:', err);
        throw err;
      }
    },
    [setMedicines],
  );

  useEffect(() => {
    load();
  }, [load]);

  return { medicines, loading, error, refresh, createOrUpdate };
};

