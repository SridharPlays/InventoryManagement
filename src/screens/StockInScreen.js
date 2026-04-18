import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    Image, Alert, ScrollView, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import NetInfo from '@react-native-community/netinfo';

import { COLORS } from '../constants/theme';
import { postToGAS } from '../services/api';
import { StorageService } from '../services/storage';

export default function StockInScreen() {
    const [itemName, setItemName] = useState('');
    const [price, setPrice] = useState('');
    const [quantity, setQuantity] = useState('');
    const [remarks, setRemarks] = useState('');
    const [invoiceImage, setInvoiceImage] = useState(null);

    const [isLoading, setIsLoading] = useState(false);
    const [isOnline, setIsOnline] = useState(true);

    // Listen to network changes
    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            setIsOnline(state.isConnected);
            if (state.isConnected) {
                syncOfflineData();
            }
        });
        return () => unsubscribe();
    }, []);

    const pickImage = async () => {
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permissionResult.granted === false) {
            Alert.alert("Permission required", "You need to allow camera roll access to upload an invoice.");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.5, // Compress image to reduce payload size for GAS
            base64: true, // Required to send image data through JSON
        });

        if (!result.canceled) {
            setInvoiceImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
        }
    };

    const syncOfflineData = async () => {
        const queue = await StorageService.getOfflineQueue('stockIn');
        if (queue.length > 0) {
            console.log(`Syncing ${queue.length} offline items...`);
            for (const item of queue) {
                await postToGAS('stockIn', item);
            }
            await StorageService.clearOfflineQueue('stockIn');
            Alert.alert("Sync Complete", "Your offline stock entries have been synced to the database.");
        }
    };

    const handleSubmit = async () => {
        if (!itemName || !price || !quantity) {
            Alert.alert("Validation Error", "Please fill in Name, Price, and Quantity.");
            return;
        }

        const payload = {
            timestamp: new Date().toISOString(),
            itemName,
            price: parseFloat(price),
            quantity: parseInt(quantity, 10),
            remarks,
            invoiceImage
        };

        setIsLoading(true);

        if (isOnline) {
            // Send directly to backend
            const response = await postToGAS('stockIn', payload);
            if (response && response.success !== false) {
                Alert.alert("Success", "Stock updated successfully!");
                clearForm();
            } else {
                Alert.alert("Error", "Failed to update stock. Try again.");
            }
        } else {
            // Save locally if offline
            await StorageService.addToOfflineQueue('stockIn', payload);
            Alert.alert("Offline", "No internet connection. Data saved locally and will be synced when you are back online.");
            clearForm();
        }

        setIsLoading(false);
    };

    const clearForm = () => {
        setItemName('');
        setPrice('');
        setQuantity('');
        setRemarks('');
        setInvoiceImage(null);
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.headerRow}>
                <Text style={styles.headerTitle}>Stock In</Text>
                <View style={[styles.networkBadge, { backgroundColor: isOnline ? COLORS.primary : '#FF3B30' }]}>
                    <Text style={styles.networkText}>{isOnline ? 'Online' : 'Offline'}</Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Item Name *</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. Mechanical Keyboard"
                        placeholderTextColor={COLORS.textMuted}
                        value={itemName}
                        onChangeText={setItemName}
                    />
                </View>

                <View style={styles.row}>
                    <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                        <Text style={styles.inputLabel}>Price *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="0.00"
                            placeholderTextColor={COLORS.textMuted}
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
                            placeholderTextColor={COLORS.textMuted}
                            keyboardType="numeric"
                            value={quantity}
                            onChangeText={setQuantity}
                        />
                    </View>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Invoice Picture</Text>
                    <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
                        {invoiceImage ? (
                            <Image source={{ uri: invoiceImage }} style={styles.imagePreview} />
                        ) : (
                            <View style={styles.imagePlaceholder}>
                                <Ionicons name="camera-outline" size={32} color={COLORS.textMuted} />
                                <Text style={styles.imagePlaceholderText}>Tap to add invoice</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Remarks</Text>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder="Add any notes here..."
                        placeholderTextColor={COLORS.textMuted}
                        multiline={true}
                        numberOfLines={4}
                        value={remarks}
                        onChangeText={setRemarks}
                    />
                </View>

                <TouchableOpacity
                    style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
                    onPress={handleSubmit}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.submitButtonText}>Submit Stock In</Text>
                    )}
                </TouchableOpacity>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10, alignItems: 'center' },
    headerTitle: { color: COLORS.text, fontSize: 24, fontWeight: 'bold' },
    networkBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
    networkText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
    scrollContent: { padding: 20 },
    inputGroup: { marginBottom: 16 },
    row: { flexDirection: 'row', justifyContent: 'space-between' },
    inputLabel: { color: COLORS.text, fontSize: 14, fontWeight: '500', marginBottom: 8, marginLeft: 4 },
    input: { backgroundColor: COLORS.inputBg, color: COLORS.text, borderRadius: 12, paddingHorizontal: 16, height: 50, fontSize: 15 },
    textArea: { height: 100, paddingTop: 12, textAlignVertical: 'top' },
    imagePicker: { backgroundColor: COLORS.inputBg, borderRadius: 12, height: 150, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.card, borderStyle: 'dashed' },
    imagePreview: { width: '100%', height: '100%', resizeMode: 'cover' },
    imagePlaceholder: { alignItems: 'center' },
    imagePlaceholderText: { color: COLORS.textMuted, marginTop: 8, fontSize: 14 },
    submitButton: { backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
    submitButtonDisabled: { opacity: 0.7 },
    submitButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});