import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  LayoutAnimation,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/theme';
import { postToGAS, fetchFromGAS } from '../services/api';
import { StorageService } from '../services/storage';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const RackSection = ({ rackName, items, isAdmin, cart, updateQuantity }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(!isExpanded);
  };

  return (
    <View style={styles.rackContainer}>
      <TouchableOpacity
        style={[styles.rackHeader, isExpanded && styles.rackHeaderExpanded]}
        onPress={toggleExpand}
        activeOpacity={0.7}
      >
        <View style={styles.rackHeaderLeft}>
          <Ionicons name="layers-outline" size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
          <Text style={styles.rackTitle}>{rackName}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{items.length}</Text>
          </View>
        </View>
        <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color={COLORS.textMuted} />
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.rackContent}>
          {items.map((item, i) => {
            const cartQty = cart[item.itemId]?.requestQty || 0;

            return (
              <View key={i} style={styles.listCard}>
                <View style={styles.iconPlaceholder}>
                  <Image
                    source={item.imageUrl ? { uri: item.imageUrl } : require('../../assets/images/caps_logo.png')}
                    style={{ width: '100%', height: '100%', borderRadius: 8 }}
                    resizeMode="cover"
                  />
                </View>
                <View style={styles.listContent}>
                  <Text style={styles.itemName} numberOfLines={1}>{item.itemName}</Text>
                  <Text style={styles.itemSub}>{item.category}</Text>
                </View>

                <View style={styles.listTrailing}>
                  <Text style={styles.stockText}>Stock: {item.openingStock}</Text>

                  {/* Quantity Controls for Non-Admins */}
                  {!isAdmin && (
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
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

export default function CupboardScreen({ route, navigation }) {
  const { cupboardId, floorId, isAdmin = false } = route.params;
  const [groupedItems, setGroupedItems] = useState([]);
  const [userName, setUserName] = useState("Team Lead");

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
    const fetchLocalInventoryAndUser = async () => {
      // Load User Name for the request
      const session = await StorageService.getSession();
      if (session) {
        const parsed = typeof session === 'string' ? JSON.parse(session) : session;
        if (parsed.name) setUserName(parsed.name);
      }

      // Load Inventory
      let cachedInventory = await StorageService.getCachedData('getInventory') || [];

      if (cachedInventory.length === 0) {
        cachedInventory = await fetchFromGAS('getInventory');
        await StorageService.cacheData('getInventory', cachedInventory); // Update cache with fresh data
      }

      const filtered = cachedInventory.filter(item => {
        const matchesCupboard = item.cupboard?.toLowerCase() === cupboardId.toLowerCase();
        const floorRegex = new RegExp(`(^|\\D)${floorId}(\\D|$)`);
        const matchesFloor = floorRegex.test(item.location || "");

        return matchesCupboard && matchesFloor;
      });

      const grouped = filtered.reduce((acc, item) => {
        const rackName = item.rack ? `Rack ${item.rack}` : 'Unassigned';

        if (!acc[rackName]) {
          acc[rackName] = [];
        }
        acc[rackName].push(item);
        return acc;
      }, {});

      const sortedGroupedArray = Object.keys(grouped).map(key => ({
        rackName: key,
        items: grouped[key]
      })).sort((a, b) => a.rackName.localeCompare(b.rackName, undefined, { numeric: true }));

      setGroupedItems(sortedGroupedArray);
    };

    fetchLocalInventoryAndUser();
  }, [cupboardId, floorId]);

  // CART LOGIC
  const updateQuantity = (item, delta) => {
    setCart(prev => {
      const currentQty = prev[item.itemId]?.requestQty || 0;
      const newQty = currentQty + delta;
      const availableStock = parseInt(item.openingStock, 10) || 0;

      if (newQty > availableStock) {
        Alert.alert("Stock Limit", `Only ${availableStock} items available in stock.`);
        return prev;
      }

      const updatedCart = { ...prev };

      if (newQty <= 0) {
        delete updatedCart[item.itemId];
      } else {
        updatedCart[item.itemId] = { ...item, requestQty: newQty };
      }

      // Save to local storage whenever it changes
      StorageService.cacheData('requestCart', updatedCart);
      return updatedCart;
    });
  };

  const clearCart = async () => {
    setCart({});
    setCartModalVisible(false);
    await StorageService.removeCachedData('requestCart'); // Clear from storage
  };

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

      const response = await postToGAS('request', payload);

      if (response.success) {
        Alert.alert(
          "Request Submitted",
          `Successfully sent ${cartItems.length} items to the Admin for approval.`,
          [{ text: "OK", onPress: () => { clearCart(); } }]
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

  const confirmClearCart = () => {
    Alert.alert(
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

  const cartItemCount = Object.keys(cart).length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Floor {floorId} - Cupboard {cupboardId}</Text>
          <Text style={styles.headerSub}>Select items to request</Text>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {groupedItems.length === 0 ? (
          <Text style={styles.emptyText}>No items found in this location.</Text>
        ) : (
          groupedItems.map((group, index) => (
            <RackSection
              key={index}
              rackName={group.rackName}
              items={group.items}
              isAdmin={isAdmin}
              cart={cart}
              updateQuantity={updateQuantity}
            />
          ))
        )}
        <View style={{ height: cartItemCount > 0 ? 100 : 40 }} />
      </ScrollView>

      {/* Floating Cart Button */}
      {cartItemCount > 0 && !isAdmin && (
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
                  <Text style={{ color: COLORS.danger, fontWeight: '600', fontSize: 14 }}>
                    Clear All
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.closeButton} onPress={() => setCartModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
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
                onPress={submitRequest}
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
  headerRow: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 16 },
  headerTitle: { color: COLORS.text, fontSize: 20, fontWeight: 'bold' },
  headerSub: { color: COLORS.textMuted, fontSize: 13, marginTop: 2 },
  content: { paddingHorizontal: 16 },
  emptyText: { color: COLORS.textMuted, textAlign: 'center', marginTop: 40 },

  rackContainer: { marginBottom: 12, backgroundColor: COLORS.card, borderRadius: 16, overflow: 'hidden' },
  rackHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: COLORS.inputBg },
  rackHeaderExpanded: { borderBottomWidth: 1, borderBottomColor: COLORS.background },
  rackHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  rackTitle: { color: COLORS.text, fontSize: 16, fontWeight: 'bold', marginRight: 8 },
  badge: { backgroundColor: COLORS.primary + '20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { color: COLORS.primary, fontSize: 12, fontWeight: 'bold' },
  rackContent: { padding: 12, backgroundColor: COLORS.card },

  listCard: { flexDirection: 'row', backgroundColor: COLORS.background, padding: 12, borderRadius: 18, marginBottom: 8, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border },
  iconPlaceholder: { width: 60, height: 60, borderRadius: 8, backgroundColor: COLORS.inputBg },
  listContent: { flex: 1, marginLeft: 12 },
  itemName: { color: COLORS.text, fontSize: 15, fontWeight: '600', marginBottom: 2 },
  itemSub: { color: COLORS.textMuted, fontSize: 12 },
  listTrailing: { alignItems: 'flex-end', justifyContent: 'center' },
  stockText: { color: COLORS.success, fontSize: 12, fontWeight: '600', marginBottom: 8 },

  // Qty Controls (From RequestItemScreen)
  qtyContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.inputBg, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border },
  qtyBtn: { padding: 6, paddingHorizontal: 10 },
  qtyText: { color: COLORS.text, fontWeight: 'bold', fontSize: 14, minWidth: 20, textAlign: 'center' },
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary + '15', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: COLORS.primary + '50' },
  addBtnText: { color: COLORS.primary, fontWeight: 'bold', marginLeft: 4, fontSize: 13 },

  // Floating Cart (From RequestItemScreen)
  floatingCartContainer: { position: 'absolute', bottom: 20, left: 16, right: 16 },
  floatingCartBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, padding: 16, borderRadius: 16, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  cartIconWrapper: { position: 'relative', marginRight: 12 },
  cartBadge: { position: 'absolute', top: -6, right: -10, backgroundColor: COLORS.danger, width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.primary },
  cartBadgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  floatingCartText: { flex: 1, color: '#FFF', fontSize: 16, fontWeight: 'bold' },

  // Modal
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