import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { postToGAS } from '../services/api';
import { StorageService } from '../services/storage';

import { useTheme } from '../context/ThemeContext';

import { UniversalAlert } from '../utils/UniversalAlert';
import { HapticHelper } from '../utils/haptics';

export default function ForgotPasswordScreen({ navigation, setToken, setUserData }) {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordVisible, setPasswordVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { theme } = useTheme();
  const styles = getStyles(theme);

  const handleSendCode = async () => {
    if (!email) {
      Alert.alert("Error", "Please enter your email address.");
      return;
    }

    setIsLoading(true);
    const response = await postToGAS('sendResetCode', { email });
    setIsLoading(false);

    console.log(response)

    if (response && response.success) {
      Alert.alert("Check your email", "A reset code has been sent.");
      setStep(2);
    } else {
      Alert.alert("Error", response?.message || "Failed to send reset code.");
    }
  };

  const handleResetAndLogin = async () => {
    if (!code || !newPassword || !confirmPassword) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match.");
      return;
    }

    setIsLoading(true);
    const response = await postToGAS('resetPassword', { 
      email, 
      code, 
      newPassword 
    });
    setIsLoading(false);

    if (response && response.success) {
      // Login directly upon successful reset
      await AsyncStorage.setItem('userToken', response.sessionId);
      await AsyncStorage.setItem('userData', JSON.stringify(response.user));
      
      await StorageService.saveSession(response.user);

      if (setUserData) setUserData(response.user);
      if (setToken) setToken(response.sessionId);
      
    } else {
      Alert.alert("Reset Failed", response?.message || "Invalid code or failed to reset.");
    }
  };

  return (
    <SafeAreaView style={[styles.container, { paddingBottom: 0}]} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
            disabled={isLoading}
          >
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>

          <Text style={styles.title}>Reset Password</Text>
          
          {step === 1 ? (
            <Text style={styles.subtitle}>Enter your email to receive a reset code.</Text>
          ) : (
            <Text style={styles.subtitle}>Enter the code sent to your email and your new password.</Text>
          )}

          {step === 1 && (
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
          )}

          {step === 2 && (
            <>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Reset Code</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter 6-digit code"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="number-pad"
                  value={code}
                  onChangeText={setCode}
                  editable={!isLoading}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>New Password</Text>
                <View style={styles.passwordWrapper}>
                  <TextInput
                    style={styles.inputPassword}
                    placeholder="••••••••••"
                    placeholderTextColor={theme.textMuted}
                    secureTextEntry={!isPasswordVisible}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    editable={!isLoading}
                  />
                  <TouchableOpacity onPress={() => setPasswordVisible(!isPasswordVisible)}>
                    <Ionicons
                      name={isPasswordVisible ? "eye-off-outline" : "eye-outline"}
                      size={20}
                      color={theme.textMuted}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Confirm New Password</Text>
                <View style={styles.passwordWrapper}>
                  <TextInput
                    style={styles.inputPassword}
                    placeholder="••••••••••"
                    placeholderTextColor={theme.textMuted}
                    secureTextEntry={!isPasswordVisible}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    editable={!isLoading}
                  />
                </View>
              </View>
            </>
          )}

          <TouchableOpacity
            style={[styles.primaryButton, isLoading && { opacity: 0.7 }]}
            onPress={step === 1 ? handleSendCode : handleResetAndLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={theme.text} />
            ) : (
              <Text style={styles.primaryButtonText}>
                {step === 1 ? 'Send Code' : 'Reset & Log In'}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  scrollContent: { padding: 24, paddingTop: 20 },
  backButton: { marginBottom: 30, alignSelf: 'flex-start' },
  title: { color: theme.text, fontSize: 28, fontWeight: '700', marginBottom: 10 },
  subtitle: { color: theme.textMuted, fontSize: 15, marginBottom: 30, lineHeight: 22 },
  inputContainer: { marginBottom: 20 },
  inputLabel: { color: theme.text, fontSize: 13, fontWeight: '500', marginBottom: 8, marginLeft: 4 },
  input: { backgroundColor: theme.inputBg, color: theme.text, padding: 16, borderRadius: 12, fontSize: 15 },
  passwordWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.inputBg, borderRadius: 12, paddingRight: 16 },
  inputPassword: { flex: 1, color: theme.text, padding: 16, fontSize: 15 },
  primaryButton: { backgroundColor: theme.primary, width: '100%', paddingVertical: 16, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', height: 56, marginTop: 10 },
  primaryButtonText: { color: theme.background, fontSize: 16, fontWeight: '600' },
});