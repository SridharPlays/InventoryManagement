import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image, ScrollView,
    StyleSheet,
    Text,
    TextInput, TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/theme';
import { postToGAS } from '../services/api';
import { StorageService } from '../services/storage';

// CUSTOM INLINE DROPDOWN COMPONENT (Adapted for Selection)
const CustomDropdown = ({ label, options, selectedValue, onSelect, placeholder }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <View style={styles.customDropdownContainer}>
            <Text style={styles.inputLabel}>{label}</Text>

            <TouchableOpacity
                style={styles.dropdownSelector}
                activeOpacity={0.7}
                onPress={() => setIsExpanded(!isExpanded)}
            >
                <Text style={{ color: selectedValue ? COLORS.text : COLORS.textMuted, fontSize: 15 }}>
                    {selectedValue ? (label.includes("Cupboard") ? `Cupboard ${selectedValue}` : selectedValue) : placeholder}
                </Text>
                <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color={COLORS.textMuted} />
            </TouchableOpacity>

            {isExpanded && (
                <View style={styles.dropdownListContainer}>
                    <ScrollView nestedScrollEnabled style={{ maxHeight: 150 }}>
                        {options.length === 0 ? (
                            <Text style={{ padding: 14, color: COLORS.textMuted }}>No options available</Text>
                        ) : (
                            options.map((option) => (
                                <TouchableOpacity
                                    key={option}
                                    style={[styles.dropdownOption, selectedValue === option && styles.dropdownOptionSelected]}
                                    onPress={() => { onSelect(option); setIsExpanded(false); }}
                                >
                                    <Text style={{ color: selectedValue === option ? COLORS.primary : COLORS.text }}>
                                        {label.includes("Cupboard") ? `Cupboard ${option}` : option}
                                    </Text>
                                </TouchableOpacity>
                            ))
                        )}
                    </ScrollView>
                </View>
            )}
        </View>
    );
};

