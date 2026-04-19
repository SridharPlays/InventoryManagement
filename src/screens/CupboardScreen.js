import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
    Image,
    LayoutAnimation,
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
import { StorageService } from '../services/storage';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const RackSection = ({ rackName, items }) => {
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
          {items.map((item, i) => (
            <View key={i} style={styles.listCard}>
              {/* ADDED IMAGE COMPONENT HERE */}
              <View style={styles.iconPlaceholder}>
                <Image 
                  source={item.imageUrl ? { uri: item.imageUrl } : require('../../assets/images/caps_logo.png')} 
                  style={{ width: '100%', height: '100%', borderRadius: 8 }} 
                  resizeMode="cover" 
                />
              </View>
              <View style={styles.listContent}>
                <Text style={styles.itemName} numberOfLines={1}>{item.itemName}</Text>
                <Text style={styles.itemSub}>{item.itemId} • {item.category}</Text>
              </View>
              <View style={styles.listTrailing}>
                <Text style={styles.stockText}>{item.openingStock} {item.unit || ''}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

export default function CupboardScreen({ route, navigation }) {
  const { cupboardId, floorId } = route.params;
  const [groupedItems, setGroupedItems] = useState([]);

  useEffect(() => {
    const fetchLocalInventory = async () => {
      const cachedInventory = await StorageService.getCachedData('getInventory') || [];
      
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
        {groupedItems.length === 0 ? (
          <Text style={styles.emptyText}>No items found in this location.</Text>
        ) : (
          groupedItems.map((group, index) => (
            <RackSection 
              key={index} 
              rackName={group.rackName} 
              items={group.items} 
            />
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerRow: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 16 },
  headerTitle: { color: COLORS.text, fontSize: 20, fontWeight: 'bold' },
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
  
  listCard: { flexDirection: 'row', backgroundColor: COLORS.background, padding: 12, borderRadius: 12, marginBottom: 8, alignItems: 'center' },
  iconPlaceholder: { width: 60, height: 60, borderRadius: 8, backgroundColor: COLORS.primary + '20' },
  listContent: { flex: 1, marginLeft: 12 },
  itemName: { color: COLORS.text, fontWeight: '600', marginBottom: 2 },
  itemSub: { color: COLORS.textMuted, fontSize: 12 },
  listTrailing: { alignItems: 'flex-end' },
  stockText: { color: COLORS.text, fontWeight: 'bold' },
});