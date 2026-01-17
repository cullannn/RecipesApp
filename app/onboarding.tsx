import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
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
  } = usePreferencesStore();

  const [postalInput, setPostalInput] = useState(formatPostalCode(postalCode));
  const [selectedDietary, setSelectedDietary] = useState<string[]>(dietaryPreferences);
  const [allergiesInput, setAllergiesInput] = useState(allergies);
  const [householdInput, setHouseholdInput] = useState(householdSize ? String(householdSize) : '');
  const [error, setError] = useState('');

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

  const onSave = () => {
    if (!isValidCanadianPostalCode(postalInput)) {
      setError('Enter a valid Canadian postal code (ex: M5V 2T6).');
      return;
    }
    setError('');
    if (normalizedPostal) {
      setPostalCode(normalizedPostal);
    }
    setDietaryPreferences(selectedDietary);
    setAllergies(allergiesInput.trim());
    const parsedHousehold = Number.parseInt(householdInput, 10);
    setHouseholdSize(Number.isFinite(parsedHousehold) ? parsedHousehold : undefined);
    router.replace('/(tabs)/settings');
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
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.card}>
            <Text style={styles.subtitle}>Set up your kitchen</Text>

            <View style={styles.section}>
              <Text style={styles.label}>Postal code</Text>
              <TextInput
                mode="outlined"
                style={styles.input}
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

            <View style={styles.section}>
              <Text style={styles.label}>Dietary preferences</Text>
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
                      selectedColor="#1F1F1F">
                      {option}
                    </Chip>
                  );
                })}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Allergies</Text>
              <TextInput
                mode="outlined"
                style={styles.input}
                placeholder="Peanuts, shellfish, etc."
                value={allergiesInput}
                onChangeText={setAllergiesInput}
                textColor="#5F6368"
                placeholderTextColor="#B0B6BC"
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Household size (optional)</Text>
              <TextInput
                mode="outlined"
                style={styles.input}
                placeholder="2"
                value={householdInput}
                keyboardType="number-pad"
                onChangeText={setHouseholdInput}
                textColor="#5F6368"
                placeholderTextColor="#B0B6BC"
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Favorite grocery stores</Text>
              <Text style={styles.helper}>
                Select stores to highlight in Deals and prioritize in meal plans.
              </Text>
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
                        <Image source={typeof logo === 'string' ? { uri: logo } : logo} style={styles.storeLogo} />
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

            <Button
              mode="contained"
              onPress={onSave}
              buttonColor="#1B7F3A"
              textColor="#FFFFFF"
              style={styles.primaryButton}>
              Save preferences
            </Button>
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#F1F3F4',
  },
  chipSelected: {
    backgroundColor: '#D8EFDF',
  },
  storeList: {
    gap: 8,
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
  primaryButton: {
    marginTop: 8,
  },
});
