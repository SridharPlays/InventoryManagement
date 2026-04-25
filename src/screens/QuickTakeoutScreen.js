import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../context/ThemeContext';
import { postToGAS } from '../services/api';
import { StorageService } from '../services/storage';
import { useInventory } from '../hooks/useInventory';
import { HapticHelper } from '../utils/haptics';
import { UniversalAlert } from '../utils/UniversalAlert';
import { set } from '@react-native-firebase/app/dist/module/internal/web/firebaseDatabase';
import { BlurView } from 'expo-blur';

export default function QuickTakeoutScreen({ navigation }) {
  const [showNotice, setShowNotice] = useState(true);
  const [userData, setUserData] = useState(null);

  const { theme } = useTheme();
  const styles = getStyles(theme);

  // Hook Initialization
  const { inventory, loading, loadInventory } = useInventory();

  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [categories, setCategories] = useState(['All']);

  // Cart State
  const [cart, setCart] = useState([]);
  const [cartModalVisible, setCartModalVisible] = useState(false);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadInventory();
    const loadUser = async () => {
      const session = await StorageService.getSession();
      if (session) {
        const parsed = typeof session === 'string' ? JSON.parse(session) : session;
        setUserData(parsed);
      }
    };
    loadUser();
  }, [loadInventory]);

  // Derive Active Items and Categories
  const activeItems = useMemo(() => {
    if (!inventory) return [];
    return inventory.filter(item => item.status === 'Active');
  }, [inventory]);

  useEffect(() => {
    const uniqueCats = ['All', ...new Set(activeItems.map(item => item.category).filter(Boolean))];
    setCategories(uniqueCats);
  }, [activeItems]);

  const filteredItems = useMemo(() => {
    return activeItems.filter(item => {
      const matchesSearch = item.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.itemId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [activeItems, searchQuery, activeCategory]);

  // Cart Operations
  const handleUpdateCart = (item, delta) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(c => c.itemId === item.itemId);
      const currentQty = existingItem ? existingItem.cartQty : 0;
      const newQty = currentQty + delta;
      const availableStock = parseInt(item.openingStock, 10) || 0;

      // Ensure we don't exceed stock
      if (newQty > availableStock) {
        UniversalAlert.alert("Stock Limit", `Only ${availableStock} available.`);
        HapticHelper.error();
        return prevCart;
      }

      // Ensure we don't drop below 0
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

  const clearCart = () => {
    setCart([]);
    setReason('');
    setCartModalVisible(false);
    HapticHelper.success();
  };

  const confirmClearCart = () => {
    UniversalAlert.alert(
      "Clear Cart",
      "Are you sure you want to remove all items from your takeout?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Clear All", style: "destructive", onPress: clearCart }
      ]
    );
  };

  const cartTotalItems = cart.reduce((sum, item) => sum + item.cartQty, 0);

  // Checkout Operations
  const submitTakeout = async () => {
    if (cart.length === 0) {
      HapticHelper.error();
      return UniversalAlert.alert("Empty Cart", "Please add items before checking out.");
    }
    if (!reason.trim()) {
      HapticHelper.error();
      return UniversalAlert.alert("Validation", "Please enter an urgent reason for this takeout.");
    }

    setIsSubmitting(true);
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
        HapticHelper.success();
        UniversalAlert.alert(
          "Success",
          `${successCount} item(s) processed successfully.`,
          [{
            text: "OK",
            onPress: async () => {
              await StorageService.removeCachedData('getInventory');
              await StorageService.removeCachedData('getDashboard');
              clearCart();
              navigation.goBack();
            }
          }]
        );
      } else {
        HapticHelper.error();
        UniversalAlert.alert("Error", "Failed to process takeout. Please try again.");
      }
    } catch (error) {
      HapticHelper.error();
      UniversalAlert.alert("Error", "Network error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // UI COMPONENTS

  if (showNotice) {
    return (
      <BlurView style={styles.noticeContainer}>
        <View style={styles.noticeCard}>
          <View style={styles.noticeIconContainer}>
            <Ionicons name="warning" size={48} color={theme.warning} />
          </View>
          <Text style={styles.noticeTitle}>Emergency Use Only</Text>
          <View style={styles.noticeBodyContainer}>
            <Text style={styles.noticeText}>
              1. This feature is strictly reserved for emergency situations and hospitality purposes.
            </Text>
            <Text style={styles.noticeText}>
              2. For high-urgency cases, you must inform an Operations Volunteer or obtain explicit permission prior to use.
            </Text>
            <Text style={styles.noticeTextBold}>
              3. If you are unsure how to operate this system, do not proceed. Seek immediate assistance from authorized personnel.
            </Text>
            <Text style={styles.noticeSignoff}>
              Regards,{'\n'}Operations Committee
            </Text>
          </View>
          <TouchableOpacity style={styles.noticeButton} onPress={() => setShowNotice(false)}>
            <Text style={styles.noticeButtonText}>I Understand & Agree</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.noticeCancelButton} onPress={() => navigation.goBack()}>
            <Text style={styles.noticeCancelText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </BlurView>
    );
  }

  const renderItemCard = ({ item }) => {
    const availableStock = parseInt(item.openingStock, 10) || 0;
    const isOutOfStock = availableStock <= 0;
    const cartItem = cart.find(c => c.itemId === item.itemId);
    const cartQty = cartItem ? cartItem.cartQty : 0;
    const isMaxStock = cartQty >= availableStock;
    const image = item.imageUrl ? { uri: item.imageUrl } : require('../../assets/images/caps_logo.png');

    return (
      <View style={[styles.itemCard, isOutOfStock && { opacity: 0.5 }]}>
        <Image source={image} style={styles.itemImage} />
        <View style={styles.itemDetails}>
          <Text style={styles.itemName} numberOfLines={1}>{item.itemName}</Text>
          <Text style={styles.itemSub}>{item.category} • {item.location} | {item.rack}</Text>
          <Text style={styles.itemStock}>Stock: {item.openingStock}</Text>
        </View>

        <View style={styles.qtyContainer}>
          {cartQty > 0 ? (
            <>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => handleUpdateCart(item, -1)}>
                <Ionicons name="remove" size={18} color={theme.text} />
              </TouchableOpacity>
              <Text style={styles.qtyText}>{cartQty}</Text>
              <TouchableOpacity
                style={[styles.qtyBtn, isMaxStock && { opacity: 0.3 }]}
                onPress={() => handleUpdateCart(item, 1)}
                disabled={isMaxStock}
              >
                <Ionicons name="add" size={18} color={theme.text} />
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.addBtn, isOutOfStock && { opacity: 0.5 }]}
              onPress={() => handleUpdateCart(item, 1)}
              disabled={isOutOfStock}
            >
              <Ionicons name="add" size={18} color={theme.primary} />
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { paddingBottom: 0 }]} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => {
          setCartModalVisible(false);
          setShowNotice(true);
          navigation.goBack()
        }
        }>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Quick Takeout</Text>
          <Text style={styles.headerSub}>Urgent & Hospitality Only</Text>
        </View>
      </View>

      {/* Search & Categories */}
      <View style={styles.filterSection}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color={theme.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search items by name or ID..."
            placeholderTextColor={theme.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <View style={styles.categoryWrapper}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={categories}
            keyExtractor={item => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.categoryChip, activeCategory === item && styles.categoryChipActive]}
                onPress={() => setActiveCategory(item)}
              >
                <Text style={[styles.categoryChipText, activeCategory === item && styles.categoryChipTextActive]}>
                  {item}
                </Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          />
        </View>
      </View>

      {/* Item List */}
      {loading ? (
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={item => item.itemId}
          renderItem={renderItemCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<Text style={styles.emptyText}>No active items found.</Text>}
        />
      )}

      {/* Floating Cart Button */}
      {cartTotalItems > 0 && (
        <View style={styles.floatingCartContainer}>
          <TouchableOpacity style={styles.floatingCartBtn} onPress={() => setCartModalVisible(true)}>
            <View style={styles.cartIconWrapper}>
              <Ionicons name="cart" size={24} color="#FFF" />
              <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{cart.length}</Text></View>
            </View>
            <Text style={styles.floatingCartText}>Review Takeout</Text>
            <Ionicons name="chevron-forward" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      )}

      {/* CART REVIEW MODAL */}
      <Modal visible={cartModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Takeout Summary</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                {cartTotalItems > 0 && (
                  <TouchableOpacity onPress={confirmClearCart}>
                    <Text style={{ color: theme.danger, fontWeight: '600', fontSize: 14 }}>Clear All</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.closeButton} onPress={() => setCartModalVisible(false)}>
                  <Ionicons name="close" size={24} color={theme.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView contentContainerStyle={styles.cartList}>
              {cart.length === 0 ? (
                <Text style={styles.emptyCartText}>No items added to takeout.</Text>
              ) : (
                cart.map(item => {
                  const availableStock = parseInt(item.openingStock, 10) || 0;
                  const isMaxStock = item.cartQty >= availableStock;

                  return (
                    <View key={item.itemId} style={styles.cartItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cartItemName}>{item.itemName}</Text>
                        <Text style={styles.cartItemSub}>ID: {item.itemId}</Text>
                      </View>
                      <View style={styles.qtyContainer}>
                        <TouchableOpacity style={styles.qtyBtn} onPress={() => handleUpdateCart(item, -1)}>
                          <Ionicons name="remove" size={18} color={theme.text} />
                        </TouchableOpacity>
                        <Text style={styles.qtyText}>{item.cartQty}</Text>
                        <TouchableOpacity
                          style={[styles.qtyBtn, isMaxStock && { opacity: 0.3 }]}
                          onPress={() => handleUpdateCart(item, 1)}
                          disabled={isMaxStock}
                        >
                          <Ionicons name="add" size={18} color={theme.text} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )
                })
              )}

              {/* Reason Input integrated into Cart Modal */}
              {cart.length > 0 && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Reason for Urgent Takeout *</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Why do you need this immediately?"
                    placeholderTextColor={theme.textMuted}
                    multiline={true}
                    numberOfLines={4}
                    value={reason}
                    onChangeText={setReason}
                  />
                  <Text style={styles.helperText}>This will be recorded without prior admin approval.</Text>
                </View>
              )}
              <View style={{ height: 40 }} />
            </ScrollView>

            <View style={styles.modalFooter}>
              {isSubmitting ? (
                <ActivityIndicator size="large" color={theme.primary} />
              ) : (
                <TouchableOpacity
                  style={[styles.submitBtn, cartTotalItems === 0 && { opacity: 0.5 }]}
                  onPress={submitTakeout}
                  disabled={cartTotalItems === 0}
                >
                  <Ionicons name="flash" size={20} color="#FFF" style={{ marginRight: 8 }} />
                  <Text style={styles.submitBtnText}>Confirm Takeout</Text>
                </TouchableOpacity>
              )}
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

    </SafeAreaView>
  );
}

const getStyles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },

  // Notice Screen Styles
  noticeContainer: { flex: 1, backgroundColor: theme.background, justifyContent: 'center', padding: 20 },
  noticeCard: { backgroundColor: theme.card, borderRadius: 24, padding: 30, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10, borderWidth: 1, borderColor: theme.border },
  noticeIconContainer: { width: 80, height: 80, borderRadius: 40, backgroundColor: theme.warning + '20', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  noticeTitle: { fontSize: 22, fontWeight: 'bold', color: theme.text, marginBottom: 16, textAlign: 'center' },
  noticeBodyContainer: { backgroundColor: theme.inputBg, padding: 20, borderRadius: 16, marginBottom: 24, width: '100%' },
  noticeText: { fontSize: 14, color: theme.text, marginBottom: 12, lineHeight: 22, textAlign: 'left' },
  noticeTextBold: { fontSize: 14, color: theme.danger, fontWeight: 'bold', marginBottom: 16, lineHeight: 22, textAlign: 'left' },
  noticeSignoff: { fontSize: 14, color: theme.textMuted, fontWeight: '600', textAlign: 'left', fontStyle: 'italic' },
  noticeButton: { backgroundColor: theme.primary, width: '100%', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  noticeButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  noticeCancelButton: { paddingVertical: 12, width: '100%', alignItems: 'center' },
  noticeCancelText: { color: theme.textMuted, fontSize: 15, fontWeight: '600' },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 10 },
  backBtn: { marginRight: 16, padding: 4 },
  headerTitle: { color: theme.text, fontSize: 24, fontWeight: 'bold' },
  headerSub: { color: theme.warning, fontSize: 13, marginTop: 2, fontWeight: '600' },

  // Search & Filter (From RequestItemScreen)
  filterSection: { borderBottomWidth: 1, borderBottomColor: theme.border, paddingBottom: 16 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.inputBg, marginHorizontal: 16, paddingHorizontal: 16, height: 48, borderRadius: 12, borderWidth: 1, borderColor: theme.border, marginBottom: 16 },
  searchInput: { flex: 1, color: theme.text, marginLeft: 10, fontSize: 15 },
  categoryWrapper: { height: 36 },
  categoryChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: theme.inputBg, borderWidth: 1, borderColor: theme.border },
  categoryChipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  categoryChipText: { color: theme.textMuted, fontWeight: '600', fontSize: 13 },
  categoryChipTextActive: { color: '#FFF' },
  emptyText: { color: theme.textMuted, textAlign: 'center', marginTop: 40 },

  // List (From RequestItemScreen)
  listContent: { padding: 16, paddingBottom: 100 },
  itemCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, padding: 12, borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: theme.border },
  itemImage: { width: 70, height: 70, borderRadius: 12, backgroundColor: theme.inputBg },
  itemDetails: { flex: 1, marginLeft: 12 },
  itemName: { color: theme.text, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  itemSub: { color: theme.textMuted, fontSize: 12, marginBottom: 4 },
  itemStock: { color: theme.success, fontSize: 12, fontWeight: '600' },

  // Qty Controls (From RequestItemScreen)
  qtyContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.inputBg, borderRadius: 8, borderWidth: 1, borderColor: theme.border },
  qtyBtn: { padding: 8, paddingHorizontal: 12 },
  qtyText: { color: theme.text, fontWeight: 'bold', fontSize: 16, minWidth: 20, textAlign: 'center' },
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.primary + '15', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: theme.primary + '50' },
  addBtnText: { color: theme.primary, fontWeight: 'bold', marginLeft: 4 },

  // Floating Cart (From RequestItemScreen)
  floatingCartContainer: { position: 'absolute', bottom: 20, left: 16, right: 16 },
  floatingCartBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.primary, padding: 16, borderRadius: 16, shadowColor: theme.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  cartIconWrapper: { position: 'relative', marginRight: 12 },
  cartBadge: { position: 'absolute', top: -6, right: -10, backgroundColor: theme.danger, width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: theme.primary },
  cartBadgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  floatingCartText: { flex: 1, color: '#FFF', fontSize: 16, fontWeight: 'bold' },

  // Modal (Cart Review - From RequestItemScreen)
  modalContainer: { flex: 1, backgroundColor: theme.background },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: theme.border, backgroundColor: theme.card },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: theme.text },
  closeButton: { padding: 4, backgroundColor: theme.inputBg, borderRadius: 20 },
  cartList: { padding: 16 },
  emptyCartText: { color: theme.textMuted, textAlign: 'center', marginTop: 40, fontSize: 16 },
  cartItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, padding: 16, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: theme.border },
  cartItemName: { color: theme.text, fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  cartItemSub: { color: theme.textMuted, fontSize: 13 },

  // Checkout Input fields for Reason
  inputGroup: { marginTop: 16, paddingHorizontal: 16 },
  inputLabel: { color: theme.text, fontSize: 14, fontWeight: '500', marginBottom: 8, marginLeft: 4 },
  input: { backgroundColor: theme.inputBg, color: theme.text, borderRadius: 12, paddingHorizontal: 16, height: 52, fontSize: 15, borderWidth: 1, borderColor: theme.border },
  textArea: { height: 100, paddingTop: 14, textAlignVertical: 'top' },
  helperText: { color: theme.warning, fontSize: 12, marginTop: 8, marginLeft: 4, fontStyle: 'italic' },

  modalFooter: { padding: 20, backgroundColor: theme.card, borderTopWidth: 1, borderTopColor: theme.border },
  submitBtn: { flexDirection: 'row', backgroundColor: theme.success, padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' }
});