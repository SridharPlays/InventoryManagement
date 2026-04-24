import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

export default function CustomDropdown({ label, options, selectedValue, onSelect, placeholder }) {
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
          {selectedValue ? (label === "Cupboard" ? `Cupboard ${selectedValue}` : selectedValue) : placeholder}
        </Text>
        <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color={COLORS.textMuted} />
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.dropdownListContainer}>
          <ScrollView nestedScrollEnabled style={{ maxHeight: 150 }}>
            <TouchableOpacity
              style={[styles.dropdownOption, !selectedValue && styles.dropdownOptionSelected]}
              onPress={() => { onSelect(''); setIsExpanded(false); }}
            >
              <Text style={{ color: !selectedValue ? COLORS.primary : COLORS.textMuted }}>
                {label.includes("Category") ? "Uncategorized" : `All ${label}s`}
              </Text>
            </TouchableOpacity>

            {options.map((option) => (
              <TouchableOpacity
                key={option}
                style={[styles.dropdownOption, selectedValue === option && styles.dropdownOptionSelected]}
                onPress={() => { onSelect(option); setIsExpanded(false); }}
              >
                <Text style={{ color: selectedValue === option ? COLORS.primary : COLORS.text }}>
                  {label === "Cupboard" ? `Cupboard ${option}` : option}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  inputLabel: { color: COLORS.text, fontSize: 13, fontWeight: '500', marginBottom: 8, marginLeft: 4 },
  customDropdownContainer: { marginBottom: 16 },
  dropdownSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.inputBg, padding: 16, borderRadius: 12 },
  dropdownListContainer: { backgroundColor: COLORS.inputBg, borderRadius: 12, marginTop: 4, borderWidth: 1, borderColor: COLORS.card, overflow: 'hidden' },
  dropdownOption: { paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: COLORS.card },
  dropdownOptionSelected: { backgroundColor: COLORS.primary + '10' },
});