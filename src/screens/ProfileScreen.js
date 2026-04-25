import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// Add these to your imports at the top
import * as ImagePicker from 'expo-image-picker';
import { postToGAS } from '../services/api';

import { Audio } from 'expo-av';
import { BlurView } from 'expo-blur';
import { useNavigation } from 'expo-router';
import { CAPS_APPS } from '../constants/apps';
import { useTheme } from '../context/ThemeContext';
import { StorageService } from '../services/storage';
import { HapticHelper } from '../utils/haptics';
import { UniversalAlert } from '../utils/UniversalAlert';

export default function ProfileScreen({ userData, setToken }) {
  const { theme, isDarkMode, toggleTheme } = useTheme();
  const styles = getStyles(theme);

  const [vibrationsEnabled, setVibrationsEnabled] = useState(true);
  const [helpModalVisible, setHelpModalVisible] = useState(false);
  const [appsModalVisible, setAppsModalVisible] = useState(false);

  const [isUploading, setIsUploading] = useState(false);
  const [profileImage, setProfileImage] = useState(userData?.profileImage || null);

  const [tapCount, setTapCount] = useState(0);
  const [soundIndex, setSoundIndex] = useState(0);
  const soundRef = useRef(null);

  const navigate = useNavigation();

  const soundsList = [
    require('../../assets/aww_socute.mp3'),
    require('../../assets/faaah.mp3'),
    require('../../assets/getout.mp3'),
  ];

  useEffect(() => {
    const loadVibrationSettings = async () => {
      try {
        const storedValue = await StorageService.getCachedData('vibrationsEnabled');
        if (storedValue !== null && storedValue !== undefined) {
          setVibrationsEnabled(storedValue);
          HapticHelper.setHapticsEnabled(storedValue); // Sync the helper
        }
      } catch (error) {
        console.error("Failed to load vibration settings:", error);
      }
    };
    loadVibrationSettings();
  }, []);

  const toggleVibrations = async () => {
    const newValue = !vibrationsEnabled;
    setVibrationsEnabled(newValue);
    HapticHelper.setHapticsEnabled(newValue); // Instantly update helper

    // Provide haptic feedback if turning ON
    if (newValue && Platform.OS !== 'web') {
      await HapticHelper.success();
    }

    try {
      await StorageService.cacheData('vibrationsEnabled', newValue);
    } catch (error) {
      console.error("Failed to save vibration preference:", error);
    }
  };

  const playNextSound = async () => {
    const { sound } = await Audio.Sound.createAsync(soundsList[soundIndex]);
    soundRef.current = sound;
    await sound.playAsync();
    setSoundIndex((prev) => (prev + 1) % soundsList.length);
  };

  const handlePress = () => {
    const newCount = tapCount + 1;
    setTapCount(newCount);
    if (newCount === 10) {
      playNextSound();
      setTapCount(0);
    }
  };

  const sortedCapsApps = [...CAPS_APPS].sort((a, b) => {
    if (a.isDraft === b.isDraft) return 0;
    return a.isDraft ? 1 : -1;
  });

  const handleUpdateProfilePic = async () => {
    try {
      // Ask for permission
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionResult.granted === false) {
        UniversalAlert.alert("Permission Required", "Please allow access to your photos to change your profile picture.");
        return;
      }

      // Launch Image Library
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled) {
        setIsUploading(true);
        const base64 = result.assets[0].base64;
        const uri = result.assets[0].uri;
        const extension = uri.split('.').pop() || 'jpg';
        const mimeType = result.assets[0].mimeType || `image/${extension}`;

        // Send to Google Apps Script using your helper
        const data = await postToGAS('updateProfileImage', {
          email: userData.email,
          fileObject: {
            base64: base64,
            type: mimeType,
            name: `profile_${userData.id}_${Date.now()}.${extension}`
          }
        });

        // Handle Response
        if (data && data.success) {
          setProfileImage(data.imageUrl);

          // Update local storage so it persists on app reload
          const updatedUser = { ...userData, profileImage: data.imageUrl };
          await AsyncStorage.setItem('userData', JSON.stringify(updatedUser));

          const { sound } = await Audio.Sound.createAsync(soundsList[0]);
          soundRef.current = sound;
          await sound.playAsync();

          HapticHelper.success();
          UniversalAlert.alert("Success", "Profile picture updated!");
        } else {
          HapticHelper.error();
          UniversalAlert.alert("Error", data?.message || "Failed to update profile picture.");
        }
      }
    } catch (error) {
      console.error("Profile Pic Upload Error:", error);
      UniversalAlert.alert("Error", "Something went wrong while uploading.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleLogout = async () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm("Are you sure you want to log out?");
      if (confirmed) {
        await AsyncStorage.removeItem('userToken');
        await AsyncStorage.removeItem('userData');
        await StorageService.clearSession();
        setToken(null);
      }
    } else {
      UniversalAlert.alert("Log Out", "Are you sure you want to log out?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: async () => {
            HapticHelper.success();
            await AsyncStorage.removeItem('userToken');
            await AsyncStorage.removeItem('userData');
            await StorageService.clearSession();
            setToken(null);
          }
        }
      ]);
    }
  };

  const handleClearCache = async () => {
    UniversalAlert.alert("Clear Cache", "Are you sure you want to clear the locally stored inventory data?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          try {
            await StorageService.removeCachedData('getInventory');
            await HapticHelper.success();
            UniversalAlert.alert("Success", "Inventory cache has been cleared.");
          } catch (error) {
            console.error("Failed to clear cache:", error);
            await HapticHelper.error();
            UniversalAlert.alert("Error", "Could not clear the cached data.");
          }
        }
      }
    ]);
  };

  const ProfileItem = ({ icon, label, value, onPress, rightIcon = "chevron-forward" }) => (
    <TouchableOpacity style={styles.profileItem} onPress={onPress}>
      <View style={styles.profileItemLeft}>
        <View style={styles.iconBox}>
          <MaterialCommunityIcons name={icon} size={20} color={theme.text} />
        </View>
        <Text style={styles.profileItemLabel}>{label}</Text>
      </View>
      <View style={styles.profileItemRight}>
        {value && <Text style={styles.profileItemValue}>{value}</Text>}
        <Ionicons name={rightIcon} size={20} color={theme.textMuted} />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContentProfile}>
        <View style={styles.headerProfile}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        <View style={styles.userCard}>
          {/* Avatar Area - Triggers Image Picker */}
          <TouchableOpacity
            style={styles.avatarPlaceholder}
            onPress={handleUpdateProfilePic}
            disabled={isUploading}
          >
            {isUploading ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <>
                <Image
                  source={profileImage ? { uri: profileImage } : require('../../assets/images/caps_logo.png')}
                  style={styles.avatar}
                />
                <View style={styles.editIconBadge}>
                  <Ionicons name="camera" size={12} color="#fff" />
                </View>
              </>
            )}
          </TouchableOpacity>

          {/* User Info Area - Triggers the Easter Egg (handlePress) */}
          <TouchableOpacity style={styles.userInfo} onPress={handlePress} activeOpacity={0.7}>
            <Text style={styles.userName}>{userData?.name || 'Guest User'}</Text>
            <Text style={styles.userEmail}>{userData?.email || 'No email found'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.cardGroup}>
          <ProfileItem icon="file-document-outline" label="Terms of Use" />
          <View style={styles.itemDivider} />
          <ProfileItem icon="shield-check-outline" label="Privacy Policy" />
        </View>

        <Text style={styles.sectionTitle}>App</Text>
        <View style={styles.cardGroup}>
          <ProfileItem icon="help-circle-outline" label="Help & Support" onPress={() => setHelpModalVisible(true)} />
          <View style={styles.itemDivider} />
          <View style={styles.profileItem}>
            <View style={styles.profileItemLeft}>
              <View style={styles.iconBox}>
                <MaterialCommunityIcons name={"palette"} size={20} color={theme.text} />
              </View>
              <Text style={styles.profileItemLabel}>Switch Theme</Text>
            </View>
            <Switch
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor={'#f4f3f4'}
              ios_backgroundColor="#3e3e3e"
              onValueChange={toggleTheme}
              value={isDarkMode}
            />
          </View>
          <View style={styles.itemDivider} />
          <View style={styles.profileItem}>
            <View style={styles.profileItemLeft}>
              <View style={styles.iconBox}>
                <MaterialCommunityIcons name={"vibrate"} size={20} color={theme.text} />
              </View>
              <Text style={styles.profileItemLabel}>Vibrations</Text>
            </View>
            <Switch
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor={'#f4f3f4'}
              ios_backgroundColor="#3e3e3e"
              onValueChange={toggleVibrations} // Use new handler
              value={vibrationsEnabled}        // Use new state
            />
          </View>
          <View style={styles.itemDivider} />
          <ProfileItem icon="grid" label="More Applications" onPress={() => setAppsModalVisible(true)} />
        </View>

        <View style={[styles.cardGroup, { marginTop: 20 }]}>
          <TouchableOpacity style={styles.profileItem} onPress={handleClearCache}>
            <View style={styles.profileItemLeft}>
              <View style={styles.iconBox}>
                <Ionicons name="trash-outline" size={20} color={theme.danger} />
              </View>
              <Text style={[styles.profileItemLabel, { color: theme.danger }]}>Clear Cache</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.profileItem} onPress={handleLogout}>
            <View style={styles.profileItemLeft}>
              <View style={styles.iconBox}>
                <Ionicons name="log-out-outline" size={20} color={theme.danger} />
              </View>
              <Text style={[styles.profileItemLabel, { color: theme.danger }]}>Log out</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Help & Support Modal */}
      <Modal animationType="fade" transparent={true} visible={helpModalVisible} onRequestClose={() => setHelpModalVisible(false)}>
        <BlurView intensity={50} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Help & Support</Text>
            <Text style={styles.modalText}>Need assistance? Contact your Team Lead or Administrator.</Text>
            <TouchableOpacity style={styles.modalButton} onPress={() => setHelpModalVisible(false)}>
              <Text style={styles.modalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      </Modal>

      {/* Bottom Sheet Modal for More Applications */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={appsModalVisible}
        onRequestClose={() => setAppsModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.bottomSheetOverlay}
          activeOpacity={1}
          onPress={() => setAppsModalVisible(false)}
        >
          <View style={styles.bottomSheetContainer}>
            <View style={styles.bottomSheetHeader}>
              <View style={styles.dragHandle} />
              <View style={styles.bottomSheetHeaderTitleRow}>
                <Text style={styles.bottomSheetTitle}>More CAPS Apps</Text>
                <TouchableOpacity onPress={() => setAppsModalVisible(false)}>
                  <Ionicons name="close" size={24} color={theme.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.appListContainer}>
              {sortedCapsApps.map((app) => (
                <TouchableOpacity
                  key={app.id}
                  style={[styles.appCard, app.isDraft && styles.appCardDraft]}
                  activeOpacity={app.isDraft && userData?.role === 'admin' ? 1 : 0.7}
                  onPress={() => {
                    if (!app.isDraft && userData?.role === 'admin') {
                      setAppsModalVisible(false);
                      navigate.navigate(app.redirectTo);
                    } else {
                    }
                  }}
                >
                  <View style={styles.appLogoContainer}>
                    <Image
                      source={app.image}
                      style={styles.appImage}
                      resizeMode="cover"
                    />
                  </View>
                  <View style={styles.appCardInfo}>
                    <Text style={styles.appCardName}>{app.name}</Text>
                    <Text style={styles.appCardDesc}>{app.desc}</Text>

                    {app.isDraft && (
                      <View style={[styles.draftBadge, { borderColor: theme.border }]}>
                        <Ionicons name="time-outline" size={12} color={theme.textMuted} style={{ marginRight: 4 }} />
                        <Text style={[styles.draftBadgeText, { color: theme.textMuted }]}>Under Development</Text>
                      </View>
                    )}
                  </View>

                  <TouchableOpacity
                    style={[styles.openBtn, app.isDraft && { backgroundColor: theme.border }]}
                    disabled={app.isDraft && userData?.role !== 'admin'}
                    onPress={() => {
                      if (!app.isDraft && userData?.role === 'admin') {
                        setAppsModalVisible(false);
                        navigate.navigate(app.redirectTo);
                      }
                    }}
                  >
                    <Text style={[
                      styles.openBtnText,
                      app.isDraft && userData?.role === 'admin' && { color: theme.textMuted }
                    ]}>
                      {app.isDraft && userData?.role !== 'admin' ? 'Soon' : 'Open'}
                    </Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView >
  );
}

const getStyles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  scrollContentProfile: { padding: 20 },
  headerProfile: { flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', marginBottom: 30 },
  iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.card, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: theme.text, fontSize: 24, fontWeight: 'bold' },
  userCard: { backgroundColor: theme.card, flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, marginBottom: 30 },
  avatarPlaceholder: { width: 50, height: 50, borderRadius: 25, backgroundColor: theme.inputBg, justifyContent: 'center', alignItems: 'center' },
  avatar: { width: '100%', height: '100%', borderRadius: 25 },
  userInfo: { flex: 1, marginLeft: 15 },
  userName: { color: theme.text, fontSize: 16, fontWeight: '600', marginBottom: 4 },
  userEmail: { color: theme.textMuted, fontSize: 13 },
  sectionTitle: { color: theme.textMuted, fontSize: 13, marginBottom: 10, marginLeft: 5 },
  cardGroup: { backgroundColor: theme.card, borderRadius: 16, marginBottom: 20, overflow: 'hidden' },
  profileItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  profileItemLeft: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: theme.inputBg, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  profileItemLabel: { color: theme.text, fontSize: 15 },
  profileItemRight: { flexDirection: 'row', alignItems: 'center' },
  profileItemValue: { color: theme.textMuted, fontSize: 13, marginRight: 8 },
  itemDivider: { height: 1, backgroundColor: theme.border, marginLeft: 60 },

  // Modals (Contact, Help, Preferences, Theme)
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  modalContent: { width: '80%', backgroundColor: theme.card, borderRadius: 16, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: theme.text, marginBottom: 15 },
  modalText: { fontSize: 15, color: theme.textMuted, textAlign: 'center', marginBottom: 20, lineHeight: 22 },
  modalButton: { backgroundColor: theme.primary, paddingVertical: 10, paddingHorizontal: 24, borderRadius: 8, width: '100%', alignItems: 'center' },
  modalButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 25, marginTop: 10 },
  switchLabel: { fontSize: 16, color: theme.text, fontWeight: '500' },
  modalActionRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', gap: 12 },
  modalButtonBase: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  modalButtonCancel: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.border },
  modalButtonPrimary: { backgroundColor: theme.primary },
  modalButtonCancelText: { color: theme.textMuted, fontSize: 16, fontWeight: '600' },

  // Bottom Sheet App Modal
  bottomSheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  bottomSheetContainer: { backgroundColor: theme.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '70%', paddingBottom: 20 },
  bottomSheetHeader: { padding: 20, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: theme.border },
  dragHandle: { width: 40, height: 4, backgroundColor: theme.border, borderRadius: 2, alignSelf: 'center', marginBottom: 15 },
  bottomSheetHeaderTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bottomSheetTitle: { fontSize: 18, fontWeight: 'bold', color: theme.text },
  appListContainer: { padding: 20 },
  appCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, padding: 15, borderRadius: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  appCardDraft: { opacity: 0.65 },
  appLogoContainer: { width: 60, height: 60, borderRadius: 12, overflow: 'hidden', marginRight: 15, backgroundColor: theme.border },
  appImage: { width: '100%', height: '100%' },
  appCardInfo: { flex: 1 },
  appCardName: { fontSize: 16, fontWeight: '600', color: theme.text, marginBottom: 2 },
  appCardDesc: { fontSize: 12, color: theme.textMuted, marginBottom: 6 },
  draftBadge: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start' },
  draftBadgeText: { fontSize: 10, fontWeight: '600' },
  openBtn: { backgroundColor: `${theme.primary}15`, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20 },
  openBtnText: { color: theme.primary, fontSize: 13, fontWeight: '600' },
  editIconBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: theme.primary,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.card
  },
});