import AsyncStorage from '@react-native-async-storage/async-storage';

export const StorageService = {
  saveSession: async (userData) => {
    try {
      await AsyncStorage.setItem('@user_session', JSON.stringify(userData));
    } catch (error) {
      console.error("Error saving session", error);
    }
  },
  getSession: async () => {
    try {
      const session = await AsyncStorage.getItem('@user_session');
      return session ? JSON.parse(session) : null;
    } catch (error) {
      console.error("Error getting session", error);
      return null;
    }
  },
  clearSession: async () => {
    try {
      await AsyncStorage.removeItem('@user_session');
    } catch (error) {
      console.error("Error clearing session", error);
    }
  },
  cacheData: async (key, data) => {
    try {
      await AsyncStorage.setItem(`@cache_${key}`, JSON.stringify(data));
    } catch (error) {
      console.error(`Error caching ${key}`, error);
    }
  },
  getCachedData: async (key) => {
    try {
      const data = await AsyncStorage.getItem(`@cache_${key}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error(`Error getting cache for ${key}`, error);
      return null;
    }
  },
  removeCachedData: async (key) => {
    try {
      // If you are using AsyncStorage:
      await AsyncStorage.removeItem(key); 
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }
};
