import { useState, useCallback } from 'react';
import { fetchFromGAS } from '../services/api';
import { StorageService } from '../services/storage';

export const useInventory = () => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadInventory = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    try {
      let data = forceRefresh ? null : await StorageService.getCachedData('getInventory');
      
      if (!data) {
        const response = await fetchFromGAS('getInventory');
        data = Array.isArray(response) ? response : response?.data || [];
        if (data.length > 0) {
           await StorageService.cacheData('getInventory', data);
        }
      }
      setInventory(data);
    } catch (error) {
      console.error("Inventory Data Error:", error);
      setInventory([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return { inventory, loading, loadInventory };
};