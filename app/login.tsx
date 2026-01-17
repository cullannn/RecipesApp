import { Redirect } from 'expo-router';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { GradientTitle } from '@/components/gradient-title';
import { PatternBackground } from '@/components/pattern-background';
import { useGoogleAuth } from '@/src/hooks/useGoogleAuth';
import {
  useFonts,
  Montserrat_300Light,
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_700Bold,
} from '@expo-google-fonts/montserrat';

export default function LoginScreen() {
  const { authError, signingIn, canSignIn, signIn, userId } = useGoogleAuth();
  const [fontsLoaded] = useFonts({
    Montserrat_300Light,
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_700Bold,
  });

  if (userId) {
    return <Redirect href="/(tabs)/deals" />;
  }

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.contentSurface}>
        <LinearGradient colors={['#C7E7D1', '#9FCEB3']} style={styles.backdrop} />
        <PatternBackground />
          <View style={styles.card}>
            <LinearGradient
            colors={['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0.35)']}
            locations={[0, 0.5, 1]}
            style={styles.glassFill}
          />
          <LinearGradient
            colors={['rgba(255,255,255,0.7)', 'rgba(255,255,255,0)']}
            locations={[0, 1]}
            style={styles.glassEdge}
          />
          <View style={styles.glassSheen} />
          <View style={styles.logoWrap}>
            <Image
              source={require('../assets/logos/app-logo/forkcast-logo-transparent.png')}
              style={styles.logoImageLarge}
              resizeMode="contain"
            />
          </View>
          <GradientTitle text="FORKCAST" style={styles.title} />
          <Text style={styles.subtitle}>Predictably delicious.</Text>
          {authError ? <Text style={styles.errorText}>{authError}</Text> : null}
          <Pressable
            accessibilityRole="button"
            onPress={signIn}
            disabled={!canSignIn || signingIn}
            style={({ pressed }) => [
              styles.googleButton,
              (!canSignIn || signingIn) && styles.googleButtonDisabled,
              pressed && styles.googleButtonPressed,
            ]}>
            <View style={styles.googleIconWrap}>
              <Image
                source={{ uri: 'https://developers.google.com/identity/images/g-logo.png' }}
                style={styles.googleIcon}
              />
            </View>
            <Text style={styles.googleButtonText}>Sign in with Google</Text>
            {signingIn ? <ActivityIndicator size="small" color="#1F1F1F" /> : null}
          </Pressable>
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
  contentSurface: {
    flex: 1,
    backgroundColor: '#D9DEE6',
    padding: 16,
    justifyContent: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    padding: 20,
    shadowColor: '#1A3B2D',
    shadowOpacity: 0.18,
    shadowRadius: 36,
    shadowOffset: { width: 0, height: 16 },
    elevation: 12,
    overflow: 'hidden',
  },
  glassFill: {
    ...StyleSheet.absoluteFillObject,
  },
  glassEdge: {
    ...StyleSheet.absoluteFillObject,
  },
  glassSheen: {
    position: 'absolute',
    top: -40,
    left: -80,
    width: 240,
    height: 120,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.35)',
    transform: [{ rotate: '-12deg' }],
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1B7F3A',
    marginBottom: 8,
  },
  title: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 36,
    color: '#000000',
    textAlign: 'center',
    letterSpacing: 1.5,
  },
  subtitle: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 14,
    color: '#111111',
    marginTop: 0,
    marginBottom: 20,
    lineHeight: 18,
    textAlign: 'center',
  },
  cardBody: {
    fontSize: 14,
    color: '#2E3136',
    marginBottom: 20,
    lineHeight: 20,
  },
  helperText: {
    fontSize: 12,
    color: '#5F6368',
    marginTop: 10,
  },
  errorText: {
    fontSize: 12,
    color: '#C62828',
    marginBottom: 8,
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: -10,
  },
  logoImageLarge: {
    width: 128,
    height: 128,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E0E4E7',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  googleButtonPressed: {
    transform: [{ scale: 0.995 }],
  },
  googleButtonDisabled: {
    opacity: 0.6,
  },
  googleButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F1F1F',
  },
  googleIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIcon: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
  },
});
