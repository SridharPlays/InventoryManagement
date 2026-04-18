import React, { useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { postToGAS } from '../services/api';
import { StorageService } from '../services/storage';

export default function SignInScreen({ setToken }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setPasswordVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }

    setIsLoading(true);
    
    // Call the actual GAS Backend
    const response = await postToGAS('login', { email, password });
    
    setIsLoading(false);

    if (response && response.success) {
      // Create session from response data
      const userData = response.user || { email: email, name: "Sridhar N" };
      await StorageService.saveSession(userData);
      setToken(userData); // This triggers the navigation to the Dashboard tabs
    } else {
      Alert.alert("Login Failed", response?.message || "Invalid credentials or network error.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} scrollEnabled={false}>
        <View style={styles.headerCentered}>
          {/* Note: Ensure the image path is correct relative to this file */}
          <Image source={require("../../assets/images/caps.png")} style={{ width: 250, height: 100, resizeMode: 'contain' }} />
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

        <TouchableOpacity style={styles.socialButton} onPress={() => Alert.alert("Google Sign-In", "Google Sign-In is not implemented in this demo.")}>
          <Image
            source={{ uri: 'https://img.icons8.com/?size=100&id=17949&format=png&color=000000' }}
            style={styles.socialIcon}
          />
          <Text style={styles.socialButtonText}>Sign in with Google</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.socialButton} onPress={() => Alert.alert("Apple Sign-In", "Apple Sign-In is not implemented in this demo.")}>
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