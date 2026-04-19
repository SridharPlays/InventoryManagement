import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image, Modal,
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

export default function RequestItemScreen({ navigation }) {
  const [isLoading, setIsLoading] = useState(false);
  const [inventory, setInventory] = useState([]);
  const [userName, setUserName] = useState("Team Lead");

  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [categories, setCategories] = useState(['All']);

  // Cart State: { itemId: { ...itemDetails, requestQty: number } }
  const [cart, setCart] = useState({});
  const [cartModalVisible, setCartModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load User Name for the request
      const session = await StorageService.getSession();
      if (session) {
        const parsed = typeof session === 'string' ? JSON.parse(session) : session;
        if (parsed.name) setUserName(parsed.name);
      }

      // Load Inventory
      const cachedInv = await StorageService.getCachedData('getInventory') || [];
      const activeItems = cachedInv.filter(item => item.status === 'Active');

      // Extract unique categories
      const uniqueCats = ['All', ...new Set(activeItems.map(item => item.category).filter(Boolean))];

      setInventory(activeItems);
      setCategories(uniqueCats);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // CART LOGIC
  const updateQuantity = (item, delta) => {
    setCart(prev => {
      const currentQty = prev[item.itemId]?.requestQty || 0;
      const newQty = currentQty + delta;

      const updatedCart = { ...prev };

      if (newQty <= 0) {
        delete updatedCart[item.itemId]; // Remove if qty drops to 0
      } else {
        updatedCart[item.itemId] = { ...item, requestQty: newQty };
      }
      return updatedCart;
    });
  };

  const clearCart = () => {
    setCart({});
    setCartModalVisible(false);
  };

  // Submit Request
  const sumbitRequest = async () => {
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
        Alert.alert(
          "Request Submitted",
          `Successfully sent ${cartItems.length} items to the Admin for approval.`,
          [{ text: "OK", onPress: () => { clearCart(); navigation.goBack(); } }]
        );
      } else {
        Alert.alert("Error", response.message || "Failed to submit request.");
      }

    } catch (e) {
      Alert.alert("Error", "Network error while submitting requests.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // FILTERING
  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      const matchesSearch = item.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.itemId.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [inventory, searchQuery, activeCategory]);

  const cartItemCount = Object.keys(cart).length;

  // UI COMPONENTS
  const renderItemCard = ({ item }) => {
    const cartQty = cart[item.itemId]?.requestQty || 0;

    return (
      <View style={styles.itemCard}>
        <Image
          source={{ uri: item.imageUrl || 'https://placehold.co/150/1C1C2A/8F8F9D?text=No+Image' }}
          style={styles.itemImage}
        />
        <View style={styles.itemDetails}>
          <Text style={styles.itemName} numberOfLines={1}>{item.itemName}</Text>
          <Text style={styles.itemSub}>{item.category} • ID: {item.itemId}</Text>
          <Text style={styles.itemStock}>Current Stock: {item.openingStock}</Text>
        </View>

        {/* Quantity Controls */}
        <View style={styles.qtyContainer}>
          {cartQty > 0 ? (
            <>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(item, -1)}>
                <Ionicons name="remove" size={18} color={COLORS.text} />
              </TouchableOpacity>
              <Text style={styles.qtyText}>{cartQty}</Text>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(item, 1)}>
                <Ionicons name="add" size={18} color={COLORS.text} />
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={styles.addBtn} onPress={() => updateQuantity(item, 1)}>
              <Ionicons name="add" size={18} color={COLORS.primary} />
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Bulk Request</Text>
          <Text style={styles.headerSub}>Request items for {userName}</Text>
        </View>
      </View>

      {/* Search & Categories */}
      <View style={styles.filterSection}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search items by name or ID..."
            placeholderTextColor={COLORS.textMuted}
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
      {isLoading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filteredInventory}
          keyExtractor={item => item.itemId}
          renderItem={renderItemCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
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
            <TouchableOpacity style={styles.closeButton} onPress={() => setCartModalVisible(false)}>
              <Ionicons name="close" size={24} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={Object.values(cart)}
            keyExtractor={item => item.itemId}
            contentContainerStyle={styles.cartList}
            renderItem={({ item }) => (
              <View style={styles.cartItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cartItemName}>{item.itemName}</Text>
                  <Text style={styles.cartItemSub}>ID: {item.itemId}</Text>
                </View>
                <View style={styles.qtyContainer}>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(item, -1)}>
                    <Ionicons name="remove" size={18} color={COLORS.text} />
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{item.requestQty}</Text>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(item, 1)}>
                    <Ionicons name="add" size={18} color={COLORS.text} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyCartText}>No items added to request.</Text>
            }
          />

          <View style={styles.modalFooter}>
            {isSubmitting ? (
              <ActivityIndicator size="large" color={COLORS.primary} />
            ) : (
              <TouchableOpacity
                style={[styles.submitBtn, cartItemCount === 0 && { opacity: 0.5 }]}
                onPress={sumbitRequest}
                disabled={cartItemCount === 0}
              >
                <Ionicons name="send" size={20} color="#FFF" style={{ marginRight: 8 }} />
                <Text style={styles.submitBtnText}>Submit {cartItemCount} Items</Text>
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 10 },
  backBtn: { marginRight: 16, backgroundColor: COLORS.card, padding: 8, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  headerTitle: { color: COLORS.text, fontSize: 24, fontWeight: 'bold' },
  headerSub: { color: COLORS.textMuted, fontSize: 13, marginTop: 2 },

  // Search & Filter
  filterSection: { borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingBottom: 16 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.inputBg, marginHorizontal: 16, paddingHorizontal: 16, height: 48, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, marginBottom: 16 },
  searchInput: { flex: 1, color: COLORS.text, marginLeft: 10, fontSize: 15 },
  categoryWrapper: { height: 36 },
  categoryChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.inputBg, borderWidth: 1, borderColor: COLORS.border },
  categoryChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  categoryChipText: { color: COLORS.textMuted, fontWeight: '600', fontSize: 13 },
  categoryChipTextActive: { color: '#FFF' },

  // List
  listContent: { padding: 16, paddingBottom: 100 },
  itemCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, padding: 12, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  itemImage: { width: 50, height: 50, borderRadius: 10, backgroundColor: COLORS.inputBg },
  itemDetails: { flex: 1, marginLeft: 12 },
  itemName: { color: COLORS.text, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  itemSub: { color: COLORS.textMuted, fontSize: 12, marginBottom: 4 },
  itemStock: { color: COLORS.success, fontSize: 12, fontWeight: '600' },

  // Qty Controls
  qtyContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.inputBg, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border },
  qtyBtn: { padding: 8, paddingHorizontal: 12 },
  qtyText: { color: COLORS.text, fontWeight: 'bold', fontSize: 16, minWidth: 20, textAlign: 'center' },
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary + '15', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1, borderColor: COLORS.primary + '50' },
  addBtnText: { color: COLORS.primary, fontWeight: 'bold', marginLeft: 4 },

  // Floating Cart
  floatingCartContainer: { position: 'absolute', bottom: 20, left: 16, right: 16 },
  floatingCartBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, padding: 16, borderRadius: 16, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  cartIconWrapper: { position: 'relative', marginRight: 12 },
  cartBadge: { position: 'absolute', top: -6, right: -10, backgroundColor: COLORS.danger, width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.primary },
  cartBadgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  floatingCartText: { flex: 1, color: '#FFF', fontSize: 16, fontWeight: 'bold' },

  // Modal (Cart Review)
  modalContainer: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.card },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.text },
  closeButton: { padding: 4, backgroundColor: COLORS.inputBg, borderRadius: 20 },
  cartList: { padding: 16 },
  emptyCartText: { color: COLORS.textMuted, textAlign: 'center', marginTop: 40, fontSize: 16 },
  cartItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, padding: 16, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
  cartItemName: { color: COLORS.text, fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  cartItemSub: { color: COLORS.textMuted, fontSize: 13 },
  modalFooter: { padding: 20, backgroundColor: COLORS.card, borderTopWidth: 1, borderTopColor: COLORS.border },
  submitBtn: { flexDirection: 'row', backgroundColor: COLORS.success, padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' }
});