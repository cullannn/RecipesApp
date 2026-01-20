import { Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Button } from 'react-native-paper';

import { PatternBackground } from '@/components/pattern-background';
import { LogoWithShimmer } from '@/components/logo-with-shimmer';
import { usePreferencesStore } from '@/src/state/usePreferencesStore';
import { useMealPlanStore } from '@/src/state/useMealPlanStore';
import { formatPostalCode } from '@/src/utils/postalCode';
import { resolveStoreLogo } from '@/src/utils/storeLogos';
import { useGoogleAuth } from '@/src/hooks/useGoogleAuth';

export default function SettingsScreen() {
  const {
    postalCode,
    dietaryPreferences,
    allergies,
    householdSize,
    favoriteStores,
  } = usePreferencesStore();
  const { isGeneratingPlan } = useMealPlanStore();
  const { userId, name, email, photoUrl, authError, signingIn, canSignIn, signIn, signOut } =
    useGoogleAuth();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.headerBar}>
        <View style={styles.headerRow}>
          <View style={styles.logoTitleRow}>
            <LogoWithShimmer isActive={isGeneratingPlan} tintColor="#1F1F1F" size={32} />
            <View>
              <Text style={styles.title}>Settings</Text>
            </View>
          </View>
        </View>
      </View>
      <View style={styles.contentSurface}>
        <PatternBackground />

        <View style={[styles.card, styles.accountCard]}>
          <Text style={styles.cardTitle}>Account</Text>
          {userId ? (
            <View style={styles.accountRow}>
              <View style={styles.avatarWrap}>
                {photoUrl ? (
                  <Image source={{ uri: photoUrl }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarFallback} />
                )}
              </View>
              <View style={styles.accountMeta}>
                <Text style={styles.accountName}>{name || 'Google user'}</Text>
                <Text style={styles.accountEmail}>{email || 'Signed in with Google'}</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.helperText}>Sign in to personalize your recipe generation.</Text>
          )}

          {authError ? <Text style={styles.errorText}>{authError}</Text> : null}
          <Button
            mode={userId ? 'outlined' : 'contained'}
            onPress={() => {
              if (userId) {
                signOut();
                router.replace('/login');
              } else {
                signIn();
              }
            }}
            disabled={!canSignIn || signingIn}
            loading={signingIn}
            buttonColor={userId ? undefined : '#1B7F3A'}
            textColor={userId ? '#1B7F3A' : '#FFFFFF'}
            style={styles.primaryButton}>
            {userId ? 'Sign out' : 'Sign in with Google'}
          </Button>
          {!canSignIn ? (
            <Text style={styles.helperText}>Add Google OAuth client IDs to enable sign-in.</Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>My Kitchen Settings</Text>
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

          <View style={styles.section}>
            <Text style={styles.label}>Favorite grocery stores</Text>
            {favoriteStores.length > 0 ? (
              <View style={styles.favoriteRow}>
                {favoriteStores.map((store) => {
                  const logo = resolveStoreLogo(store);
                  return (
                    <View key={store} style={styles.favoriteLogoWrap}>
                      {logo ? (
                        <Image
                          source={typeof logo === 'string' ? { uri: logo } : logo}
                          style={styles.favoriteLogo}
                        />
                      ) : (
                        <View style={styles.favoriteLogoFallback} />
                      )}
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.value}>None</Text>
            )}
          </View>

          <Button
            mode="contained"
            onPress={() => router.push('/(tabs)/preferences?edit=true')}
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
    paddingTop: 8,
  },
  contentSurface: {
    flex: 1,
    backgroundColor: '#B6DCC6',
    padding: 16,
  },
  accountCard: {
    marginBottom: 16,
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
  logoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
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
  favoriteRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  favoriteLogoWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteLogo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    resizeMode: 'contain',
  },
  favoriteLogoFallback: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#E6E9EF',
  },
  primaryButton: {
    marginTop: 8,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  avatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatar: {
    width: 44,
    height: 44,
  },
  avatarFallback: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E6E9EF',
  },
  accountMeta: {
    flex: 1,
  },
  accountName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  accountEmail: {
    fontSize: 12,
    color: '#5F6368',
    marginTop: 2,
  },
  helperText: {
    fontSize: 12,
    color: '#5F6368',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 12,
    color: '#C62828',
    marginBottom: 8,
  },
});
