import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { StorageService } from '../services/storage';

let HAPTICS_ENABLED = true; 

export const HapticHelper = {
  init: async () => {
    try {
      const storedValue = await StorageService.getCachedData('vibrationsEnabled');
      if (storedValue !== null && storedValue !== undefined) {
        HAPTICS_ENABLED = storedValue;
      }
      return HAPTICS_ENABLED;
    } catch (error) {
      console.error("Failed to load vibration settings:", error);
      return true;
    }
  },

  setHapticsEnabled: async (isEnabled) => {
    HAPTICS_ENABLED = isEnabled;
    try {
      await StorageService.cacheData('vibrationsEnabled', isEnabled);
    } catch (error) {
      console.error("Failed to save vibration preference:", error);
    }
  },

  isEnabled: () => HAPTICS_ENABLED,

  lightImpact: async () => {
    if (HAPTICS_ENABLED && Platform.OS !== 'web') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  },
  
  mediumImpact: async () => {
    if (HAPTICS_ENABLED && Platform.OS !== 'web') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  },
  
  selection: async () => {
    if (HAPTICS_ENABLED && Platform.OS !== 'web') {
      await Haptics.selectionAsync();
    }
  },
  
  success: async () => {
    if (HAPTICS_ENABLED && Platform.OS !== 'web') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  },
  
  error: async () => {
    if (HAPTICS_ENABLED && Platform.OS !== 'web') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }
};