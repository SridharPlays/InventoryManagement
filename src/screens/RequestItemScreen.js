import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/theme';
import { postToGAS } from '../services/api';

export default function RequestItemScreen({ userData }) {
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('');

  const handleSubmit = async () => {
    if (!itemName || !quantity) return Alert.alert("Error", "Fill all fields");
    
    const payload = {
      action: 'request',
      data: {
        tlName: userData?.name || 'Unknown TL',
        itemId: 'N/A', // Or add a scanner to get exact ID
        itemName,
        quantity
      }
    };

    const response = await postToGAS('request', payload.data); // Calls your backend requestItem function
    if (response.success) {
      Alert.alert("Success", "Request sent to admin!");
      setItemName('');
      setQuantity('');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.headerTitle}>Request New Item</Text>
      <View style={styles.form}>
        <TextInput style={styles.input} placeholder="Item Name" placeholderTextColor={COLORS.textMuted} value={itemName} onChangeText={setItemName} />
        <TextInput style={styles.input} placeholder="Quantity" placeholderTextColor={COLORS.textMuted} keyboardType="numeric" value={quantity} onChangeText={setQuantity} />
        <TouchableOpacity style={styles.button} onPress={handleSubmit}>
          <Text style={styles.buttonText}>Submit Request</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, padding: 20 },
  headerTitle: { color: COLORS.text, fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  form: { gap: 16 },
  input: { backgroundColor: COLORS.inputBg, color: COLORS.text, padding: 16, borderRadius: 12, fontSize: 16 },
  button: { backgroundColor: COLORS.primary, padding: 16, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});