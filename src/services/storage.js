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
      await AsyncStorage.removeItem(key); 
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  },
  addToOfflineQueue: async (queueName, data) => {
    try {
      const existingQueue = await AsyncStorage.getItem(`@queue_${queueName}`);
      const queue = existingQueue ? JSON.parse(existingQueue) : [];
      queue.push(data);
      await AsyncStorage.setItem(`@queue_${queueName}`, JSON.stringify(queue));
    } catch (error) {
      console.error(`Error adding to offline queue ${queueName}`, error);
    }
  },
  getOfflineQueue: async (queueName) => {
    try {
      const queue = await AsyncStorage.getItem(`@queue_${queueName}`);
      return queue ? JSON.parse(queue) : [];
    } catch (error) {
      console.error(`Error getting offline queue ${queueName}`, error);
      return [];
    }
  },
  clearOfflineQueue: async (queueName) => {
    try {
      await AsyncStorage.removeItem(`@queue_${queueName}`);
    } catch (error) {
      console.error(`Error clearing queue ${queueName}`, error);
    }
  }
};
