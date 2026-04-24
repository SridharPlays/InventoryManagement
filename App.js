import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';

const RootComponent = () => {
  const { theme, isDarkMode } = useTheme();

  return (
    <SafeAreaProvider style={{ backgroundColor: theme.background }}>
      <StatusBar 
        barStyle={isDarkMode ? "light-content" : "dark-content"} 
        backgroundColor={theme.background} 
      />
      <AppNavigator />  
    </SafeAreaProvider>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <RootComponent />
    </ThemeProvider>
  );
}