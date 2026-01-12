import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Button } from 'react-native-paper';

import { PatternBackground } from '@/components/pattern-background';
import { GradientTitle } from '@/components/gradient-title';
import { usePreferencesStore } from '@/src/state/usePreferencesStore';
import { formatPostalCode } from '@/src/utils/postalCode';

export default function SettingsScreen() {
  const { postalCode, dietaryPreferences, allergies, householdSize } = usePreferencesStore();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.headerBar}>
        <GradientTitle text="Settings" style={styles.title} />
      </View>
      <View style={styles.contentSurface}>
        <PatternBackground />

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your Kitchen Settings</Text>
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

        <Button
          mode="contained"
          onPress={() => router.push('/(tabs)/preferences')}
          buttonColor="#1B7F3A"
          textColor="#FFFFFF"
          style={styles.primaryButton}>
          Edit preferences
        </Button>
        </View>
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
  },
  contentSurface: {
    flex: 1,
    backgroundColor: '#D9DEE6',
    padding: 16,
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
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
    color: '#1F1F1F',
  },
  section: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    color: '#5F6368',
    marginBottom: 4,
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  primaryButton: {
    marginTop: 8,
  },
});
