import { useMemo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Button, Checkbox, Chip, TextInput } from 'react-native-paper';

import { PatternBackground } from '@/components/pattern-background';
import { GROCERY_STORES } from '@/src/constants/stores';
import { usePreferencesStore } from '@/src/state/usePreferencesStore';
import { formatPostalCode, isValidCanadianPostalCode, normalizePostalCode } from '@/src/utils/postalCode';
import { resolveStoreLogo } from '@/src/utils/storeLogos';

const dietaryOptions = ['None', 'Vegetarian', 'Vegan', 'Pescatarian', 'Halal', 'Keto'];


export default function OnboardingScreen() {
  const {
    postalCode,
    dietaryPreferences,
    allergies,
    householdSize,
    setPostalCode,
    setDietaryPreferences,
    setAllergies,
    setHouseholdSize,
    favoriteStores,
    toggleFavoriteStore,
    pantryItems,
    addPantryItem,
    removePantryItem,
    onboardingComplete,
    setOnboardingComplete,
  } = usePreferencesStore();

  const [postalInput, setPostalInput] = useState(formatPostalCode(postalCode));
  const [selectedDietary, setSelectedDietary] = useState<string[]>(dietaryPreferences);
  const [allergiesInput, setAllergiesInput] = useState(allergies);
  const [householdInput, setHouseholdInput] = useState(householdSize ? String(householdSize) : '');
  const [error, setError] = useState('');
  const [stepIndex, setStepIndex] = useState(0);
  const scrollRef = useRef<ScrollView | null>(null);

  const pantryOptions = [
    {
      category: 'Baking Supplies',
      items: ['Baking Powder', 'Baking Soda', 'Cornstarch', 'Flour', 'Yeast'],
    },
    {
      category: 'Condiments & Sauces',
      items: ['Honey', 'Maple Syrup', 'Miso', 'Oyster Sauce', 'Soy Sauce', 'Vinegar'],
    },
    {
      category: 'Grains & Pasta',
      items: ['Rice', 'Pasta', 'Quinoa', 'Oats', 'Bread Crumbs', 'Noodles'],
    },
    {
      category: 'Herbs & Spices',
      items: ['Sugar', 'Salt', 'Pepper', 'Garlic Powder', 'Paprika', 'Cumin', 'Italian Seasoning'],
    },
    {
      category: 'Oils & Vinegars',
      items: ['Butter', 'Olive Oil', 'Vegetable Oil', 'Canola Oil', 'Sesame Oil', 'Balsamic Vinegar', 'Rice Vinegar'],
    },
    {
      category: 'Others',
      items: ['White Wine', 'Red Wine', 'Shaoxing Wine', 'Rice Wine'],
    },
  ];

  const toggleDietary = (option: string) => {
    setSelectedDietary((current) => {
      if (option === 'None') {
        return ['None'];
      }
      const next = current.filter((item) => item !== 'None');
      if (next.includes(option)) {
        return next.filter((item) => item !== option);
      }
      return [...next, option];
    });
  };

  const normalizedPostal = useMemo(() => normalizePostalCode(postalInput), [postalInput]);

  const params = useLocalSearchParams<{ edit?: string }>();
  const isEditing = params.edit === 'true';

  if (onboardingComplete && !isEditing) {
    return <Redirect href="/(tabs)/deals" />;
  }

  const totalSteps = 6;
  const rawProgress = totalSteps > 1 ? stepIndex / (totalSteps - 1) : 0;
  const stepProgress = Number.isFinite(rawProgress)
    ? Math.max(0, Math.min(1, rawProgress))
    : 0;
  const progressWidth = `${stepProgress * 100}%`;

  const isHouseholdValid = () => {
    const parsed = Number.parseInt(householdInput, 10);
    return Number.isFinite(parsed) && parsed >= 1;
  };

  const validateHousehold = () => {
    const parsed = Number.parseInt(householdInput, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      setError('Household size must be at least 1.');
      return false;
    }
    return true;
  };

  const onSave = () => {
    if (!isValidCanadianPostalCode(postalInput)) {
      setError('Enter a valid Canadian postal code (ex: M5V 2T6).');
      return;
    }
    if (!validateHousehold()) {
      return;
    }
    setError('');
    if (normalizedPostal) {
      setPostalCode(normalizedPostal);
    }
    setDietaryPreferences(selectedDietary.length ? selectedDietary : ['None']);
    setAllergies(allergiesInput.trim());
    const parsedHousehold = Number.parseInt(householdInput, 10);
    setHouseholdSize(Number.isFinite(parsedHousehold) ? parsedHousehold : undefined);
    setOnboardingComplete(true);
    router.replace(isEditing ? '/(tabs)/settings' : '/(tabs)/deals');
  };

  const canAdvancePostal = isValidCanadianPostalCode(postalInput);
  const stepTitle = () => {
    switch (stepIndex) {
      case 0:
        return 'Postal code';
      case 1:
        return 'Dietary preferences';
      case 2:
        return 'Allergies (Optional)';
      case 3:
        return 'Household size';
      case 4:
        return 'Favorite grocery stores';
      case 5:
        return 'My Pantry Items';
      default:
        return 'Set up your kitchen';
    }
  };

  const handleNext = () => {
    if (stepIndex === 0 && !canAdvancePostal) {
      setError('Enter a valid Canadian postal code (ex: M5V 2T6).');
      return;
    }
    if (stepIndex === 1 && selectedDietary.length === 0) {
      setError('Select a dietary preference or choose None.');
      return;
    }
    if (stepIndex === 3 && !validateHousehold()) {
      return;
    }
    setError('');
    setStepIndex((current) => Math.min(totalSteps - 1, current + 1));
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 0, animated: false }));
  };

  const canAdvanceStep =
    stepIndex === 0
      ? canAdvancePostal
      : stepIndex === 1
        ? selectedDietary.length > 0
        : stepIndex === 3
          ? isHouseholdValid()
          : true;

  const handleBack = () => {
    setError('');
    setStepIndex((current) => Math.max(0, current - 1));
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 0, animated: false }));
  };


  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.headerBar}>
        <View style={styles.headerRow}>
          <View style={styles.logoTitleRow}>
            <Image
              source={require('../assets/logos/app-logo/forkcast-logo-transparent.png')}
              style={styles.headerLogo}
              resizeMode="contain"
              tintColor="#1F1F1F"
            />
            <View>
              <Text style={styles.screenTitle}>Your Kitchen</Text>
            </View>
          </View>
        </View>
      </View>
      <View style={styles.contentSurface}>
        <PatternBackground />
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.container}
          scrollEnabled>
          <View style={styles.card}>
            <Text style={styles.subtitle}>Set up your kitchen</Text>
            {isEditing ? null : (
              <>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: progressWidth }]} />
                </View>
                <Text style={styles.stepTitle}>{stepTitle()}</Text>
              </>
            )}

            {isEditing || stepIndex === 0 ? (
              <View style={styles.section}>
                {isEditing ? <Text style={styles.sectionSubtitle}>Postal code</Text> : null}
                <TextInput
                  mode="outlined"
                  style={[styles.input, styles.inputCompact]}
                  contentStyle={styles.inputContent}
                  placeholder="M5V 2T6"
                  value={postalInput}
                  autoCapitalize="characters"
                  onChangeText={(value) => setPostalInput(formatPostalCode(value))}
                  maxLength={7}
                  textColor="#5F6368"
                  placeholderTextColor="#B0B6BC"
                />
                {error ? <Text style={styles.error}>{error}</Text> : null}
              </View>
            ) : null}

            {isEditing || stepIndex === 1 ? (
              <View style={styles.section}>
                {isEditing ? <Text style={styles.sectionSubtitle}>Dietary preferences</Text> : null}
                <View style={styles.chipRow}>
                  {dietaryOptions.map((option) => {
                    const active = selectedDietary.includes(option);
                    return (
                      <Chip
                        key={option}
                        selected={active}
                        mode="outlined"
                        onPress={() => toggleDietary(option)}
                        style={[styles.chip, active && styles.chipSelected]}
                        textStyle={styles.chipText}
                        selectedColor="#1F1F1F">
                        {option}
                      </Chip>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {isEditing || stepIndex === 2 ? (
              <View style={styles.section}>
                {isEditing ? <Text style={styles.sectionSubtitle}>Allergies</Text> : null}
                <TextInput
                  mode="outlined"
                  style={[styles.input, styles.inputCompact]}
                  contentStyle={styles.inputContent}
                  placeholder="Peanuts, shellfish, etc."
                  value={allergiesInput}
                  onChangeText={setAllergiesInput}
                  textColor="#5F6368"
                  placeholderTextColor="#B0B6BC"
                />
              </View>
            ) : null}

            {isEditing || stepIndex === 3 ? (
              <View style={styles.section}>
                {isEditing ? <Text style={styles.sectionSubtitle}>Household size</Text> : null}
                <TextInput
                  mode="outlined"
                  style={[styles.input, styles.inputCompact]}
                  contentStyle={styles.inputContent}
                  placeholder="2"
                  value={householdInput}
                  keyboardType="number-pad"
                  onChangeText={setHouseholdInput}
                  textColor="#5F6368"
                  placeholderTextColor="#B0B6BC"
                />
              </View>
            ) : null}

            {isEditing || stepIndex === 4 ? (
              <View style={styles.section}>
                {isEditing ? <Text style={styles.sectionSubtitle}>Favorite grocery stores</Text> : null}
                <View style={styles.storeList}>
                  {GROCERY_STORES.map((store) => {
                    const logo = resolveStoreLogo(store);
                    const checked = favoriteStores.includes(store);
                    return (
                      <Pressable
                        key={store}
                        onPress={() => toggleFavoriteStore(store)}
                        style={({ pressed }) => [styles.storeRow, pressed && styles.storeRowPressed]}
                      >
                        {logo ? (
                          <Image
                            source={typeof logo === 'string' ? { uri: logo } : logo}
                            style={styles.storeLogo}
                          />
                        ) : (
                          <View style={styles.storeLogoFallback} />
                        )}
                        <Text style={styles.storeName}>{store}</Text>
                        <Checkbox status={checked ? 'checked' : 'unchecked'} />
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {!isEditing && stepIndex === 5 ? (
              <View style={styles.section}>
                <View style={styles.pantryScrollContent}>
                  {pantryOptions.map((group) => (
                    <View key={group.category} style={styles.pantryGroup}>
                      <Text style={styles.sectionSubtitle}>{group.category}</Text>
                      <View style={styles.pantryOptionList}>
                        {group.items.map((item) => {
                          const selected = pantryItems.some(
                            (entry) =>
                              entry.category === group.category &&
                              entry.name.toLowerCase() === item.toLowerCase()
                          );
                          return (
                            <Pressable
                              key={`${group.category}-${item}`}
                              onPress={() =>
                                selected
                                  ? removePantryItem({ name: item, category: group.category as any })
                                  : addPantryItem(item, group.category as any)
                              }
                              style={styles.pantryOptionRow}>
                              <Text style={styles.pantryOptionText}>{item}</Text>
                              <Checkbox status={selected ? 'checked' : 'unchecked'} />
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {isEditing ? (
              <View style={styles.actionsRow}>
                <Button
                  mode="contained"
                  onPress={onSave}
                  buttonColor="#1B7F3A"
                  textColor="#FFFFFF"
                  style={styles.primaryButton}>
                  Save preferences
                </Button>
              </View>
            ) : (
              <View style={styles.actionsRow}>
                {stepIndex > 0 ? (
                  <Button
                    mode="outlined"
                    onPress={handleBack}
                    textColor="#1B7F3A"
                    style={styles.secondaryButton}>
                    Back
                  </Button>
                ) : null}
                {stepIndex < totalSteps - 1 ? (
                  <Button
                    mode="contained"
                    onPress={handleNext}
                    disabled={!canAdvanceStep}
                    buttonColor="#1B7F3A"
                    textColor="#FFFFFF"
                    style={[
                      styles.primaryButton,
                      stepIndex === 0 && styles.primaryButtonCentered,
                      !canAdvanceStep && styles.primaryButtonDisabled,
                    ]}>
                    Next
                  </Button>
                ) : (
                  <Button
                    mode="contained"
                    onPress={onSave}
                    buttonColor="#1B7F3A"
                    textColor="#FFFFFF"
                    style={styles.primaryButton}>
                    Save preferences
                  </Button>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
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
  headerLogo: {
    width: 32,
    height: 32,
  },
  contentSurface: {
    flex: 1,
    backgroundColor: '#B6DCC6',
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 0,
  },
  container: {
    paddingTop: 16,
    paddingBottom: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E6E9EF',
    padding: 16,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1B7F3A',
    marginBottom: 12,
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: '#E2F2E8',
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3F8F5E',
    borderRadius: 999,
  },
  stepIndicator: {
    fontSize: 12,
    color: '#6C7075',
    marginBottom: 6,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F1F1F',
    marginBottom: 16,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5F6368',
    marginBottom: 8,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    color: '#5F6368',
  },
  helper: {
    fontSize: 12,
    color: '#7B8187',
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
  },
  inputCompact: {
    height: 44,
  },
  inputContent: {
    fontSize: 13,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#F1F3F4',
  },
  chipText: {
    fontSize: 12,
  },
  chipSelected: {
    backgroundColor: '#D8EFDF',
  },
  storeList: {
    gap: 8,
  },
  pantryGroup: {
    marginBottom: 16,
  },
  pantryScrollContent: {
    paddingBottom: 8,
  },
  pantryOptionList: {
    gap: 6,
  },
  pantryOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#EEF1F6',
  },
  pantryOptionText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: '#1F1F1F',
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#EEF1F6',
  },
  storeRowPressed: {
    opacity: 0.7,
  },
  storeLogo: {
    width: 32,
    height: 32,
    marginRight: 12,
    resizeMode: 'contain',
  },
  storeLogoFallback: {
    width: 32,
    height: 32,
    marginRight: 12,
    borderRadius: 16,
    backgroundColor: '#E6E9EF',
  },
  storeName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  error: {
    color: '#c0392b',
    marginTop: 6,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  secondaryButton: {
    flex: 1,
    borderColor: '#1B7F3A',
  },
  secondaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButton: {
    marginTop: 8,
    flex: 1,
  },
  primaryButtonDisabled: {
    backgroundColor: '#A9B7AE',
  },
  primaryButtonCentered: {
    alignSelf: 'center',
    flex: 0,
    minWidth: 140,
  },
});
