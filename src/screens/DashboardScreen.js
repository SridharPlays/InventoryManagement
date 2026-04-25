import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { fetchFromGAS, postToGAS } from '../services/api';
import { StorageService } from '../services/storage';
import { HapticHelper } from '../utils/haptics';

export default function DashboardScreen() {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const navigation = useNavigation();
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isLowStockModalVisible, setLowStockModalVisible] = useState(false);
  const [isItemIssuedModalVisible, setItemIssuedModalVisible] = useState(false);

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

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  // LOW STOCK LOGIC
  const handleLongPressLowStock = (item) => {
    Alert.alert(
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
      const inventory = await StorageService.getCachedData('getInventory') || [];
      const fullItem = inventory.find(invItem => invItem.itemId === lowStockItem.id);

      if (!fullItem) {
        Alert.alert("Error", "Could not find full item details. Try refreshing the app first.");
        HapticHelper.error();
        setRefreshing(false);
        return;
      }

      const updatedItem = { ...fullItem, ignoreLowStock: 'Yes' };
      const response = await postToGAS('updateItem', { itemData: updatedItem });

      if (response.success) {
        Alert.alert("Success", `${lowStockItem.name} will no longer trigger alerts.`);
        HapticHelper.success();
        await StorageService.removeCachedData('getInventory');
        loadData(true);
      } else {
        Alert.alert("Error", response.message || "Failed to update item.");
        HapticHelper.error();
        setRefreshing(false);
      }
    } catch (error) {
      console.error("Error ignoring low stock:", error);
      Alert.alert("Error", "An unexpected network error occurred.");
      setRefreshing(false);
    }
  };

  // NEW: MARK AS RETURNED LOGIC
  const handleMarkReturned = (item) => {
    Alert.alert(
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
      Alert.alert("Error", "Missing item ID. Ensure backend sends 'id' in getDashboard.");
      HapticHelper.error();
      return;
    }

    try {
      setRefreshing(true);
      const response = await postToGAS('markReturned', { rowNumber: item.id });

      if (response.success) {
        Alert.alert("Success", `${item.item} has been marked as returned.`);
        HapticHelper.success();
        await StorageService.removeCachedData('getDashboard'); // Clear cache
        loadData(true); // Refresh dashboard to remove the item from the list
      } else {
        Alert.alert("Error", response.message || "Failed to mark as returned.");
        HapticHelper.error();
        setRefreshing(false);
      }
    } catch (error) {
      console.error("Error marking as returned:", error);
      Alert.alert("Error", "An unexpected network error occurred.");
      HapticHelper.error();
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
    <SafeAreaView style={[styles.container, { paddingBottom: 0}]} edges={['top', 'left', 'right']}>
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
              <SummaryCard title="Items Issued" value={data.summary?.itemsIssued} highlightColor={theme.primary} onPress={() => setItemIssuedModalVisible(true)} />
            </View>
            <View style={styles.gridRow}>
              <SummaryCard title="Pending Returns" value={data.summary?.pendingReturns} highlightColor={theme.warning} />
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
              console.log(item);
              const isOverdue = item.overdueDays > 0;
              const statusColor = isOverdue ? (theme.danger || '#EF4444') : (theme.success || '#10B981');
              return (
                <View key={i} style={styles.listCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{item.item}</Text>
                    <Text style={styles.cardSub}>Issued to: {item.issuedTo}</Text>
                    <Text style={styles.cardSub}>Due: {item.dueDate}</Text>
                  </View>

                  {/* UPDATE: Added column layout for badge + button */}
                  <View style={styles.actionColumn}>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                      <Text style={[styles.statusText, { color: statusColor }]}>
                        {isOverdue ? `+${item.overdueDays} Days Overdue` : 'Due Soon'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.returnButton}
                      onPress={() => handleMarkReturned(item)}
                    >
                      <Text style={styles.returnButtonText}>Mark Returned</Text>
                    </TouchableOpacity>
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
                  onLongPress={() => {
                    HapticHelper.lightImpact();
                    handleLongPressLowStock(item)}
                  }
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

    </SafeAreaView>
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