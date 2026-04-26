// src/store/useInventoryStore.js
import { create } from 'zustand';
import { fetchFromGAS } from '../services/api';
import { StorageService } from '../services/storage';

const useInventoryStore = create((set, get) => ({
  inventory: [],
  loading: false,

  loadInventory: async (forceRefresh = false) => {
    const currentInventory = get().inventory;
    if (currentInventory.length === 0 || forceRefresh) {
        set({ loading: true });
    }
    
    try {
      let data = forceRefresh ? null : await StorageService.getCachedData('getInventory');
      
      if (!data) {
        const response = await fetchFromGAS('getInventory');
        data = Array.isArray(response) ? response : response?.data || [];
        if (data.length > 0) {
           await StorageService.cacheData('getInventory', data);
        }
      }
      set({ inventory: data, loading: false });
    } catch (error) {
      console.error("Inventory Data Error:", error);
      set({ inventory: [], loading: false });
    }
  },

  updateItemLocally: (updatedItem) => {
    set((state) => ({
      inventory: state.inventory.map(item => 
        item.itemId === updatedItem.itemId ? updatedItem : item
      )
    }));
  },

  deleteItemLocally: (itemId) => {
    set((state) => ({
      inventory: state.inventory.filter(item => item.itemId !== itemId)
    }));
  }
}));

export default useInventoryStore;