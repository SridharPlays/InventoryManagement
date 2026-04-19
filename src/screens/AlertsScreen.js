import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, Switch, 
  TouchableOpacity, ActivityIndicator, RefreshControl, Alert, TextInput 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { StorageService } from '../services/storage';
import { postToGAS, fetchFromGAS } from '../services/api';

export default function AlertsScreen({ navigation }) {
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // User Data State
  const [userEmail, setUserEmail] = useState('');
  const [emailAlertsEnabled, setEmailAlertsEnabled] = useState(false);
  const [isUpdatingPrefs, setIsUpdatingPrefs] = useState(false);

  // Filters State
  const [filters, setFilters] = useState({
    requests: true,
    lowStock: true,
    returns: true
  });

  // Alerts State
  const [alerts, setAlerts] = useState({ lowStock: [], pendingReturns: [], requests: [] });

  // Interactive Request State
  const [expandedReq, setExpandedReq] = useState(null);
  const [approveQty, setApproveQty] = useState(0);
  const [remarks, setRemarks] = useState('');
  const [isApproving, setIsApproving] = useState(false);

  const loadAlertsData = async () => {
    try {
      // 1. Get User Session & Preferences
      const sessionData = await StorageService.getSession();
      if (sessionData) {
        const parsed = typeof sessionData === 'string' ? JSON.parse(sessionData) : sessionData;
        if (parsed.email) setUserEmail(parsed.email);
        
        // Load initial toggle state directly from session preference
        if (parsed.emailPreference !== undefined) {
          setEmailAlertsEnabled(parsed.emailPreference === true || String(parsed.emailPreference).toLowerCase() === 'true');
        }
      }

      // 2. Fetch Dashboard Data
      const cachedDash = await StorageService.getCachedData('getDashboard');
      if (cachedDash) setAlerts(cachedDash);

      const freshDash = await fetchFromGAS('getDashboard');
      if (freshDash) setAlerts(freshDash);
      
    } catch (error) {
      console.error("Error loading alerts:", error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadAlertsData(); }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAlertsData();
  }, []);

  // --- PREFERENCES HANDLER ---
  const toggleEmailAlerts = async (newValue) => {
    if (!userEmail) return Alert.alert("Error", "Email not found. Please re-login.");
    setEmailAlertsEnabled(newValue); 
    setIsUpdatingPrefs(true);
    try {
      const response = await postToGAS('updateEmailPreference', { email: userEmail, receiveAlerts: newValue });
      if (!response.success) {
        setEmailAlertsEnabled(!newValue);
        Alert.alert("Error", response.message || "Could not update preferences.");
      } else {
        // Update local session so it remembers next time
        const session = await StorageService.getSession();
        const parsed = typeof session === 'string' ? JSON.parse(session) : session;
        parsed.emailPreference = newValue;
        await StorageService.saveSession(parsed);
      }
    } catch (e) {
      setEmailAlertsEnabled(!newValue);
    } finally {
      setIsUpdatingPrefs(false);
    }
  };

  // --- REQUEST NEGOTIATION HANDLERS ---
  const handleExpandRequest = (req) => {
    if (expandedReq === req.row) {
      setExpandedReq(null); // Collapse if already open
    } else {
      setExpandedReq(req.row);
      setApproveQty(parseInt(req.qty) || 0); // Default to what they asked for
      setRemarks('');
    }
  };

  const changeQty = (delta, max) => {
    setApproveQty(prev => {
      const newQty = prev + delta;
      if (newQty < 0) return 0;
      if (newQty > max) return max;
      return newQty;
    });
  };

  const submitApproval = async (rowNumber) => {
    setIsApproving(true);
    try {
      const response = await postToGAS('approveRequest', { 
        rowNumber: rowNumber,
        approvedQty: approveQty,
        remarks: remarks
      });

      if (response.success) {
        Alert.alert("Approved", "The request has been processed successfully.");
        setExpandedReq(null);
        onRefresh();
      } else {
        Alert.alert("Error", response.message);
      }
    } catch (e) {
      Alert.alert("Error", "Network error.");
    } finally {
      setIsApproving(false);
    }
  };

  // --- UI COMPONENTS ---
  const FilterChip = ({ label, active, type }) => (
    <TouchableOpacity 
      style={[styles.filterChip, active && styles.filterChipActive]}
      onPress={() => setFilters(prev => ({ ...prev, [type]: !prev[type] }))}
    >
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Alerts Center</Text>
        <Text style={styles.headerSub}>Manage notifications and approvals</Text>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* Settings */}
        <View style={styles.preferencesCard}>
          <View style={styles.prefIconBox}>
            <MaterialCommunityIcons name="email-outline" size={24} color={COLORS.primary} />
          </View>
          <View style={styles.prefTextContainer}>
            <Text style={styles.prefTitle}>Email Notifications</Text>
            <Text style={styles.prefSub}>Get alerts for low stock and requests</Text>
          </View>
          {isUpdatingPrefs ? <ActivityIndicator size="small" color={COLORS.primary} /> : (
            <Switch
              trackColor={{ false: COLORS.border, true: COLORS.primary }}
              thumbColor={"#FFF"}
              ios_backgroundColor={COLORS.border}
              onValueChange={toggleEmailAlerts}
              value={emailAlertsEnabled}
            />
          )}
        </View>

        {/* Filter Row */}
        <View style={styles.filterRow}>
          <FilterChip label="Requests" active={filters.requests} type="requests" />
          <FilterChip label="Low Stock" active={filters.lowStock} type="lowStock" />
          <FilterChip label="Overdue" active={filters.returns} type="returns" />
        </View>

        {isLoading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : (
          <View style={styles.alertsList}>
            
            {/* 1. REQUESTS ALWAYS ON TOP */}
            {filters.requests && alerts.requests.map((item, index) => {
              const isExpanded = expandedReq === item.row;
              
              return (
              <TouchableOpacity 
                key={`req_${index}`} 
                activeOpacity={0.8}
                onPress={() => handleExpandRequest(item)}
                style={[styles.alertCard, { borderLeftColor: COLORS.primary }]}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.alertIconBg, { backgroundColor: COLORS.primary + '15' }]}>
                    <Ionicons name="git-pull-request-outline" size={20} color={COLORS.primary} />
                  </View>
                  <View style={styles.alertContent}>
                    <Text style={styles.alertTitle}>Request: {item.itemName}</Text>
                    <Text style={styles.alertDesc}>{item.tl} wants {item.qty} units ({item.date}).</Text>
                  </View>
                  <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color={COLORS.textMuted} />
                </View>

                {/* Interactive Expandable Section */}
                {isExpanded && (
                  <View style={styles.expandedSection}>
                    <Text style={styles.expandLabel}>Negotiate Quantity (Max: {item.qty})</Text>
                    <View style={styles.stepperContainer}>
                      <TouchableOpacity style={styles.stepperBtn} onPress={() => changeQty(-1, item.qty)}>
                        <Ionicons name="remove" size={20} color={COLORS.text} />
                      </TouchableOpacity>
                      <Text style={styles.stepperValue}>{approveQty}</Text>
                      <TouchableOpacity style={styles.stepperBtn} onPress={() => changeQty(1, item.qty)}>
                        <Ionicons name="add" size={20} color={COLORS.text} />
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.expandLabel}>Admin Remarks</Text>
                    <TextInput 
                      style={styles.remarksInput}
                      placeholder="Add a note (e.g., Short on stock)..."
                      placeholderTextColor={COLORS.textMuted}
                      value={remarks}
                      onChangeText={setRemarks}
                    />

                    <TouchableOpacity 
                      style={styles.approveSubmitBtn} 
                      onPress={() => submitApproval(item.row)}
                      disabled={isApproving}
                    >
                      {isApproving ? <ActivityIndicator color="#FFF" /> : (
                        <>
                          <Ionicons name="checkmark-circle" size={18} color="#FFF" style={{marginRight: 6}} />
                          <Text style={styles.approveSubmitText}>Approve {approveQty} Units</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            )})}

            {/* 2. LOW STOCK */}
            {filters.lowStock && alerts.lowStock.map((item, index) => (
              <View key={`low_${index}`} style={[styles.alertCard, { borderLeftColor: COLORS.danger }]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.alertIconBg, { backgroundColor: COLORS.danger + '15' }]}>
                    <Ionicons name="trending-down" size={20} color={COLORS.danger} />
                  </View>
                  <View style={styles.alertContent}>
                    <Text style={styles.alertTitle}>Low Stock: {item.itemName || item[1]}</Text>
                    <Text style={styles.alertDesc}>Only {item.openingStock || item[7]} units remaining (Min: {item.minStock || item[8]}).</Text>
                  </View>
                </View>
              </View>
            ))}

            {/* 3. OVERDUE RETURNS */}
            {filters.returns && alerts.pendingReturns.map((item, index) => (
              <View key={`ret_${index}`} style={[styles.alertCard, { borderLeftColor: COLORS.warning }]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.alertIconBg, { backgroundColor: COLORS.warning + '15' }]}>
                    <Ionicons name="time-outline" size={20} color={COLORS.warning} />
                  </View>
                  <View style={styles.alertContent}>
                    <Text style={styles.alertTitle}>Overdue: {item.item}</Text>
                    <Text style={styles.alertDesc}>Issued to {item.issuedTo}. Overdue by {item.overdueDays} days.</Text>
                  </View>
                </View>
              </View>
            ))}

            {/* Empty States */}
            {((!filters.requests && !filters.lowStock && !filters.returns) || 
              (alerts.lowStock.length === 0 && alerts.pendingReturns.length === 0 && alerts.requests.length === 0)) && (
              <View style={styles.emptyContainer}>
                <Ionicons name="checkmark-done-circle-outline" size={60} color={COLORS.border} />
                <Text style={styles.emptyTitle}>All Caught Up!</Text>
                <Text style={styles.emptySub}>No alerts match your current filters.</Text>
              </View>
            )}
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { padding: 20, paddingBottom: 10 },
  headerTitle: { color: COLORS.text, fontSize: 30, fontWeight: '800' },
  headerSub: { color: COLORS.textMuted, fontSize: 14, marginTop: 4 },
  scrollContent: { padding: 16 },

  // Preferences
  preferencesCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 16 },
  prefIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: COLORS.inputBg, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  prefTextContainer: { flex: 1 },
  prefTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700', marginBottom: 2 },
  prefSub: { color: COLORS.textMuted, fontSize: 12 },

  // Filters
  filterRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipText: { color: COLORS.textMuted, fontSize: 13, fontWeight: '600' },
  filterChipTextActive: { color: '#FFF' },

  // Alert Cards
  alertsList: { gap: 12 },
  alertCard: { backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, borderLeftWidth: 4, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  alertIconBg: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  alertContent: { flex: 1 },
  alertTitle: { color: COLORS.text, fontSize: 15, fontWeight: '700', marginBottom: 4 },
  alertDesc: { color: COLORS.textMuted, fontSize: 13, lineHeight: 18 },

  // Expanded Negotiation Section
  expandedSection: { padding: 16, paddingTop: 0, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.card },
  expandLabel: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginTop: 12, marginBottom: 8 },
  stepperContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.inputBg, borderRadius: 12, alignSelf: 'flex-start', borderWidth: 1, borderColor: COLORS.border },
  stepperBtn: { padding: 12, paddingHorizontal: 16 },
  stepperValue: { color: COLORS.text, fontSize: 18, fontWeight: 'bold', minWidth: 30, textAlign: 'center' },
  remarksInput: { backgroundColor: COLORS.inputBg, color: COLORS.text, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, fontSize: 14, marginBottom: 16 },
  approveSubmitBtn: { flexDirection: 'row', backgroundColor: COLORS.success, padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  approveSubmitText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },

  // Empty State
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 50 },
  emptyTitle: { color: COLORS.text, fontSize: 18, fontWeight: '700', marginTop: 16, marginBottom: 6 },
  emptySub: { color: COLORS.textMuted, fontSize: 14, textAlign: 'center' }
});