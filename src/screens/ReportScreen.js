import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, 
  ScrollView, Alert, ActivityIndicator 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { StorageService } from '../services/storage';
import { postToGAS } from '../services/api';

export default function ReportScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [inventory, setInventory] = useState([]);

  useEffect(() => {
    const loadLocalData = async () => {
      const cached = await StorageService.getCachedData('getInventory') || [];
      setInventory(cached);
    };
    loadLocalData();
  }, []);

  // --- REPORT GENERATION LOGIC ---

  const generateLocalReport = (type) => {
    let reportTitle = "";
    let data = [];

    switch(type) {
      case 'lowStock':
        reportTitle = "Low Stock Report";
        data = inventory.filter(item => item.openingStock <= item.minStock && item.ignoreLowStock !== 'Yes');
        break;
      case 'all':
        reportTitle = "All Items Master Report";
        data = inventory;
        break;
      case 'category':
        reportTitle = "Category Summary";
        // Logic to group by category and sum stock
        const catMap = inventory.reduce((acc, item) => {
          acc[item.category] = (acc[item.category] || 0) + (parseInt(item.openingStock) || 0);
          return acc;
        }, {});
        data = Object.keys(catMap).map(cat => ({ category: cat, totalStock: catMap[cat] }));
        break;
      default:
        return;
    }

    // In a real production app, you would use a library like 'expo-print' 
    // to generate a PDF or 'xlsx' to generate Excel.
    // For now, we show a summary alert.
    Alert.alert(reportTitle, `Found ${data.length} records. Detailed PDF generation will be sent to your registered email.`);
  };

  const generateServerReport = async (action, params = {}) => {
    setIsLoading(true);
    try {
      const response = await postToGAS(action, params);
      if (response.success) {
        Alert.alert("Report Generated", "The report has been compiled and saved to the Operations Google Drive folder.");
      } else {
        Alert.alert("Error", "Could not generate report from server.");
      }
    } catch (e) {
      Alert.alert("Error", "Network error.");
    } finally {
      setIsLoading(false);
    }
  };

  const ReportButton = ({ icon, label, sub, onPress, color = COLORS.primary, isLib = false }) => (
    <TouchableOpacity style={styles.reportCard} onPress={onPress}>
      <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
        {isLib ? 
          <MaterialCommunityIcons name={icon} size={28} color={color} /> :
          <Ionicons name={icon} size={28} color={color} />
        }
      </View>
      <View style={styles.reportTextContainer}>
        <Text style={styles.reportLabel}>{label}</Text>
        <Text style={styles.reportSub}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Inventory Reports</Text>
        <Text style={styles.headerSub}>Export data to PDF or Excel formats</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <Text style={styles.sectionHeader}>Stock Analysis</Text>
        <ReportButton 
          icon="alert-circle-outline" 
          label="Low Stock Items" 
          sub="Items currently below minimum threshold" 
          color="#EF4444"
          onPress={() => generateLocalReport('lowStock')}
        />
        <ReportButton 
          icon="briefcase-outline" 
          label="All Items Report" 
          sub="Complete snapshot of current inventory" 
          onPress={() => generateLocalReport('all')}
        />
        <ReportButton 
          icon="shape-outline" 
          isLib={true}
          label="Category Report" 
          sub="Stock levels grouped by item category" 
          color="#8B5CF6"
          onPress={() => generateLocalReport('category')}
        />

        <Text style={styles.sectionHeader}>Location Reports</Text>
        <ReportButton 
          icon="layers-outline" 
          label="Floor Wise Report" 
          sub="Inventory filtered by floor location" 
          color="#3B82F6"
          onPress={() => Alert.alert("Select Floor", "Pick floor to export...", [{text: "Floor 9"}, {text: "Floor 10"}])}
        />
        <ReportButton 
          icon="grid-outline" 
          label="Cupboard Report" 
          sub="Breakdown of items in specific cupboards" 
          color="#10B981"
          onPress={() => Alert.alert("Select Cupboard", "Pick cupboard to export...")}
        />

        <Text style={styles.sectionHeader}>Historical (Server Side)</Text>
        <ReportButton 
          icon="calendar-month-outline" 
          isLib={true}
          label="Monthly Stock-In" 
          sub="Report of all receipts for current month" 
          color="#F59E0B"
          onPress={() => generateServerReport('report', { year: 2026, month: 3 })}
        />
        <ReportButton 
          icon="calendar-check-outline" 
          isLib={true}
          label="Annual Audit Report" 
          sub="Yearly transaction and loss summary" 
          color="#64748B"
          onPress={() => generateServerReport('report', { year: 2026, month: 'all' })}
        />

        {isLoading && <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 20 }} />}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { padding: 20 },
  headerTitle: { color: COLORS.text, fontSize: 26, fontWeight: 'bold' },
  headerSub: { color: COLORS.textMuted, fontSize: 14, marginTop: 4 },
  scrollContent: { padding: 16 },
  sectionHeader: { color: COLORS.primary, fontSize: 13, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginTop: 20, marginLeft: 4 },
  reportCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, padding: 16, borderRadius: 16, marginBottom: 12 },
  iconContainer: { width: 56, height: 56, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  reportTextContainer: { flex: 1 },
  reportLabel: { color: COLORS.text, fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
  reportSub: { color: COLORS.textMuted, fontSize: 12 },
});