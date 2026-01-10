import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';

import { usePreferencesStore } from '@/src/state/usePreferencesStore';
import { formatPostalCode, isValidCanadianPostalCode, normalizePostalCode } from '@/src/utils/postalCode';

const dietaryOptions = ['None', 'Vegetarian', 'Pescatarian', 'Halal', 'Keto'];

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
    router.replace('/(tabs)/deals');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Welcome to DealChef</Text>
      <Text style={styles.subtitle}>Tell us where you shop so we can find Toronto deals.</Text>

      <View style={styles.section}>
        <Text style={styles.label}>Postal code</Text>
        <TextInput
          style={styles.input}
          placeholder="M5V 2T6"
          value={postalInput}
          autoCapitalize="characters"
          onChangeText={(value) => setPostalInput(formatPostalCode(value))}
          maxLength={7}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Dietary preferences</Text>
        <View style={styles.chipRow}>
          {dietaryOptions.map((option) => {
            const active = selectedDietary.includes(option);
            return (
              <Pressable
                key={option}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => toggleDietary(option)}>
                <Text style={styles.chipText}>{option}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Allergies</Text>
        <TextInput
          style={styles.input}
          placeholder="Peanuts, shellfish, etc."
          value={allergiesInput}
          onChangeText={setAllergiesInput}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Household size (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="2"
          value={householdInput}
          keyboardType="number-pad"
          onChangeText={setHouseholdInput}
        />
      </View>

      <Pressable style={styles.primaryButton} onPress={onSave}>
        <Text style={styles.primaryButtonText}>Save preferences</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#555',
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#f1f1f1',
  },
  chipActive: {
    backgroundColor: '#d6f2e9',
  },
  chipText: {
    fontSize: 13,
  },
  error: {
    color: '#c0392b',
    marginTop: 6,
  },
  primaryButton: {
    backgroundColor: '#0b6e4f',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