export default function RelocateScreen({ route, navigation }) {
    const initialItemId = route.params?.initialItemId || null;

    const [items, setItems] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState(initialItemId ? [initialItemId] : []);

    const [step, setStep] = useState(1);

    // Destination State
    const [newLocation, setNewLocation] = useState('');
    const [newCupboard, setNewCupboard] = useState('');
    const [newRack, setNewRack] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const loadInventory = async () => {
            const cached = await StorageService.getCachedData('getInventory') || [];
            setItems(cached.filter(item => item.status === 'Active'));
        };
        loadInventory();
    }, []);

    // DYNAMIC DROPDOWN OPTIONS
    const uniqueLocations = useMemo(() => {
        const locs = new Set(items.map(item => item.location).filter(Boolean));
        return Array.from(locs).sort();
    }, [items]);

    const availableCupboards = useMemo(() => {
        const relevantItems = newLocation
            ? items.filter(item => item.location === newLocation)
            : items;

        const cupboards = new Set(relevantItems.map(item => item.cupboard).filter(Boolean));

        return Array.from(cupboards).sort((a, b) => {
            return a.toString().localeCompare(b.toString(), undefined, { numeric: true, sensitivity: 'base' });
        });
    }, [items, newLocation]);

    const filteredItems = useMemo(() => {
        if (!searchQuery) return items;
        return items.filter(item =>
            item.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.itemId.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [items, searchQuery]);

    const toggleSelection = (id) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const handleSelectAll = () => {
        if (selectedIds.length === filteredItems.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredItems.map(item => item.itemId));
        }
    };

    const submitRelocation = async () => {
        if (!newLocation && !newCupboard && !newRack) {
            return Alert.alert("Error", "Please select at least one destination field to update.");
        }

        setIsLoading(true);
        try {
            const response = await postToGAS('bulkRelocate', {
                itemIds: selectedIds,
                newLocation,
                newCupboard,
                newRack
            });

            if (response.success) {
                Alert.alert("Success", response.message || "Items relocated successfully.");
                await StorageService.removeCachedData('getInventory');
                navigation.goBack();
            } else {
                Alert.alert("Error", response.message || "Failed to relocate items.");
            }
        } catch (error) {
            Alert.alert("Error", "Network error occurred.");
        } finally {
            setIsLoading(false);
        }
    };

    const renderItem = ({ item }) => {
        const isSelected = selectedIds.includes(item.itemId);
        return (
            <TouchableOpacity
                style={[styles.itemCard, isSelected && styles.itemCardSelected]}
                activeOpacity={0.7}
                onPress={() => toggleSelection(item.itemId)}
            >
                <Ionicons
                    name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                    size={24}
                    color={isSelected ? COLORS.primary : COLORS.textMuted}
                    style={{ marginRight: 12 }}
                />
                <View style={styles.iconPlaceholder}>
                    <Image
                        source={item.imageUrl ? { uri: item.imageUrl } : require('../../assets/images/caps_logo.png')}
                        style={{ width: '100%', height: '100%', borderRadius: 8 }}
                    />
                </View>
                <View style={styles.itemContent}>
                    <Text style={styles.itemName} numberOfLines={1}>{item.itemName}</Text>
                    <Text style={styles.itemSub}>{item.location} • Cupboard {item.cupboard || 'N/A'}</Text>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.headerRow}>
                <TouchableOpacity onPress={() => step === 2 ? setStep(1) : navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{step === 1 ? 'Select Items' : 'Set Destination'}</Text>
                <View style={{ width: 24 }} />
            </View>

            {step === 1 ? (
                // STEP 1: SELECT ITEMS
                <View style={{ flex: 1, paddingHorizontal: 16 }}>
                    <View style={styles.searchContainer}>
                        <Ionicons name="search" size={20} color={COLORS.textMuted} style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search items to relocate..."
                            placeholderTextColor={COLORS.textMuted}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>

                    <View style={styles.selectionBar}>
                        <Text style={styles.selectionText}>{selectedIds.length} Selected</Text>
                        <TouchableOpacity onPress={handleSelectAll}>
                            <Text style={styles.selectAllText}>
                                {selectedIds.length === filteredItems.length && filteredItems.length > 0 ? 'Deselect All' : 'Select All'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <FlatList
                        data={filteredItems}
                        keyExtractor={item => item.itemId}
                        renderItem={renderItem}
                        contentContainerStyle={{ paddingBottom: 100 }}
                    />

                    {selectedIds.length > 0 && (
                        <View style={styles.bottomBar}>
                            <TouchableOpacity style={styles.primaryButton} onPress={() => setStep(2)}>
                                <Text style={styles.primaryButtonText}>Continue ({selectedIds.length} Items)</Text>
                                <Ionicons name="arrow-forward" size={20} color="#fff" style={{ marginLeft: 8 }} />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            ) : (
                // STEP 2: SET DESTINATION
                <ScrollView style={{ flex: 1, padding: 20 }} keyboardShouldPersistTaps="handled">
                    <View style={styles.summaryBox}>
                        <Ionicons name="information-circle" size={24} color={COLORS.primary} style={{ marginRight: 10 }} />
                        <Text style={styles.summaryText}>
                            Relocating <Text style={{ fontWeight: 'bold', color: COLORS.text }}>{selectedIds.length} items</Text>.
                            Leave dropdowns blank if you do not want to change them.
                        </Text>
                    </View>

                    <CustomDropdown
                        label="New Location / Floor"
                        placeholder="Select a location..."
                        options={uniqueLocations}
                        selectedValue={newLocation}
                        onSelect={(val) => {
                            setNewLocation(val);
                            setNewCupboard(''); // Reset cupboard when floor changes
                        }}
                    />

                    <View style={styles.row}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                            <CustomDropdown
                                label="New Cupboard"
                                placeholder="Select cupboard..."
                                options={availableCupboards}
                                selectedValue={newCupboard}
                                onSelect={setNewCupboard}
                            />
                        </View>
                        <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                            <Text style={styles.inputLabel}>New Rack</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g., 2"
                                placeholderTextColor={COLORS.textMuted}
                                value={newRack}
                                onChangeText={setNewRack}
                            />
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[styles.primaryButton, isLoading && { opacity: 0.7 }, { marginTop: 20, marginBottom: 40 }]}
                        onPress={submitRelocation}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.primaryButtonText}>Confirm Relocation</Text>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
    headerTitle: { color: COLORS.text, fontSize: 20, fontWeight: 'bold' },

    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.inputBg, borderRadius: 12, paddingHorizontal: 12, marginBottom: 16 },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, color: COLORS.text, height: 48, fontSize: 15 },

    selectionBar: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, paddingHorizontal: 4 },
    selectionText: { color: COLORS.text, fontWeight: '600' },
    selectAllText: { color: COLORS.primary, fontWeight: '600' },

    itemCard: { flexDirection: 'row', backgroundColor: COLORS.card, padding: 12, borderRadius: 12, marginBottom: 8, alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
    itemCardSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '10' },
    iconPlaceholder: { width: 50, height: 50, borderRadius: 8, backgroundColor: COLORS.inputBg, marginRight: 12 },
    itemContent: { flex: 1 },
    itemName: { color: COLORS.text, fontSize: 16, fontWeight: '600', marginBottom: 4 },
    itemSub: { color: COLORS.textMuted, fontSize: 13 },

    bottomBar: { position: 'absolute', bottom: 20, left: 16, right: 16 },
    primaryButton: { backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
    primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

    summaryBox: { flexDirection: 'row', backgroundColor: COLORS.primary + '15', padding: 16, borderRadius: 12, marginBottom: 24, alignItems: 'center' },
    summaryText: { color: COLORS.textMuted, flex: 1, fontSize: 14, lineHeight: 20 },

    inputGroup: { marginBottom: 16 },
    inputLabel: { color: COLORS.text, fontSize: 14, fontWeight: '500', marginBottom: 8, marginLeft: 4 },
    input: { backgroundColor: COLORS.inputBg, color: COLORS.text, borderRadius: 12, paddingHorizontal: 16, height: 52, fontSize: 15 },
    row: { flexDirection: 'row' },

    // Dropdown Styles
    customDropdownContainer: { marginBottom: 20 },
    dropdownSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.inputBg, padding: 16, borderRadius: 12, height: 52 },

    dropdownListContainer: {
        backgroundColor: COLORS.inputBg,
        borderRadius: 12,
        marginTop: 8,
        borderWidth: 1,
        borderColor: COLORS.card,
        overflow: 'hidden'
    },

    dropdownOption: { paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: COLORS.card },
    dropdownOptionSelected: { backgroundColor: COLORS.primary + '10' },
});