import { Image, StyleSheet, Text, View } from 'react-native';
import { usePreferencesStore } from '@/src/state/usePreferencesStore';
import { getGtaCityForPostalCode } from '@/src/utils/postalCode';

export type AppHeaderProps = {
  title: string;
};

export function AppHeader({ title }: AppHeaderProps) {
  const { postalCode } = usePreferencesStore();
  const cityLabel = postalCode ? getGtaCityForPostalCode(postalCode) : '';
  return (
    <View style={styles.headerRow}>
      <Image
        source={require('../assets/logos/app-logo/forkcast-logo-transparent.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>
          {cityLabel ? `${title} in ${cityLabel}` : `${title} in your city`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  logo: {
    width: 38,
    height: 38,
    tintColor: '#1B7F3A',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1B7F3A',
  },
  subtitle: {
    fontSize: 12,
    color: '#5F6368',
  },
});
