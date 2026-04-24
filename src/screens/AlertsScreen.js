import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/theme';
import { fetchFromGAS, postToGAS } from '../services/api';
import { StorageService } from '../services/storage';

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
  const [isDeclining, setIsDeclining] = useState(false);

  const loadAlertsData = async () => {
    try {
      const sessionData = await StorageService.getSession();
      if (sessionData) {
        const parsed = typeof sessionData === 'string' ? JSON.parse(sessionData) : sessionData;
        if (parsed.email) setUserEmail(parsed.email);
        
        if (parsed.emailPreference !== undefined) {
          setEmailAlertsEnabled(parsed.emailPreference === true || String(parsed.emailPreference).toLowerCase() === 'true');
        }
      }

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

  const handleExpandRequest = (req) => {
    if (expandedReq === req.row) {
      setExpandedReq(null);
    } else {
      setExpandedReq(req.row);
      setApproveQty(parseInt(req.qty) || 0);
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

  const submitDecline = async (rowNumber) => {
    setIsDeclining(true);
    try {
      const response = await postToGAS('declineRequest', { 
        rowNumber: rowNumber,
        remarks: remarks
      });

      if (response.success) {
        Alert.alert("Declined", "The request has been declined.");
        setExpandedReq(null);
        onRefresh();
      } else {
        Alert.alert("Error", response.message);
      }
    } catch (e) {
      Alert.alert("Error", "Network error.");
    } finally {
      setIsDeclining(false);
    }
  };

  const FilterChip = ({ label, active, type }) => (
    <TouchableOpacity 
      style={[styles.filterChip, active && styles.filterChipActive]}
      onPress={() => setFilters(prev => ({ ...prev, [type]: !prev[type] }))}
    >
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  // Group requests by person
  const groupedRequests = alerts.requests.reduce((groups, item) => {
    const person = item.tl || 'Unknown Person';
    if (!groups[person]) groups[person] = [];
    groups[person].push(item);
    return groups;
  }, {});

  // Group returns by person
  const groupedReturns = alerts.pendingReturns.reduce((groups, item) => {
    const person = item.issuedTo || 'Unknown Person';
    if (!groups[person]) groups[person] = [];
    groups[person].push(item);
    return groups;
  }, {});

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
            
            {/* 1. REQUESTS ALWAYS ON TOP (Grouped into Single Box per Person) */}
            {filters.requests && Object.entries(groupedRequests).map(([person, items], groupIndex) => (
              <View key={`req_group_${groupIndex}`} style={[styles.groupedCard, { borderTopColor: COLORS.primary, borderTopWidth: 4 }]}>
                
                {/* Person Header */}
                <View style={styles.groupedCardHeader}>
                  <View style={[styles.alertIconBg, { backgroundColor: COLORS.primary + '15', width: 32, height: 32, marginRight: 10 }]}>
                    <Ionicons name="person-outline" size={16} color={COLORS.primary} />
                  </View>
                  <View>
                    <Text style={styles.groupedCardTitle}>{person}</Text>
                    <Text style={styles.groupedCardSub}>{items.length} Pending Request{items.length > 1 ? 's' : ''}</Text>
                  </View>
                </View>
                
                {/* Person's Items */}
                {items.map((item, index) => {
                  const isExpanded = expandedReq === item.row;
                  const isLast = index === items.length - 1;
                  
                  return (
                    <View key={`req_${item.row}`} style={[styles.itemRow, isLast && { borderBottomWidth: 0 }]}>
                      <TouchableOpacity 
                        activeOpacity={0.7}
                        onPress={() => handleExpandRequest(item)}
                        style={styles.itemRowHeader}
                      >
                        <View style={styles.alertContent}>
                          <Text style={styles.alertTitle}>{item.itemName}</Text>
                          <Text style={styles.alertDesc}>Needs {item.qty} units ({item.date})</Text>
                        </View>
                        <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color={COLORS.textMuted} />
                      </TouchableOpacity>

                      {/* Interactive Expandable Section */}
                      {isExpanded && (
                        <View style={styles.expandedSectionInner}>
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

                          {/* Action Buttons Row */}
                          <View style={styles.actionButtonsRow}>
                            <TouchableOpacity 
                              style={[styles.actionBtn, styles.declineBtn]} 
                              onPress={() => submitDecline(item.row)}
                              disabled={isDeclining || isApproving}
                            >
                              {isDeclining ? <ActivityIndicator color="#FFF" /> : (
                                <>
                                  <Ionicons name="close-circle" size={18} color="#FFF" style={{marginRight: 6}} />
                                  <Text style={styles.actionBtnText}>Decline</Text>
                                </>
                              )}
                            </TouchableOpacity>

                            <TouchableOpacity 
                              style={[styles.actionBtn, styles.approveBtn]} 
                              onPress={() => submitApproval(item.row)}
                              disabled={isApproving || isDeclining}
                            >
                              {isApproving ? <ActivityIndicator color="#FFF" /> : (
                                <>
                                  <Ionicons name="checkmark-circle" size={18} color="#FFF" style={{marginRight: 6}} />
                                  <Text style={styles.actionBtnText}>Approve {approveQty}</Text>
                                </>
                              )}
                            </TouchableOpacity>
                          </View>

                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            ))}

            {/* 2. LOW STOCK */}
            {filters.lowStock && alerts.lowStock.map((item, index) => (
              <View key={`low_${index}`} style={[styles.alertCard, { borderLeftColor: COLORS.danger, borderLeftWidth: 4 }]}>
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
            {filters.returns && Object.entries(groupedReturns).map(([person, items], groupIndex) => (
              <View key={`ret_group_${groupIndex}`} style={[styles.groupedCard, { borderTopColor: COLORS.warning, borderTopWidth: 4 }]}>
                
                <View style={styles.groupedCardHeader}>
                  <View style={[styles.alertIconBg, { backgroundColor: COLORS.warning + '15', width: 32, height: 32, marginRight: 10 }]}>
                    <Ionicons name="person-outline" size={16} color={COLORS.warning} />
                  </View>
                  <View>
                    <Text style={styles.groupedCardTitle}>{person}</Text>
                    <Text style={styles.groupedCardSub}>{items.length} Overdue Return{items.length > 1 ? 's' : ''}</Text>
                  </View>
                </View>
                
                {items.map((item, index) => {
                  const isLast = index === items.length - 1;
                  return (
                    <View key={`ret_${index}`} style={[styles.itemRow, isLast && { borderBottomWidth: 0 }]}>
                      <View style={styles.alertContent}>
                        <Text style={styles.alertTitle}>{item.item}</Text>
                        <Text style={styles.alertDesc}>Overdue by {item.overdueDays} days.</Text>
                      </View>
                    </View>
                  );
                })}
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

  alertsList: { gap: 16 },

  // Single Items (e.g. Low Stock)
  alertCard: { backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  alertIconBg: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  
  // Grouped Box Containers
  groupedCard: { backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  groupedCardHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: COLORS.inputBg, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  groupedCardTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  groupedCardSub: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  
  // Inner Rows for Grouped Items
  itemRow: { padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  itemRowHeader: { flexDirection: 'row', alignItems: 'center' },

  // Content Text inside rows/cards
  alertContent: { flex: 1 },
  alertTitle: { color: COLORS.text, fontSize: 15, fontWeight: '700', marginBottom: 4 },
  alertDesc: { color: COLORS.textMuted, fontSize: 13, lineHeight: 18 },

  // Expanded Negotiation Section
  expandedSectionInner: { paddingTop: 16, marginTop: 16, borderTopWidth: 1, borderTopColor: COLORS.border },
  expandLabel: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 },
  stepperContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.inputBg, borderRadius: 12, alignSelf: 'flex-start', borderWidth: 1, borderColor: COLORS.border, marginBottom: 12 },
  stepperBtn: { padding: 12, paddingHorizontal: 16 },
  stepperValue: { color: COLORS.text, fontSize: 18, fontWeight: 'bold', minWidth: 30, textAlign: 'center' },
  remarksInput: { backgroundColor: COLORS.inputBg, color: COLORS.text, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, fontSize: 14, marginBottom: 16 },
  
  // Action Buttons
  actionButtonsRow: { flexDirection: 'row', gap: 12 },
  actionBtn: { flex: 1, flexDirection: 'row', padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  approveBtn: { backgroundColor: COLORS.success },
  declineBtn: { backgroundColor: COLORS.danger },
  actionBtnText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },

  // Empty State
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 50 },
  emptyTitle: { color: COLORS.text, fontSize: 18, fontWeight: '700', marginTop: 16, marginBottom: 6 },
  emptySub: { color: COLORS.textMuted, fontSize: 14, textAlign: 'center' }
});