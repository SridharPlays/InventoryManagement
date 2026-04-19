import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, 
  ScrollView, Alert, ActivityIndicator, Modal, FlatList 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { StorageService } from '../services/storage';
import { postToGAS } from '../services/api';

import { MONTHS, YEARS } from '../constants/time';

// --- MOCK DATA FOR DROPDOWNS ---
const FLOORS = ['9th Floor', '10th Floor'];
const CUPBOARDS = ['5', 'Cupboard B', 'Cupboard C', 'Cupboard D'];

export default function ReportScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [inventory, setInventory] = useState([]);
  const [userEmail, setUserEmail] = useState("");

  // --- PREVIEW MODAL STATES (For generated data) ---
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [currentReportData, setCurrentReportData] = useState([]);
  const [currentReportTitle, setCurrentReportTitle] = useState("");

  // --- CONFIGURATION SCREEN STATES (For human input) ---
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [activeConfigType, setActiveConfigType] = useState(null); // 'floor', 'cupboard', 'monthly', 'annual'
  
  // Input Selections
  const [selectedFloor, setSelectedFloor] = useState(null);
  const [selectedCupboard, setSelectedCupboard] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  useEffect(() => {
    const loadInitData = async () => {
      const cachedInv = await StorageService.getCachedData('getInventory') || [];
      setInventory(cachedInv);

      const userSession = await StorageService.getSession();
      if (userSession) {
        try {
          const parsed = JSON.parse(userSession);
          if (parsed && parsed.email) setUserEmail(parsed.email);
        } catch (e) {
          if (userSession.email) setUserEmail(userSession.email);
        }
      }
    };
    loadInitData();
  }, []);

  // --- DIRECT GENERATION (No input needed) ---
  const generateDirectLocalReport = (type) => {
    let reportTitle = "";
    let data = [];

    switch(type) {
      case 'lowStock':
        reportTitle = "Low Stock Report";
        data = inventory.filter(item => item.openingStock <= item.minStock && item.ignoreLowStock !== 'Yes' && item.status !== 'Inactive');
        break;
      case 'all':
        reportTitle = "All Items Master Report";
        data = inventory;
        break;
      case 'category':
        reportTitle = "Category Summary Report";
        const catMap = inventory.reduce((acc, item) => {
          acc[item.category] = (acc[item.category] || 0) + (parseInt(item.openingStock) || 0);
          return acc;
        }, {});
        data = Object.keys(catMap).map(cat => ({ Category_Name: cat || "Uncategorized", Total_Stock: catMap[cat] }));
        break;
      default: return;
    }

    if (data.length === 0) {
      Alert.alert("No Data", "There is no data matching this report criteria right now.");
      return;
    }

    setCurrentReportTitle(reportTitle);
    setCurrentReportData(data);
    setReportModalVisible(true);
  };

  // --- OPEN CONFIGURATION SCREEN ---
  const openConfigScreen = (type) => {
    setActiveConfigType(type);
    
    // Reset selections on open
    setSelectedFloor(null);
    setSelectedCupboard(null);
    setSelectedYear(new Date().getFullYear());
    setSelectedMonth(new Date().getMonth() + 1);
    
    setConfigModalVisible(true);
  };

  // --- EXECUTE REPORT FROM CONFIG SCREEN ---
  const handleGenerateConfiguredReport = async () => {
    setConfigModalVisible(false); // Close config screen

    if (activeConfigType === 'floor') {
      if (!selectedFloor) return Alert.alert("Missing Input", "Please select a floor.");
      
      const data = inventory.filter(item => item.location && item.location.includes(selectedFloor));
      if (data.length === 0) return Alert.alert("No Data", `No items found on ${selectedFloor}.`);
      
      setCurrentReportTitle(`${selectedFloor} Report`);
      setCurrentReportData(data);
      setReportModalVisible(true);

    } 
    else if (activeConfigType === 'cupboard') {
      if (!selectedFloor || !selectedCupboard) return Alert.alert("Missing Input", "Please select both a floor and a cupboard.");
      
      // Assuming 'location' field stores data like "Floor 9 - Cupboard A"
      const data = inventory.filter(item => item.location && item.location.includes(selectedFloor) && item.location.includes(selectedCupboard));
      if (data.length === 0) return Alert.alert("No Data", `No items found in ${selectedCupboard} on ${selectedFloor}.`);
      
      setCurrentReportTitle(`${selectedFloor} - ${selectedCupboard} Report`);
      setCurrentReportData(data);
      setReportModalVisible(true);
    }
    else if (activeConfigType === 'monthly') {
      if (!selectedYear || !selectedMonth) return Alert.alert("Missing Input", "Select Year and Month.");
      generateServerReport('getMonthlyStockInReport', { year: selectedYear, month: selectedMonth });
    }
    else if (activeConfigType === 'annual') {
      if (!selectedYear) return Alert.alert("Missing Input", "Select a Year.");
      generateServerReport('report', { year: selectedYear, month: 'all' });
    }
  };

  // --- SERVER REPORT EXECUTION ---
  const generateServerReport = async (action, params = {}) => {
    setIsLoading(true);
    try {
      const response = await postToGAS(action, params);
      
      // If fetching a preview to display:
      if (action === 'getMonthlyStockInReport') {
        if (response.success && response.data && response.data.length > 0) {
          setCurrentReportTitle(`Monthly Stock-In (${params.month}/${params.year})`);
          setCurrentReportData(response.data);
          setReportModalVisible(true);
        } else {
           Alert.alert("No Data", "No stock-in records found for this period.");
        }
      } 
      // If just triggering background generation:
      else {
        if (response.success) {
          Alert.alert("Report Generated", "The report has been compiled and saved to the Operations Google Drive folder.");
        } else {
          Alert.alert("Error", "Could not generate report from server.");
        }
      }
    } catch (e) {
      Alert.alert("Error", "Network error.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- EMAIL DELIVERY ---
  const handleEmailReport = async (format) => {
    if (!userEmail) {
      Alert.alert("Email Missing", "Could not find your email address in the session. Please re-login.");
      return;
    }
    setIsLoading(true);
    try {
      const response = await postToGAS('emailReport', { 
        format: format, 
        title: currentReportTitle,
        data: currentReportData,
        emailTo: userEmail
      });
      if (response.success) {
        Alert.alert("Success", `Your ${format.toUpperCase()} report was sent successfully.`);
        setReportModalVisible(false); 
      } else {
        Alert.alert("Error", response.message || "Failed to send report.");
      }
    } catch (e) {
      Alert.alert("Error", "Network error while sending report.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- UI COMPONENTS ---
  const ReportButton = ({ icon, label, sub, color = COLORS.primary, onPress, isLib = false }) => (
    <TouchableOpacity style={styles.reportCard} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.iconContainer, { backgroundColor: color + '15' }]}>
        {isLib ? 
          <MaterialCommunityIcons name={icon} size={28} color={color} /> :
          <Ionicons name={icon} size={28} color={color} />
        }
      </View>
      <View style={styles.reportTextContainer}>
        <Text style={styles.reportLabel}>{label}</Text>
        <Text style={styles.reportSub}>{sub}</Text>
      </View>
      <View style={styles.actionChevron}>
        <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
      </View>
    </TouchableOpacity>
  );

  const renderDataRow = ({ item, index }) => {
    const keys = Object.keys(item);
    const primaryTitle = item.itemName || item.Item_Name || item.Category_Name || `Record #${index + 1}`;
    
    return (
      <View style={styles.dataRowCard}>
        <View style={styles.dataRowHeader}>
          <Text style={styles.dataRowIndex}>#{index + 1}</Text>
          <Text style={styles.dataRowPrimary}>{primaryTitle}</Text>
        </View>
        <View style={styles.dataRowContent}>
          {keys.map(key => {
            if (key === 'Item_Name' || key === 'itemName' || key === 'Category_Name') return null; 
            return (
              <View key={key} style={styles.dataCell}>
                <Text style={styles.dataLabel}>{key.replace(/_/g, ' ')}</Text>
                <Text style={styles.dataValue} numberOfLines={1}>{String(item[key])}</Text>
              </View>
            )
          })}
        </View>
      </View>
    );
  };

  // HELPER: Renders mock dropdowns as horizontal pills
  const renderPillSelector = (options, selectedValue, onSelect, isObject = false) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillContainer}>
      {options.map((opt, idx) => {
        const label = isObject ? opt.label : opt;
        const value = isObject ? opt.val : opt;
        const isSelected = selectedValue === value;
        
        return (
          <TouchableOpacity 
            key={idx} 
            style={[styles.pill, isSelected && styles.pillSelected]} 
            onPress={() => onSelect(value)}
          >
            <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* MAIN SCREEN HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Inventory Reports</Text>
        <Text style={styles.headerSub}>Export data to PDF or Excel formats</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* --- STOCK ANALYSIS --- */}
        <Text style={styles.sectionHeader}>Stock Analysis</Text>
        <ReportButton 
          icon="alert-circle-outline" label="Low Stock Items" sub="Items currently below minimum threshold" color="#EF4444"
          onPress={() => generateDirectLocalReport('lowStock')}
        />
        <ReportButton 
          icon="briefcase-outline" label="All Items Report" sub="Complete snapshot of current inventory" 
          onPress={() => generateDirectLocalReport('all')}
        />
        <ReportButton 
          icon="shape-outline" isLib={true} label="Category Report" sub="Stock levels grouped by item category" color="#8B5CF6"
          onPress={() => generateDirectLocalReport('category')}
        />

        {/* --- LOCATION REPORTS (Require Input) --- */}
        <Text style={styles.sectionHeader}>Location Reports</Text>
        <ReportButton 
          icon="layers-outline" label="Floor Wise Report" sub="Inventory filtered by floor location" color="#3B82F6"
          onPress={() => openConfigScreen('floor')}
        />
        <ReportButton 
          icon="grid-outline" label="Cupboard Report" sub="Breakdown of items in specific cupboards" color="#10B981"
          onPress={() => openConfigScreen('cupboard')}
        />

        {/* --- HISTORICAL SERVER SIDE (Require Input) --- */}
        <Text style={styles.sectionHeader}>Historical (Server Side)</Text>
        <ReportButton 
          icon="calendar-month-outline" isLib={true} label="Monthly Stock-In" sub="Report of all receipts for specific month" color="#F59E0B"
          onPress={() => openConfigScreen('monthly')}
        />
        <ReportButton 
          icon="calendar-check-outline" isLib={true} label="Annual Audit Report" sub="Yearly transaction and loss summary" color="#64748B"
          onPress={() => openConfigScreen('annual')}
        />

        {isLoading && <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 20 }} />}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ========================================== */}
      {/* --- CONFIGURATION SCREEN MODAL (NEW) --- */}
      {/* ========================================== */}
      <Modal visible={configModalVisible} animationType="slide" transparent={true}>
        <View style={styles.configModalOverlay}>
          <View style={styles.configModalContainer}>
            <View style={styles.configHeader}>
              <Text style={styles.configTitle}>Configure Report</Text>
              <TouchableOpacity onPress={() => setConfigModalVisible(false)} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.configBody}>
              
              {/* Floor Dropdown (Needed for 'floor' and 'cupboard') */}
              {(activeConfigType === 'floor' || activeConfigType === 'cupboard') && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Select Floor</Text>
                  {renderPillSelector(FLOORS, selectedFloor, setSelectedFloor)}
                </View>
              )}

              {/* Cupboard Dropdown (Needed for 'cupboard' only) */}
              {activeConfigType === 'cupboard' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Select Cupboard</Text>
                  {renderPillSelector(CUPBOARDS, selectedCupboard, setSelectedCupboard)}
                </View>
              )}

              {/* Year Dropdown (Needed for 'monthly' and 'annual') */}
              {(activeConfigType === 'monthly' || activeConfigType === 'annual') && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Select Year</Text>
                  {renderPillSelector(YEARS, selectedYear, setSelectedYear)}
                </View>
              )}

              {/* Month Dropdown (Needed for 'monthly' only) */}
              {activeConfigType === 'monthly' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Select Month</Text>
                  {renderPillSelector(MONTHS, selectedMonth, setSelectedMonth, true)}
                </View>
              )}

            </View>

            <View style={styles.configFooter}>
              <TouchableOpacity style={styles.generateActionBtn} onPress={handleGenerateConfiguredReport}>
                <Text style={styles.generateActionText}>Generate Report</Text>
                <Ionicons name="arrow-forward" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================== */}
      {/* --- PREVIEW AND EXPORT MODAL --- */}
      {/* ========================================== */}
      <Modal visible={reportModalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>{currentReportTitle}</Text>
              <Text style={styles.recordCount}>{currentReportData.length} Records Generated</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={() => setReportModalVisible(false)}>
              <Ionicons name="close" size={24} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={currentReportData}
            keyExtractor={(item, index) => index.toString()}
            renderItem={renderDataRow}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />

          <View style={styles.exportPanel}>
            {isLoading ? (
              <ActivityIndicator size="large" color={COLORS.primary} style={{ marginVertical: 14 }} />
            ) : (
              <View style={styles.actionRow}>
                <TouchableOpacity style={[styles.exportBtn, { backgroundColor: COLORS.danger }]} onPress={() => handleEmailReport('pdf')}>
                  <MaterialCommunityIcons name="file-pdf-box" size={22} color="#FFF" />
                  <Text style={styles.exportBtnText}>Send as PDF</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.exportBtn, { backgroundColor: COLORS.success }]} onPress={() => handleEmailReport('excel')}>
                  <MaterialCommunityIcons name="file-excel-box" size={22} color="#FFF" />
                  <Text style={styles.exportBtnText}>Send as Excel</Text>
                </TouchableOpacity>
              </View>
            )}
            <Text style={styles.exportFooterText}>Report will be emailed to {userEmail}</Text>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { padding: 20, paddingBottom: 10 },
  headerTitle: { color: COLORS.text, fontSize: 26, fontWeight: 'bold' },
  headerSub: { color: COLORS.textMuted, fontSize: 14, marginTop: 4 },
  scrollContent: { padding: 16 },
  
  sectionHeader: { color: COLORS.primary, fontSize: 13, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginTop: 20, marginLeft: 4 },
  
  // Old Report Button Styles
  reportCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  iconContainer: { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  reportTextContainer: { flex: 1 },
  reportLabel: { color: COLORS.text, fontSize: 16, fontWeight: '700', marginBottom: 2 },
  reportSub: { color: COLORS.textMuted, fontSize: 12, lineHeight: 18, paddingRight: 10 },
  actionChevron: { backgroundColor: COLORS.inputBg, padding: 6, borderRadius: 10 },

  // Configuration Modal Styles (The "New Screen" for inputs)
  configModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  configModalContainer: { backgroundColor: COLORS.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, minHeight: '50%' },
  configHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  configTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.text },
  configBody: { padding: 20 },
  inputGroup: { marginBottom: 24 },
  inputLabel: { color: COLORS.text, fontSize: 14, fontWeight: '700', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  
  // Mock Dropdown Pills
  pillContainer: { gap: 10, paddingRight: 20 },
  pill: { backgroundColor: COLORS.inputBg, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, marginRight: 10 },
  pillSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pillText: { color: COLORS.text, fontSize: 16, fontWeight: '500' },
  pillTextSelected: { color: '#FFF', fontWeight: 'bold' },

  configFooter: { padding: 20, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.card },
  generateActionBtn: { backgroundColor: COLORS.primary, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 16, borderRadius: 14, gap: 8 },
  generateActionText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },

  // Preview Modal Styles
  modalContainer: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 25, backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  recordCount: { fontSize: 14, color: COLORS.textMuted, fontWeight: '600', marginTop: 4 },
  closeButton: { backgroundColor: COLORS.inputBg, padding: 8, borderRadius: 20 },
  listContent: { padding: 16, paddingBottom: 40 },
  
  dataRowCard: { backgroundColor: COLORS.card, borderRadius: 16, marginBottom: 16, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
  dataRowHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.inputBg, padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  dataRowIndex: { fontSize: 14, fontWeight: 'bold', color: COLORS.primary, width: 35 },
  dataRowPrimary: { fontSize: 16, fontWeight: '700', color: COLORS.text, flex: 1 },
  dataRowContent: { flexDirection: 'row', flexWrap: 'wrap', padding: 12 },
  dataCell: { width: '50%', paddingVertical: 6, paddingRight: 8 },
  dataLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', marginBottom: 2 },
  dataValue: { fontSize: 14, color: COLORS.text, fontWeight: '500' },

  exportPanel: { padding: 20, paddingBottom: 40, backgroundColor: COLORS.card, borderTopWidth: 1, borderTopColor: COLORS.border },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  exportBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12, gap: 8 },
  exportBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  exportFooterText: { textAlign: 'center', color: COLORS.textMuted, fontSize: 12, marginTop: 16, fontWeight: '500' }
});