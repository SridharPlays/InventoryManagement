import React, { useState, useRef } from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View, Modal, Switch, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { COLORS } from '../constants/theme';
import { StorageService } from '../services/storage';
import { useNavigation } from 'expo-router';
import { CAPS_APPS } from '../constants/apps';
import { Audio } from 'expo-av';

export default function ProfileScreen({ userData, setToken }) {
  const [contactModalVisible, setContactModalVisible] = useState(false);
  const [helpModalVisible, setHelpModalVisible] = useState(false);
  const [preferencesModalVisible, setPreferencesModalVisible] = useState(false);
  const [appsModalVisible, setAppsModalVisible] = useState(false);
  const [themeModalVisible, setThemeModalVisible] = useState(false);

  const [tapCount, setTapCount] = useState(0);
  const [soundIndex, setSoundIndex] = useState(0);
  const soundRef = useRef(null);

  const [mailEnabled, setMailEnabled] = useState(true);

  const navigate = useNavigation();

  const soundsList = [
    require('../../assets/aww_socute.mp3'),
    require('../../assets/faaah.mp3'),
    require('../../assets/getout.mp3'),
  ];

  const playNextSound = async () => {
    const { sound } = await Audio.Sound.createAsync(
      soundsList[soundIndex]
    );
    soundRef.current = sound;
    await sound.playAsync();

    // move to next sound (loop back after last)
    setSoundIndex((prev) => (prev + 1) % soundsList.length);
  };

  const handlePress = () => {
    const newCount = tapCount + 1;
    setTapCount(newCount);

    if (newCount === 20) {
      playNextSound();
      setTapCount(0);
    }
  };
  // sort caps apps, show non-draft apps first
  const sortedCapsApps = [...CAPS_APPS].sort((a, b) => {
    if (a.isDraft === b.isDraft) return 0;
    return a.isDraft ? 1 : -1;
  });

  const handleLogout = async () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.removeItem('userToken');
          await AsyncStorage.removeItem('userData');

          await StorageService.clearSession();
          setToken(null);
        }
      }
    ]);
  };

  const handleClearCache = async () => {
    Alert.alert("Clear Cache", "Are you sure you want to clear the locally stored inventory data?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          try {
            await StorageService.removeCachedData('getInventory');
            Alert.alert("Success", "Inventory cache has been cleared.");
          } catch (error) {
            console.error("Failed to clear cache:", error);
            Alert.alert("Error", "Could not clear the cached data.");
          }
        }
      }
    ]);
  };

  const handleSavePreferences = () => {
    Alert.alert("Preferences Saved", `Mail Notifications are now ${mailEnabled ? 'ON' : 'OFF'}`);
    setPreferencesModalVisible(false);
  };

  const ProfileItem = ({ icon, label, value, onPress, rightIcon = "chevron-forward" }) => (
    <TouchableOpacity style={styles.profileItem} onPress={onPress}>
      <View style={styles.profileItemLeft}>
        <View style={styles.iconBox}>
          <MaterialCommunityIcons name={icon} size={20} color={COLORS.text} />
        </View>
        <Text style={styles.profileItemLabel}>{label}</Text>
      </View>
      <View style={styles.profileItemRight}>
        {value && <Text style={styles.profileItemValue}>{value}</Text>}
        <Ionicons name={rightIcon} size={20} color={COLORS.textMuted} />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContentProfile}>
        <View style={styles.headerProfile}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        <TouchableOpacity style={styles.userCard} onPress={handlePress}>
          <View style={styles.avatarPlaceholder}>
            {/* <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: 'bold' }}>
              {userData?.name ? userData.name.charAt(0).toUpperCase() : <Ionicons name="person" size={24} color={COLORS.textMuted} />}
            </Text> */}
            <Image source={require('../../assets/images/caps_logo.png')} style={styles.avatar} />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{userData?.name || 'Guest User'}</Text>
            <Text style={styles.userEmail}>{userData?.email || 'No email found'}</Text>
          </View>
          {/* <Ionicons name="create-outline" size={20} color={COLORS.textMuted} /> */}
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.cardGroup}>
          <ProfileItem icon="file-document-outline" label="Terms of Use" />
          <View style={styles.itemDivider} />
          <ProfileItem icon="shield-check-outline" label="Privacy Policy" />
        </View>

        <Text style={styles.sectionTitle}>App</Text>
        <View style={styles.cardGroup}>
          <ProfileItem icon="card-account-mail-outline" label="Contact us" onPress={() => setContactModalVisible(true)} />
          <View style={styles.itemDivider} />
          <ProfileItem icon="help-circle-outline" label="Help & Support" onPress={() => setHelpModalVisible(true)} />
          <View style={styles.itemDivider} />
          <ProfileItem icon="palette" label="Themes" onPress={() => setThemeModalVisible(true)} />
          <View style={styles.itemDivider} />
          <ProfileItem icon="grid" label="More Applications" onPress={() => setAppsModalVisible(true)} />
        </View>

        <View style={[styles.cardGroup, { marginTop: 20 }]}>
          <TouchableOpacity style={styles.profileItem} onPress={handleClearCache}>
            <View style={styles.profileItemLeft}>
              <View style={styles.iconBox}>
                <Ionicons name="trash-outline" size={20} color={COLORS.danger || '#EF4444'} />
              </View>
              <Text style={[styles.profileItemLabel, { color: COLORS.danger || '#EF4444' }]}>Clear Cache</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.profileItem} onPress={handleLogout}>
            <View style={styles.profileItemLeft}>
              <View style={styles.iconBox}>
                <Ionicons name="log-out-outline" size={20} color={COLORS.danger || '#EF4444'} />
              </View>
              <Text style={[styles.profileItemLabel, { color: COLORS.danger || '#EF4444' }]}>Log out</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Preferences Modal */}
      <Modal animationType="fade" transparent={true} visible={preferencesModalVisible} onRequestClose={() => setPreferencesModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>User Preferences</Text>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Mail Notifications</Text>
              <Switch
                trackColor={{ false: COLORS.border || '#767577', true: COLORS.primary || '#007BFF' }}
                thumbColor={'#f4f3f4'}
                ios_backgroundColor="#3e3e3e"
                onValueChange={setMailEnabled}
                value={mailEnabled}
              />
            </View>
            <View style={styles.modalActionRow}>
              <TouchableOpacity style={[styles.modalButtonBase, styles.modalButtonCancel]} onPress={() => setPreferencesModalVisible(false)}>
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButtonBase, styles.modalButtonPrimary]} onPress={handleSavePreferences}>
                <Text style={styles.modalButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Contact Us Modal */}
      <Modal animationType="fade" transparent={true} visible={contactModalVisible} onRequestClose={() => setContactModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Contact Us</Text>
            <Text style={styles.modalText}>You can reach us at caps@christuniversity.in</Text>
            <TouchableOpacity style={styles.modalButton} onPress={() => setContactModalVisible(false)}>
              <Text style={styles.modalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Help & Support Modal */}
      <Modal animationType="fade" transparent={true} visible={helpModalVisible} onRequestClose={() => setHelpModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Help & Support</Text>
            <Text style={styles.modalText}>Need assistance? Contact your Team Lead or Administrator.</Text>
            <TouchableOpacity style={styles.modalButton} onPress={() => setHelpModalVisible(false)}>
              <Text style={styles.modalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
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
                  <Ionicons name="close" size={24} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.appListContainer}>
              {sortedCapsApps.map((app) => (
                <TouchableOpacity
                  key={app.id}
                  style={[styles.appCard, app.isDraft && styles.appCardDraft]}
                  activeOpacity={app.isDraft ? 1 : 0.7}
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
                      <View style={[styles.draftBadge, { borderColor: COLORS.border || '#E5E7EB' }]}>
                        <Ionicons name="time-outline" size={12} color={COLORS.textMuted || '#6B7280'} style={{ marginRight: 4 }} />
                        <Text style={[styles.draftBadgeText, { color: COLORS.textMuted || '#6B7280' }]}>Under Development</Text>
                      </View>
                    )}
                  </View>

                  <TouchableOpacity
                    style={[styles.openBtn, app.isDraft && { backgroundColor: COLORS.border || '#E5E7EB' }]}
                    disabled={app.isDraft}
                    onPress={() => {
                      if (!app.isDraft) {
                        setAppsModalVisible(false);
                        navigate.navigate(app.redirectTo);
                      }
                    }}
                  >
                    <Text style={[
                      styles.openBtnText,
                      app.isDraft && { color: COLORS.textMuted || '#9CA3AF' }
                    ]}>
                      {app.isDraft ? 'Soon' : 'Open'}
                    </Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContentProfile: { padding: 20 },
  headerProfile: { flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', marginBottom: 30 },
  iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.card, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: COLORS.text, fontSize: 24, fontWeight: 'bold' },
  userCard: { backgroundColor: COLORS.card, flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, marginBottom: 30 },
  avatarPlaceholder: { width: 50, height: 50, borderRadius: 25, backgroundColor: COLORS.inputBg, justifyContent: 'center', alignItems: 'center' },
  avatar: { width: '100%', height: '100%', borderRadius: 25 },
  userInfo: { flex: 1, marginLeft: 15 },
  userName: { color: COLORS.text, fontSize: 16, fontWeight: '600', marginBottom: 4 },
  userEmail: { color: COLORS.textMuted, fontSize: 13 },
  sectionTitle: { color: COLORS.textMuted, fontSize: 13, marginBottom: 10, marginLeft: 5 },
  cardGroup: { backgroundColor: COLORS.card, borderRadius: 16, marginBottom: 20, overflow: 'hidden' },
  profileItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  profileItemLeft: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: COLORS.inputBg, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  profileItemLabel: { color: COLORS.text, fontSize: 15 },
  profileItemRight: { flexDirection: 'row', alignItems: 'center' },
  profileItemValue: { color: COLORS.textMuted, fontSize: 13, marginRight: 8 },
  itemDivider: { height: 1, backgroundColor: COLORS.border, marginLeft: 60 },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  modalContent: { width: '80%', backgroundColor: COLORS.card || '#FFF', borderRadius: 16, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.text, marginBottom: 15 },
  modalText: { fontSize: 15, color: COLORS.textMuted, textAlign: 'center', marginBottom: 20, lineHeight: 22 },
  modalButton: { backgroundColor: COLORS.primary || '#007BFF', paddingVertical: 10, paddingHorizontal: 24, borderRadius: 8, width: '100%', alignItems: 'center' },
  modalButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 25, marginTop: 10 },
  switchLabel: { fontSize: 16, color: COLORS.text, fontWeight: '500' },
  modalActionRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', gap: 12 },
  modalButtonBase: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  modalButtonCancel: { backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.border || '#E5E7EB' },
  modalButtonPrimary: { backgroundColor: COLORS.primary || '#007BFF' },
  modalButtonCancelText: { color: COLORS.textMuted || '#6B7280', fontSize: 16, fontWeight: '600' },
  bottomSheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  bottomSheetContainer: { backgroundColor: COLORS.background || '#F9FAFB', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '70%', paddingBottom: 20 },
  bottomSheetHeader: { padding: 20, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border || '#E5E7EB' },
  dragHandle: { width: 40, height: 4, backgroundColor: COLORS.border || '#D1D5DB', borderRadius: 2, alignSelf: 'center', marginBottom: 15 },
  bottomSheetHeaderTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bottomSheetTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  appListContainer: { padding: 20 },
  appCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card || '#FFF', padding: 15, borderRadius: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  appCardDraft: { opacity: 0.65 },
  appLogoContainer: { width: 60, height: 60, borderRadius: 12, overflow: 'hidden', marginRight: 15, backgroundColor: COLORS.border || '#E5E7EB' },
  appImage: { width: '100%', height: '100%' },
  appCardInfo: { flex: 1 },
  appCardName: { fontSize: 16, fontWeight: '600', color: COLORS.text, marginBottom: 2 },
  appCardDesc: { fontSize: 12, color: COLORS.textMuted, marginBottom: 6 },
  draftBadge: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start' },
  draftBadgeText: { fontSize: 10, fontWeight: '600' },
  openBtn: { backgroundColor: `${COLORS.primary || '#007BFF'}15`, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20 },
  openBtnText: { color: COLORS.primary || '#007BFF', fontSize: 13, fontWeight: '600' },
});