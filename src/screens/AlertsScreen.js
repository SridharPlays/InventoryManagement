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
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { fetchFromGAS, postToGAS } from '../services/api';
import { StorageService } from '../services/storage';
import { HapticHelper } from '../utils/haptics';

export default function AlertsScreen({ navigation }) {
  const { theme } = useTheme();
  const styles = getStyles(theme);

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
      HapticHelper.lightImpact();
    } finally {
      setIsUpdatingPrefs(false);
    }
  };

  const handleExpandRequest = (req) => {
    if (expandedReq === req.row) {
      setExpandedReq(null);
    } else {
      HapticHelper.lightImpact();
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
        HapticHelper.success();
        setExpandedReq(null);
        onRefresh();
      } else {
        Alert.alert("Error", response.message);
        HapticHelper.error();
      }
    } catch (e) {
      Alert.alert("Error", "Network error.");
      HapticHelper.error();
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
        HapticHelper.success();
        setExpandedReq(null);
        onRefresh();
      } else {
        Alert.alert("Error", response.message);
        HapticHelper.error();
      }
    } catch (e) {
      Alert.alert("Error", "Network error.");
      HapticHelper.error();
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
    <SafeAreaView style={[styles.container, { paddingBottom: 0 }]} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Alerts Center</Text>
        <Text style={styles.headerSub}>Manage notifications and approvals</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
      >
        {/* Settings */}
        <View style={styles.preferencesCard}>
          <View style={styles.prefIconBox}>
            <MaterialCommunityIcons name="email-outline" size={24} color={theme.primary} />
          </View>
          <View style={styles.prefTextContainer}>
            <Text style={styles.prefTitle}>Email Notifications</Text>
            <Text style={styles.prefSub}>Get alerts for low stock and requests</Text>
          </View>
          {isUpdatingPrefs ? <ActivityIndicator size="small" color={theme.primary} /> : (
            <Switch
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor={"#FFF"}
              ios_backgroundColor={theme.border}
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
          <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
        ) : (
          <View style={styles.alertsList}>

            {/* 1. REQUESTS ALWAYS ON TOP (Grouped into Single Box per Person) */}
            {filters.requests && Object.entries(groupedRequests).map(([person, items], groupIndex) => (
              <View key={`req_group_${groupIndex}`} style={[styles.groupedCard, { borderTopColor: theme.primary, borderTopWidth: 4 }]}>

                {/* Person Header */}
                <View style={styles.groupedCardHeader}>
                  <View style={[styles.alertIconBg, { backgroundColor: theme.primary + '15', width: 32, height: 32, marginRight: 10 }]}>
                    <Ionicons name="person-outline" size={16} color={theme.primary} />
                  </View>
                  <View>
                    <Text style={styles.groupedCardTitle}>{person}</Text>
                    <Text style={styles.groupedCardSub}>{items.length} Pending Request{items.length > 1 ? 's' : ''}</Text>
                  </View>
                </View>

                {/* Person's Items */}
                {items.map((item, index) => {
                  const isLast = index === items.length - 1;
                  return (
                    <View key={`ret_${index}`} style={[styles.itemRow, isLast && { borderBottomWidth: 0 }]}>
                      <View style={styles.alertContent}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <Text style={styles.alertTitle}>{item.item}</Text>
                          {item.isUrgent && (
                            <View style={{ backgroundColor: '#F59E0B20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, flexDirection: 'row', alignItems: 'center' }}>
                              <Ionicons name="flash" size={12} color="#F59E0B" />
                              <Text style={{ fontSize: 10, color: '#F59E0B', fontWeight: 'bold', marginLeft: 2 }}>URGENT</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.alertDesc}>
                          {item.isReturnable
                            ? `Overdue by ${item.overdueDays} days.`
                            : 'Pending Discard / Resolution.'}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ))}

            {/* 2. LOW STOCK */}
            {filters.lowStock && alerts.lowStock.map((item, index) => (
              <View key={`low_${index}`} style={[styles.alertCard, { borderLeftColor: theme.danger, borderLeftWidth: 4 }]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.alertIconBg, { backgroundColor: theme.danger + '15' }]}>
                    <Ionicons name="trending-down" size={20} color={theme.danger} />
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
              <View key={`ret_group_${groupIndex}`} style={[styles.groupedCard, { borderTopColor: theme.warning, borderTopWidth: 4 }]}>

                <View style={styles.groupedCardHeader}>
                  <View style={[styles.alertIconBg, { backgroundColor: theme.warning + '15', width: 32, height: 32, marginRight: 10 }]}>
                    <Ionicons name="person-outline" size={16} color={theme.warning} />
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
                  <Ionicons name="checkmark-done-circle-outline" size={60} color={theme.border} />
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

const getStyles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { padding: 20, paddingBottom: 10 },
  headerTitle: { color: theme.text, fontSize: 30, fontWeight: '800' },
  headerSub: { color: theme.textMuted, fontSize: 14, marginTop: 4 },
  scrollContent: { padding: 16 },

  // Preferences
  preferencesCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: theme.border, marginBottom: 16 },
  prefIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: theme.inputBg, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  prefTextContainer: { flex: 1 },
  prefTitle: { color: theme.text, fontSize: 16, fontWeight: '700', marginBottom: 2 },
  prefSub: { color: theme.textMuted, fontSize: 12 },

  // Filters
  filterRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border },
  filterChipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  filterChipText: { color: theme.textMuted, fontSize: 13, fontWeight: '600' },
  filterChipTextActive: { color: '#FFF' },

  alertsList: { gap: 16 },

  // Single Items (e.g. Low Stock)
  alertCard: { backgroundColor: theme.card, borderRadius: 16, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  alertIconBg: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 14 },

  // Grouped Box Containers
  groupedCard: { backgroundColor: theme.card, borderRadius: 16, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' },
  groupedCardHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: theme.inputBg, borderBottomWidth: 1, borderBottomColor: theme.border },
  groupedCardTitle: { color: theme.text, fontSize: 16, fontWeight: '700' },
  groupedCardSub: { color: theme.textMuted, fontSize: 12, marginTop: 2 },

  // Inner Rows for Grouped Items
  itemRow: { padding: 16, borderBottomWidth: 1, borderBottomColor: theme.border },
  itemRowHeader: { flexDirection: 'row', alignItems: 'center' },

  // Content Text inside rows/cards
  alertContent: { flex: 1 },
  alertTitle: { color: theme.text, fontSize: 15, fontWeight: '700', marginBottom: 4 },
  alertDesc: { color: theme.textMuted, fontSize: 13, lineHeight: 18 },

  // Expanded Negotiation Section
  expandedSectionInner: { paddingTop: 16, marginTop: 16, borderTopWidth: 1, borderTopColor: theme.border },
  expandLabel: { color: theme.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 },
  stepperContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.inputBg, borderRadius: 12, alignSelf: 'flex-start', borderWidth: 1, borderColor: theme.border, marginBottom: 12 },
  stepperBtn: { padding: 12, paddingHorizontal: 16 },
  stepperValue: { color: theme.text, fontSize: 18, fontWeight: 'bold', minWidth: 30, textAlign: 'center' },
  remarksInput: { backgroundColor: theme.inputBg, color: theme.text, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.border, fontSize: 14, marginBottom: 16 },

  // Action Buttons
  actionButtonsRow: { flexDirection: 'row', gap: 12 },
  actionBtn: { flex: 1, flexDirection: 'row', padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  approveBtn: { backgroundColor: theme.success },
  declineBtn: { backgroundColor: theme.danger },
  actionBtnText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },

  // Empty State
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 50 },
  emptyTitle: { color: theme.text, fontSize: 18, fontWeight: '700', marginTop: 16, marginBottom: 6 },
  emptySub: { color: theme.textMuted, fontSize: 14, textAlign: 'center' }
});