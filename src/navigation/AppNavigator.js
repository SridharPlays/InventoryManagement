import AsyncStorage from '@react-native-async-storage/async-storage';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

// Lucide Icons
import { Bell, Home, Package, PlusCircle, Scan, User, Zap } from 'lucide-react-native';

// Theme Context 
import { useTheme } from '../context/ThemeContext';

// Screens
import AlertsScreen from '../screens/AlertsScreen';
import CupboardScreen from '../screens/CupboardScreen';
import DashboardScreen from '../screens/DashboardScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import InventoryScreen from '../screens/InventoryScreen';
import IssueScreen from '../screens/IssueScreen';
import ProfileScreen from '../screens/ProfileScreen';
import QuickTakeoutScreen from '../screens/QuickTakeoutScreen';
import RelocateScreen from '../screens/RelocateScreen';
import ReportScreen from '../screens/ReportScreen';
import RequestItemScreen from '../screens/RequestItemScreen';
import ScannerScreen from '../screens/ScannerScreen';
import SignInScreen from '../screens/SignInScreen';
import StockInScreen from '../screens/StockInScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Bottom Tab Components
// Bottom Tab Components
function BottomTabs({ userData, setToken }) {
  const isAdmin = userData?.role === 'admin';
  const { theme } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.primary, // Color when focused
        tabBarInactiveTintColor: theme.textMuted, // Color when unfocused
        tabBarStyle: { backgroundColor: theme.card, borderTopColor: theme.border, height: 80 },
        tabBarIcon: ({ color, size }) => { // Removed 'focused' as we don't need it for fill anymore
          let IconComponent;

          if (route.name === 'Dashboard') IconComponent = Home;
          else if (route.name === 'Inventory') IconComponent = Package;
          else if (route.name === 'Scan') IconComponent = Scan;
          else if (route.name === 'Alerts') IconComponent = Bell;
          else if (route.name === 'Profile') IconComponent = User;
          else if (route.name === 'Request') IconComponent = PlusCircle;
          else if (route.name === 'QuickTakeout') IconComponent = Zap;

          if (!IconComponent) return null;

          return (
            <IconComponent
              size={size}
              color={color} // This automatically handles the active/inactive stroke color
            />
          );
        },
      })}
    >
      {/* Admin only tabs */}
      {isAdmin && <Tab.Screen name="Dashboard" component={DashboardScreen} />}
      {isAdmin && <Tab.Screen name="Inventory" component={InventoryScreen} />}

      {/* shared tab */}

      {/* TL ONLY TAB */}
      {!isAdmin && (
        <Tab.Screen name="Request">
          {(props) => <RequestItemScreen {...props} userData={userData} />}
        </Tab.Screen>
      )}

      <Tab.Screen name="Scan" component={ScannerScreen} />

      {/* QUICK TAKEOUT TAB */}
      {!isAdmin && (
        <Tab.Screen name="QuickTakeout" component={QuickTakeoutScreen} />
      )}

      {/* ADMIN ONLY TAB */}
      {isAdmin && <Tab.Screen name="Alerts" component={AlertsScreen} />}

      {/* SHARED TAB */}
      <Tab.Screen name="Profile">
        {(props) => <ProfileScreen {...props} userData={userData} setToken={setToken} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

// MAIN NAVIGATOR
export default function AppNavigator() {
  const [isLoading, setIsLoading] = useState(true);
  const [userToken, setUserToken] = useState(null);
  const [userData, setUserData] = useState(null);

  const { theme } = useTheme(); // Grab dynamic colors for Loading Screen

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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {userToken == null ? (
          <>
            <Stack.Screen name="SignIn">
              {(props) => (
                <SignInScreen
                  {...props}
                  setToken={setUserToken}
                  setUserData={setUserData}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="ForgotPassword">
              {(props) => (
                <ForgotPasswordScreen
                  {...props}
                  setToken={setUserToken}
                  setUserData={setUserData}
                />
              )}
            </Stack.Screen>
          </>
        ) : (
          // HAS TOKEN: Show App
          <>
            <Stack.Screen name="MainTabs">
              {(props) => <BottomTabs {...props} userData={userData} setToken={setUserToken} />}
            </Stack.Screen>

            {/* Quick Actions / Stack Screens */}
            <Stack.Screen name="StockIn" component={StockInScreen} />
            <Stack.Screen name="Cupboard" component={CupboardScreen} />
            <Stack.Screen name="Relocate" component={RelocateScreen} />
            <Stack.Screen name="Issue" component={IssueScreen} />
            <Stack.Screen name="Reports" component={ReportScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}