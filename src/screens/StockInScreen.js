import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput, TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../context/ThemeContext';
import { postToGAS } from '../services/api';
import { StorageService } from '../services/storage';

export default function StockInScreen() {
    // Mode State
    const [entryMode, setEntryMode] = useState('restock'); // 'restock' or 'expense'
    const [userName, setUserName] = useState('');

    const { theme } = useTheme();
    const styles = getStyles(theme);

    // Form State
    const [selectedItem, setSelectedItem] = useState(null); // Used for restock
    const [itemName, setItemName] = useState('');           // Used for expense/new
    const [price, setPrice] = useState('');
    const [quantity, setQuantity] = useState('');
    const [remarks, setRemarks] = useState('');

    // Image State
    const [invoiceImage, setInvoiceImage] = useState(null);
    const [rawBase64, setRawBase64] = useState(null);

    // Inventory Data State
    const [inventoryList, setInventoryList] = useState([]);
    const [filteredList, setFilteredList] = useState([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isFetchingItems, setIsFetchingItems] = useState(false);

    // System State
    const [isLoading, setIsLoading] = useState(false);
    const [isOnline, setIsOnline] = useState(true);

    useEffect(() => async () => {
        const userSession = await StorageService.getSession();
        if (userSession) {
            try {
                const parsed = JSON.parse(userSession);
                if (parsed && parsed.name) setUserName(parsed.name);
            } catch (e) {
                if (userSession.name) setUserName(userSession.name);
            }
        }

        const unsubscribe = NetInfo.addEventListener(state => {
            setIsOnline(state.isConnected);
            if (state.isConnected) syncOfflineData();
        });

        fetchInventory(); // Fetch items on load
        return () => unsubscribe();
    }, []);

    // Getting the stored inventory
    const fetchInventory = async () => {
        setIsFetchingItems(true);
        try {
            const storedInventory = await StorageService.getCachedData("getInventory");

            if (storedInventory && Array.isArray(storedInventory)) {
                setInventoryList(storedInventory);
                setFilteredList(storedInventory);
            } else {
                console.log("No valid inventory array found in local storage.");
            }
        } catch (error) {
            console.log("Failed to load inventory from local storage:", error);
        }
        setIsFetchingItems(false);
    };

    const handleSearch = (text) => {
        setSearchQuery(text);
        const filtered = inventoryList.filter(item =>
            item.itemName.toLowerCase().includes(text.toLowerCase()) ||
            item.itemId.toLowerCase().includes(text.toLowerCase())
        );
        setFilteredList(filtered);
    };

    //--------------------------------------
    // UTILITIES (Storage & Images)
    //--------------------------------------
    const pickImage = async () => {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permissionResult.granted) {
            Alert.alert("Permission required", "You need to allow camera roll access to upload an invoice.");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.5,
            base64: true,
        });

        if (!result.canceled) {
            setInvoiceImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
            setRawBase64(result.assets[0].base64);
        }
    };

    const syncOfflineData = async () => {
        const queue = await StorageService.getOfflineQueue('stockIn');
        if (queue.length > 0) {
            for (const item of queue) {
                await postToGAS('receive', { data: item });
            }
            await StorageService.clearOfflineQueue('stockIn');
            Alert.alert("Sync Complete", "Your offline stock entries have been synced to the database.");
        }
    };

    const clearForm = () => {
        setSelectedItem(null);
        setItemName('');
        setPrice('');
        setQuantity('');
        setRemarks('');
        setInvoiceImage(null);
        setRawBase64(null);
    };

    //--------------------------------------
    // SUBMIT LOGIC
    //--------------------------------------
    const handleSubmit = async () => {
        // Validation Guardrails
        if (entryMode === 'restock' && !selectedItem) {
            Alert.alert("Validation Error", "Please select an item from the inventory.");
            return;
        }
        if (entryMode === 'expense' && !itemName.trim()) {
            Alert.alert("Validation Error", "Please enter a name for the new item or expense.");
            return;
        }
        if (!price || !quantity) {
            Alert.alert("Validation Error", "Please fill in Price and Quantity.");
            return;
        }

        setIsLoading(true);

        if (isOnline) {
            try {
                let uploadedImageUrl = '';

                // Step 1: Process Image Upload if selected
                if (rawBase64) {
                    const imageRes = await postToGAS('uploadImage', {
                        fileObject: { base64: rawBase64, name: `invoice_${Date.now()}.jpg`, type: 'image/jpeg' }
                    });

                    if (imageRes && imageRes.success) {
                        uploadedImageUrl = imageRes.imageUrl;
                    } else {
                        Alert.alert("Upload Error", "Failed to upload the invoice image.");
                        setIsLoading(false);
                        return;
                    }
                }

                // Step 2: Construct the exact payload expected by your updated Backend
                const finalItemName = entryMode === 'restock' ? selectedItem.itemName : itemName;
                const finalItemId = entryMode === 'restock' ? selectedItem.itemId : "";

                const payload = {
                    itemId: finalItemId,
                    itemName: finalItemName,
                    price: parseFloat(price),
                    quantity: parseInt(quantity, 10),
                    invoiceUrl: uploadedImageUrl,
                    remarks: remarks,
                    receivedBy: userName || "Unknown User",
                };

                // Step 3: Trigger GAS
                const response = await postToGAS('receive', { data: payload });

                if (response && response.success !== false) {
                    Alert.alert("Success", "Stock record saved successfully!");
                    clearForm();
                    if (entryMode === 'restock') fetchInventory(); // Refresh stock counts invisibly
                } else {
                    Alert.alert("Error", response.message || "Failed to update the database.");
                }
            } catch (err) {
                Alert.alert("Error", "An unexpected network error occurred.");
            }
        } else {
            Alert.alert("Offline Mode", "Image uploads cannot be processed offline at this time. Standard offline tracking requires adjustments to store large image files locally.");
        }

        setIsLoading(false);
    };

    return (
        <SafeAreaView style={[styles.container, { paddingBottom: 0}]} edges={['top', 'left', 'right']}>
            <View style={styles.headerRow}>
                <Text style={styles.headerTitle}>Stock In / Expense</Text>
                <View style={[styles.networkBadge, { backgroundColor: isOnline ? theme.primary : '#FF3B30' }]}>
                    <Text style={styles.networkText}>{isOnline ? 'Online' : 'Offline'}</Text>
                </View>
            </View>

            {/* Toggle Mode Control */}
            <View style={styles.toggleContainer}>
                <TouchableOpacity
                    style={[styles.toggleButton, entryMode === 'restock' && styles.toggleActive]}
                    onPress={() => setEntryMode('restock')}
                >
                    <Text style={[styles.toggleText, entryMode === 'restock' && styles.toggleTextActive]}>Restock Item</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.toggleButton, entryMode === 'expense' && styles.toggleActive]}
                    onPress={() => setEntryMode('expense')}
                >
                    <Text style={[styles.toggleText, entryMode === 'expense' && styles.toggleTextActive]}>New / Expense</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

                {/* Conditional Form Element */}
                {entryMode === 'restock' ? (
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Select Item *</Text>
                        <TouchableOpacity style={styles.selectorBox} onPress={() => setIsModalVisible(true)}>
                            <Text style={selectedItem ? styles.selectorText : styles.placeholderText}>
                                {selectedItem ? `${selectedItem.itemName} (${selectedItem.itemId})` : "Tap to select an item..."}
                            </Text>
                            <Ionicons name="chevron-down" size={20} color={theme.textMuted} />
                        </TouchableOpacity>
                        {selectedItem && (
                            <Text style={styles.stockHint}>Current Stock: {selectedItem.openingStock}</Text>
                        )}
                    </View>
                ) : (
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Expense / Item Name *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. Printer Ink, Screws"
                            placeholderTextColor={theme.textMuted}
                            value={itemName}
                            onChangeText={setItemName}
                        />
                    </View>
                )}

                {/* Shared Inputs */}
                <View style={styles.row}>
                    <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                        <Text style={styles.inputLabel}>Total Price *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="0.00"
                            placeholderTextColor={theme.textMuted}
                            keyboardType="numeric"
                            value={price}
                            onChangeText={setPrice}
                        />
                    </View>
                    <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                        <Text style={styles.inputLabel}>Quantity *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="0"
                            placeholderTextColor={theme.textMuted}
                            keyboardType="numeric"
                            value={quantity}
                            onChangeText={setQuantity}
                        />
                    </View>
                </View>

                {/* Image Upload Area */}
                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Invoice Picture</Text>
                    <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
                        {invoiceImage ? (
                            <Image source={{ uri: invoiceImage }} style={styles.imagePreview} />
                        ) : (
                            <View style={styles.imagePlaceholder}>
                                <Ionicons name="camera-outline" size={32} color={theme.textMuted} />
                                <Text style={styles.imagePlaceholderText}>Tap to attach invoice</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Remarks Section */}
                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Remarks</Text>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder="Supplier name, reason for expense..."
                        placeholderTextColor={theme.textMuted}
                        multiline={true}
                        numberOfLines={3}
                        value={remarks}
                        onChangeText={setRemarks}
                    />
                </View>

                {/* Submit Action */}
                <TouchableOpacity
                    style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
                    onPress={handleSubmit}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.submitButtonText}>Submit Record</Text>
                    )}
                </TouchableOpacity>
            </ScrollView>

            {/* ITEM SELECTOR MODAL */}
            <Modal visible={isModalVisible} animationType="slide" transparent={true}>
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Inventory Catalog</Text>
                            <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                                <Ionicons name="close" size={28} color={theme.text} />
                            </TouchableOpacity>
                        </View>

                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search by name or ID..."
                            placeholderTextColor={theme.textMuted}
                            value={searchQuery}
                            onChangeText={handleSearch}
                        />

                        {isFetchingItems ? (
                            <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 20 }} />
                        ) : (
                            <FlatList
                                data={filteredList}
                                keyExtractor={(item) => item.itemId}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={styles.modalItem}
                                        onPress={() => {
                                            setSelectedItem(item);
                                            setIsModalVisible(false);
                                        }}
                                    >
                                        <Text style={styles.modalItemName}>{item.itemName}</Text>
                                        <View style={{ flexDirection: 'row', marginTop: 4, alignItems: 'center', justifyContent: 'space-between' }}>
                                        <Text style={styles.modalItemSub}>{item.category} • {item.location} • {item.rack}</Text> 
                                        <Text style={{color: item.openingStock < item.minStock ? theme.danger : theme.primary}}>Stock Available: {item.openingStock}</Text>
                                        </View>
                                    </TouchableOpacity>
                                )}
                                ListEmptyComponent={<Text style={styles.emptyText}>No items found</Text>}
                            />
                        )}
                    </View>
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
}

