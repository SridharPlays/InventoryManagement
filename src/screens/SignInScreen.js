import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Google Auth Imports
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

import { COLORS } from '../constants/theme';
import { postToGAS } from '../services/api';

// Required to handle the redirect back to the app from the browser
WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen({ setToken, setUserData }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setPasswordVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [request, googleResponse, promptAsync] = Google.useAuthRequest({
    iosClientId: '695463828535-ph4hvso1hi5s38kp9sgeieiq22atshmn.apps.googleusercontent.com',
    androidClientId: '695463828535-c8kcabcbts2l2b8l1r2lfpgqp3ke610o.apps.googleusercontent.com',
    webClientId: '695463828535-0jdevib60jm9bhnr3l3r5frdsrdvqtaq.apps.googleusercontent.com',
    redirectUri: AuthSession.makeRedirectUri({
    projectSettings: {
      baseUrl: 'https://auth.expo.io/@sridharplays/InventoryExpo'
    },
    useProxy: true
  }),
  });

  // 2. Listen for Google Auth Response
  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const { authentication } = googleResponse;
      // You can use authentication.accessToken or authentication.idToken 
      // depending on your backend verification method
      handleSocialLogin('google', authentication.accessToken);
    }
  }, [googleResponse]);

  // Unified Social Login Handler
  const handleSocialLogin = async (provider, token) => {
    setIsLoading(true);
    try {
      // Sending the provider and token to your GAS backend
      const response = await postToGAS('social_login', { provider, token });

      if (response && response.success) {
        await AsyncStorage.setItem('userToken', response.sessionId);
        await AsyncStorage.setItem('userData', JSON.stringify(response.user));
        setUserData(response.user);
        setToken(response.sessionId);
      } else {
        Alert.alert("Login Failed", response.message || "Social login failed.");
      }
    } catch (error) {
      Alert.alert("Error", "Could not connect to the server.");
    } finally {
      setIsLoading(false);
    }
  };

  // Original Email/Password Handler
  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }

    setIsLoading(true);
    const response = await postToGAS('login', { email, password });
    setIsLoading(false);

    if (response && response.success) {
      await AsyncStorage.setItem('userToken', response.sessionId);
      await AsyncStorage.setItem('userData', JSON.stringify(response.user));
      setUserData(response.user);
      setToken(response.sessionId);
    } else {
      Alert.alert("Login Failed", response.message || "Invalid credentials");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} scrollEnabled={true}>
        <View style={styles.headerCentered}>
          <Image 
            source={require("../../assets/images/caps.png")} 
            style={{ width: 250, height: 100, resizeMode: 'contain' }} 
          />
        </View>

        <Text style={[styles.title, { marginBottom: 20 }]}>Sign In To Your Account.</Text>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="sridhar@christuniversity.in"
            placeholderTextColor={COLORS.textMuted}
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
              placeholderTextColor={COLORS.textMuted}
              secureTextEntry={!isPasswordVisible}
              value={password}
              onChangeText={setPassword}
              editable={!isLoading}
            />
            <TouchableOpacity onPress={() => setPasswordVisible(!isPasswordVisible)} disabled={isLoading}>
              <Ionicons
                name={isPasswordVisible ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={COLORS.textMuted}
              />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, { marginTop: 10 }, isLoading && { opacity: 0.7 }]}
          onPress={handleSignIn}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={COLORS.text} />
          ) : (
            <Text style={styles.primaryButtonText}>Sign In</Text>
          )}
        </TouchableOpacity>

        <View style={styles.rowBetween}>
          <TouchableOpacity>
            <Text style={[styles.textSmall, { color: COLORS.primary }]}>Forgot password?</Text>
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
          onPress={() => promptAsync()}
        >
          <Image
            source={{ uri: 'https://img.icons8.com/?size=100&id=17949&format=png&color=000000' }}
            style={styles.socialIcon}
          />
          <Text style={styles.socialButtonText}>Sign in with Google</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.socialButton} 
          onPress={() => Alert.alert("Apple Sign-In", "Apple Sign-In configuration required.")}
        >
          <Ionicons name="logo-apple" size={20} color={COLORS.text} style={{ marginRight: 10 }} />
          <Text style={styles.socialButtonText}>Continue with Apple</Text>
        </TouchableOpacity>

        <View style={styles.signUpRow}>
          <Text style={styles.textSmall}>Crafted with ❤️ by CAPS</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { padding: 24, paddingTop: 40 },
  headerCentered: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 40 },
  title: { color: COLORS.text, fontSize: 24, fontWeight: '700', textAlign: 'center' },
  inputContainer: { marginBottom: 20 },
  inputLabel: { color: COLORS.text, fontSize: 13, fontWeight: '500', marginBottom: 8, marginLeft: 4 },
  input: { backgroundColor: COLORS.inputBg, color: COLORS.text, padding: 16, borderRadius: 12, fontSize: 15 },
  passwordWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.inputBg, borderRadius: 12, paddingRight: 16 },
  inputPassword: { flex: 1, color: COLORS.text, padding: 16, fontSize: 15 },
  primaryButton: { backgroundColor: COLORS.primary, width: '100%', paddingVertical: 16, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', height: 56 },
  primaryButtonText: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  rowBetween: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 20, marginBottom: 30 },
  textSmall: { color: COLORS.textMuted, fontSize: 13 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 30 },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { color: COLORS.textMuted, paddingHorizontal: 15, fontSize: 12 },
  socialButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.card, padding: 16, borderRadius: 12, marginBottom: 16 },
  socialIcon: { width: 20, height: 20, marginRight: 10 },
  socialButtonText: { color: COLORS.text, fontSize: 14, fontWeight: '500' },
  signUpRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20, marginBottom: 40 },
});