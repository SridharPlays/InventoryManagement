import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  FlatList, Alert, ActivityIndicator, Image, ScrollView, Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../constants/theme';
import { StorageService } from '../services/storage';
import { postToGAS } from '../services/api';

export default function IssueScreen({ route, navigation }) {
  // If navigating from Inventory screen, we might pass an initial item ID
  const initialItemId = route.params?.initialItemId || null;

  const [items, setItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [userData, setUserData] = useState(null);
  
  // Step 1: Select Item, Step 2: Fill Form
  const [step, setStep] = useState(1); 
  const [selectedItem, setSelectedItem] = useState(null);
  
  // Issue Form State
  const [quantity, setQuantity] = useState('');
  const [issuedTo, setIssuedTo] = useState('');
  const [purpose, setPurpose] = useState('');
  const [isReturnable, setIsReturnable] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [remarks, setRemarks] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadInitialData = async () => {
      // Load user session to know WHO is issuing the item
      const session = await StorageService.getSession();
      if (session) setUserData(session);

      // Load inventory
      const cached = await StorageService.getCachedData('getInventory') || [];
      const activeItems = cached.filter(item => item.status === 'Active');
      setItems(activeItems);

      // If we passed an item ID from another screen, auto-select it and skip to Step 2
      if (initialItemId) {
        const itemToSelect = activeItems.find(i => i.itemId === initialItemId);
        if (itemToSelect) {
          setSelectedItem(itemToSelect);
          setStep(2);
        }
      }
    };
    loadInitialData();
  }, [initialItemId]);

  const filteredItems = useMemo(() => {
    if (!searchQuery) return items;
    return items.filter(item => 
      item.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.itemId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [items, searchQuery]);

  const handleSelectItem = (item) => {
    if (item.openingStock <= 0) {
      return Alert.alert("Out of Stock", "This item currently has 0 stock and cannot be issued.");
    }
    setSelectedItem(item);
    setStep(2);
  };

  const handleQuantityChange = (val) => {
    // Only allow numbers
    const formatted = val.replace(/[^0-9]/g, '');
    
    // Prevent issuing more than available stock
    if (selectedItem && formatted !== '') {
      if (parseInt(formatted) > selectedItem.openingStock) {
        Alert.alert("Invalid Quantity", `You only have ${selectedItem.openingStock} in stock.`);
        setQuantity(String(selectedItem.openingStock));
        return;
      }
    }
    setQuantity(formatted);
  };

  const submitIssue = async () => {
    if (!quantity || quantity === '0') return Alert.alert("Validation", "Please enter a valid quantity.");
    if (!issuedTo.trim()) return Alert.alert("Validation", "Please specify who is receiving the item.");
    if (isReturnable && !dueDate.trim()) return Alert.alert("Validation", "Please enter a due date for returnable items.");

    setIsLoading(true);
    try {
      const payload = {
        itemId: selectedItem.itemId,
        itemName: selectedItem.itemName,
        quantity: parseInt(quantity),
        issuedBy: userData?.name || 'Unknown User',
        issuedTo: issuedTo.trim(),
        purpose: purpose.trim(),
        isReturnable: isReturnable ? 'Yes' : 'No',
        dueDate: isReturnable ? dueDate.trim() : '',
        remarks: remarks.trim()
      };

      const response = await postToGAS('issue', { data: payload });

      if (response.success) {
        Alert.alert("Success", response.message || "Item issued successfully.");
        await StorageService.removeCachedData('getInventory'); // Clear cache to reflect new stock
        await StorageService.removeCachedData('getDashboard'); // Clear dashboard cache
        navigation.goBack();
      } else {
        Alert.alert("Error", response.message || "Failed to issue item.");
      }
    } catch (error) {
      Alert.alert("Error", "Network error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const renderItem = ({ item }) => {
    const isOutOfStock = item.openingStock <= 0;

    return (
      <TouchableOpacity 
        style={[styles.itemCard, isOutOfStock && { opacity: 0.5 }]} 
        activeOpacity={0.7}
        onPress={() => handleSelectItem(item)}
      >
        <View style={styles.iconPlaceholder}>
          <Image 
            source={item.imageUrl ? { uri: item.imageUrl } : require('../../assets/images/caps.png')} 
            style={{ width: '100%', height: '100%', borderRadius: 8 }} 
          />
        </View>
        <View style={styles.itemContent}>
          <Text style={styles.itemName} numberOfLines={1}>{item.itemName}</Text>
          <Text style={styles.itemSub}>{item.itemId} • {item.location}</Text>
        </View>
        <View style={styles.itemTrailing}>
          <Text style={[styles.stockText, isOutOfStock && { color: COLORS.danger || '#EF4444' }]}>
            {item.openingStock} {item.unit}
          </Text>
          <Text style={styles.stockLabel}>Available</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => step === 2 && !initialItemId ? setStep(1) : navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{step === 1 ? 'Select Item to Issue' : 'Issue Details'}</Text>
        <View style={{ width: 24 }} /> 
      </View>

      {step === 1 ? (
        // --- STEP 1: SELECT ITEM ---
        <View style={{ flex: 1, paddingHorizontal: 16 }}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={COLORS.textMuted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or ID..."
              placeholderTextColor={COLORS.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <FlatList
            data={filteredItems}
            keyExtractor={item => item.itemId}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 20 }}
            ListEmptyComponent={<Text style={styles.emptyText}>No items found.</Text>}
          />
        </View>
      ) : (
        // --- STEP 2: FILL ISSUE FORM ---
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
          
          {/* Selected Item Summary Card */}
          {selectedItem && (
            <View style={styles.selectedItemCard}>
              <Image 
                source={selectedItem.imageUrl ? { uri: selectedItem.imageUrl } : require('../../assets/images/caps.png')} 
                style={styles.selectedItemImage} 
              />
              <View style={{ flex: 1, marginLeft: 16 }}>
                <Text style={styles.itemName}>{selectedItem.itemName}</Text>
                <Text style={styles.itemSub}>ID: {selectedItem.itemId}</Text>
                <View style={styles.stockBadge}>
                  <Text style={styles.stockBadgeText}>{selectedItem.openingStock} Available</Text>
                </View>
              </View>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Quantity to Issue *</Text>
            <TextInput
              style={styles.input}
              placeholder={`Max: ${selectedItem?.openingStock}`}
              placeholderTextColor={COLORS.textMuted}
              keyboardType="numeric"
              value={quantity}
              onChangeText={handleQuantityChange}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Issued To (Name / ID) *</Text>
            <TextInput
              style={styles.input}
              placeholder="Who is receiving this?"
              placeholderTextColor={COLORS.textMuted}
              value={issuedTo}
              onChangeText={setIssuedTo}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Purpose (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Why is it needed?"
              placeholderTextColor={COLORS.textMuted}
              value={purpose}
              onChangeText={setPurpose}
            />
          </View>

          {/* Returnable Toggle */}
          <View style={styles.switchContainer}>
            <View>
              <Text style={styles.inputLabel}>Is this item returnable?</Text>
              <Text style={styles.itemSub}>Will this item be brought back?</Text>
            </View>
            <Switch
              trackColor={{ false: COLORS.border, true: COLORS.primary }}
              thumbColor={'#fff'}
              onValueChange={setIsReturnable}
              value={isReturnable}
            />
          </View>

          {isReturnable && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Due Date *</Text>
              <TextInput
                style={styles.input}
                placeholder="DD/MM/YYYY"
                placeholderTextColor={COLORS.textMuted}
                value={dueDate}
                onChangeText={setDueDate}
              />
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Remarks (Optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Any extra notes..."
              placeholderTextColor={COLORS.textMuted}
              multiline={true}
              numberOfLines={3}
              value={remarks}
              onChangeText={setRemarks}
            />
          </View>

          <TouchableOpacity 
            style={[styles.primaryButton, isLoading && { opacity: 0.7 }, { marginTop: 10, marginBottom: 40 }]} 
            onPress={submitIssue}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="push-outline" size={20} color="#fff" style={{marginRight: 8}} />
                <Text style={styles.primaryButtonText}>Confirm Issue</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  headerTitle: { color: COLORS.text, fontSize: 20, fontWeight: 'bold' },
  
  // Step 1 Styles
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.inputBg, borderRadius: 12, paddingHorizontal: 12, marginBottom: 16 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, color: COLORS.text, height: 48, fontSize: 15 },
  emptyText: { color: COLORS.textMuted, textAlign: 'center', marginTop: 40 },
  
  itemCard: { flexDirection: 'row', backgroundColor: COLORS.card, padding: 12, borderRadius: 12, marginBottom: 12, alignItems: 'center' },
  iconPlaceholder: { width: 50, height: 50, borderRadius: 8, backgroundColor: COLORS.inputBg, marginRight: 12 },
  itemContent: { flex: 1 },
  itemName: { color: COLORS.text, fontSize: 16, fontWeight: '600', marginBottom: 4 },
  itemSub: { color: COLORS.textMuted, fontSize: 13 },
  itemTrailing: { alignItems: 'flex-end' },
  stockText: { color: COLORS.primary, fontSize: 18, fontWeight: 'bold' },
  stockLabel: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },

  // Step 2 Styles
  selectedItemCard: { flexDirection: 'row', backgroundColor: COLORS.primary + '15', padding: 16, borderRadius: 16, marginBottom: 24, alignItems: 'center', borderWidth: 1, borderColor: COLORS.primary + '30' },
  selectedItemImage: { width: 60, height: 60, borderRadius: 12, backgroundColor: COLORS.inputBg },
  stockBadge: { backgroundColor: COLORS.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start', marginTop: 8 },
  stockBadgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },

  inputGroup: { marginBottom: 16 },
  inputLabel: { color: COLORS.text, fontSize: 14, fontWeight: '500', marginBottom: 8, marginLeft: 4 },
  input: { backgroundColor: COLORS.inputBg, color: COLORS.text, borderRadius: 12, paddingHorizontal: 16, height: 52, fontSize: 15 },
  textArea: { height: 80, paddingTop: 14, textAlignVertical: 'top' },

  switchContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.inputBg, padding: 16, borderRadius: 12, marginBottom: 16 },

  primaryButton: { backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});