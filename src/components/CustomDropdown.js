import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export default function CustomDropdown({ label, options, selectedValue, onSelect, placeholder }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { theme } = useTheme();
  const styles = getStyles(theme);

  return (
    <View style={styles.customDropdownContainer}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TouchableOpacity
        style={styles.dropdownSelector}
        activeOpacity={0.7}
        onPress={() => setIsExpanded(!isExpanded)}
      >
        <Text style={{ color: selectedValue ? theme.text : theme.textMuted, fontSize: 15 }}>
          {selectedValue ? (label === "Cupboard" ? `Cupboard ${selectedValue}` : selectedValue) : placeholder}
        </Text>
        <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={20} color={theme.textMuted} />
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.dropdownListContainer}>
          <ScrollView nestedScrollEnabled style={{ maxHeight: 150 }}>
            <TouchableOpacity
              style={[styles.dropdownOption, !selectedValue && styles.dropdownOptionSelected]}
              onPress={() => { onSelect(''); setIsExpanded(false); }}
            >
              <Text style={{ color: !selectedValue ? theme.primary : theme.textMuted }}>
                {label.includes("Category") ? "Uncategorized" : `All ${label}s`}
              </Text>
            </TouchableOpacity>

            {options.map((option) => (
              <TouchableOpacity
                key={option}
                style={[styles.dropdownOption, selectedValue === option && styles.dropdownOptionSelected]}
                onPress={() => { onSelect(option); setIsExpanded(false); }}
              >
                <Text style={{ color: selectedValue === option ? theme.primary : theme.text }}>
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

const getStyles = (theme) => StyleSheet.create({
  inputLabel: { color: theme.text, fontSize: 13, fontWeight: '500', marginBottom: 8, marginLeft: 4 },
  customDropdownContainer: { marginBottom: 16 },
  dropdownSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: theme.inputBg, padding: 16, borderRadius: 12 },
  dropdownListContainer: { backgroundColor: theme.inputBg, borderRadius: 12, marginTop: 4, borderWidth: 1, borderColor: theme.card, overflow: 'hidden' },
  dropdownOption: { paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: theme.card },
  dropdownOptionSelected: { backgroundColor: theme.primary + '10' },
});