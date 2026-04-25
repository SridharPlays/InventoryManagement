import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { UniversalAlert } from "../utils/UniversalAlert";

import { StorageService } from "../services/storage";

import * as Device from "expo-device";
import * as Notifications from "expo-notifications";

// Google Auth Imports
import * as AuthSession from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";

import { postToGAS } from "../services/api";

import { useTheme } from "../context/ThemeContext";
import { HapticHelper } from "../utils/haptics";

// Required to handle the redirect back to the app from the browser
WebBrowser.maybeCompleteAuthSession();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function SignInScreen({ navigation, setToken, setUserData }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setPasswordVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { theme } = useTheme();
  const styles = getStyles(theme);

  const [request, googleResponse, promptAsync] = Google.useAuthRequest({
    iosClientId:
      "695463828535-ph4hvso1hi5s38kp9sgeieiq22atshmn.apps.googleusercontent.com",
    androidClientId:
      "695463828535-c8kcabcbts2l2b8l1r2lfpgqp3ke610o.apps.googleusercontent.com",
    webClientId:
      "695463828535-0jdevib60jm9bhnr3l3r5frdsrdvqtaq.apps.googleusercontent.com",
    redirectUri: AuthSession.makeRedirectUri({
      projectSettings: {
        baseUrl: "https://auth.expo.io/@sridharplays/InventoryExpo",
      },
      useProxy: true,
    }),
  });

  const registerForPushNotificationsAsync = async (userEmail) => {
    let token;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: theme.primary,
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        console.log("Failed to get push token for push notification!");
        return;
      }

      // Get the token
      token = (
        await Notifications.getExpoPushTokenAsync({
          projectId: "92035d82-8cf0-401b-84f7-036ec1ba73dc",
        })
      ).data;

      // Send token to your Google Apps Script backend
      await postToGAS("savePushToken", { email: userEmail, token: token });
    } else {
      console.log("Must use physical device for Push Notifications");
    }
  };

  // 2. Listen for Google Auth Response
  useEffect(() => {
    if (googleResponse?.type === "success") {
      const { authentication } = googleResponse;
      // You can use authentication.accessToken or authentication.idToken
      // depending on your backend verification method
      handleSocialLogin("google", authentication.accessToken);
    }
  }, [googleResponse]);

  // Unified Social Login Handler
  const handleSocialLogin = async (provider, token) => {
    setIsLoading(true);
    try {
      // Sending the provider and token to your GAS backend
      const response = await postToGAS("social_login", { provider, token });

      if (response && response.success) {
        await AsyncStorage.setItem("userToken", response.sessionId);
        await AsyncStorage.setItem("userData", JSON.stringify(response.user));
        setUserData(response.user);
        setToken(response.sessionId);

        await StorageService.setSession({
          sessionId: response.sessionId,
          user: response.user,
          email: response.user.email,
        });
      } else {
        UniversalAlert.alert(
          "Login Failed",
          response.message || "Social login failed.",
        );
        HapticHelper.error();
      }
    } catch (error) {
      UniversalAlert.alert("Error", "Could not connect to the server.");
      HapticHelper.error();
    } finally {
      setIsLoading(false);
    }
  };

  // Original Email/Password Handler
  const handleSignIn = async () => {
    if (!email || !password) {
      UniversalAlert.alert("Error", "Please fill in all fields.");
      HapticHelper.error();
      return;
    }

    setIsLoading(true);
    const response = await postToGAS("login", { email, password });
    setIsLoading(false);

    if (response && response.success) {
      await AsyncStorage.setItem("userToken", response.sessionId);
      await AsyncStorage.setItem("userData", JSON.stringify(response.user));

      if (setUserData) setUserData(response.user);
      if (setToken) setToken(response.sessionId);

      await StorageService.saveSession(response.user);
      HapticHelper.success();
      registerForPushNotificationsAsync(response.user.email);
    } else {
      UniversalAlert.alert(
        "Login Failed",
        response.message || "Invalid credentials",
      );
      HapticHelper.error();
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { paddingBottom: 0 }]}
      edges={["top", "left", "right"]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        scrollEnabled={true}
      >
        <View style={styles.headerCentered}>
          <Image
            source={
              theme.name === 'light'
                ? require("../../assets/images/caps_blue.png")
                : require("../../assets/images/caps.png")
            }
            style={
              theme.name === 'light'
                ? { width: 280, height: 120, resizeMode: "contain" }
                : { width: 250, height: 120, resizeMode: "contain" } 
            }
          />
        </View>

        <Text style={[styles.title, { marginBottom: 20 }]}>
          Sign In To Your Account.
        </Text>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="sridhar@christuniversity.in"
            placeholderTextColor={theme.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
            editable={!isLoading}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Password</Text>
          <View style={styles.passwordWrapper}>
            <TextInput
              style={styles.inputPassword}
              placeholder="••••••••••"
              placeholderTextColor={theme.textMuted}
              secureTextEntry={!isPasswordVisible}
              value={password}
              onChangeText={setPassword}
              editable={!isLoading}
            />
            <TouchableOpacity
              onPress={() => setPasswordVisible(!isPasswordVisible)}
              disabled={isLoading}
            >
              <Ionicons
                name={isPasswordVisible ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={theme.textMuted}
              />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.primaryButton,
            { marginTop: 10 },
            isLoading && { opacity: 0.7 },
          ]}
          onPress={handleSignIn}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={theme.text} />
          ) : (
            <Text style={styles.primaryButtonText}>Sign In</Text>
          )}
        </TouchableOpacity>

        <View style={styles.rowBetween}>
          <TouchableOpacity
            onPress={() => navigation.navigate("ForgotPassword")}
          >
            <Text style={[styles.textSmall, { color: theme.primary }]}>
              Forgot password?
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>Or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Google Sign-In Button */}
        <TouchableOpacity
          style={styles.socialButton}
          disabled={!request || isLoading}
          // onPress={() => promptAsync()}
          onPress={() => {
            UniversalAlert.alert(
              "Google Sign-In",
              "Google Sign-In is under development.",
            );
            HapticHelper.lightImpact();
          }}
        >
          <Image
            source={{
              uri: "https://img.icons8.com/?size=100&id=17949&format=png&color=000000",
            }}
            style={styles.socialIcon}
          />
          <Text style={styles.socialButtonText}>Sign in with Google</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.socialButton}
          onPress={() => {
            UniversalAlert.alert(
              "Apple Sign-In",
              "Apple Sign-In is under development.",
            );
            HapticHelper.lightImpact();
          }}
        >
          <Ionicons
            name="logo-apple"
            size={20}
            color={theme.text}
            style={{ marginRight: 10 }}
          />
          <Text style={styles.socialButtonText}>Continue with Apple</Text>
        </TouchableOpacity>

        <View style={styles.signUpRow}>
          <Text style={styles.textSmall}>Crafted with ❤️ by CAPS</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    scrollContent: { padding: 24, paddingTop: 40 },
    headerCentered: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 40,
    },
    title: {
      color: theme.text,
      fontSize: 24,
      fontWeight: "700",
      textAlign: "center",
    },
    inputContainer: { marginBottom: 20 },
    inputLabel: {
      color: theme.text,
      fontSize: 13,
      fontWeight: "500",
      marginBottom: 8,
      marginLeft: 4,
    },
    input: {
      backgroundColor: theme.inputBg,
      color: theme.text,
      padding: 16,
      borderRadius: 12,
      fontSize: 15,
    },
    passwordWrapper: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.inputBg,
      borderRadius: 12,
      paddingRight: 16,
    },
    inputPassword: { flex: 1, color: theme.text, padding: 16, fontSize: 15 },
    primaryButton: {
      backgroundColor: theme.primary,
      width: "100%",
      paddingVertical: 16,
      borderRadius: 16,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      height: 56,
    },
    primaryButtonText: {
      color: theme.background,
      fontSize: 16,
      fontWeight: "600",
    },
    rowBetween: {
      flexDirection: "row",
      justifyContent: "flex-end",
      alignItems: "center",
      marginTop: 20,
      marginBottom: 30,
    },
    textSmall: { color: theme.textMuted, fontSize: 13 },
    dividerRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 30,
    },
    dividerLine: { flex: 1, height: 1, backgroundColor: theme.border },
    dividerText: {
      color: theme.textMuted,
      paddingHorizontal: 15,
      fontSize: 12,
    },
    socialButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.card,
      padding: 16,
      borderRadius: 12,
      marginBottom: 16,
    },
    socialIcon: { width: 20, height: 20, marginRight: 10 },
    socialButtonText: { color: theme.text, fontSize: 14, fontWeight: "500" },
    signUpRow: {
      flexDirection: "row",
      justifyContent: "center",
      marginTop: 20,
      marginBottom: 40,
    },
  });
