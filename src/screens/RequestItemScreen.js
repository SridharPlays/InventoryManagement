import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { postToGAS } from '../services/api';
import { StorageService } from '../services/storage';
import { useInventory } from '../hooks/useInventory';
import { HapticHelper } from '../utils/haptics';
import { UniversalAlert } from '../utils/UniversalAlert';

export default function RequestItemScreen({ navigation }) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [userName, setUserName] = useState("Team Lead");

  const { theme } = useTheme();
  const styles = getStyles(theme);

  // Hook Initialization
  const { inventory, loading, loadInventory } = useInventory();

  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [categories, setCategories] = useState(['All']);

  // Cart State
  const [cart, setCart] = useState({});
  const [cartModalVisible, setCartModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load Cart every time the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      const loadCart = async () => {
        const savedCart = await StorageService.getCachedData('requestCart');
        if (savedCart) {
          setCart(savedCart);
        }
      };
      loadCart();
    }, [])
  );

  useEffect(() => {
    const initData = async () => {
      loadInventory();
      const session = await StorageService.getSession();
      if (session) {
        const parsed = typeof session === 'string' ? JSON.parse(session) : session;
        if (parsed.name) setUserName(parsed.name);
      }
    };
    initData();
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

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadInventory(true);
    setIsRefreshing(false);
  }, [loadInventory]);

  // CART LOGIC
  const updateQuantity = (item, delta) => {
    setCart(prev => {
      const currentQty = prev[item.itemId]?.requestQty || 0;
      const newQty = currentQty + delta;
      const availableStock = parseInt(item.openingStock, 10) || 0;

      if (newQty > availableStock) {
        UniversalAlert.alert("Stock Limit", `Only ${availableStock} items available in stock.`);
        HapticHelper.error();
        return prev;
      }

      const updatedCart = { ...prev };

      if (newQty <= 0) {
        delete updatedCart[item.itemId];
      } else {
        updatedCart[item.itemId] = { ...item, requestQty: newQty };
      }

      // Save to local storage
      StorageService.cacheData('requestCart', updatedCart);
      return updatedCart;
    });
  };

  const clearCart = async () => {
    setCart({});
    setCartModalVisible(false);
    HapticHelper.success();
    await StorageService.removeCachedData('requestCart'); // Clear from storage
  };

  const confirmClearCart = () => {
    UniversalAlert.alert(
      "Clear Cart",
      "Are you sure you want to remove all items from your request?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: clearCart 
        }
      ]
    );
  };

  // Submit Request
  const submitRequest = async () => {
    const cartItems = Object.values(cart);
    if (cartItems.length === 0) return;

    setIsSubmitting(true);

    try {
      const payload = {
        data: {
          tlName: userName,
          items: cartItems.map(item => ({
            itemId: item.itemId,
            itemName: item.itemName,
            quantity: item.requestQty
          }))
        }
      };

      // Send the entire cart in ONE request
      const response = await postToGAS('request', payload);

      if (response.success) {
        HapticHelper.success();
        UniversalAlert.alert(
          "Request Submitted",
          `Successfully sent ${cartItems.length} items to the Admin for approval.`,
          [{ text: "OK", onPress: () => { clearCart(); navigation.goBack(); } }]
        );
      } else {
        HapticHelper.error();
        UniversalAlert.alert("Error", response.message || "Failed to submit request.");
      }

    } catch (e) {
      HapticHelper.error();
      UniversalAlert.alert("Error", "Network error while submitting requests.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // FILTERING
  const filteredInventory = useMemo(() => {
    return activeItems.filter(item => {
      const matchesSearch = item.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.itemId.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [activeItems, searchQuery, activeCategory]);

  const cartItemCount = Object.keys(cart).length;

  // UI COMPONENTS
  const renderItemCard = ({ item }) => {
    const cartQty = cart[item.itemId]?.requestQty || 0;
    const availableStock = parseInt(item.openingStock, 10) || 0;
    const isMaxStock = cartQty >= availableStock;
    const image = item.imageUrl ? { uri: item.imageUrl } : require('../../assets/images/caps_logo.png');

    return (
      <View style={styles.itemCard}>
        <Image
          source={image}
          style={styles.itemImage}
        />
        <View style={styles.itemDetails}>
          <Text style={styles.itemName} numberOfLines={1}>{item.itemName}</Text>
          <Text style={styles.itemSub}>{item.category} • {item.location} | {item.rack}</Text>
          <Text style={styles.itemStock}>Current Stock: {item.openingStock}</Text>
        </View>

        {/* Quantity Controls */}
        <View style={styles.qtyContainer}>
          {cartQty > 0 ? (
            <>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(item, -1)}>
                <Ionicons name="remove" size={18} color={theme.text} />
              </TouchableOpacity>
              <Text style={styles.qtyText}>{cartQty}</Text>
              <TouchableOpacity 
                style={[styles.qtyBtn, isMaxStock && { opacity: 0.3 }]} 
                onPress={() => updateQuantity(item, 1)}
                disabled={isMaxStock}
              >
                <Ionicons name="add" size={18} color={theme.text} />
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity 
              style={[styles.addBtn, availableStock <= 0 && { opacity: 0.5 }]} 
              onPress={() => updateQuantity(item, 1)}
              disabled={availableStock <= 0}
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
    <SafeAreaView style={[styles.container, { paddingBottom: 0}]} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Bulk Request</Text>
          <Text style={styles.headerSub}>Request items for {userName}</Text>
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
      {loading && !isRefreshing ? (
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filteredInventory}
          keyExtractor={item => item.itemId}
          renderItem={renderItemCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={isRefreshing}
          onRefresh={onRefresh}
        />
      )}

      {/* Floating Cart Button */}
      {cartItemCount > 0 && (
        <View style={styles.floatingCartContainer}>
          <TouchableOpacity style={styles.floatingCartBtn} onPress={() => setCartModalVisible(true)}>
            <View style={styles.cartIconWrapper}>
              <Ionicons name="cart" size={24} color="#FFF" />
              <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{cartItemCount}</Text></View>
            </View>
            <Text style={styles.floatingCartText}>Review Request</Text>
            <Ionicons name="chevron-forward" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      )}

      {/* CART REVIEW MODAL */}
      <Modal visible={cartModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Request Summary</Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              {/* CLEAR ALL BUTTON */}
              {cartItemCount > 0 && (
                <TouchableOpacity onPress={confirmClearCart}>
                  <Text style={{ color: theme.danger, fontWeight: '600', fontSize: 14 }}>
                    Clear All
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.closeButton} onPress={() => setCartModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          <FlatList
            data={Object.values(cart)}
            keyExtractor={item => item.itemId}
            contentContainerStyle={styles.cartList}
            renderItem={({ item }) => {
              const availableStock = parseInt(item.openingStock, 10) || 0;
              const isMaxStock = item.requestQty >= availableStock;

              return (
                <View style={styles.cartItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cartItemName}>{item.itemName}</Text>
                    <Text style={styles.cartItemSub}>ID: {item.itemId}</Text>
                  </View>
                  <View style={styles.qtyContainer}>
                    <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(item, -1)}>
                      <Ionicons name="remove" size={18} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={styles.qtyText}>{item.requestQty}</Text>
                    <TouchableOpacity 
                      style={[styles.qtyBtn, isMaxStock && { opacity: 0.3 }]} 
                      onPress={() => updateQuantity(item, 1)}
                      disabled={isMaxStock}
                    >
                      <Ionicons name="add" size={18} color={theme.text} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <Text style={styles.emptyCartText}>No items added to request.</Text>
            }
          />

        </SafeAreaView>
        <View style={styles.modalFooter}>
          {isSubmitting ? (
            <ActivityIndicator size="large" color={theme.primary} />
          ) : (
            <TouchableOpacity
              style={[styles.submitBtn, cartItemCount === 0 && { opacity: 0.5 }]}
              onPress={submitRequest}
              disabled={cartItemCount === 0}
            >
              <Ionicons name="send" size={20} color="#FFF" style={{ marginRight: 8 }} />
              <Text style={styles.submitBtnText}>Submit {cartItemCount} Items</Text>
            </TouchableOpacity>
          )}
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const getStyles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 10 },
  backBtn: { marginRight: 16, backgroundColor: theme.card, padding: 8, borderRadius: 12, borderWidth: 1, borderColor: theme.border },
  headerTitle: { color: theme.text, fontSize: 24, fontWeight: 'bold' },
  headerSub: { color: theme.textMuted, fontSize: 13, marginTop: 2 },

  // Search & Filter
  filterSection: { borderBottomWidth: 1, borderBottomColor: theme.border, paddingBottom: 16 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.inputBg, marginHorizontal: 16, paddingHorizontal: 16, height: 48, borderRadius: 12, borderWidth: 1, borderColor: theme.border, marginBottom: 16 },
  searchInput: { flex: 1, color: theme.text, marginLeft: 10, fontSize: 15 },
  categoryWrapper: { height: 36 },
  categoryChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: theme.inputBg, borderWidth: 1, borderColor: theme.border },
  categoryChipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  categoryChipText: { color: theme.textMuted, fontWeight: '600', fontSize: 13 },
  categoryChipTextActive: { color: '#FFF' },

  // List
  listContent: { padding: 16, paddingBottom: 100 },
  itemCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, padding: 12, borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: theme.border },
  itemImage: { width: 70, height: 70, borderRadius: 12, backgroundColor: theme.inputBg },
  itemDetails: { flex: 1, marginLeft: 12 },
  itemName: { color: theme.text, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  itemSub: { color: theme.textMuted, fontSize: 12, marginBottom: 4 },
  itemStock: { color: theme.success, fontSize: 12, fontWeight: '600' },

  // Qty Controls
  qtyContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.inputBg, borderRadius: 8, borderWidth: 1, borderColor: theme.border },
  qtyBtn: { padding: 8, paddingHorizontal: 12 },
  qtyText: { color: theme.text, fontWeight: 'bold', fontSize: 16, minWidth: 20, textAlign: 'center' },
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.primary + '15', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: theme.primary + '50' },
  addBtnText: { color: theme.primary, fontWeight: 'bold', marginLeft: 4 },

  // Floating Cart
  floatingCartContainer: { position: 'absolute', bottom: 20, left: 16, right: 16 },
  floatingCartBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.primary, padding: 16, borderRadius: 16, shadowColor: theme.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  cartIconWrapper: { position: 'relative', marginRight: 12 },
  cartBadge: { position: 'absolute', top: -6, right: -10, backgroundColor: theme.danger, width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: theme.primary },
  cartBadgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  floatingCartText: { flex: 1, color: '#FFF', fontSize: 16, fontWeight: 'bold' },

  // Modal (Cart Review)
  modalContainer: { flex: 1, backgroundColor: theme.background },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: theme.border, backgroundColor: theme.card },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: theme.text },
  closeButton: { padding: 4, backgroundColor: theme.inputBg, borderRadius: 20 },
  cartList: { padding: 16 },
  emptyCartText: { color: theme.textMuted, textAlign: 'center', marginTop: 40, fontSize: 16 },
  cartItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.card, padding: 16, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: theme.border },
  cartItemName: { color: theme.text, fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  cartItemSub: { color: theme.textMuted, fontSize: 13 },
  modalFooter: { padding: 20, backgroundColor: theme.card, borderTopWidth: 1, borderTopColor: theme.border },
  submitBtn: { flexDirection: 'row', backgroundColor: theme.success, padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' }
});