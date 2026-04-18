import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { fetchFromGAS } from '../services/api';
import { StorageService } from '../services/storage';

export default function DashboardScreen() {
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Helper to convert the array-based lowStock into objects
  const parseLowStockData = (lowStockArray) => {
    if (!lowStockArray || !Array.isArray(lowStockArray)) return [];

    return lowStockArray.map(item => {
      // If the backend already sends objects, return as is
      if (!Array.isArray(item)) return item;

      // Parsing your array structure:
      return {
        id: item[0],
        name: item[1],
        category: item[2],
        unit: item[3],
        // Combine Floor (item[4]) and Cupboard (item[6]) for the location
        location: `${item[4] || ''} ${item[6] ? `- ${item[6]}` : ''}`.trim(),
        // Assuming index 7 is current stock and index 8 is min stock threshold
        current: parseInt(item[7]) || 0,
        min: parseInt(item[8]) || 0, 
      };
    });
  };

  const loadData = useCallback(async (forceRefresh = false) => {
    setRefreshing(true);
    
    try {
      let dashboardData = null;

      // 1. Try fetching from LocalStorage first if it's NOT a forced refresh
      if (!forceRefresh) {
        dashboardData = await StorageService.getCachedData('getDashboard');
      }

      // 2. If nothing is in LocalStorage OR user pulled to refresh -> Fetch from API
      if (forceRefresh || !dashboardData) {
        dashboardData = await fetchFromGAS('getDashboard');
        // Note: fetchFromGAS already caches the successful response under the hood
      }

      // 3. Set the state with formatted data
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

  // Initial Load
  useEffect(() => { 
    loadData(false); // false = check local storage first
  }, [loadData]);

  // UI Component for Summary Cards
  const SummaryCard = ({ title, value }) => (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryTitle}>{title}</Text>
      <Text style={styles.summaryValue}>{value || 0}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={() => loadData(true)} // true = force API fetch
            tintColor={COLORS.primary} 
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Dashboard</Text>
        </View>

        {data && (
          <View style={styles.content}>
            {/* Summary Grid */}
            <View style={styles.gridRow}>
              <SummaryCard title="Total Items" value={data.summary?.totalItems} />
              <SummaryCard title="Items Issued" value={data.summary?.itemsIssued} />
            </View>
            <View style={styles.gridRow}>
              <SummaryCard title="Pending Returns" value={data.summary?.pendingReturns} />
              <SummaryCard title="Low Stock" value={data.summary?.lowStock} />
            </View>

            {/* Low Stock Alerts */}
            <Text style={styles.sectionTitle}>Low Stock Alerts</Text>
            {data.lowStock?.length ? data.lowStock.map((item, i) => (
              <View key={i} style={styles.listCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  <Text style={styles.cardSub}>{item.location || 'Location Not Set'}</Text>
                </View>
                <View style={styles.warningBadge}>
                  <Ionicons name="warning" size={16} color={COLORS.warning || '#F59E0B'} />
                  <Text style={styles.warningText}>{item.current} / {item.min}</Text>
                </View>
              </View>
            )) : (
              <Text style={styles.emptyText}>Inventory levels look good. 👍</Text>
            )}

            {/* Pending Returns */}
            <Text style={styles.sectionTitle}>Pending Returns</Text>
            {data.pendingReturns?.length ? data.pendingReturns.map((item, i) => {
              const isOverdue = item.overdueDays > 0;
              const statusColor = isOverdue ? (COLORS.danger || '#EF4444') : (COLORS.success || '#10B981');
              return (
                <View key={i} style={styles.listCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{item.item}</Text>
                    <Text style={styles.cardSub}>Issued to: {item.issuedTo}</Text>
                    <Text style={styles.cardSub}>Due: {item.dueDate}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                    <Text style={[styles.statusText, { color: statusColor }]}>
                      {isOverdue ? `+${item.overdueDays} Days Overdue` : 'Due Soon'}
                    </Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { padding: 20 },
  headerTitle: { color: COLORS.text, fontSize: 24, fontWeight: 'bold' },
  content: { paddingHorizontal: 16 },
  gridRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  summaryCard: { flex: 1, backgroundColor: COLORS.card, padding: 16, borderRadius: 16 },
  summaryTitle: { color: COLORS.textMuted, fontSize: 13, marginBottom: 8 },
  summaryValue: { color: COLORS.text, fontSize: 28, fontWeight: 'bold' },
  sectionTitle: { color: COLORS.text, fontSize: 18, fontWeight: '600', marginTop: 16, marginBottom: 12 },
  listCard: { flexDirection: 'row', backgroundColor: COLORS.card, padding: 16, borderRadius: 12, marginBottom: 12, alignItems: 'center' },
  cardTitle: { color: COLORS.text, fontWeight: '600', marginBottom: 4 },
  cardSub: { color: COLORS.textMuted, fontSize: 12, marginBottom: 2 },
  warningBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: (COLORS.warning || '#F59E0B') + '20', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  warningText: { color: COLORS.warning || '#F59E0B', fontWeight: 'bold' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  statusText: { fontWeight: 'bold', fontSize: 12 },
  emptyText: { color: COLORS.textMuted, textAlign: 'center', marginVertical: 20 },
});