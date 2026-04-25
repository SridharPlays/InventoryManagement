import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { darkTheme, lightTheme } from '../constants/theme';
import { HapticHelper } from '../utils/haptics';

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(true); 
  const [isThemeLoaded, setIsThemeLoaded] = useState(false);

  // Load saved theme from AsyncStorage on app start
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('appThemePreference');
        if (savedTheme !== null) {
          setIsDarkMode(savedTheme === 'dark');
        } else {
          // Fallback to system preference if nothing is saved
          setIsDarkMode(systemColorScheme === 'dark');
        }
        await HapticHelper.success();
      } catch (error) {
        console.error('Error loading theme:', error);
      } finally {
        setIsThemeLoaded(true);
      }
    };
    loadTheme();
  }, [systemColorScheme]);

  // Determine current theme colors
  const theme = isDarkMode ? darkTheme : lightTheme;

  // Toggle theme and save to AsyncStorage
  const toggleTheme = async () => {
    try {
      const newMode = !isDarkMode;
      setIsDarkMode(newMode);
      await AsyncStorage.setItem('appThemePreference', newMode ? 'dark' : 'light');
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  // Prevent flashing wrong theme on load
  if (!isThemeLoaded) return null; 

  return (
    <ThemeContext.Provider value={{ theme, isDarkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);