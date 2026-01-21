import { useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, List, TextInput as PaperTextInput } from 'react-native-paper';

import { PatternBackground } from '@/components/pattern-background';
import { LogoWithShimmer } from '@/components/logo-with-shimmer';
import { useMealPlanStore } from '@/src/state/useMealPlanStore';
import { usePreferencesStore } from '@/src/state/usePreferencesStore';

export default function PantryScreen() {
  const { pantryItems, addPantryItem, removePantryItem } = usePreferencesStore();
  const { isGeneratingPlan } = useMealPlanStore();
  const [pantryInput, setPantryInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const canAdd = Boolean(pantryInput.trim() && selectedCategory);
  const addScale = useRef(new Animated.Value(1)).current;
  const animateAdd = () => {
    Animated.sequence([
      Animated.timing(addScale, { toValue: 0.94, duration: 90, useNativeDriver: true }),
      Animated.timing(addScale, { toValue: 1, duration: 140, useNativeDriver: true }),
    ]).start();
  };

  const categories = [
    'Baking Supplies',
    'Canned Goods',
    'Condiments & Sauces',
    'Grains & Pasta',
    'Herbs & Spices',
    'Oils & Vinegars',
    'Others',
  ];

  const handleAddPantryItem = () => {
    if (!pantryInput.trim()) {
      return;
    }
    if (!selectedCategory) {
      return;
    }
    animateAdd();
    addPantryItem(pantryInput, selectedCategory as typeof categories[number]);
    setPantryInput('');
  };

  const groupedItems = categories.map((category) => ({
    category,
    items: pantryItems
      .filter((item) => item.category === category)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name)),
  }));
  const dropdownHeight = categories.length * 40 + 8;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.headerBar}>
        <View style={styles.headerRow}>
          <View style={styles.logoTitleRow}>
            <LogoWithShimmer isActive={isGeneratingPlan} tintColor="#1F1F1F" size={32} />
            <View>
              <Text style={styles.title}>Pantry</Text>
            </View>
          </View>
        </View>
      </View>
      <View style={styles.contentSurface}>
        <PatternBackground />
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.cardTitle}>My Pantry</Text>
          <Text style={styles.categoryLabel}>Category</Text>
          <Pressable
            onPress={() => setCategoryOpen((prev) => !prev)}
            style={styles.categoryPressable}
            accessibilityRole="button">
            <View style={styles.categoryInputContainer}>
              <PaperTextInput
                mode="outlined"
                value={selectedCategory ?? ''}
                placeholder="Select a category"
                editable={false}
                pointerEvents="none"
                style={[styles.inputOutline, styles.categoryInputBox]}
                textColor="#1F1F1F"
                contentStyle={styles.inputContent}
                placeholderTextColor="#B0B6BC"
              />
              <MaterialCommunityIcons
                name={categoryOpen ? 'chevron-up' : 'chevron-down'}
                size={16}
                color="#6B7280"
                style={styles.categoryIconOverlay}
              />
            </View>
          </Pressable>
          {categoryOpen ? (
            <View style={styles.categoryDropdownShell}>
              <PaperTextInput
                mode="outlined"
                editable={false}
                value=""
                style={[styles.categoryDropdownOutline, { height: dropdownHeight }]}
                contentStyle={styles.dropdownContent}
                pointerEvents="none"
              />
              <View style={styles.categoryDropdownContent} pointerEvents="box-none">
                {categories.map((category, index) => (
                  <Pressable
                    key={category}
                    onPress={() => {
                      setSelectedCategory(category);
                      setCategoryOpen(false);
                    }}
                    style={[
                      styles.categoryOptionRow,
                      index === categories.length - 1 && styles.categoryOptionRowLast,
                    ]}>
                    <Text style={styles.categoryOptionText}>{category}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
          <Text style={styles.categoryLabel}>Item</Text>
          <View style={styles.pantryRow}>
            <View style={styles.pantryInputWrap}>
              <PaperTextInput
                mode="outlined"
                placeholder="Add pantry item (e.g., olive oil)"
                value={pantryInput}
                onChangeText={setPantryInput}
                onSubmitEditing={handleAddPantryItem}
                style={[styles.inputOutline, styles.inputBox, styles.pantryInput]}
                textColor="#1F1F1F"
                contentStyle={styles.inputContent}
                placeholderTextColor="#B0B6BC"
                dense
              />
            </View>
            <Animated.View style={{ transform: [{ scale: addScale }] }}>
              <Button
                mode="contained"
                onPress={handleAddPantryItem}
                disabled={!canAdd}
                buttonColor={canAdd ? '#3C9A5C' : '#E0E0E0'}
                textColor={canAdd ? '#FFFFFF' : '#9AA0A6'}
                style={styles.pantryAddButton}
                contentStyle={styles.pantryAddButtonContent}>
                <Text style={[styles.pantryAddButtonText, !canAdd && styles.pantryAddButtonTextDisabled]}>
                  Add
                </Text>
              </Button>
            </Animated.View>
          </View>
          {pantryItems.length ? (
            <View style={styles.pantryList}>
              {groupedItems.map((group) =>
                group.items.length ? (
                  <View key={group.category} style={styles.pantryGroup}>
                    <Text style={styles.groupTitle}>{group.category}</Text>
                    <View style={styles.pantryItemsRow}>
                      {group.items.map((item) => (
                        <View key={`${group.category}-${item.name}`} style={styles.pantryChip}>
                          <Text style={styles.pantryChipText}>{item.name}</Text>
                          <Pressable onPress={() => removePantryItem(item)} style={styles.pantryChipClose}>
                            <MaterialCommunityIcons name="close" size={10} color="#1F1F1F" />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null
              )}
            </View>
          ) : (
            <Text style={styles.value}>No pantry items yet.</Text>
          )}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerBar: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingBottom: 8,
    paddingTop: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  contentSurface: {
    flex: 1,
    backgroundColor: '#B6DCC6',
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E6E9EF',
    padding: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1B7F3A',
    marginBottom: 12,
  },
  helperText: {
    fontSize: 12,
    color: '#5F6368',
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    color: '#5F6368',
    marginBottom: 4,
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F1F1F',
    marginBottom: 6,
  },
  inputOutline: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  inputBox: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    height: 34,
  },
  inputContent: {
    fontSize: 12,
    height: 34,
    paddingVertical: 0,
  },
  categoryInputBox: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    height: 34,
  },
  categoryInputContainer: {
    position: 'relative',
  },
  categoryPressable: {
    marginBottom: 8,
  },
  categoryIconOverlay: {
    position: 'absolute',
    right: 12,
    top: '50%',
    marginTop: -8,
  },
  categoryDropdownBox: {
    marginBottom: 12,
    overflow: 'hidden',
  },
  categoryDropdownShell: {
    marginBottom: 12,
  },
  categoryDropdownOutline: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  dropdownContent: {
    paddingVertical: 0,
  },
  categoryDropdownContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 4,
  },
  categoryOptionRow: {
    paddingHorizontal: 12,
    height: 40,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#EEF1F4',
  },
  categoryOptionRowLast: {
    borderBottomWidth: 0,
  },
  categoryOptionText: {
    fontSize: 12,
    color: '#1F1F1F',
  },
  pantryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  pantryInput: {
    height: 34,
    width: '100%',
  },
  pantryInputWrap: {
    flex: 1,
  },
  pantryAddButton: {
    height: 34,
    justifyContent: 'center',
    borderRadius: 6,
  },
  pantryAddButtonContent: {
    height: 34,
  },
  pantryAddButtonText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  pantryAddButtonTextDisabled: {
    color: '#9AA0A6',
  },
  pantryList: {
    gap: 12,
  },
  pantryGroup: {
    gap: 8,
  },
  groupTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1B7F3A',
  },
  pantryItemsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pantryChip: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E0E0E0',
    borderWidth: 1,
    borderRadius: 10,
    height: 28,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pantryChipText: {
    fontSize: 12,
    color: '#1F1F1F',
  },
  pantryChipClose: {
    width: 8,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 13,
    color: '#5F6368',
  },
});
