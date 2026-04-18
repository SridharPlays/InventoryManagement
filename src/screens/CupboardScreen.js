import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { StorageService } from '../services/storage';

export default function CupboardScreen({ route, navigation }) {
  const { cupboardId, floorId } = route.params;
  const [cupboardItems, setCupboardItems] = useState([]);

  useEffect(() => {
    const fetchLocalInventory = async () => {
      // Pulling from cache just like the Kotlin implementation
      const cachedInventory = await StorageService.getCachedData('getInventory') || [];
      
      const filtered = cachedInventory.filter(item => {
        const matchesCupboard = item.cupboard?.toLowerCase() === cupboardId.toLowerCase();
        // Regex match for floor just like Kotlin: "(^|\\D)$floorId(\\D|$)"
        const floorRegex = new RegExp(`(^|\\D)${floorId}(\\D|$)`);
        const matchesFloor = floorRegex.test(item.location || "");
        
        return matchesCupboard && matchesFloor;
      });
      
      setCupboardItems(filtered);
    };
    
    fetchLocalInventory();
  }, [cupboardId, floorId]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Floor {floorId} - Cupboard {cupboardId}</Text>
      </View>

      <ScrollView style={styles.content}>
        {cupboardItems.length === 0 ? (
          <Text style={styles.emptyText}>No items found in this location.</Text>
        ) : (
          cupboardItems.map((item, i) => (
            <View key={i} style={styles.listCard}>
              <View style={styles.iconPlaceholder} />
              <View style={styles.listContent}>
                <Text style={styles.itemName} numberOfLines={1}>{item.itemName}</Text>
                <Text style={styles.itemSub}>{item.itemId} • {item.category}</Text>
              </View>
              <View style={styles.listTrailing}>
                <Text style={styles.stockText}>{item.openingStock} {item.unit || ''}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerRow: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 16 },
  headerTitle: { color: COLORS.text, fontSize: 18, fontWeight: 'bold' },
  content: { paddingHorizontal: 16 },
  emptyText: { color: COLORS.textMuted, textAlign: 'center', marginTop: 40 },
  listCard: { flexDirection: 'row', backgroundColor: COLORS.card, padding: 16, borderRadius: 12, marginBottom: 12, alignItems: 'center' },
  iconPlaceholder: { width: 40, height: 40, borderRadius: 8, backgroundColor: COLORS.primary + '20' },
  listContent: { flex: 1, marginLeft: 16 },
  itemName: { color: COLORS.text, fontWeight: '600', marginBottom: 4 },
  itemSub: { color: COLORS.textMuted, fontSize: 12 },
  listTrailing: { alignItems: 'flex-end' },
  stockText: { color: COLORS.text, fontWeight: 'bold' },
});