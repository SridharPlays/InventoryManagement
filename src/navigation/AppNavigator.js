import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { createContext, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { COLORS } from '../constants/theme';
import { StorageService } from '../services/storage';

import AlertsScreen from '../screens/AlertsScreen';
import CupboardScreen from '../screens/CupboardScreen';
import DashboardScreen from '../screens/DashboardScreen';
import InventoryScreen from '../screens/InventoryScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ScannerScreen from '../screens/ScannerScreen';
import SignInScreen from '../screens/SignInScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

export const AuthContext = createContext();

const BottomTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarStyle: { backgroundColor: COLORS.card, borderTopColor: COLORS.border, padding: 10, height: 100 },
      tabBarActiveTintColor: COLORS.primary,
      tabBarInactiveTintColor: COLORS.textMuted,
      // tabBarShowLabel: false,
      tabBarIcon: ({ color, size }) => {
        let iconName = 'home-outline';
        if (route.name === 'Inventory') iconName = 'cube-outline';
        if (route.name === 'Scan') iconName = 'scan-outline';
        if (route.name === 'Alerts') iconName = 'notifications-outline';
        if (route.name === 'Profile') iconName = 'person-outline';
        return <Ionicons name={iconName} size={size} color={color} />;
      },
    })}
  >
    <Tab.Screen name="Dashboard" component={DashboardScreen} />
    <Tab.Screen name="Inventory" component={InventoryScreen} />
    <Tab.Screen name="Scan" component={ScannerScreen} />
    <Tab.Screen name="Alerts" component={AlertsScreen} />
    <Tab.Screen name="Profile" component={ProfileScreen} />
  </Tab.Navigator>
);

export default function AppNavigator() {
  const [isLoading, setIsLoading] = useState(true);
  const [userToken, setUserToken] = useState(null);

  useEffect(() => {
    const checkSession = async () => {
      const session = await StorageService.getSession();
      setUserToken(session);
      setIsLoading(false);
    };
    checkSession();
  }, []);


  const authContext = React.useMemo(
    () => ({
      signOut: async () => {
        await StorageService.clearSession();
        setUserToken(null);
      },
    }),
    []
  );

  if (isLoading) return (
    <View style={{ flex: 1, justifyContent: 'center', backgroundColor: COLORS.background }}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  );

  return (
    <AuthContext.Provider value={authContext}>

      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {userToken == null ? (
            <Stack.Screen name="SignIn">
              {(props) => <SignInScreen {...props} setToken={setUserToken} />}
            </Stack.Screen>
          ) : (
            <>
              <Stack.Screen name="MainTabs" component={BottomTabs} />
              <Stack.Screen name="Cupboard" component={CupboardScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </AuthContext.Provider>
  );
}