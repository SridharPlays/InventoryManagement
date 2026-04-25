import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { postToGAS } from '../services/api';
import { StorageService } from '../services/storage';
import { useInventory } from '../hooks/useInventory';
import { HapticHelper } from '../utils/haptics';
import { UniversalAlert } from '../utils/UniversalAlert';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const RackSection = ({ rackName, items, isAdmin, cart, updateQuantity }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const { theme } = useTheme();
  const styles = getStyles(theme);

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
          <Ionicons name="layers-outline" size={20} color={theme.primary} style={{ marginRight: 8 }} />
          <Text style={styles.rackTitle}>{rackName}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{items.length}</Text>
          </View>
        </View>
        <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color={theme.textMuted} />
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.rackContent}>
          {items.map((item, i) => {
            const cartQty = cart[item.itemId]?.requestQty || 0;
            const availableStock = parseInt(item.openingStock, 10) || 0;
            const isMaxStock = cartQty >= availableStock;

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

                  {/* Quantity Controls */}
                  {!isAdmin && (
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

  const { theme } = useTheme();
  const styles = getStyles(theme);

  // Hook Initialization
  const { inventory, loading, loadInventory } = useInventory();

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

  // Trigger Inventory Load on mount
  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  // Process Inventory and User Data whenever inventory updates
  useEffect(() => {
    const fetchLocalUserAndProcessInventory = async () => {
      // Load User Name for the request
      const session = await StorageService.getSession();
      if (session) {
        const parsed = typeof session === 'string' ? JSON.parse(session) : session;
        if (parsed.name) setUserName(parsed.name);
      }

      if (!inventory || inventory.length === 0) return;

      const filtered = inventory.filter(item => {
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

    fetchLocalUserAndProcessInventory();
  }, [inventory, cupboardId, floorId]);

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

      // Save to local storage whenever it changes
      StorageService.cacheData('requestCart', updatedCart);
      return updatedCart;
    });
  };

  const clearCart = async () => {
    setCart({});
    setCartModalVisible(false);
    HapticHelper.success();
    await StorageService.removeCachedData('requestCart');
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
        HapticHelper.success();
        UniversalAlert.alert(
          "Request Submitted",
          `Successfully sent ${cartItems.length} items to the Admin for approval.`,
          [{ text: "OK", onPress: () => { clearCart(); } }]
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

  const cartItemCount = Object.keys(cart).length;

  return (
    <SafeAreaView style={[styles.container, { paddingBottom: 0 }]} edges={['top', 'left', 'right']}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Floor {floorId} - Cupboard {cupboardId}</Text>
          <Text style={styles.headerSub}>Select items to request</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={theme.primary} />
      ) : (
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
      )}

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
        </SafeAreaView>
      </Modal>

    </SafeAreaView>
  );
}

const getStyles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  headerRow: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 16 },
  headerTitle: { color: theme.text, fontSize: 20, fontWeight: 'bold' },
  headerSub: { color: theme.textMuted, fontSize: 13, marginTop: 2 },
  content: { paddingHorizontal: 16 },
  emptyText: { color: theme.textMuted, textAlign: 'center', marginTop: 40 },

  rackContainer: { marginBottom: 12, backgroundColor: theme.card, borderRadius: 16, overflow: 'hidden' },
  rackHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: theme.inputBg },
  rackHeaderExpanded: { borderBottomWidth: 1, borderBottomColor: theme.background },
  rackHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  rackTitle: { color: theme.text, fontSize: 16, fontWeight: 'bold', marginRight: 8 },
  badge: { backgroundColor: theme.primary + '20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { color: theme.primary, fontSize: 12, fontWeight: 'bold' },
  rackContent: { padding: 12, backgroundColor: theme.card },

  listCard: { flexDirection: 'row', backgroundColor: theme.background, padding: 12, borderRadius: 18, marginBottom: 8, alignItems: 'center', borderWidth: 1, borderColor: theme.border },
  iconPlaceholder: { width: 60, height: 60, borderRadius: 8, backgroundColor: theme.inputBg },
  listContent: { flex: 1, marginLeft: 12 },
  itemName: { color: theme.text, fontSize: 15, fontWeight: '600', marginBottom: 2 },
  itemSub: { color: theme.textMuted, fontSize: 12 },
  listTrailing: { alignItems: 'flex-end', justifyContent: 'center' },
  stockText: { color: theme.success, fontSize: 12, fontWeight: '600', marginBottom: 8 },

  // Qty Controls (From RequestItemScreen)
  qtyContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.inputBg, borderRadius: 8, borderWidth: 1, borderColor: theme.border },
  qtyBtn: { padding: 6, paddingHorizontal: 10 },
  qtyText: { color: theme.text, fontWeight: 'bold', fontSize: 14, minWidth: 20, textAlign: 'center' },
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.primary + '15', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: theme.primary + '50' },
  addBtnText: { color: theme.primary, fontWeight: 'bold', marginLeft: 4, fontSize: 13 },

  // Floating Cart (From RequestItemScreen)
  floatingCartContainer: { position: 'absolute', bottom: 20, left: 16, right: 16 },
  floatingCartBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.primary, padding: 16, borderRadius: 16, shadowColor: theme.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  cartIconWrapper: { position: 'relative', marginRight: 12 },
  cartBadge: { position: 'absolute', top: -6, right: -10, backgroundColor: theme.danger, width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: theme.primary },
  cartBadgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  floatingCartText: { flex: 1, color: '#FFF', fontSize: 16, fontWeight: 'bold' },

  // Modal
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