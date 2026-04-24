import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
	ActivityIndicator,
	Alert,
	FlatList,
	Image,
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

import { COLORS } from '../constants/theme';
import { postToGAS } from '../services/api';
import { StorageService } from '../services/storage';

export default function QuickTakeoutScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [userData, setUserData] = useState(null);

  // Cart State
  const [cart, setCart] = useState([]);
  
  // Step 1: Browse & Cart, Step 2: Checkout & Reason
  const [step, setStep] = useState(1);
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadInitialData = async () => {
      const session = await StorageService.getSession();
      if (session) setUserData(session);

      const cached = await StorageService.getCachedData('getInventory') || [];
      const activeItems = cached.filter(item => item.status === 'Active');
      setItems(activeItems);
    };
    loadInitialData();
  }, []);

  const filteredItems = useMemo(() => {
    if (!searchQuery) return items;
    return items.filter(item =>
      item.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.itemId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [items, searchQuery]);

  // Cart Operations
  const handleUpdateCart = (item, delta) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(c => c.itemId === item.itemId);
      const currentQty = existingItem ? existingItem.cartQty : 0;
      const newQty = currentQty + delta;

      // Ensure we don't exceed stock or drop below 0
      if (newQty > item.openingStock) {
        Alert.alert("Stock Limit", `Only ${item.openingStock} available.`);
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

  // Checkout Operations
  const submitTakeout = async () => {
    if (cart.length === 0) return Alert.alert("Empty Cart", "Please add items before checking out.");
    if (!reason.trim()) return Alert.alert("Validation", "Please enter an urgent reason for this takeout.");

    setIsLoading(true);
    let successCount = 0;

    try {
      // Loop through cart and submit as an 'issue' to the existing backend
      for (const cartItem of cart) {
        const payload = {
          itemId: cartItem.itemId,
          itemName: cartItem.itemName,
          quantity: cartItem.cartQty,
          issuedBy: userData?.name || 'Quick Takeout',
          issuedTo: userData?.name || 'Self (TL)',
          purpose: `[URGENT] ${reason.trim()}`,
          isReturnable: 'No', 
          dueDate: '',
          remarks: 'Quick Takeout Cart Checkout'
        };

        const response = await postToGAS('issue', { data: payload });
        if (response.success) successCount++;
      }

      if (successCount > 0) {
        Alert.alert("Success", `${successCount} item(s) processed successfully.`);
        await StorageService.removeCachedData('getInventory');
        await StorageService.removeCachedData('getDashboard');
        navigation.goBack();
      } else {
        Alert.alert("Error", "Failed to process takeout. Please try again.");
      }
    } catch (error) {
      Alert.alert("Error", "Network error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  // Render Helpers
  const renderItem = ({ item }) => {
    const isOutOfStock = item.openingStock <= 0;
    const cartItem = cart.find(c => c.itemId === item.itemId);
    const cartQty = cartItem ? cartItem.cartQty : 0;

    return (
      <View style={[styles.itemCard, isOutOfStock && { opacity: 0.5 }]}>
        <View style={styles.iconPlaceholder}>
          <Image
            source={item.imageUrl ? { uri: item.imageUrl } : require('../../assets/images/caps_logo.png')}
            style={{ width: '100%', height: '100%', borderRadius: 8 }}
          />
        </View>
        <View style={styles.itemContent}>
          <Text style={styles.itemName} numberOfLines={1}>{item.itemName}</Text>
          <Text style={styles.itemSub}>{item.itemId} • {item.openingStock} {item.unit} available</Text>
        </View>
        
        {/* Add / Adjust Cart Quantity Controls */}
        <View style={styles.itemTrailing}>
          {cartQty > 0 ? (
            <View style={styles.qtyContainer}>
              <TouchableOpacity onPress={() => handleUpdateCart(item, -1)} style={styles.qtyBtn}>
                <Ionicons name="remove" size={16} color={COLORS.text} />
              </TouchableOpacity>
              <Text style={styles.qtyText}>{cartQty}</Text>
              <TouchableOpacity onPress={() => handleUpdateCart(item, 1)} style={styles.qtyBtn}>
                <Ionicons name="add" size={16} color={COLORS.text} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity 
              style={[styles.addButton, isOutOfStock && { backgroundColor: COLORS.border }]} 
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
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => step === 2 ? setStep(1) : navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{step === 1 ? 'Quick Takeout' : 'Cart Summary'}</Text>
        <View style={{ width: 24 }} />
      </View>

      {step === 1 ? (
        // STEP 1: CATALOG & CART SELECTION
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 16 }}>
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
          </View>

          <FlatList
            data={filteredItems}
            keyExtractor={item => item.itemId}
            renderItem={renderItem}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
            ListEmptyComponent={<Text style={styles.emptyText}>No items found.</Text>}
          />

          {/* Floating Cart Summary */}
          {cartTotalItems > 0 && (
            <View style={styles.floatingCartContainer}>
              <View>
                <Text style={styles.cartTotalText}>{cartTotalItems} Item(s) Selected</Text>
                <Text style={styles.cartSubText}>Ready for checkout</Text>
              </View>
              <TouchableOpacity style={styles.checkoutBtn} onPress={() => setStep(2)}>
                <Text style={styles.checkoutBtnText}>Review</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : (
        // STEP 2: CART SUMMARY & REASON
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
            
            <Text style={styles.sectionTitle}>Items in Cart</Text>
            {cart.map(item => (
              <View key={item.itemId} style={styles.cartItemRow}>
                <Text style={styles.cartItemName} numberOfLines={1}>{item.itemName}</Text>
                <Text style={styles.cartItemQty}>x{item.cartQty}</Text>
              </View>
            ))}

            <View style={styles.divider} />

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Reason for Urgent Takeout *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Why do you need this immediately?"
                placeholderTextColor={COLORS.textMuted}
                multiline={true}
                numberOfLines={4}
                value={reason}
                onChangeText={setReason}
              />
              <Text style={styles.helperText}>This will be recorded without prior admin approval.</Text>
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, isLoading && { opacity: 0.7 }, { marginTop: 20 }]}
              onPress={submitTakeout}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Confirm Takeout</Text>
              )}
            </TouchableOpacity>

          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  headerTitle: { color: COLORS.text, fontSize: 20, fontWeight: 'bold' },

  // Search & List Styles
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.inputBg, borderRadius: 12, paddingHorizontal: 12, marginBottom: 16 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, color: COLORS.text, height: 48, fontSize: 15 },
  emptyText: { color: COLORS.textMuted, textAlign: 'center', marginTop: 40 },

  itemCard: { flexDirection: 'row', backgroundColor: COLORS.card, padding: 12, borderRadius: 12, marginBottom: 12, alignItems: 'center' },
  iconPlaceholder: { width: 50, height: 50, borderRadius: 8, backgroundColor: COLORS.inputBg, marginRight: 12 },
  itemContent: { flex: 1 },
  itemName: { color: COLORS.text, fontSize: 16, fontWeight: '600', marginBottom: 4 },
  itemSub: { color: COLORS.textMuted, fontSize: 13 },
  itemTrailing: { alignItems: 'flex-end', justifyContent: 'center' },

  // Cart Controls
  addButton: { backgroundColor: COLORS.primary + '30', paddingVertical: 6, paddingHorizontal: 16, borderRadius: 8 },
  addButtonText: { color: COLORS.primary, fontWeight: 'bold', fontSize: 13 },
  qtyContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.inputBg, borderRadius: 8, paddingHorizontal: 4, paddingVertical: 4 },
  qtyBtn: { padding: 4, backgroundColor: COLORS.border, borderRadius: 6 },
  qtyText: { color: COLORS.text, marginHorizontal: 12, fontWeight: 'bold', fontSize: 16 },

  // Floating Cart
  floatingCartContainer: { position: 'absolute', bottom: 20, left: 16, right: 16, backgroundColor: COLORS.primary, borderRadius: 16, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4 },
  cartTotalText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  cartSubText: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },
  checkoutBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  checkoutBtnText: { color: '#fff', fontWeight: 'bold', marginRight: 6 },

  // Checkout Styles
  sectionTitle: { color: COLORS.textMuted, fontSize: 14, textTransform: 'uppercase', marginBottom: 12, fontWeight: '600' },
  cartItemRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: COLORS.card, padding: 16, borderRadius: 12, marginBottom: 8 },
  cartItemName: { color: COLORS.text, fontSize: 15, fontWeight: '500', flex: 1, paddingRight: 10 },
  cartItemQty: { color: COLORS.primary, fontSize: 15, fontWeight: 'bold' },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 24 },
  
  inputGroup: { marginBottom: 16 },
  inputLabel: { color: COLORS.text, fontSize: 14, fontWeight: '500', marginBottom: 8, marginLeft: 4 },
  input: { backgroundColor: COLORS.inputBg, color: COLORS.text, borderRadius: 12, paddingHorizontal: 16, height: 52, fontSize: 15 },
  textArea: { height: 100, paddingTop: 14, textAlignVertical: 'top' },
  helperText: { color: COLORS.warning, fontSize: 12, marginTop: 8, marginLeft: 4, fontStyle: 'italic' },

  primaryButton: { backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});