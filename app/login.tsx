import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from 'react-native-paper';

import { GradientTitle } from '@/components/gradient-title';
import { PatternBackground } from '@/components/pattern-background';
import { useGoogleAuth } from '@/src/hooks/useGoogleAuth';

export default function LoginScreen() {
  const { authError, signingIn, canSignIn, signIn } = useGoogleAuth();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.headerBar}>
        <GradientTitle text="Welcome" style={styles.title} />
        <Text style={styles.subtitle}>Sign in to access your kitchen settings.</Text>
      </View>
      <View style={styles.contentSurface}>
        <PatternBackground />
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign in required</Text>
          <Text style={styles.cardBody}>
            RecipesApp stores your preferences per account so your plans follow you across devices.
          </Text>
          {authError ? <Text style={styles.errorText}>{authError}</Text> : null}
          <Button
            mode="contained"
            onPress={signIn}
            disabled={!canSignIn || signingIn}
            loading={signingIn}
            buttonColor="#1B7F3A"
            textColor="#FFFFFF"
            style={styles.primaryButton}>
            Sign in with Google
          </Button>
          {!canSignIn ? (
            <Text style={styles.helperText}>Missing Google OAuth client IDs.</Text>
          ) : null}
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
    paddingBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F1F1F',
  },
  subtitle: {
    fontSize: 14,
    color: '#5F6368',
    marginTop: 6,
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
    marginBottom: 8,
  },
  cardBody: {
    fontSize: 14,
    color: '#2E3136',
    marginBottom: 12,
  },
  primaryButton: {
    marginTop: 4,
  },
  helperText: {
    fontSize: 12,
    color: '#5F6368',
    marginTop: 8,
  },
  errorText: {
    fontSize: 12,
    color: '#C62828',
    marginBottom: 8,
  },
});
