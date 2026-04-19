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

export default function ReportScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [inventory, setInventory] = useState([]);
  const [userEmail, setUserEmail] = useState("");``

  // Report Modal States
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [currentReportData, setCurrentReportData] = useState([]);
  const [currentReportTitle, setCurrentReportTitle] = useState("");

  useEffect(() => {
    const loadInitData = async () => {
      // 1. Load Inventory for Local Reports
      const cachedInv = await StorageService.getCachedData('getInventory') || [];
      setInventory(cachedInv);

      // 2. Load Email automatically from User Session
      const userSession = await StorageService.getSession();
      console.log(userSession);
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


  // --- LOCAL REPORT GENERATION (PREVIEW & EMAIL) ---
  const generateLocalReport = (type) => {
    let reportTitle = "";
    let data = [];

    switch(type) {
      case 'lowStock':
        reportTitle = "Low Stock Report";
        data = inventory.filter(item => item.openingStock <= item.minStock && item.ignoreLowStock !== 'Yes' && item.status !== 'Inactive');
        data = data.map(item => ({
          ID: item.itemId, 
          Item_Name: item.itemName, 
          Category: item.category, 
          Current_Stock: item.openingStock, 
          Minimum_Stock: item.minStock, 
          Location: item.location
        }));
        break;

      case 'all':
        reportTitle = "All Items Master Report";
        data = inventory.map(item => ({
          ID: item.itemId, 
          Item_Name: item.itemName, 
          Category: item.category, 
          Stock: item.openingStock, 
          Status: item.status, 
          Location: item.location
        }));
        break;

      case 'category':
        reportTitle = "Category Summary Report";
        const catMap = inventory.reduce((acc, item) => {
          acc[item.category] = (acc[item.category] || 0) + (parseInt(item.openingStock) || 0);
          return acc;
        }, {});
        data = Object.keys(catMap).map(cat => ({ 
          Category_Name: cat || "Uncategorized", 
          Total_Stock: catMap[cat] 
        }));
        break;

      default:
        return;
    }

    if (data.length === 0) {
      Alert.alert("No Data", "There is no data matching this report criteria right now.");
      return;
    }

    setCurrentReportTitle(reportTitle);
    setCurrentReportData(data);
    setReportModalVisible(true);
  };

  const handleEmailReport = async (format) => {
    if (!userEmail) {
      Alert.alert("Email Missing", "Could not find your email address in the session. Please re-login.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await postToGAS('emailReport', { 
        format: format, // 'pdf' or 'excel'
        title: currentReportTitle,
        data: currentReportData,
        emailTo: userEmail
      });

      if (response.success) {
        Alert.alert("Success", `Your ${format.toUpperCase()} report was sent successfully to ${userEmail}`);
        setReportModalVisible(false); // Close Modal on success
      } else {
        Alert.alert("Error", response.message || "Failed to send report.");
      }
    } catch (e) {
      Alert.alert("Error", "Network error while sending report.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- SERVER REPORT GENERATION (DIRECT TO DRIVE) ---
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
    const primaryTitle = item.Item_Name || item.Category_Name || `Record #${index + 1}`;
    
    return (
      <View style={styles.dataRowCard}>
        <View style={styles.dataRowHeader}>
          <Text style={styles.dataRowIndex}>#{index + 1}</Text>
          <Text style={styles.dataRowPrimary}>{primaryTitle}</Text>
        </View>
        <View style={styles.dataRowContent}>
          {keys.map(key => {
            if (key === 'Item_Name' || key === 'Category_Name') return null; 
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Inventory Reports</Text>
        <Text style={styles.headerSub}>Export data to PDF or Excel formats</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* --- STOCK ANALYSIS --- */}
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

        {/* --- LOCATION REPORTS --- */}
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

        {/* --- HISTORICAL (SERVER SIDE) --- */}
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

        {/* --- EXPORT INFO BANNER --- */}
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle" size={24} color="#059669" />
          <View style={{ flex: 1 }}>
            <Text style={styles.infoTextTitle}>Automatic Email Delivery</Text>
            <Text style={styles.infoText}>
              All exports generated from the preview screen will be automatically sent to:
            </Text>
            <Text style={styles.infoEmail}>{userEmail || "Loading email..."}</Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* --- IN-APP REPORT PREVIEW MODAL --- */}
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

          {/* In-App Data Grid */}
          <FlatList
            data={currentReportData}
            keyExtractor={(item, index) => index.toString()}
            renderItem={renderDataRow}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />

          {/* Clean Export Actions Panel (No Input Fields) */}
          <View style={styles.exportPanel}>
            {isLoading ? (
              <ActivityIndicator size="large" color={COLORS.primary} style={{ marginVertical: 14 }} />
            ) : (
              <View style={styles.actionRow}>
                <TouchableOpacity 
                  style={[styles.exportBtn, { backgroundColor: COLORS.danger }]} 
                  onPress={() => handleEmailReport('pdf')}
                >
                  <MaterialCommunityIcons name="file-pdf-box" size={22} color="#FFF" />
                  <Text style={styles.exportBtnText}>Send as PDF</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.exportBtn, { backgroundColor: COLORS.success }]} 
                  onPress={() => handleEmailReport('excel')}
                >
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
  
  // Clean Card Buttons (Dark Theme)
  reportCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  iconContainer: { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  reportTextContainer: { flex: 1 },
  reportLabel: { color: COLORS.text, fontSize: 16, fontWeight: '700', marginBottom: 2 },
  reportSub: { color: COLORS.textMuted, fontSize: 12, lineHeight: 18, paddingRight: 10 },
  actionChevron: { backgroundColor: COLORS.inputBg, padding: 6, borderRadius: 10 },

  // Info Banner (Dark Theme)
  infoBanner: { flexDirection: 'row', backgroundColor: COLORS.inputBg, padding: 16, borderRadius: 16, gap: 12, borderWidth: 1, borderColor: COLORS.border, marginTop: 10 },
  infoTextTitle: { color: COLORS.text, fontWeight: 'bold', fontSize: 14, marginBottom: 4 },
  infoText: { color: COLORS.textMuted, fontSize: 12, lineHeight: 18 },
  infoEmail: { color: COLORS.primary, fontWeight: 'bold', fontSize: 13, marginTop: 6 },

  // Modal Styles (Dark Theme)
  modalContainer: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 25, backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  modalTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  recordCount: { fontSize: 14, color: COLORS.textMuted, fontWeight: '600', marginTop: 4 },
  closeButton: { backgroundColor: COLORS.inputBg, padding: 8, borderRadius: 20 },
  listContent: { padding: 16, paddingBottom: 40 },
  
  // Data Grid Rows (Dark Theme)
  dataRowCard: { backgroundColor: COLORS.card, borderRadius: 16, marginBottom: 16, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
  dataRowHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.inputBg, padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  dataRowIndex: { fontSize: 14, fontWeight: 'bold', color: COLORS.primary, width: 35 },
  dataRowPrimary: { fontSize: 16, fontWeight: '700', color: COLORS.text, flex: 1 },
  dataRowContent: { flexDirection: 'row', flexWrap: 'wrap', padding: 12 },
  dataCell: { width: '50%', paddingVertical: 6, paddingRight: 8 },
  dataLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', marginBottom: 2 },
  dataValue: { fontSize: 14, color: COLORS.text, fontWeight: '500' },

  // Clean Export Panel (Dark Theme)
  exportPanel: { padding: 20, paddingBottom: 40, backgroundColor: COLORS.card, borderTopWidth: 1, borderTopColor: COLORS.border },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  exportBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12, gap: 8 },
  exportBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
  exportFooterText: { textAlign: 'center', color: COLORS.textMuted, fontSize: 12, marginTop: 16, fontWeight: '500' }
});