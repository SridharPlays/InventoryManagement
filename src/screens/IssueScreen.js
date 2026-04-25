import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import { postToGAS } from '../services/api';
import { StorageService } from '../services/storage';
import { useTheme } from '../context/ThemeContext';
import { useInventory } from '../hooks/useInventory';
import { HapticHelper } from '../utils/haptics';
import { UniversalAlert } from '../utils/UniversalAlert';

export default function IssueScreen({ route, navigation }) {
  const initialItemId = route.params?.initialItemId || null;

  const { theme } = useTheme();
  const styles = getStyles(theme);

  const [searchQuery, setSearchQuery] = useState('');
  const [userData, setUserData] = useState(null);

  // Hook Initialization
  const { inventory, loading, loadInventory } = useInventory();

  // Step 1: Browse & Cart, Step 2: Fill Form
  const [step, setStep] = useState(1);
  const [cart, setCart] = useState([]);
  const [hasAutoSelected, setHasAutoSelected] = useState(false);

  // Issue Form State
  const [issuedTo, setIssuedTo] = useState('');
  const [purpose, setPurpose] = useState('');
  const [isReturnable, setIsReturnable] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [remarks, setRemarks] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadInventory();
    const loadInitialData = async () => {
      const session = await StorageService.getSession();
      if (session) {
        const parsed = typeof session === 'string' ? JSON.parse(session) : session;
        setUserData(parsed);
      }
    };
    loadInitialData();
  }, [loadInventory]);

  // Derive Active Items
  const activeItems = useMemo(() => {
    if (!inventory) return [];
    return inventory.filter(item => item.status === 'Active');
  }, [inventory]);

  // Auto-select initial item if passed from Inventory screen
  useEffect(() => {
    if (initialItemId && activeItems.length > 0 && !hasAutoSelected) {
      const itemToSelect = activeItems.find(i => i.itemId === initialItemId);
      const availableStock = parseInt(itemToSelect?.openingStock, 10) || 0;
      
      if (itemToSelect && availableStock > 0) {
        setCart([{ ...itemToSelect, cartQty: 1 }]);
        setStep(2);
      } else if (itemToSelect && availableStock <= 0) {
        UniversalAlert.alert("Out of Stock", "The selected item currently has 0 stock.");
      }
      setHasAutoSelected(true);
    }
  }, [initialItemId, activeItems, hasAutoSelected]);

  const filteredItems = useMemo(() => {
    if (!searchQuery) return activeItems;
    return activeItems.filter(item =>
      item.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.itemId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [activeItems, searchQuery]);

  // Cart Operations
  const handleUpdateCart = (item, delta) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(c => c.itemId === item.itemId);
      const currentQty = existingItem ? existingItem.cartQty : 0;
      const newQty = currentQty + delta;
      const availableStock = parseInt(item.openingStock, 10) || 0;

      if (newQty > availableStock) {
        UniversalAlert.alert("Stock Limit", `Only ${availableStock} available.`);
        HapticHelper.error();
        return prevCart;
      }
      
      if (newQty <= 0) {
        return prevCart.filter(c => c.itemId !== item.itemId);
      }

      if (existingItem) {
        return prevCart.map(c => c.itemId === item.itemId ? { ...c, cartQty: newQty } : c);
      } else {
        return [...prevCart, { ...item, cartQty: newQty }];
      }
    });
  };

  const cartTotalItems = cart.reduce((sum, item) => sum + item.cartQty, 0);

  const submitIssue = async () => {
    if (cart.length === 0) {
      HapticHelper.error();
      return UniversalAlert.alert("Validation", "Please add items to your cart.");
    }
    if (!issuedTo.trim()) {
      HapticHelper.error();
      return UniversalAlert.alert("Validation", "Please specify who is receiving the items.");
    }
    if (isReturnable && !dueDate.trim()) {
      HapticHelper.error();
      return UniversalAlert.alert("Validation", "Please enter a due date for returnable items.");
    }

    setIsSubmitting(true);
    let successCount = 0;

    try {
      // Loop through cart and submit each as an issue
      for (const cartItem of cart) {
        const payload = {
          itemId: cartItem.itemId,
          itemName: cartItem.itemName,
          quantity: cartItem.cartQty,
          issuedBy: userData?.name || 'Unknown User',
          issuedTo: issuedTo.trim(),
          purpose: purpose.trim(),
          isReturnable: isReturnable ? 'Yes' : 'No',
          dueDate: isReturnable ? dueDate.trim() : '',
          remarks: remarks.trim()
        };

        const response = await postToGAS('issue', { data: payload });
        if (response.success) successCount++;
      }

      if (successCount > 0) {
        HapticHelper.success();
        UniversalAlert.alert(
          "Success", 
          `Successfully issued ${successCount} item(s).`, 
          [{
            text: "OK",
            onPress: async () => {
              await StorageService.removeCachedData('getInventory'); 
              await StorageService.removeCachedData('getDashboard'); 
              navigation.goBack();
            }
          }]
        );
      } else {
        HapticHelper.error();
        UniversalAlert.alert("Error", "Failed to issue items. Please try again.");
      }
    } catch (error) {
      HapticHelper.error();
      UniversalAlert.alert("Error", "Network error occurred." + (error.message ? ` (${error.message})` : ""));
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderItemCard = ({ item }) => {
    const availableStock = parseInt(item.openingStock, 10) || 0;
    const isOutOfStock = availableStock <= 0;
    const cartItem = cart.find(c => c.itemId === item.itemId);
    const cartQty = cartItem ? cartItem.cartQty : 0;
    const isMaxStock = cartQty >= availableStock;

    return (
      <View style={[styles.itemCard, isOutOfStock && { opacity: 0.5 }]}>
        <View style={styles.iconPlaceholder}>
          <Image
            source={item.imageUrl ? { uri: item.imageUrl } : require('../../assets/images/caps_logo.png')}
            style={{ width: '100%', height: '100%', borderRadius: 8 }}
            contentFit="cover"
          />
        </View>
        <View style={styles.itemContent}>
          <Text style={styles.itemName} numberOfLines={1}>{item.itemName}</Text>
          <Text style={styles.itemSub}>{item.category} • {item.location}</Text>
          <Text style={[styles.stockText, isOutOfStock && { color: theme.danger || '#EF4444' }]}>
            {item.openingStock} {item.unit} available
          </Text>
        </View>
        
        <View style={styles.itemTrailing}>
          {cartQty > 0 ? (
            <View style={styles.qtyContainer}>
              <TouchableOpacity onPress={() => handleUpdateCart(item, -1)} style={styles.qtyBtn}>
                <Ionicons name="remove" size={16} color={theme.text} />
              </TouchableOpacity>
              <Text style={styles.qtyText}>{cartQty}</Text>
              <TouchableOpacity 
                onPress={() => handleUpdateCart(item, 1)} 
                style={[styles.qtyBtn, isMaxStock && { opacity: 0.3 }]}
                disabled={isMaxStock}
              >
                <Ionicons name="add" size={16} color={theme.text} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity 
              style={[styles.addButton, isOutOfStock && { backgroundColor: theme.border }]} 
              onPress={() => handleUpdateCart(item, 1)}
              disabled={isOutOfStock}
            >
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { paddingBottom: 0}]} edges={['top', 'left', 'right']}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => step === 2 && cart.length > 0 && !initialItemId ? setStep(1) : navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{step === 1 ? 'Select Items to Issue' : 'Issue Details'}</Text>
        <View style={{ width: 24 }} />
      </View>

      {step === 1 ? (
        // STEP 1: SELECT ITEMS (CART)
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 16 }}>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color={theme.textMuted} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name or ID..."
                placeholderTextColor={theme.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={filteredItems}
              keyExtractor={item => item.itemId}
              renderItem={renderItemCard}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
              ListEmptyComponent={<Text style={styles.emptyText}>No items found.</Text>}
            />
          )}

          {/* Floating Cart Summary */}
          {cartTotalItems > 0 && (
            <View style={styles.floatingCartContainer}>
              <View>
                <Text style={styles.cartTotalText}>{cartTotalItems} Item(s) Selected</Text>
                <Text style={styles.cartSubText}>Ready to fill details</Text>
              </View>
              <TouchableOpacity style={styles.checkoutBtn} onPress={() => setStep(2)}>
                <Text style={styles.checkoutBtnText}>Continue</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : (
        // STEP 2: FILL ISSUE FORM
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">

            {/* Cart Summary Header */}
            <Text style={styles.sectionTitle}>Items to Issue</Text>
            {cart.map(item => (
              <View key={item.itemId} style={styles.cartItemRow}>
                <Text style={styles.cartItemName} numberOfLines={1}>{item.itemName}</Text>
                <Text style={styles.cartItemQty}>x{item.cartQty}</Text>
              </View>
            ))}

            <View style={styles.divider} />

            {/* Form Fields */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Issued To (Name / ID) *</Text>
              <TextInput
                style={styles.input}
                placeholder="Who is receiving this?"
                placeholderTextColor={theme.textMuted}
                value={issuedTo}
                onChangeText={setIssuedTo}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Purpose (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Why is it needed?"
                placeholderTextColor={theme.textMuted}
                value={purpose}
                onChangeText={setPurpose}
              />
            </View>

            {/* Returnable Toggle (Yes | No Buttons) */}
            <View style={styles.switchContainer}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.inputLabel}>Is this item returnable?</Text>
                <Text style={styles.itemSub}>Will this item be brought back?</Text>
              </View>

              <View style={styles.toggleGroup}>
                <TouchableOpacity
                  style={[styles.toggleButton, isReturnable === true && styles.toggleButtonActive]}
                  onPress={() => setIsReturnable(true)}
                >
                  <Text style={[styles.toggleButtonText, isReturnable === true && styles.toggleButtonTextActive]}>
                    Yes
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.toggleButton, isReturnable === false && styles.toggleButtonActive]}
                  onPress={() => setIsReturnable(false)}
                >
                  <Text style={[styles.toggleButtonText, isReturnable === false && styles.toggleButtonTextActive]}>
                    No
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {isReturnable && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Due Date *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="DD/MM/YYYY"
                  placeholderTextColor={theme.textMuted}
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
                placeholderTextColor={theme.textMuted}
                multiline={true}
                numberOfLines={3}
                value={remarks}
                onChangeText={setRemarks}
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, isSubmitting && { opacity: 0.7 }, { marginTop: 10, marginBottom: 40 }]}
              onPress={submitIssue}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Confirm Issue</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const getStyles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  headerTitle: { color: theme.text, fontSize: 20, fontWeight: 'bold' },

  // Search Container
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.inputBg, borderRadius: 12, paddingHorizontal: 12, marginBottom: 16 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, color: theme.text, height: 48, fontSize: 15 },
  emptyText: { color: theme.textMuted, textAlign: 'center', marginTop: 40 },

  // Item Cards (Step 1)
  itemCard: { flexDirection: 'row', backgroundColor: theme.card, padding: 12, borderRadius: 12, marginBottom: 12, alignItems: 'center' },
  iconPlaceholder: { width: 50, height: 50, borderRadius: 8, backgroundColor: theme.inputBg, marginRight: 12 },
  itemContent: { flex: 1 },
  itemName: { color: theme.text, fontSize: 16, fontWeight: '600', marginBottom: 4 },
  itemSub: { color: theme.textMuted, fontSize: 13 },
  itemTrailing: { alignItems: 'flex-end', justifyContent: 'center' },
  stockText: { color: theme.primary, fontSize: 13, fontWeight: 'bold', marginTop: 2 },

  // Cart Controls
  addButton: { backgroundColor: theme.primary + '30', paddingVertical: 6, paddingHorizontal: 16, borderRadius: 8 },
  addButtonText: { color: theme.primary, fontWeight: 'bold', fontSize: 13 },
  qtyContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.inputBg, borderRadius: 8, paddingHorizontal: 4, paddingVertical: 4 },
  qtyBtn: { padding: 4, backgroundColor: theme.border, borderRadius: 6 },
  qtyText: { color: theme.text, marginHorizontal: 12, fontWeight: 'bold', fontSize: 16 },

  // Floating Cart
  floatingCartContainer: { position: 'absolute', bottom: 20, left: 16, right: 16, backgroundColor: theme.primary, borderRadius: 16, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4 },
  cartTotalText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  cartSubText: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  checkoutBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  checkoutBtnText: { color: '#fff', fontWeight: 'bold', marginRight: 6 },

  // Form Fields (Step 2)
  sectionTitle: { color: theme.textMuted, fontSize: 14, textTransform: 'uppercase', marginBottom: 12, fontWeight: '600' },
  cartItemRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: theme.card, padding: 16, borderRadius: 12, marginBottom: 8 },
  cartItemName: { color: theme.text, fontSize: 15, fontWeight: '500', flex: 1, paddingRight: 10 },
  cartItemQty: { color: theme.primary, fontSize: 15, fontWeight: 'bold' },
  divider: { height: 1, backgroundColor: theme.border, marginVertical: 20 },

  inputGroup: { marginBottom: 16 },
  inputLabel: { color: theme.text, fontSize: 14, fontWeight: '500', marginBottom: 8, marginLeft: 4 },
  input: { backgroundColor: theme.inputBg, color: theme.text, borderRadius: 12, paddingHorizontal: 16, height: 52, fontSize: 15, borderColor: theme.inputBg + '10', borderWidth: 1 },
  textArea: { height: 80, paddingTop: 14, textAlignVertical: 'top' },

  switchContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: theme.inputBg, padding: 16, borderRadius: 12, marginBottom: 16, borderColor: theme.inputBg + '10', borderWidth: 1},

  toggleGroup: {
    flexDirection: 'row',
    backgroundColor: theme.primary, 
    borderRadius: 8,
    padding: 4,
  },
  toggleButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  toggleButtonActive: {
    backgroundColor: theme.text,
  },
  toggleButtonText: {
    color: theme.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  toggleButtonTextActive: {
    color: theme.text,
  },

  primaryButton: { backgroundColor: theme.primary, paddingVertical: 16, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  primaryButtonText: { color: theme.text, fontSize: 16, fontWeight: 'bold' },
});