const getStyles = (theme) => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10, alignItems: 'center' },
    headerTitle: { color: theme.text, fontSize: 24, fontWeight: 'bold' },
    networkBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
    networkText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },

    toggleContainer: { flexDirection: 'row', marginHorizontal: 20, backgroundColor: theme.card, borderRadius: 12, padding: 4, marginBottom: 10 },
    toggleButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
    toggleActive: { backgroundColor: theme.primary },
    toggleText: { color: theme.textMuted, fontWeight: 'bold' },
    toggleTextActive: { color: '#fff' },

    scrollContent: { padding: 20, paddingTop: 0 },
    inputGroup: { marginBottom: 16 },
    row: { flexDirection: 'row', justifyContent: 'space-between' },
    inputLabel: { color: theme.text, fontSize: 14, fontWeight: '500', marginBottom: 8, marginLeft: 4 },

    input: { backgroundColor: theme.inputBg, color: theme.text, borderRadius: 12, paddingHorizontal: 16, height: 50, fontSize: 15 },
    textArea: { height: 80, paddingTop: 12, textAlignVertical: 'top' },

    selectorBox: { backgroundColor: theme.inputBg, borderRadius: 12, paddingHorizontal: 16, height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    selectorText: { color: theme.text, fontSize: 15 },
    placeholderText: { color: theme.textMuted, fontSize: 15 },
    stockHint: { color: theme.primary, fontSize: 12, marginTop: 4, marginLeft: 4, fontWeight: '500' },

    imagePicker: { backgroundColor: theme.inputBg, borderRadius: 12, height: 130, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: theme.card, borderStyle: 'dashed' },
    imagePreview: { width: '100%', height: '100%', resizeMode: 'cover' },
    imagePlaceholder: { alignItems: 'center' },
    imagePlaceholderText: { color: theme.textMuted, marginTop: 8, fontSize: 14 },

    submitButton: { backgroundColor: theme.primary, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 10, marginBottom: 30 },
    submitButtonDisabled: { opacity: 0.7 },
    submitButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

    // Modal Styles
    modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: theme.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '80%', padding: 20 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    modalTitle: { color: theme.text, fontSize: 20, fontWeight: 'bold' },
    searchInput: { backgroundColor: theme.inputBg, color: theme.text, borderRadius: 10, paddingHorizontal: 15, height: 45, marginBottom: 15 },
    modalItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: theme.card },
    modalItemName: { color: theme.text, fontSize: 16, fontWeight: '500' },
    modalItemSub: { color: theme.textMuted, fontSize: 13, marginTop: 4 },
    emptyText: { color: theme.textMuted, textAlign: 'center', marginTop: 30 }
});