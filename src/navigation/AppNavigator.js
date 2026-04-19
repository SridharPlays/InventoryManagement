import React, { useState, useEffect, useMemo } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, ActivityIndicator } from 'react-native';

import { COLORS } from '../constants/theme';

// Screens
import SignInScreen from '../screens/SignInScreen';
import DashboardScreen from '../screens/DashboardScreen';
import InventoryScreen from '../screens/InventoryScreen';
import ScannerScreen from '../screens/ScannerScreen';
import AlertsScreen from '../screens/AlertsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import StockInScreen from '../screens/StockInScreen';
import RequestItemScreen from '../screens/RequestItemScreen';
import CupboardScreen from '../screens/CupboardScreen';
import RelocateScreen from '../screens/RelocateScreen';
import IssueScreen from '../screens/IssueScreen';
import ReportScreen from '../screens/ReportScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// --- BOTTOM TABS COMPONENT ---
// We pass userData in as a prop so the tabs know who is looking at them
function BottomTabs({ userData, setToken }) {
  const isAdmin = userData?.role === 'admin';

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: { backgroundColor: COLORS.card, borderTopColor: COLORS.border },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Dashboard') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'Inventory') iconName = focused ? 'cube' : 'cube-outline';
          else if (route.name === 'Scan') iconName = focused ? 'scan-circle' : 'scan-circle-outline';
          else if (route.name === 'Alerts') iconName = focused ? 'notifications' : 'notifications-outline';
          else if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';
          else if (route.name === 'Request') iconName = focused ? 'add-circle' : 'add-circle-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      {/* --- ADMIN ONLY TABS --- */}
      {isAdmin && <Tab.Screen name="Dashboard" component={DashboardScreen} />}
      {isAdmin && <Tab.Screen name="Inventory" component={InventoryScreen} />}

      {/* --- SHARED TAB --- */}
      <Tab.Screen name="Scan" component={ScannerScreen} />

      {/* --- TL ONLY TAB --- */}
      {!isAdmin && (
        <Tab.Screen name="Request">
          {(props) => <RequestItemScreen {...props} userData={userData} />}
        </Tab.Screen>
      )}

      {/* --- ADMIN ONLY TAB --- */}
      {isAdmin && <Tab.Screen name="Alerts" component={AlertsScreen} />}

      {/* --- SHARED TAB --- */}
      <Tab.Screen name="Profile">
        {(props) => <ProfileScreen {...props} userData={userData} setToken={setToken} />}
      </Tab.Screen>

      {/* Report Tab */}
      {isAdmin && <Tab.Screen
        name="Reports"
        component={ReportScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="document-text-outline" size={size} color={color} />
          ),
        }}
      />}
    </Tab.Navigator>
  );
}

// --- MAIN NAVIGATOR ---
export default function AppNavigator() {
  const [isLoading, setIsLoading] = useState(true);
  const [userToken, setUserToken] = useState(null);
  const [userData, setUserData] = useState(null); // <-- Store User Role here

  // Check for existing login on app start
  useEffect(() => {
    const checkLoginState = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        const userString = await AsyncStorage.getItem('userData');

        if (token && userString) {
          setUserToken(token);
          setUserData(JSON.parse(userString));
        }
      } catch (e) {
        console.error("Failed to load session", e);
      } finally {
        setIsLoading(false);
      }
    };
    checkLoginState();
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {userToken == null ? (
          // NO TOKEN: Show Login Screen
          <Stack.Screen name="SignIn">
            {(props) => (
              <SignInScreen
                {...props}
                setToken={setUserToken}
                setUserData={setUserData}
              />
            )}
          </Stack.Screen>
        ) : (
          // HAS TOKEN: Show App
          <>
            <Stack.Screen name="MainTabs">
              {(props) => <BottomTabs {...props} userData={userData} setToken={setUserToken} />}
            </Stack.Screen>

            {/* Quick Actions / Stack Screens (Admin only usually, but safe to keep here) */}
            <Stack.Screen name="StockIn" component={StockInScreen} />
            <Stack.Screen name="Cupboard" component={CupboardScreen} />
            <Stack.Screen name="Relocate" component={RelocateScreen} />
            <Stack.Screen name="Issue" component={IssueScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}