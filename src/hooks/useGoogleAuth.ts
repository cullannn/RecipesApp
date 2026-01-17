import { useEffect, useState } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

import { useAuthStore } from '@/src/state/useAuthStore';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '';

function maskClientId(value: string) {
  if (!value) {
    return '';
  }
  const tail = value.slice(-10);
  return `***${tail}`;
}

async function fetchGoogleProfile(accessToken: string) {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    throw new Error('Google profile request failed.');
  }
  return response.json();
}

export function useGoogleAuth() {
  const { userId, name, email, photoUrl, setUser, clearUser } = useAuthStore();
  const [authError, setAuthError] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    console.log(
      `[auth] google client ids web=${maskClientId(GOOGLE_WEB_CLIENT_ID)} ios=${maskClientId(
        GOOGLE_IOS_CLIENT_ID
      )} android=${maskClientId(GOOGLE_ANDROID_CLIENT_ID)}`
    );
  }, []);
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    scopes: ['profile', 'email'],
    selectAccount: true,
  });

  useEffect(() => {
    const accessToken =
      response?.authentication?.accessToken ||
      (response?.type === 'success' && response.params && 'access_token' in response.params
        ? String(response.params.access_token)
        : '');
    if (response?.type === 'success' && accessToken) {
      setSigningIn(true);
      setAuthError('');
      fetchGoogleProfile(accessToken)
        .then((profile) => {
          const user = profile as {
            sub?: string;
            name?: string;
            email?: string;
            picture?: string;
          };
          setUser({
            userId: user.sub ?? '',
            name: user.name ?? '',
            email: user.email ?? '',
            photoUrl: user.picture ?? '',
          });
        })
        .catch(() => {
          setAuthError('Unable to load Google profile. Try again.');
        })
        .finally(() => {
          setSigningIn(false);
        });
      return;
    }
    if (response?.type === 'error') {
      setAuthError('Google sign-in failed. Try again.');
      setSigningIn(false);
    }
  }, [response, setUser]);

  const canSignIn = Boolean(GOOGLE_WEB_CLIENT_ID && GOOGLE_IOS_CLIENT_ID && GOOGLE_ANDROID_CLIENT_ID);
  const signIn = async () => {
    if (!request) {
      return;
    }
    setAuthError('');
    setSigningIn(true);
    const result = await promptAsync({ useProxy: false });
    if (result.type !== 'success') {
      setSigningIn(false);
      if (result.type === 'error') {
        setAuthError('Google sign-in failed. Try again.');
      }
    }
  };

  const signOut = () => {
    clearUser();
  };

  return {
    userId,
    name,
    email,
    photoUrl,
    canSignIn,
    signingIn,
    authError,
    signIn,
    signOut,
  };
}
