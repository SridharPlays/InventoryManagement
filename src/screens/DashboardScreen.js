import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import {
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { fetchFromGAS, postToGAS } from '../services/api';
import { StorageService } from '../services/storage';
import { useInventory } from '../hooks/useInventory';
import { HapticHelper } from '../utils/haptics';
import { UniversalAlert } from '../utils/UniversalAlert';

export default function DashboardScreen() {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const navigation = useNavigation();
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isLowStockModalVisible, setLowStockModalVisible] = useState(false);
  const [isItemIssuedModalVisible, setItemIssuedModalVisible] = useState(false);

  const [isReturnModalVisible, setReturnModalVisible] = useState(false);
  const [selectedReturnItem, setSelectedReturnItem] = useState(null);
  const [returnQty, setReturnQty] = useState(1);
  const [returnReason, setReturnReason] = useState('');

  const [isReturnedListModalVisible, setReturnedListModalVisible] = useState(false);
  const [isDiscardedListModalVisible, setDiscardedListModalVisible] = useState(false);

  // Hook Initialization
  const { inventory, loadInventory } = useInventory();

  const openReturnModal = (item) => {
    setSelectedReturnItem(item);
    setReturnQty(item.qty || 1);
    setReturnReason('');
    setReturnModalVisible(true);
    setItemIssuedModalVisible(false); // Close the other modal if open
  };

  const processReturnItem = async () => {
    if (returnQty < selectedReturnItem.qty && !returnReason.trim()) {
      HapticHelper.error();
      UniversalAlert.alert("Reason Required", `You are keeping ${selectedReturnItem.qty - returnQty} items. Please provide a reason.`);
      return;
    }

    try {
      setRefreshing(true);
      setReturnModalVisible(false);

      const response = await postToGAS('markReturned', {
        data: {
          rowNumber: selectedReturnItem.id,
          returnQty: returnQty,
          reason: returnReason.trim()
        }
      });

      if (response.success) {
        HapticHelper.success();
        UniversalAlert.alert("Success", response.message);
        await StorageService.removeCachedData('getDashboard');
        loadData(true);
      } else {
        HapticHelper.error();
        UniversalAlert.alert("Error", response.message || "Failed to process return.");
        setRefreshing(false);
      }
    } catch (error) {
      console.error("Error returning:", error);
      HapticHelper.error();
      UniversalAlert.alert("Error", "Network error occurred.");
      setRefreshing(false);
    }
  };

  const parseLowStockData = (lowStockArray) => {
    if (!lowStockArray || !Array.isArray(lowStockArray)) return [];
    return lowStockArray.map(item => {
      if (!Array.isArray(item)) return item;
      return {
        id: item[0],
        name: item[1],
        category: item[2],
        unit: item[3],
        location: `${item[4] || ''} ${item[6] ? `- ${item[6]}` : ''}`.trim(),
        current: parseInt(item[7]) || 0,
        min: parseInt(item[8]) || 0,
      };
    });
  };

  const loadData = useCallback(async (forceRefresh = false) => {
    setRefreshing(true);
    try {
      let dashboardData = null;
      if (!forceRefresh) {
        dashboardData = await StorageService.getCachedData('getDashboard');
      }
      if (forceRefresh || !dashboardData) {
        dashboardData = await fetchFromGAS('getDashboard');
      }
      if (dashboardData) {
        setData({
          ...dashboardData,
          lowStock: parseLowStockData(dashboardData.lowStock)
        });
      }
    } catch (error) {
      console.error("Dashboard Data Error:", error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData(false);
      loadInventory();
    }, [loadData, loadInventory])
  );

  // LOW STOCK LOGIC
  const handleLongPressLowStock = (item) => {
    HapticHelper.lightImpact();
    UniversalAlert.alert(
      "Ignore Low Stock?",
      `Do you want to ignore future low stock alerts for ${item.name}?`,
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes",
          style: "destructive",
          onPress: () => {
            ignoreLowStockAlert(item)
          }
        }
      ]
    );
  };

  const ignoreLowStockAlert = async (lowStockItem) => {
    try {
      setRefreshing(true);
      // Use hook inventory or fallback to local storage
      const currentInv = inventory?.length ? inventory : await StorageService.getCachedData('getInventory') || [];
      const fullItem = currentInv.find(invItem => invItem.itemId === lowStockItem.id);

      if (!fullItem) {
        HapticHelper.error();
        UniversalAlert.alert("Error", "Could not find full item details. Try refreshing the app first.");
        setRefreshing(false);
        return;
      }

      const updatedItem = { ...fullItem, ignoreLowStock: 'Yes' };
      const response = await postToGAS('updateItem', { itemData: updatedItem });

      if (response.success) {
        HapticHelper.success();
        UniversalAlert.alert("Success", `${lowStockItem.name} will no longer trigger alerts.`);
        await StorageService.removeCachedData('getInventory');
        loadInventory(true); // Refresh background cache
        loadData(true);
      } else {
        HapticHelper.error();
        UniversalAlert.alert("Error", response.message || "Failed to update item.");
        setRefreshing(false);
      }
    } catch (error) {
      console.error("Error ignoring low stock:", error);
      HapticHelper.error();
      UniversalAlert.alert("Error", "An unexpected network error occurred.");
      setRefreshing(false);
    }
  };

  // MARK AS RETURNED LOGIC
  const handleMarkReturned = (item) => {
    UniversalAlert.alert(
      "Confirm Return",
      `Are you sure you want to mark ${item.item} as returned?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Mark Returned",
          style: "default",
          onPress: () => processMarkReturned(item)
        }
      ]
    );
  };

  const processMarkReturned = async (item) => {
    if (!item.id) {
      HapticHelper.error();
      UniversalAlert.alert("Error", "Missing item ID. Ensure backend sends 'id' in getDashboard.");
      return;
    }

    try {
      setRefreshing(true);
      const response = await postToGAS('markReturned', { rowNumber: item.id });

      if (response.success) {
        HapticHelper.success();
        UniversalAlert.alert("Success", `${item.item} has been marked as returned.`);
        await StorageService.removeCachedData('getDashboard'); // Clear cache
        loadData(true); // Refresh dashboard to remove the item from the list
      } else {
        HapticHelper.error();
        UniversalAlert.alert("Error", response.message || "Failed to mark as returned.");
        setRefreshing(false);
      }
    } catch (error) {
      console.error("Error marking as returned:", error);
      HapticHelper.error();
      UniversalAlert.alert("Error", "An unexpected network error occurred.");
      setRefreshing(false);
    }
  };

  const handleMarkDiscarded = (item) => {
    UniversalAlert.alert(
      "Discard Item",
      `Are you sure you want to discard ${item.item}? This clears it from the list without returning stock.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Discard",
          style: "destructive",
          onPress: () => processMarkDiscarded(item)
        }
      ]
    );
  };

  const processMarkDiscarded = async (item) => {
    if (!item.id) return;
    try {
      setRefreshing(true);
      const response = await postToGAS('markDiscarded', { rowNumber: item.id });

      if (response.success) {
        HapticHelper.success();
        UniversalAlert.alert("Discarded", `${item.item} has been discarded.`);
        await StorageService.removeCachedData('getDashboard');
        loadData(true);
      } else {
        HapticHelper.error();
        UniversalAlert.alert("Error", response.message || "Failed to discard.");
        setRefreshing(false);
      }
    } catch (error) {
      console.error("Error discarding:", error);
      HapticHelper.error();
      UniversalAlert.alert("Error", "Network error.");
      setRefreshing(false);
    }
  };

  // REUSABLE COMPONENTS
  const ActionButton = ({ icon, label, onPress, color }) => (
    <TouchableOpacity
      style={[styles.actionButton, { backgroundColor: color + '15' }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.actionIconCircle, { backgroundColor: color }]}>
        <Ionicons name={icon} size={24} color="#fff" />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );

  const SummaryCard = ({ title, value, onPress, highlightColor }) => (
    <TouchableOpacity
      style={[
        styles.summaryCard,
        highlightColor ? { borderWidth: 1, borderColor: highlightColor + '40' } : null
      ]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.summaryTitle}>{title}</Text>
      <Text style={[styles.summaryValue, highlightColor ? { color: highlightColor } : null]}>
        {value || 0}
      </Text>
      {onPress && (
        <View style={styles.tapIndicator}>
          <Text style={{ color: highlightColor, fontSize: 10, fontWeight: 'bold' }}>TAP TO VIEW</Text>
          <Ionicons name="chevron-forward" size={12} color={highlightColor} />
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { paddingBottom: 0 }]} edges={['top', 'left', 'right']}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={theme.primary} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Dashboard</Text>
        </View>

        {/* QUICK ACTIONS ROW */}
        <View style={styles.quickActionsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickActionsScroll}>
            <ActionButton
              icon="arrow-down-circle"
              label="Stock In"
              color="#10B981"
              onPress={() => navigation.navigate('StockIn')}
            />
            <ActionButton
              icon="arrow-up-circle"
              label="Issue"
              color="#F59E0B"
              onPress={() => navigation.navigate('Issue')}
            />
            <ActionButton
              icon="swap-horizontal"
              label="Relocate"
              color="#3B82F6"
              onPress={() => navigation.navigate('Relocate')}
            />
            <ActionButton
              icon="scan"
              label="Audit"
              color="#8B5CF6"
              onPress={() => navigation.navigate('Scan')}
            />
          </ScrollView>
        </View>

        {data && (
          <View style={styles.content}>
            {/* Summary Grid */}
            <View style={styles.gridRow}>
              <SummaryCard
                onPress={() => navigation.navigate('Inventory')}
                title="Total Items"
                value={data.summary?.totalItems}
                highlightColor={theme.primary}
              />
              <SummaryCard title="Items Issued" value={data.summary?.itemsIssued} highlightColor={'rgba(255, 81, 0, 0.68)'} onPress={() => setItemIssuedModalVisible(true)} />
            </View>
            <View style={styles.gridRow}>
              <SummaryCard title="Pending Returns" value={data.summary?.pendingReturns} highlightColor={theme.warning} />
              <SummaryCard title="Total Returned" value={data.summary?.totalReturned} highlightColor={theme.success || '#10B981'} onPress={() => setReturnedListModalVisible(true)} />
            </View>
            <View style={styles.gridRow}>
              <SummaryCard
                title="Total Discarded"
                value={data.summary?.totalDiscarded}
                highlightColor={'#ff0055'}
                onPress={() => setDiscardedListModalVisible(true)}
              />
              <SummaryCard
                title="Low Stock"
                value={data.summary?.lowStock}
                highlightColor={data.summary?.lowStock > 0 ? (theme.danger || '#F59E0B') : null}
                onPress={() => setLowStockModalVisible(true)}
              />
            </View>

            {/* Pending Returns Section */}
            <Text style={styles.sectionTitle}>Pending Returns</Text>
            {data.pendingReturns?.length ? data.pendingReturns.map((item, i) => {
              const isOverdue = item.overdueDays > 0 && item.isReturnable;
              const statusColor = isOverdue ? (theme.danger || '#EF4444') : (theme.success || '#10B981');

              return (
                <View key={i} style={styles.listCard}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <Text style={styles.cardTitle}>{item.item}</Text>
                      {item.isUrgent && (
                        <View style={{ backgroundColor: '#F59E0B20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="flash" size={12} color="#F59E0B" />
                          <Text style={{ fontSize: 10, color: '#F59E0B', fontWeight: 'bold', marginLeft: 2 }}>URGENT</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.cardSub}>Issued to: {item.issuedTo}</Text>
                    <Text style={styles.cardSub}>Due: {item.dueDate}</Text>
                  </View>

                  <View style={styles.actionColumn}>
                    {item.isReturnable ? (
                      <>
                        <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                          <Text style={[styles.statusText, { color: statusColor }]}>
                            {isOverdue ? `+${item.overdueDays} Days Overdue` : 'Due Soon'}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.returnButton}
                          onPress={() => openReturnModal(item)}
                        >
                          <Text style={styles.returnButtonText}>Process Return</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <View style={[styles.statusBadge, { backgroundColor: theme.textMuted + '20' }]}>
                          <Text style={[styles.statusText, { color: theme.textMuted }]}>
                            Non-Returnable
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={[styles.returnButton, { backgroundColor: theme.danger || '#EF4444', flexDirection: 'row', alignItems: 'center', gap: 4 }]}
                          onPress={() => handleMarkDiscarded(item)}
                        >
                          <Ionicons name="trash" size={14} color="#FFF" />
                          <Text style={styles.returnButtonText}>Discard ({item.qty})</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>
              );
            }) : (
              <Text style={styles.emptyText}>All items returned. ✅</Text>
            )}

            <View style={{ height: 40 }} />
          </View>
        )}
      </ScrollView>

      {/* LOW STOCK MODAL */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isLowStockModalVisible}
        onRequestClose={() => setLowStockModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Low Stock Alerts</Text>
              <TouchableOpacity onPress={() => setLowStockModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalHint}>Long press an item to ignore its alert</Text>

            <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
              {data?.lowStock?.length ? data.lowStock.map((item, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.listCard}
                  activeOpacity={0.7}
                  onLongPress={() => handleLongPressLowStock(item)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{item.name}</Text>
                    <Text style={styles.cardSub}>{item.location || 'Location Not Set'}</Text>
                  </View>
                  <View style={styles.warningBadge}>
                    <Ionicons name="warning" size={16} color={theme.warning || '#F59E0B'} />
                    <Text style={styles.warningText}>{item.current} / {item.min}</Text>
                  </View>
                </TouchableOpacity>
              )) : (
                <Text style={styles.emptyText}>Inventory levels look good. 👍</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* PARTIAL RETURN MODAL */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isReturnModalVisible}
        onRequestClose={() => setReturnModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { paddingBottom: 40, maxHeight: '90%' }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Process Return</Text>
                <TouchableOpacity onPress={() => setReturnModalVisible(false)}>
                  <Ionicons name="close" size={24} color={theme.text} />
                </TouchableOpacity>
              </View>

              {selectedReturnItem && (
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ paddingBottom: 20 }}
                >
                  <Text style={styles.cardTitle}>{selectedReturnItem.item}</Text>
                  <Text style={[styles.cardSub, { marginBottom: 16 }]}>Total Issued: {selectedReturnItem.qty}</Text>

                  <Text style={{ color: theme.textMuted, fontSize: 13, marginBottom: 8, fontWeight: 'bold' }}>QUANTITY TO RETURN</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.inputBg, borderRadius: 12, alignSelf: 'flex-start', borderWidth: 1, borderColor: theme.border, marginBottom: 20 }}>
                    <TouchableOpacity
                      style={{ padding: 12, paddingHorizontal: 16 }}
                      onPress={() => setReturnQty(Math.max(1, returnQty - 1))}
                    >
                      <Ionicons name="remove" size={20} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={{ color: theme.text, fontSize: 18, fontWeight: 'bold', minWidth: 40, textAlign: 'center' }}>{returnQty}</Text>
                    <TouchableOpacity
                      style={{ padding: 12, paddingHorizontal: 16 }}
                      onPress={() => setReturnQty(Math.min(selectedReturnItem.qty, returnQty + 1))}
                    >
                      <Ionicons name="add" size={20} color={theme.text} />
                    </TouchableOpacity>
                  </View>

                  <Text style={{ color: theme.textMuted, fontSize: 13, marginBottom: 8, fontWeight: 'bold' }}>
                    REMARKS / REASON {returnQty < selectedReturnItem.qty ? '(REQUIRED)' : '(OPTIONAL)'}
                  </Text>
                  <TextInput
                    style={{ backgroundColor: theme.inputBg, color: theme.text, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.border, fontSize: 14, marginBottom: 20, minHeight: 80, textAlignVertical: 'top' }}
                    placeholder={returnQty < selectedReturnItem.qty ? "Why are you keeping the remaining items?" : "Add a note..."}
                    placeholderTextColor={theme.textMuted}
                    multiline={true}
                    value={returnReason}
                    onChangeText={setReturnReason}
                  />

                  <TouchableOpacity
                    style={{ backgroundColor: theme.primary, padding: 16, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}
                    onPress={processReturnItem}
                  >
                    <Ionicons name="checkmark-circle" size={20} color="#FFF" style={{ marginRight: 8 }} />
                    <Text style={{ color: '#FFF', fontSize: 16, fontWeight: 'bold' }}>
                      {returnQty === selectedReturnItem.qty ? "Return All" : `Return ${returnQty} & Log Reason`}
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* RETURNED ITEMS LOG MODAL */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isReturnedListModalVisible}
        onRequestClose={() => setReturnedListModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Returned History</Text>
              <TouchableOpacity onPress={() => setReturnedListModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
              {data?.returnedItems?.length ? data.returnedItems.map((item, i) => (
                <View key={`ret-log-${i}`} style={styles.listCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{item.item}</Text>
                    <Text style={styles.cardSub}>Issued To: {item.issuedTo} | Qty: {item.qty}</Text>
                    <Text style={styles.cardSub}>Date Logged: {item.date}</Text>
                    {item.remarks ? (
                      <Text style={[styles.cardSub, { fontStyle: 'italic', marginTop: 4, color: theme.text }]}>
                        {item.remarks}
                      </Text>
                    ) : null}
                  </View>
                </View>
              )) : (
                <Text style={styles.emptyText}>No items have been returned yet.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* DISCARDED ITEMS LOG MODAL */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isDiscardedListModalVisible}
        onRequestClose={() => setDiscardedListModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Discarded History</Text>
              <TouchableOpacity onPress={() => setDiscardedListModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
              {data?.discardedItems?.length ? data.discardedItems.map((item, i) => (
                <View key={`disc-log-${i}`} style={styles.listCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{item.item}</Text>
                    <Text style={styles.cardSub}>Issued To: {item.issuedTo} | Qty: {item.qty}</Text>
                    <Text style={styles.cardSub}>Date Logged: {item.date}</Text>
                    {item.remarks ? (
                      <Text style={[styles.cardSub, { fontStyle: 'italic', marginTop: 4, color: theme.text }]}>
                        {item.remarks}
                      </Text>
                    ) : null}
                  </View>
                </View>
              )) : (
                <Text style={styles.emptyText}>No items have been discarded yet.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ITEMS ISSUED MODAL */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isItemIssuedModalVisible}
        onRequestClose={() => setItemIssuedModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Items Issued</Text>
              <TouchableOpacity onPress={() => setItemIssuedModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
              {data?.pendingReturns?.length ? data.pendingReturns.map((item, i) => {
                const isOverdue = item.overdueDays > 0;
                const statusColor = isOverdue ? (theme.danger || '#EF4444') : (theme.success || '#10B981');

                return (
                  <View key={`issued-${i}`} style={styles.listCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{item.item}</Text>
                      <Text style={styles.cardSub}>Issued to: {item.issuedTo}</Text>
                      <Text style={styles.cardSub}>Due: {item.dueDate}</Text>
                    </View>
                    <View style={styles.actionColumn}>
                      <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                        <Text style={[styles.statusText, { color: statusColor }]}>
                          {isOverdue ? `+${item.overdueDays} Days Overdue` : 'Due Soon'}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.returnButton}
                        onPress={() => {
                          setItemIssuedModalVisible(false);
                          handleMarkReturned(item);
                        }}
                      >
                        <Text style={styles.returnButtonText}>Mark Returned</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }) : (
                <Text style={styles.emptyText}>No items currently issued. ✅</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

    </SafeAreaView >
  );
}

const getStyles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  headerTitle: { color: theme.text, fontSize: 24, fontWeight: 'bold' },

  // Quick Actions Styles
  quickActionsContainer: { marginBottom: 20 },
  quickActionsScroll: { paddingHorizontal: 16, gap: 12 },
  actionButton: { padding: 12, borderRadius: 16, alignItems: 'center', width: 85, height: 95, justifyContent: 'center' },
  actionIconCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  actionLabel: { color: theme.text, fontSize: 12, fontWeight: '600', textAlign: 'center' },

  content: { paddingHorizontal: 16 },
  gridRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  summaryCard: { flex: 1, backgroundColor: theme.card, padding: 16, borderRadius: 16, justifyContent: 'center' },
  summaryTitle: { color: theme.textMuted, fontSize: 13, marginBottom: 8 },
  summaryValue: { color: theme.text, fontSize: 28, fontWeight: 'bold' },
  tapIndicator: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 2 },

  sectionTitle: { color: theme.text, fontSize: 18, fontWeight: '600', marginTop: 8, marginBottom: 12 },
  listCard: { flexDirection: 'row', backgroundColor: theme.card, padding: 16, borderRadius: 12, marginBottom: 12, alignItems: 'center' },
  cardTitle: { color: theme.text, fontWeight: '600', marginBottom: 4 },
  cardSub: { color: theme.textMuted, fontSize: 12, marginBottom: 2 },

  warningBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: (theme.warning || '#F59E0B') + '20', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  warningText: { color: theme.warning || '#F59E0B', fontWeight: 'bold' },

  actionColumn: { alignItems: 'flex-end', gap: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  statusText: { fontWeight: 'bold', fontSize: 12 },
  returnButton: { backgroundColor: theme.primary || '#3B82F6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  returnButtonText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },

  emptyText: { color: theme.textMuted, textAlign: 'center', marginVertical: 20 },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: theme.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: theme.card },
  modalTitle: { color: theme.text, fontSize: 20, fontWeight: 'bold' },
  modalHint: { color: theme.textMuted, fontSize: 12, marginBottom: 16, textAlign: 'center', fontStyle: 'italic' },
});