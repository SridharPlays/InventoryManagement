import React, { useState } from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View, Modal, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { COLORS } from '../constants/theme';
import { StorageService } from '../services/storage';

// Notice we added setToken here!
export default function ProfileScreen({ userData, setToken }) {
  // State for Modals
  const [contactModalVisible, setContactModalVisible] = useState(false);
  const [helpModalVisible, setHelpModalVisible] = useState(false);
  const [preferencesModalVisible, setPreferencesModalVisible] = useState(false);

  // State for Toggle Preference
  const [mailEnabled, setMailEnabled] = useState(true);

  const handleLogout = async () => {
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.removeItem('userToken');
            await AsyncStorage.removeItem('userData');
            setToken(null); // This instantly kicks the user back to the SignIn screen!
          }
        }
      ]
    );
  };

  const handleClearCache = async () => {
    Alert.alert(
      "Clear Cache",
      "Are you sure you want to clear the locally stored inventory data?",
      [
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
      ]
    );
  };

  const handleSavePreferences = () => {
    Alert.alert(
      "Preferences Saved",
      `Mail Notifications are now ${mailEnabled ? 'ON' : 'OFF'}`
    );
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
      <ScrollView contentContainerStyle={styles.scrollContentProfile} scrollEnabled={false}>
        <View style={styles.headerProfile}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        <TouchableOpacity 
          style={styles.userCard} 
          onPress={() => setPreferencesModalVisible(true)}
        >
          <View style={styles.avatarPlaceholder}>
            <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: 'bold' }}>
              {userData?.name ? userData.name.charAt(0).toUpperCase() : <Ionicons name="person" size={24} color={COLORS.textMuted} />}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{userData?.name || 'Guest User'}</Text>
            <Text style={styles.userEmail}>{userData?.email || 'No email found'}</Text>
          </View>
          <Ionicons name="create-outline" size={20} color={COLORS.textMuted} />
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.cardGroup}>
          <ProfileItem icon="file-document-outline" label="Terms of Use" />
          <View style={styles.itemDivider} />
          <ProfileItem icon="shield-check-outline" label="Privacy Policy" />
        </View>

        <Text style={styles.sectionTitle}>App</Text>
        <View style={styles.cardGroup}>
          <ProfileItem
            icon="card-account-mail-outline"
            label="Contact us"
            onPress={() => setContactModalVisible(true)}
          />
          <View style={styles.itemDivider} />
          <ProfileItem
            icon="help-circle-outline"
            label="Help & Support"
            onPress={() => setHelpModalVisible(true)}
          />
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
      <Modal animationType="slide" transparent={true} visible={preferencesModalVisible} onRequestClose={() => setPreferencesModalVisible(false)}>
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
      <Modal animationType="slide" transparent={true} visible={contactModalVisible} onRequestClose={() => setContactModalVisible(false)}>
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
      <Modal animationType="slide" transparent={true} visible={helpModalVisible} onRequestClose={() => setHelpModalVisible(false)}>
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
});