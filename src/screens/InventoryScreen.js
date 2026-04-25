import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image'; // High Performance Image
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { postToGAS } from '../services/api';
import { StorageService } from '../services/storage';
import { useInventory } from '../hooks/useInventory';
import { UniversalAlert } from '../utils/UniversalAlert';
import BottomSheetModal from '../components/BottomSheetModal';
import CustomDropdown from '../components/CustomDropdown';
import { useTheme } from '../context/ThemeContext';
import { HapticHelper } from '../utils/haptics';

// Custom hook for debouncing search
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export default function InventoryScreen({ navigation }) {
  const { inventory: items, loading: refreshing, loadInventory } = useInventory();
  const [isGrid, setIsGrid] = useState(false);

  const { theme } = useTheme();
  const styles = getStyles(theme);

  // FILTER STATES
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300); // Optimized search
  const [isFilterModalVisible, setFilterModalVisible] = useState(false);
  const [activeFloor, setActiveFloor] = useState('');
  const [activeCupboard, setActiveCupboard] = useState('');
  const [tempFloor, setTempFloor] = useState('');
  const [tempCupboard, setTempCupboard] = useState('');

  // ITEM INTERACTION STATES
  const [selectedItem, setSelectedItem] = useState(null);

  // EDIT STATES
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => { loadInventory(false); HapticHelper.lightImpact(); }, [loadInventory]);

  // DYNAMIC OPTIONS GENERATOR
  const uniqueCategories = useMemo(() => Array.from(new Set(items.map(i => i.category).filter(Boolean))).sort(), [items]);
  const uniqueFloors = useMemo(() => Array.from(new Set(items.map(i => i.location).filter(Boolean))).sort(), [items]);

  const availableCupboards = useMemo(() => {
    const relevantItems = tempFloor ? items.filter(item => item.location === tempFloor) : items;
    return Array.from(new Set(relevantItems.map(item => item.cupboard).filter(Boolean))).sort((a, b) => a.toString().localeCompare(b.toString(), undefined, { numeric: true }));
  }, [items, tempFloor]);

  const editAvailableCupboards = useMemo(() => {
    const relevantItems = editForm?.location ? items.filter(item => item.location === editForm.location) : items;
    return Array.from(new Set(relevantItems.map(item => item.cupboard).filter(Boolean))).sort((a, b) => a.toString().localeCompare(b.toString(), undefined, { numeric: true }));
  }, [items, editForm?.location]);

  // FILTER LOGIC
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = !debouncedSearchQuery ||
        (item.itemName && item.itemName.toLowerCase().includes(debouncedSearchQuery.toLowerCase())) ||
        (item.itemId && item.itemId.toLowerCase().includes(debouncedSearchQuery.toLowerCase())) ||
        (item.category && item.category.toLowerCase().includes(debouncedSearchQuery.toLowerCase()));
      const matchesFloor = !activeFloor || (item.location && item.location.toLowerCase() === activeFloor.toLowerCase());
      const matchesCupboard = !activeCupboard || (item.cupboard && item.cupboard.toLowerCase() === activeCupboard.toLowerCase());
      return matchesSearch && matchesFloor && matchesCupboard;
    });
  }, [items, debouncedSearchQuery, activeFloor, activeCupboard]);

  const isFilterActive = activeFloor !== '' || activeCupboard !== '';
  const applyFilters = () => { setActiveFloor(tempFloor); setActiveCupboard(tempCupboard); setFilterModalVisible(false); };
  const clearFilters = () => { setTempFloor(''); setTempCupboard(''); setActiveFloor(''); setActiveCupboard(''); setFilterModalVisible(false); };

  const handleLongPress = (item) => {
    UniversalAlert.alert(
      item.itemName,
      "Select an action to manage this item.",
      [
        { text: "Relocate", onPress: () => navigation.navigate('Relocate', { initialItemId: item.itemId }) },
        { text: "Edit Details", onPress: () => { setEditForm({ ...item }); setIsEditing(true); } },
        { text: "Delete", onPress: () => handleDeleteConfirmation(item), style: "destructive" },
        { text: "Cancel", style: "cancel" }
      ]
    );
  };

  const handleDeleteConfirmation = (itemToDelete) => {
    UniversalAlert.alert("Delete", `Are you sure you want to delete ${itemToDelete.itemName}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          setIsSaving(true);
          const response = await postToGAS('deleteItem', { itemData: itemToDelete });
          if (response.success) {
            await StorageService.removeCachedData('getInventory');
            loadInventory(true);
            setSelectedItem(null);
          }
          setIsSaving(false);
        }
      }
    ]);
  };

  const handlePhotoUpdate = () => {
    UniversalAlert.alert("Update Photo", "Choose an option", [
      { text: "Take a Photo", onPress: openCamera },
      { text: "Choose from Gallery", onPress: openGallery },
      { text: "Cancel", style: "cancel" }
    ]);
  };

  const openCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return UniversalAlert.alert("Required", "Allow camera access.");
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.5, base64: true });
    if (!res.canceled) setEditForm({ ...editForm, imageUrl: `data:image/jpeg;base64,${res.assets[0].base64}`, isNewImage: true });
  };

  const openGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return UniversalAlert.alert("Required", "Allow gallery access.");
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, quality: 0.5, base64: true });
    if (!res.canceled) setEditForm({ ...editForm, imageUrl: `data:image/jpeg;base64,${res.assets[0].base64}`, isNewImage: true });
  };

  const handleQtyChange = (amount) => {
    const current = parseInt(editForm.openingStock) || 0;
    setEditForm({ ...editForm, openingStock: Math.max(0, current + amount) });
  };

  const handleSaveUpdate = async () => {
    if (!editForm.itemName) return UniversalAlert.alert("Error", "Item Name is required.");
    setIsSaving(true);
    try {
      let finalImageUrl = editForm.imageUrl;
      if (editForm.isNewImage) {
        const base64Data = editForm.imageUrl.split(",")[1];
        const uploadRes = await postToGAS('uploadImage', { fileObject: { base64: base64Data, type: 'image/jpeg', name: `Update_${editForm.itemId}.jpg` } });
        if (uploadRes.success) finalImageUrl = uploadRes.imageUrl;
      }
      const updatedData = { ...editForm, imageUrl: finalImageUrl };
      const response = await postToGAS('updateItem', { itemData: updatedData });

      if (response.success) {
        UniversalAlert.alert("Success", "Item updated successfully.");
        await StorageService.removeCachedData('getInventory');
        loadInventory(true);
        setIsEditing(false);
      } else {
        UniversalAlert.alert("Error", response.message || "Failed to update item.");
      }
    } catch (e) {
      UniversalAlert.alert("Error", "Network error occurred.");
    } finally {
      setIsSaving(false);
    }
  };

  const renderInventoryItem = ({ item }) => {
    if (isGrid) {
      return (
        <TouchableOpacity
          style={styles.gridCardNew}
          activeOpacity={0.8}
          onPress={() => setSelectedItem(item)}
          onLongPress={() => handleLongPress(item)} 
        >
          <Image source={item.imageUrl ? { uri: item.imageUrl } : require('../../assets/images/caps_logo.png')} style={styles.gridImageFull} contentFit="cover" cachePolicy="memory-disk" transition={200} />
          <View style={styles.gridOverlay}>
            <Text style={styles.gridItemName} numberOfLines={1}>{item.itemName}</Text>
            <Text style={styles.gridItemSub} numberOfLines={1}>{item.category} • {item.location} {item.cupboard ? `(C: ${item.cupboard})` : ''}</Text>
            <Text style={styles.gridItemCount}>{item.openingStock} {item.unit || ''}</Text>
          </View>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity style={styles.listCard} activeOpacity={0.7} onPress={() => setSelectedItem(item)} onLongPress={() => handleLongPress(item)}>
        <View style={styles.iconPlaceholder}>
          <Image source={item.imageUrl ? { uri: item.imageUrl } : require('../../assets/images/caps_logo.png')} style={{ width: '100%', height: '100%', borderRadius: 8 }} contentFit="cover" cachePolicy="memory-disk" transition={200} />
        </View>
        <View style={styles.listContent}>
          <Text style={styles.itemName} numberOfLines={1}>{item.itemName}</Text>
          <Text style={styles.itemSub}>{item.category} • {item.location} {item.cupboard ? `(C: ${item.cupboard})` : ''}</Text>
        </View>
        <View style={styles.listTrailing}>
          <Text style={styles.stockText}>{item.openingStock} {item.unit || ''}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Inventory</Text>
        <TouchableOpacity onPress={() => setIsGrid(!isGrid)}>
          <Ionicons name={isGrid ? "list" : "grid"} size={24} color={theme.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search" size={20} color={theme.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search items, IDs, or categories..."
            placeholderTextColor={theme.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={theme.textMuted} style={styles.clearIcon} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={[styles.filterButton, isFilterActive && styles.filterButtonActive]} onPress={() => { setTempFloor(activeFloor); setTempCupboard(activeCupboard); setFilterModalVisible(true); }}>
          <Ionicons name="filter" size={22} color={isFilterActive ? theme.text : theme.textMuted} />
          {isFilterActive && <View style={styles.activeFilterDot} />}
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredItems}
        key={isGrid ? 'grid-view' : 'list-view'}
        numColumns={isGrid ? 2 : 1}
        keyExtractor={(item, index) => item.itemId ? item.itemId.toString() : index.toString()}
        contentContainerStyle={[styles.listContainer, filteredItems.length === 0 && { flex: 1 }]}
        columnWrapperStyle={isGrid ? styles.gridRow : undefined}
        renderItem={renderInventoryItem}
        
        // Optimizations
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}

        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadInventory(true)} tintColor={theme.primary} />}
        ListEmptyComponent={!refreshing ? <Text style={styles.emptyText}>No items match your filters.</Text> : null}
      />

      {/* REFACTORED: FILTER MODAL */}
      <BottomSheetModal visible={isFilterModalVisible} onClose={() => setFilterModalVisible(false)} title="Filter Inventory">
        <CustomDropdown label="Floor Location" placeholder="Select a floor..." options={uniqueFloors} selectedValue={tempFloor} onSelect={(val) => { setTempFloor(val); setTempCupboard(''); }} />
        <CustomDropdown label="Cupboard" placeholder="Select a cupboard..." options={availableCupboards} selectedValue={tempCupboard} onSelect={setTempCupboard} />
        <View style={styles.modalActionsRow}>
          <TouchableOpacity style={styles.clearButton} onPress={clearFilters}><Text style={styles.clearButtonText}>Clear All</Text></TouchableOpacity>
          <TouchableOpacity style={styles.applyButton} onPress={applyFilters}><Text style={styles.applyButtonText}>Apply Filters</Text></TouchableOpacity>
        </View>
      </BottomSheetModal>

      {/* REFACTORED: DETAILS MODAL */}
      <BottomSheetModal visible={!!selectedItem} onClose={() => setSelectedItem(null)} title="Item Details" isScrollable>
        {selectedItem && (
          <>
            <View style={styles.itemDetailImageContainer}>
              <Image source={selectedItem.imageUrl ? { uri: selectedItem.imageUrl } : require('../../assets/images/caps_logo.png')} style={styles.itemDetailImage} contentFit="cover" cachePolicy="memory-disk" />
            </View>
            <Text style={styles.detailTitle}>{selectedItem.itemName}</Text>
            <View style={styles.detailInfoBox}>
              <View style={styles.detailRow}><Text style={styles.detailLabel}>Item ID:</Text><Text style={styles.detailValue}>{selectedItem.itemId}</Text></View>
              <View style={styles.detailRow}><Text style={styles.detailLabel}>Category:</Text><Text style={styles.detailValue}>{selectedItem.category || 'N/A'}</Text></View>
              <View style={styles.detailRow}><Text style={styles.detailLabel}>Location:</Text><Text style={styles.detailValue}>{selectedItem.location || 'N/A'}</Text></View>
              <View style={styles.detailRow}><Text style={styles.detailLabel}>Cupboard:</Text><Text style={styles.detailValue}>{selectedItem.cupboard || 'N/A'} - {selectedItem.rack || 'N/A'}</Text></View>
              <View style={styles.detailRow}><Text style={styles.detailLabel}>Current Stock:</Text>
                <Text style={[styles.detailValue, { fontWeight: 'bold', color: theme.primary }]}>{selectedItem.openingStock} {selectedItem.unit || ''}</Text>
              </View>
            </View>
            <View style={styles.verticalActionContainer}>
              <TouchableOpacity style={[styles.fullWidthButton, { backgroundColor: '#3B82F6' }]} onPress={() => { const id = selectedItem.itemId; setSelectedItem(null); navigation.navigate('Relocate', { initialItemId: id }); }}>
                <Ionicons name="swap-horizontal" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.fullWidthButtonText}>Relocate Item</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.fullWidthButton, { backgroundColor: theme.primary }]} onPress={() => { setEditForm({ ...selectedItem }); setIsEditing(true); setSelectedItem(null); }}>
                <Ionicons name="create-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.fullWidthButtonText}>Edit Details</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.fullWidthButton, { backgroundColor: '#FF3B30' }]} onPress={() => handleDeleteConfirmation(selectedItem)}>
                <Ionicons name="trash-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.fullWidthButtonText}>Delete Item</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </BottomSheetModal>

      {/* REFACTORED: EDIT FORM MODAL */}
      <BottomSheetModal visible={isEditing} onClose={() => setIsEditing(false)} title="Edit Item" isScrollable disabled={isSaving}>
         {editForm && (
            <View style={styles.editFormContainer}>
              <View style={styles.itemDetailImageContainer}>
                <TouchableOpacity onPress={handlePhotoUpdate} activeOpacity={0.8}>
                  <Image source={editForm.imageUrl ? { uri: editForm.imageUrl } : require('../../assets/images/caps_logo.png')} style={[styles.itemDetailImage, { opacity: 0.6 }]} contentFit="cover" cachePolicy="memory-disk" />
                  <View style={styles.imageOverlayText}>
                    <Ionicons name="camera" size={24} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: 'bold', marginTop: 4 }}>Change Photo</Text>
                  </View>
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Item Name</Text>
                <TextInput style={styles.input} value={editForm.itemName} onChangeText={(t) => setEditForm({ ...editForm, itemName: t })} placeholderTextColor={theme.textMuted} />
              </View>

              <CustomDropdown label="Category" options={uniqueCategories} selectedValue={editForm.category} onSelect={(val) => setEditForm({ ...editForm, category: val })} />

              <Text style={styles.inputLabel}>Stock Quantity & Unit</Text>
              <View style={styles.qtyRow}>
                <View style={styles.qtyControls}>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => handleQtyChange(-1)}><Text style={styles.qtyBtnText}>-</Text></TouchableOpacity>
                  <TextInput style={styles.qtyInput} keyboardType="numeric" value={String(editForm.openingStock)} onChangeText={(t) => setEditForm({ ...editForm, openingStock: t.replace(/[^0-9]/g, '') })} />
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => handleQtyChange(1)}><Text style={styles.qtyBtnText}>+</Text></TouchableOpacity>
                </View>
                <TextInput style={[styles.input, { flex: 1, marginLeft: 12 }]} placeholder="e.g. pcs, kg" placeholderTextColor={theme.textMuted} value={editForm.unit} onChangeText={(t) => setEditForm({ ...editForm, unit: t })} />
              </View>

              <CustomDropdown label="Floor Location" options={uniqueFloors} selectedValue={editForm.location} onSelect={(val) => setEditForm({ ...editForm, location: val, cupboard: '' })} />
              <CustomDropdown label="Cupboard" options={editAvailableCupboards} selectedValue={editForm.cupboard} onSelect={(val) => setEditForm({ ...editForm, cupboard: val })} />

              <View style={styles.modalActionsRow}>
                <TouchableOpacity style={styles.clearButton} onPress={() => setIsEditing(false)} disabled={isSaving}>
                  <Text style={styles.clearButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.applyButton, isSaving && { opacity: 0.7 }]} onPress={handleSaveUpdate} disabled={isSaving}>
                  {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.applyButtonText}>Save Changes</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}
      </BottomSheetModal>
    </SafeAreaView>
  );
}

const getStyles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10, alignItems: 'center' },
  headerTitle: { color: theme.text, fontSize: 24, fontWeight: 'bold' },
  searchContainer: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 16, gap: 10 },
  searchInputWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: theme.inputBg, borderRadius: 12, paddingHorizontal: 12 },
  searchIcon: { marginRight: 8 },
  clearIcon: { marginLeft: 8 },
  searchInput: { flex: 1, color: theme.text, height: 48, fontSize: 15 },
  filterButton: { width: 48, height: 48, backgroundColor: theme.inputBg, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  filterButtonActive: { backgroundColor: theme.primary },
  activeFilterDot: { position: 'absolute', top: 12, right: 12, width: 6, height: 6, borderRadius: 3, backgroundColor: theme.text },
  emptyText: { color: theme.textMuted, textAlign: 'center', marginTop: 40, width: '100%' },
  listContainer: { paddingHorizontal: 16, paddingBottom: 40, gap: 2 },
  gridRow: { justifyContent: 'space-between', gap: 12 },
  listCard: { flexDirection: 'row', backgroundColor: theme.card, padding: 8, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  iconPlaceholder: { width: 70, height: 70, borderRadius: 8, backgroundColor: theme.primary + '20' },
  listContent: { flex: 1, marginLeft: 16 },
  itemName: { color: theme.text, fontSize: 16, fontWeight: '600', marginBottom: 4 },
  itemSub: { color: theme.textMuted, fontSize: 12, lineHeight: 18 },
  listTrailing: { alignItems: 'flex-end' },
  stockText: { color: theme.text, fontWeight: 'bold', fontSize: 16 },
  gridCardNew: { flex: 1, borderRadius: 16, overflow: 'hidden', aspectRatio: 0.8, backgroundColor: theme.card },
  gridImageFull: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  gridOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 12, paddingTop: 24, backgroundColor: 'rgba(0, 0, 0, 0.65)' },
  gridItemName: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  gridItemSub: { color: 'rgba(255, 255, 255, 0.8)', fontSize: 12, marginBottom: 6 },
  gridItemCount: { color: theme.primary || '#10B981', fontWeight: '900', fontSize: 14 },
  itemDetailImageContainer: { alignItems: 'center', marginBottom: 16, position: 'relative' },
  itemDetailImage: { width: 120, height: 120, borderRadius: 16, backgroundColor: theme.inputBg },
  imageOverlayText: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 16 },
  detailTitle: { fontSize: 22, fontWeight: 'bold', color: theme.text, textAlign: 'center', marginBottom: 20 },
  detailInfoBox: { backgroundColor: theme.inputBg, borderRadius: 12, padding: 16, marginBottom: 24 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.card },
  detailLabel: { color: theme.textMuted, fontSize: 15 },
  detailValue: { color: theme.text, fontSize: 15, fontWeight: '500' },
  modalActionsRow: { flexDirection: 'row', gap: 12, marginTop: 10 },
  clearButton: { flex: 1, paddingVertical: 16, borderRadius: 12, backgroundColor: theme.inputBg, alignItems: 'center' },
  clearButtonText: { color: theme.text, fontWeight: '600' },
  applyButton: { flex: 1, paddingVertical: 16, borderRadius: 12, backgroundColor: theme.primary, alignItems: 'center' },
  applyButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  verticalActionContainer: { gap: 10 },
  fullWidthButton: { paddingVertical: 16, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  fullWidthButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  editFormContainer: { paddingBottom: 20 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { color: theme.text, fontSize: 13, fontWeight: '500', marginBottom: 8, marginLeft: 4 },
  input: { backgroundColor: theme.inputBg, color: theme.text, borderRadius: 12, paddingHorizontal: 16, height: 50, fontSize: 15 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  qtyControls: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.inputBg, borderRadius: 12, height: 50 },
  qtyBtn: { width: 40, height: '100%', justifyContent: 'center', alignItems: 'center' },
  qtyBtnText: { color: theme.primary, fontSize: 24, fontWeight: 'bold' },
  qtyInput: { width: 60, textAlign: 'center', color: theme.text, fontSize: 16, fontWeight: 'bold' },
});