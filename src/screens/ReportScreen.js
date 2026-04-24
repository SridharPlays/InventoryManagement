import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../constants/theme';
import { postToGAS } from '../services/api';
import { StorageService } from '../services/storage';
import { useInventory } from '../hooks/useInventory';
import { UniversalAlert } from '../utils/UniversalAlert';
import BottomSheetModal from '../components/BottomSheetModal';
import { MONTHS, YEARS } from '../constants/time';
import { useTheme } from '../context/ThemeContext';

export default function ReportScreen() {
  const { inventory, loadInventory } = useInventory();
  const [isLoading, setIsLoading] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  const { theme } = useTheme();
  const styles = getStyles(theme);

  // PREVIEW MODAL STATES
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [currentReportData, setCurrentReportData] = useState([]);
  const [currentReportTitle, setCurrentReportTitle] = useState("");

  // INVOICE IMAGE MODAL STATES
  const [invoicePreviewVisible, setInvoicePreviewVisible] = useState(false);
  const [currentInvoiceUrl, setCurrentInvoiceUrl] = useState(null);

  // CONFIGURATION SCREEN STATES
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [activeConfigType, setActiveConfigType] = useState(null);

  // Input Selections
  const [selectedFloor, setSelectedFloor] = useState(null);
  const [selectedCupboard, setSelectedCupboard] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  useEffect(() => {
    loadInventory();
    const loadSession = async () => {
      const userSession = await StorageService.getSession();
      if (userSession) {
        try {
          const parsed = typeof userSession === 'string' ? JSON.parse(userSession) : userSession;
          if (parsed && parsed.email) setUserEmail(parsed.email);
        } catch (e) {
          console.error(e);
        }
      }
    };
    loadSession();
  }, [loadInventory]);

  // DATA MEMOIZATION
  const uniqueFloors = useMemo(() => Array.from(new Set(inventory.map(i => i.location).filter(Boolean))).sort(), [inventory]);
  const sortedCupboards = useMemo(() => {
    if (!selectedFloor) return [];
    const cupboards = inventory
      .filter(i => i.location && i.location.includes(selectedFloor))
      .map(i => i.cupboard?.trim())
      .filter(Boolean);
    return Array.from(new Set(cupboards)).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, '')) || 0;
      const numB = parseInt(b.replace(/\D/g, '')) || 0;
      return numA - numB;
    });
  }, [inventory, selectedFloor]);

  const totalQuantity = useMemo(() => {
    return currentReportData.reduce((sum, item) => sum + (parseFloat(item.quantity || item.Quantity || item.qty || item.Total_Stock || item.openingStock || 0) || 0), 0);
  }, [currentReportData]);

  const totalAmount = useMemo(() => {
    return currentReportData.reduce((sum, item) => sum + (parseFloat(item.amount || item.Amount || item.total || item.Total || item.price || item.Price || 0) || 0), 0);
  }, [currentReportData]);

  // REPORT GENERATION LOGIC
  const generateDirectLocalReport = (type) => {
    if (inventory.length === 0) return UniversalAlert.alert("No Data", "Inventory data is not available right now.");
    let reportTitle = "";
    let data = [];

    switch (type) {
      case 'lowStock':
        reportTitle = "Low Stock Report";
        data = inventory.filter(item => item.status === 'Active' && item.openingStock <= item.minStock && item.ignoreLowStock?.trim().toLowerCase() !== 'yes');
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

    if (data.length === 0) return UniversalAlert.alert("No Data", "There is no data matching this report criteria right now.");
    setCurrentReportTitle(reportTitle);
    setCurrentReportData(data);
    setReportModalVisible(true);
  };

  const openConfigScreen = (type) => {
    setActiveConfigType(type);
    setSelectedFloor(null);
    setSelectedCupboard(null);
    setSelectedYear(new Date().getFullYear());
    setSelectedMonth(new Date().getMonth() + 1);
    setConfigModalVisible(true);
  };

  const handleGenerateConfiguredReport = async () => {
    setConfigModalVisible(false);

    if (activeConfigType === 'floor') {
      if (!selectedFloor) return UniversalAlert.alert("Missing Input", "Please select a floor.");
      const data = inventory.filter(item => item.location && item.location.includes(selectedFloor));
      if (data.length === 0) return UniversalAlert.alert("No Data", `No items found on ${selectedFloor}.`);

      setCurrentReportTitle(`${selectedFloor} Report`);
      setCurrentReportData(data);
      setReportModalVisible(true);
    }
    else if (activeConfigType === 'cupboard') {
      if (!selectedFloor || !selectedCupboard) return UniversalAlert.alert("Missing Input", "Please select both a floor and a cupboard.");
      const data = inventory.filter(item => item.location && item.location.includes(selectedFloor) && item.cupboard?.includes(selectedCupboard));
      if (data.length === 0) return UniversalAlert.alert("No Data", `No items found in ${selectedCupboard} on ${selectedFloor}.`);

      setCurrentReportTitle(`${selectedFloor} - ${selectedCupboard} Report`);
      setCurrentReportData(data);
      setReportModalVisible(true);
    }
    else if (activeConfigType === 'monthly') {
      if (!selectedYear || !selectedMonth) return UniversalAlert.alert("Missing Input", "Select Year and Month.");
      generateServerReport('report', { year: selectedYear, month: selectedMonth });
    }
    else if (activeConfigType === 'annual') {
      if (!selectedYear) return UniversalAlert.alert("Missing Input", "Select a Year.");
      generateServerReport('report', { year: selectedYear, month: 'all' });
    }
  };

  const generateServerReport = async (action, params = {}) => {
    setIsLoading(true);
    try {
      const response = await postToGAS(action, params);
      if (response.success && response.data && response.data.length > 0) {
        setCurrentReportTitle(params.month === 'all' ? `Annual Report (${params.year})` : `Monthly Stock-In (${params.month}/${params.year})`);
        setCurrentReportData(response.data);
        setReportModalVisible(true);
      } else {
        UniversalAlert.alert("No Data", "No records found for this period.");
      }
    } catch (e) {
      UniversalAlert.alert("Error", "Network error.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailReport = async (format) => {
    if (!userEmail) return UniversalAlert.alert("Email Missing", "Could not find your email address in the session. Please re-login.");
    setIsLoading(true);
    try {
      const response = await postToGAS('emailReport', { format: format, title: currentReportTitle, data: currentReportData, emailTo: userEmail });
      if (response.success) {
        UniversalAlert.alert("Success", `Your ${format.toUpperCase()} report was sent successfully.`);
        setReportModalVisible(false);
      } else {
        UniversalAlert.alert("Error", response.message || "Failed to send report.");
      }
    } catch (e) {
      UniversalAlert.alert("Error", "Network error while sending report.");
    } finally {
      setIsLoading(false);
    }
  };

  const openInvoicePreview = (url) => {
    setReportModalVisible(false);
    setTimeout(() => {
      setCurrentInvoiceUrl(url);
      setInvoicePreviewVisible(true);
    }, 300);
  };

  // REUSABLE UI COMPONENTS
  const ReportButton = ({ icon, label, sub, color = theme.primary, onPress, isLib = false }) => (
    <TouchableOpacity style={styles.reportCard} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.iconContainer, { backgroundColor: color + '15' }]}>
        {isLib ? <MaterialCommunityIcons name={icon} size={28} color={color} /> : <Ionicons name={icon} size={28} color={color} />}
      </View>
      <View style={styles.reportTextContainer}>
        <Text style={styles.reportLabel}>{label}</Text>
        <Text style={styles.reportSub}>{sub}</Text>
      </View>
      <View style={styles.actionChevron}>
        <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
      </View>
    </TouchableOpacity>
  );

  const renderPillSelector = (options, selectedValue, onSelect, isObject = false) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillContainer}>
      {options.map((opt, idx) => {
        const label = isObject ? opt.label : opt;
        const value = isObject ? opt.val : opt;
        const isSelected = selectedValue === value;
        return (
          <TouchableOpacity key={idx} style={[styles.pill, isSelected && styles.pillSelected]} onPress={() => onSelect(value)}>
            <Text style={[styles.pillText, isSelected && styles.pillTextSelected]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  const renderSummaryCards = () => (
    <View style={styles.summaryContainer}>
      <View style={styles.summaryCard}>
        <View style={styles.summaryIconBox}><Ionicons name="cube-outline" size={20} color={theme.primary} /></View>
        <Text style={styles.summaryLabel}>Total Items</Text>
        <Text style={styles.summaryValue}>{currentReportData.length}</Text>
      </View>
      <View style={styles.summaryCard}>
        <View style={[styles.summaryIconBox, { backgroundColor: '#10B98115' }]}><Ionicons name="layers-outline" size={20} color="#10B981" /></View>
        <Text style={styles.summaryLabel}>Total Qty</Text>
        <Text style={styles.summaryValue}>{totalQuantity}</Text>
      </View>
      <View style={styles.summaryCard}>
        <View style={[styles.summaryIconBox, { backgroundColor: '#F59E0B15' }]}><Ionicons name="cash-outline" size={20} color="#F59E0B" /></View>
        <Text style={styles.summaryLabel}>Total Spent</Text>
        <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit>₹{totalAmount.toLocaleString()}</Text>
      </View>
    </View>
  );

  const renderDataRow = ({ item, index }) => {
    const primaryTitle = item.itemName || item.Item_Name || item.Category_Name || `Record #${index + 1}`;
    const keysToShow = ['itemName', 'category', 'location', 'openingStock', 'minStock', 'quantity', 'cupboard', 'rack'];
    const keys = Object.keys(item);
    const filteredKeys = keys.filter(key => keysToShow.includes(key) && item[key]);

    const invoiceUrlKey = keys.find(k => k.toLowerCase().replace(/\s|_/g, '').includes('invoice') || k.toLowerCase().replace(/\s|_/g, '').includes('bill'));
    const invoiceUrl = invoiceUrlKey ? item[invoiceUrlKey] : null;

    return (
      <View style={styles.dataRowCard}>
        <View style={styles.dataRowHeader}>
          <Text style={styles.dataRowIndex}>#{index + 1}</Text>
          <Text style={styles.dataRowPrimary}>{primaryTitle}</Text>
        </View>
        <View style={styles.dataRowContent}>
          {filteredKeys.map(key => {
            if (key === 'Item_Name' || key === 'itemName' || key === 'Category_Name' || key === invoiceUrlKey) return null;
            return (
              <View key={key} style={styles.dataCell}>
                <Text style={styles.dataLabel}>{key.replace(/_/g, ' ')}</Text>
                <Text style={styles.dataValue} numberOfLines={1}>{String(item[key])}</Text>
              </View>
            )
          })}
        </View>

        {invoiceUrl && (
          <View style={styles.invoiceSection}>
            <TouchableOpacity style={styles.invoicePreviewBtn} activeOpacity={0.8} onPress={() => openInvoicePreview(invoiceUrl)}>
              <Image source={{ uri: invoiceUrl }} style={styles.invoiceThumbnail} contentFit="cover" cachePolicy="memory-disk" />
              <View style={styles.invoiceBtnOverlay}>
                <Ionicons name="eye" size={16} color="#FFF" />
                <Text style={styles.invoiceBtnText}>Preview Invoice</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Inventory Reports</Text>
        <Text style={styles.headerSub}>Export data to PDF or Excel formats</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        <Text style={styles.sectionHeader}>Stock Analysis</Text>
        <ReportButton icon="alert-circle-outline" label="Low Stock Items" sub="Items currently below minimum threshold" color="#EF4444" onPress={() => generateDirectLocalReport('lowStock')} />
        <ReportButton icon="briefcase-outline" label="All Items Report" sub="Complete snapshot of current inventory" onPress={() => generateDirectLocalReport('all')} />
        <ReportButton icon="shape-outline" isLib={true} label="Category Report" sub="Stock levels grouped by item category" color="#8B5CF6" onPress={() => generateDirectLocalReport('category')} />

        <Text style={styles.sectionHeader}>Location Reports</Text>
        <ReportButton icon="layers-outline" label="Floor Wise Report" sub="Inventory filtered by floor location" color="#3B82F6" onPress={() => openConfigScreen('floor')} />
        <ReportButton icon="grid-outline" label="Cupboard Report" sub="Breakdown of items in specific cupboards" color="#10B981" onPress={() => openConfigScreen('cupboard')} />

        <Text style={styles.sectionHeader}>Historical (Server Side)</Text>
        <ReportButton icon="calendar-month-outline" isLib={true} label="Monthly Stock-In" sub="Report of all receipts for specific month" color="#F59E0B" onPress={() => openConfigScreen('monthly')} />
        <ReportButton icon="calendar-check-outline" isLib={true} label="Annual Audit Report" sub="Yearly transaction and loss summary" color="#64748B" onPress={() => openConfigScreen('annual')} />

        {isLoading && <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 20 }} />}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* CONFIGURATION MODAL */}
      <BottomSheetModal visible={configModalVisible} onClose={() => setConfigModalVisible(false)} title="Configure Report" isScrollable={true}>
        {(activeConfigType === 'floor' || activeConfigType === 'cupboard') && (
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Select Floor</Text>
            {renderPillSelector(uniqueFloors, selectedFloor, setSelectedFloor)}
          </View>
        )}

        {activeConfigType === 'cupboard' && (
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Select Cupboard</Text>
            {renderPillSelector(sortedCupboards, selectedCupboard, setSelectedCupboard)}
          </View>
        )}

        {(activeConfigType === 'monthly' || activeConfigType === 'annual') && (
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Select Year</Text>
            {renderPillSelector(YEARS, selectedYear, setSelectedYear)}
          </View>
        )}

        {activeConfigType === 'monthly' && (
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Select Month</Text>
            {renderPillSelector(MONTHS, selectedMonth, setSelectedMonth, true)}
          </View>
        )}

        <TouchableOpacity style={styles.generateActionBtn} onPress={handleGenerateConfiguredReport}>
          <Text style={styles.generateActionText}>Generate Report</Text>
          <Ionicons name="arrow-forward" size={20} color="#FFF" />
        </TouchableOpacity>
      </BottomSheetModal>

      {/* PREVIEW AND EXPORT MODAL */}
      <Modal visible={reportModalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>{currentReportTitle}</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={() => setReportModalVisible(false)}>
              <Ionicons name="close" size={24} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={currentReportData}
            keyExtractor={(item, index) => index.toString()}
            ListHeaderComponent={renderSummaryCards}
            renderItem={renderDataRow}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />

          <View style={styles.exportPanel}>
            {isLoading ? (
              <ActivityIndicator size="large" color={theme.primary} style={{ marginVertical: 14 }} />
            ) : (
              <View style={styles.actionRow}>
                <TouchableOpacity style={[styles.exportBtn, { backgroundColor: theme.danger }]} onPress={() => handleEmailReport('pdf')}>
                  <MaterialCommunityIcons name="file-pdf-box" size={22} color="#FFF" />
                  <Text style={styles.exportBtnText}>Send as PDF</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.exportBtn, { backgroundColor: theme.success }]} onPress={() => handleEmailReport('excel')}>
                  <MaterialCommunityIcons name="file-excel-box" size={22} color="#FFF" />
                  <Text style={styles.exportBtnText}>Send Excel</Text>
                </TouchableOpacity>
              </View>
            )}
            <Text style={styles.exportFooterText}>Report will be emailed to {userEmail}</Text>
          </View>
        </View>
      </Modal>

      {/* FULL-SCREEN INVOICE IMAGE MODAL */}
      <Modal visible={invoicePreviewVisible} transparent={true} animationType="fade">
        <View style={styles.imageModalOverlay}>
          <TouchableOpacity
            style={styles.imageModalCloseBtn}
            onPress={() => {
              setInvoicePreviewVisible(false);
              setTimeout(() => setReportModalVisible(true), 300);
            }}
          >
            <Ionicons name="close-circle" size={36} color="#FFF" />
          </TouchableOpacity>

          {currentInvoiceUrl && (
            <Image
              source={{ uri: currentInvoiceUrl }}
              style={styles.fullScreenImage}
              contentFit="contain"
            />
          )}
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const getStyles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { padding: 20, paddingBottom: 10 },
  headerTitle: { color: theme.text, fontSize: 26, fontWeight: 'bold' },
  headerSub: { color: theme.textMuted, fontSize: 14, marginTop: 4 },
  scrollContent: { padding: 16 },

  sectionHeader: { color: theme.primary, fontSize: 13, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginTop: 20, marginLeft: 4 },

  reportCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: theme.border },
  iconContainer: { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  reportTextContainer: { flex: 1 },
  reportLabel: { color: theme.text, fontSize: 16, fontWeight: '700', marginBottom: 2 },
  reportSub: { color: theme.textMuted, fontSize: 12, lineHeight: 18, paddingRight: 10 },
  actionChevron: { backgroundColor: theme.inputBg, padding: 6, borderRadius: 10 },

  inputGroup: { marginBottom: 24 },
  inputLabel: { color: theme.text, fontSize: 14, fontWeight: '700', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },

  pillContainer: { gap: 2, paddingRight: 20 },
  pill: { backgroundColor: theme.inputBg, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, borderWidth: 1, borderColor: theme.border, marginRight: 10 },
  pillSelected: { backgroundColor: theme.primary, borderColor: theme.primary },
  pillText: { color: theme.text, fontSize: 16, fontWeight: '500' },
  pillTextSelected: { color: '#FFF', fontWeight: 'bold' },

  generateActionBtn: { backgroundColor: theme.primary, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 16, borderRadius: 14, gap: 8, marginTop: 10 },
  generateActionText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },

  modalContainer: { flex: 1, backgroundColor: theme.background },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 25, backgroundColor: theme.card, borderBottomWidth: 1, borderBottomColor: theme.border },
  modalTitle: { fontSize: 20, fontWeight: '800', color: theme.text },
  closeButton: { backgroundColor: theme.inputBg, padding: 8, borderRadius: 20 },
  listContent: { padding: 16, paddingBottom: 40 },

  summaryContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, gap: 10 },
  summaryCard: { flex: 1, backgroundColor: theme.card, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: theme.border, alignItems: 'center' },
  summaryIconBox: { backgroundColor: theme.primary + '15', padding: 8, borderRadius: 10, marginBottom: 8 },
  summaryLabel: { fontSize: 11, fontWeight: '600', color: theme.textMuted, textTransform: 'uppercase', marginBottom: 4 },
  summaryValue: { fontSize: 18, fontWeight: 'bold', color: theme.text, textAlign: 'center' },

  dataRowCard: { backgroundColor: theme.card, borderRadius: 16, marginBottom: 16, overflow: 'hidden', borderWidth: 1, borderColor: theme.border },
  dataRowHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.inputBg, padding: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
  dataRowIndex: { fontSize: 14, fontWeight: 'bold', color: theme.primary, width: 35 },
  dataRowPrimary: { fontSize: 16, fontWeight: '700', color: theme.text, flex: 1 },
  dataRowContent: { flexDirection: 'row', flexWrap: 'wrap', padding: 12 },
  dataCell: { width: '50%', paddingVertical: 6, paddingRight: 8 },
  dataLabel: { fontSize: 11, fontWeight: '700', color: theme.textMuted, textTransform: 'uppercase', marginBottom: 2 },
  dataValue: { fontSize: 14, color: theme.text, fontWeight: '500' },

  invoiceSection: { padding: 12, paddingTop: 0 },
  invoicePreviewBtn: { height: 100, borderRadius: 12, overflow: 'hidden', position: 'relative', backgroundColor: theme.inputBg },
  invoiceThumbnail: { width: '100%', height: '100%', opacity: 0.7 },
  invoiceBtnOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 6 },
  invoiceBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },

  imageModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  imageModalCloseBtn: { position: 'absolute', top: 50, right: 20, zIndex: 200 },
  fullScreenImage: { width: '100%', height: '80%' },

  exportPanel: { padding: 20, paddingBottom: 40, backgroundColor: theme.card, borderTopWidth: 1, borderTopColor: theme.border },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  exportBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12, gap: 8 },
  exportBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  exportFooterText: { textAlign: 'center', color: theme.textMuted, fontSize: 12, marginTop: 16, fontWeight: '500' }
});