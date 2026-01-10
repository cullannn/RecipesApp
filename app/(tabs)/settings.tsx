import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { usePreferencesStore } from '@/src/state/usePreferencesStore';
import { formatPostalCode } from '@/src/utils/postalCode';

export default function SettingsScreen() {
  const { postalCode, dietaryPreferences, allergies, householdSize } = usePreferencesStore();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>

      <View style={styles.section}>
        <Text style={styles.label}>Postal code</Text>
        <Text style={styles.value}>{postalCode ? formatPostalCode(postalCode) : 'Not set'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Dietary preferences</Text>
        <Text style={styles.value}>
          {dietaryPreferences.length > 0 ? dietaryPreferences.join(', ') : 'None'}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Allergies</Text>
        <Text style={styles.value}>{allergies || 'None'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Household size</Text>
        <Text style={styles.value}>{householdSize ? householdSize : 'Not set'}</Text>
      </View>

      <Pressable style={styles.primaryButton} onPress={() => router.push('/onboarding')}>
        <Text style={styles.primaryButtonText}>Edit preferences</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
  },
  section: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  value: {
    fontSize: 15,
    fontWeight: '600',
  },
  primaryButton: {
    marginTop: 8,
    backgroundColor: '#0b6e4f',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
