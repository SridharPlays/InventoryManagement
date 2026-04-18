import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  RefreshControl, 
  TouchableOpacity, 
  TextInput, 
  Modal, 
  Image,
  FlatList,
  ScrollView,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { fetchFromGAS } from '../services/api';
import { StorageService } from '../services/storage';

// --- CUSTOM INLINE DROPDOWN COMPONENT ---
const CustomDropdown = ({ label, options, selectedValue, onSelect, placeholder }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <View style={styles.customDropdownContainer}>
      <Text style={styles.inputLabel}>{label}</Text>
      
      <TouchableOpacity 
        style={styles.dropdownSelector} 
        activeOpacity={0.7}
        onPress={() => setIsExpanded(!isExpanded)}
      >
        <Text style={{ color: selectedValue ? COLORS.text : COLORS.textMuted, fontSize: 15 }}>
          {selectedValue ? (label === "Cupboard" ? `Cupboard ${selectedValue}` : selectedValue) : placeholder}
        </Text>
        <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color={COLORS.textMuted} />
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.dropdownListContainer}>
          <ScrollView nestedScrollEnabled style={{ maxHeight: 150 }}>
            <TouchableOpacity 
              style={[styles.dropdownOption, !selectedValue && styles.dropdownOptionSelected]}
              onPress={() => { onSelect(''); setIsExpanded(false); }}
            >
              <Text style={{ color: !selectedValue ? COLORS.primary : COLORS.textMuted }}>
                All {label}s
              </Text>
            </TouchableOpacity>

            {options.map((option) => (
              <TouchableOpacity 
                key={option}
                style={[styles.dropdownOption, selectedValue === option && styles.dropdownOptionSelected]}
                onPress={() => { onSelect(option); setIsExpanded(false); }}
              >
                <Text style={{ color: selectedValue === option ? COLORS.primary : COLORS.text }}>
                  {label === "Cupboard" ? `Cupboard ${option}` : option}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

export default function InventoryScreen() {
  const [items, setItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isGrid, setIsGrid] = useState(false);

  // --- FILTER STATES ---
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterModalVisible, setFilterModalVisible] = useState(false);
  
  // --- ITEM DETAIL STATES ---
  const [selectedItem, setSelectedItem] = useState(null);

  // Active applied filters
  const [activeFloor, setActiveFloor] = useState('');
  const [activeCupboard, setActiveCupboard] = useState('');
  
  // Temporary state for the modal before hitting "Apply"
  const [tempFloor, setTempFloor] = useState('');
  const [tempCupboard, setTempCupboard] = useState('');

  const loadData = useCallback(async (forceRefresh = false) => {
    setRefreshing(true);
    try {
      let inventoryData = null;
      if (!forceRefresh) {
        inventoryData = await StorageService.getCachedData('getInventory');
      }
      if (forceRefresh || !inventoryData) {
        inventoryData = await fetchFromGAS('getInventory');
      }
      if (inventoryData) {
        setItems(inventoryData);
      }
    } catch (error) {
      console.error("Inventory Data Error:", error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { 
    loadData(false); 
  }, [loadData]);

  // --- DYNAMIC DROPDOWN OPTIONS ---
  const uniqueFloors = useMemo(() => {
    const floors = new Set(items.map(item => item.location).filter(Boolean));
    return Array.from(floors).sort();
  }, [items]);

  const availableCupboards = useMemo(() => {
    const relevantItems = tempFloor 
      ? items.filter(item => item.location === tempFloor)
      : items;

    const cupboards = new Set(relevantItems.map(item => item.cupboard).filter(Boolean));
    
    return Array.from(cupboards).sort((a, b) => {
      return a.toString().localeCompare(b.toString(), undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [items, tempFloor]);

  // --- FILTER LOGIC ---
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = !searchQuery || 
        (item.itemName && item.itemName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.itemId && item.itemId.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesFloor = !activeFloor || 
        (item.location && item.location.toLowerCase() === activeFloor.toLowerCase());

      const matchesCupboard = !activeCupboard || 
        (item.cupboard && item.cupboard.toLowerCase() === activeCupboard.toLowerCase());

      return matchesSearch && matchesFloor && matchesCupboard;
    });
  }, [items, searchQuery, activeFloor, activeCupboard]);

  const applyFilters = () => {
    setActiveFloor(tempFloor);
    setActiveCupboard(tempCupboard);
    setFilterModalVisible(false);
  };

  const clearFilters = () => {
    setTempFloor('');
    setTempCupboard('');
    setActiveFloor('');
    setActiveCupboard('');
    setFilterModalVisible(false);
  };

  const handleUpdate = () => {
    // Add navigation or update logic here
    Alert.alert("Update", `Navigating to update screen for ${selectedItem?.itemName}`);
    setSelectedItem(null);
  };

  const handleDelete = () => {
    // Add deletion logic/API call here
    Alert.alert("Delete", `Are you sure you want to delete ${selectedItem?.itemName}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => setSelectedItem(null) }
    ]);
  };

  const isFilterActive = activeFloor !== '' || activeCupboard !== '';

  const renderInventoryItem = ({ item }) => (
    <TouchableOpacity 
      style={isGrid ? styles.gridCard : styles.listCard}
      activeOpacity={0.7}
      onPress={() => setSelectedItem(item)}
    >
      <View style={styles.iconPlaceholder}>
        <Image 
          source={item.imageUrl ? { uri: item.imageUrl } : require('../../assets/images/caps.png')} 
          style={{ width: '100%', height: '100%', borderRadius: 8 }} 
          resizeMode="cover" 
        />
      </View>
      <View style={isGrid ? styles.gridContent : styles.listContent}>
        <Text style={styles.itemName} numberOfLines={1}>{item.itemName}</Text>
        {isGrid ? (
           <Text style={styles.itemSub} numberOfLines={1}>{item.location}</Text>
        ) : (
          <Text style={styles.itemSub}>
            {item.category} • {item.location} {item.cupboard ? `(C: ${item.cupboard})` : ''}
          </Text>
        )}
      </View>
      <View style={isGrid ? styles.gridTrailing : styles.listTrailing}>
        <Text style={styles.stockText}>{item.openingStock} {item.unit || ''}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Inventory</Text>
        <TouchableOpacity onPress={() => setIsGrid(!isGrid)}>
          <Ionicons name={isGrid ? "list" : "grid"} size={24} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search" size={20} color={COLORS.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search items, IDs, or categories..."
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={COLORS.textMuted} style={styles.clearIcon} />
            </TouchableOpacity>
          )}
        </View>
        
        <TouchableOpacity 
          style={[styles.filterButton, isFilterActive && styles.filterButtonActive]} 
          onPress={() => {
            setTempFloor(activeFloor);
            setTempCupboard(activeCupboard);
            setFilterModalVisible(true);
          }}
        >
          <Ionicons name="filter" size={22} color={isFilterActive ? COLORS.text : COLORS.textMuted} />
          {isFilterActive && <View style={styles.activeFilterDot} />}
        </TouchableOpacity>
      </View>

      {/* REPLACED SCROLLVIEW WITH FLATLIST */}
      <FlatList 
        data={filteredItems}
        key={isGrid ? 'grid-view' : 'list-view'} // Forces fresh render when switching layouts
        numColumns={isGrid ? 2 : 1}
        keyExtractor={(item, index) => item.itemId ? item.itemId.toString() : index.toString()}
        contentContainerStyle={[styles.listContainer, filteredItems.length === 0 && { flex: 1 }]}
        columnWrapperStyle={isGrid ? styles.gridRow : undefined}
        renderItem={renderInventoryItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={COLORS.primary} />
        }
        ListEmptyComponent={
          !refreshing ? <Text style={styles.emptyText}>No items match your filters.</Text> : null
        }
      />

      {/* FILTER MODAL */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={isFilterModalVisible}
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Inventory</Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <CustomDropdown 
              label="Floor Location"
              placeholder="Select a floor..."
              options={uniqueFloors}
              selectedValue={tempFloor}
              onSelect={(val) => {
                setTempFloor(val);
                setTempCupboard(''); 
              }}
            />

            <CustomDropdown 
              label="Cupboard"
              placeholder="Select a cupboard..."
              options={availableCupboards}
              selectedValue={tempCupboard}
              onSelect={setTempCupboard}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.clearButton} onPress={clearFilters}>
                <Text style={styles.clearButtonText}>Clear All</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyButton} onPress={applyFilters}>
                <Text style={styles.applyButtonText}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ITEM DETAILS (UPDATE/DELETE) MODAL */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={!!selectedItem}
        onRequestClose={() => setSelectedItem(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.itemModalContent}>
            {selectedItem && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Item Details</Text>
                  <TouchableOpacity onPress={() => setSelectedItem(null)}>
                    <Ionicons name="close" size={24} color={COLORS.text} />
                  </TouchableOpacity>
                </View>

                <View style={styles.itemDetailImageContainer}>
                  <Image 
                    source={selectedItem.imageUrl ? { uri: selectedItem.imageUrl } : require('../../assets/images/caps.png')} 
                    style={styles.itemDetailImage} 
                    resizeMode="cover" 
                  />
                </View>

                <Text style={styles.detailTitle}>{selectedItem.itemName}</Text>
                
                <View style={styles.detailInfoBox}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Item ID:</Text>
                    <Text style={styles.detailValue}>{selectedItem.itemId || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Category:</Text>
                    <Text style={styles.detailValue}>{selectedItem.category || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Location:</Text>
                    <Text style={styles.detailValue}>{selectedItem.location || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Cupboard:</Text>
                    <Text style={styles.detailValue}>{selectedItem.cupboard || 'N/A'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Current Stock:</Text>
                    <Text style={[styles.detailValue, {fontWeight: 'bold', color: COLORS.primary}]}>
                      {selectedItem.openingStock} {selectedItem.unit || ''}
                    </Text>
                  </View>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
                    <Ionicons name="trash-outline" size={20} color="#fff" style={{marginRight: 6}} />
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.updateButton} onPress={handleUpdate}>
                    <Ionicons name="create-outline" size={20} color="#fff" style={{marginRight: 6}} />
                    <Text style={styles.updateButtonText}>Update</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10, alignItems: 'center' },
  headerTitle: { color: COLORS.text, fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  
  searchContainer: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 16, gap: 10 },
  searchInputWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.inputBg, borderRadius: 12, paddingHorizontal: 12 },
  searchIcon: { marginRight: 8 },
  clearIcon: { marginLeft: 8 },
  searchInput: { flex: 1, color: COLORS.text, height: 48, fontSize: 15 },
  filterButton: { width: 48, height: 48, backgroundColor: COLORS.inputBg, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  filterButtonActive: { backgroundColor: COLORS.primary },
  activeFilterDot: { position: 'absolute', top: 12, right: 12, width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.text },
  emptyText: { color: COLORS.textMuted, textAlign: 'center', marginTop: 40, width: '100%' },

  // FlatList Specific Styles
  listContainer: { paddingHorizontal: 16, paddingBottom: 40, gap: 12 },
  gridRow: { justifyContent: 'space-between', gap: 12 },
  
  listCard: { flexDirection: 'row', backgroundColor: COLORS.card, padding: 8, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  gridCard: { flex: 1, backgroundColor: COLORS.card, padding: 16, borderRadius: 12, alignItems: 'center', aspectRatio: 1 },
  iconPlaceholder: { width: 70, height: 70, borderRadius: 8, backgroundColor: COLORS.primary + '20' },
  listContent: { flex: 1, marginLeft: 16 },
  gridContent: { alignItems: 'center', marginTop: 10 },
  itemName: { color: COLORS.text, fontSize: 16, fontWeight: '600', marginBottom: 4, textAlign: 'center' },
  itemSub: { color: COLORS.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  listTrailing: { alignItems: 'flex-end' },
  gridTrailing: { alignItems: 'center', marginTop: 8 },
  stockText: { color: COLORS.text, fontWeight: 'bold', fontSize: 16 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end', alignItems: 'center' },
  modalContent: { width: '100%', backgroundColor: COLORS.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  
  // Item Modal Styles
  itemModalContent: { width: '100%', backgroundColor: COLORS.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  itemDetailImageContainer: { alignItems: 'center', marginBottom: 16 },
  itemDetailImage: { width: 120, height: 120, borderRadius: 16, backgroundColor: COLORS.inputBg },
  detailTitle: { fontSize: 22, fontWeight: 'bold', color: COLORS.text, textAlign: 'center', marginBottom: 20 },
  detailInfoBox: { backgroundColor: COLORS.inputBg, borderRadius: 12, padding: 16, marginBottom: 24 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.card },
  detailLabel: { color: COLORS.textMuted, fontSize: 15 },
  detailValue: { color: COLORS.text, fontSize: 15, fontWeight: '500' },
  
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { color: COLORS.text, fontSize: 20, fontWeight: 'bold' },
  inputLabel: { color: COLORS.text, fontSize: 13, fontWeight: '500', marginBottom: 8, marginLeft: 4 },
  
  customDropdownContainer: { marginBottom: 20 },
  dropdownSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.inputBg, padding: 16, borderRadius: 12 },
  dropdownListContainer: { backgroundColor: COLORS.inputBg, borderRadius: 12, marginTop: 4, borderWidth: 1, borderColor: COLORS.card, overflow: 'hidden' },
  dropdownOption: { paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: COLORS.card },
  dropdownOptionSelected: { backgroundColor: COLORS.primary + '10' },

  modalActions: { flexDirection: 'row', gap: 12, marginTop: 10 },
  clearButton: { flex: 1, paddingVertical: 16, borderRadius: 12, backgroundColor: COLORS.inputBg, alignItems: 'center' },
  clearButtonText: { color: COLORS.text, fontWeight: '600' },
  applyButton: { flex: 1, paddingVertical: 16, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: 'center' },
  applyButtonText: { color: COLORS.text, fontWeight: '600' },
  
  updateButton: { flex: 1, paddingVertical: 16, borderRadius: 12, backgroundColor: COLORS.primary, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  updateButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  deleteButton: { flex: 1, paddingVertical: 16, borderRadius: 12, backgroundColor: '#FF3B30', flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  deleteButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});