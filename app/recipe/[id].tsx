import { Animated, ScrollView, StyleSheet, Text, View, Image as RNImage } from 'react-native';
import { useEffect, useRef } from 'react';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';

import { useRemoteImage } from '@/src/hooks/useRemoteImage';
import { useRecipes } from '@/src/hooks/useRecipes';
import { useMealPlanStore } from '@/src/state/useMealPlanStore';

const fallbackImage =
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80';

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const recipes = useRecipes();
  const { recipeHistory } = useMealPlanStore();
  const recipe =
    recipes.find((item) => item.id === id) ??
    recipeHistory.flatMap((entry) => entry.recipes).find((item) => item.id === id);

  if (!recipe) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Recipe not found.</Text>
      </View>
    );
  }

  const heroImage = useRemoteImage(recipe.title, recipe.imageUrl ?? null, { kind: 'recipe' });
  const isPlaceholder =
    !heroImage ||
    heroImage === fallbackImage ||
    heroImage.includes('unsplash.com') ||
    heroImage.includes('source.unsplash.com');
  const shimmerValue = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!isPlaceholder) {
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerValue, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerValue, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [isPlaceholder, shimmerValue]);
  const shimmerOpacity = shimmerValue.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.5] });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroImage}>
        <Image
          source={{ uri: heroImage ?? fallbackImage }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="none"
        />
        {isPlaceholder ? (
          <>
            <Animated.View style={[styles.heroShimmer, { opacity: shimmerOpacity }]} />
            <RNImage
              source={require('../../assets/logos/app-logo/forkcast-logo-transparent.png')}
              style={styles.heroLogoOverlay}
              resizeMode="contain"
              tintColor="#FFFFFF"
            />
          </>
        ) : null}
      </View>
      <Text style={styles.title}>{recipe.title}</Text>
      <Text style={styles.meta}>
        {recipe.cookTimeMins} mins • Serves {recipe.servings}
      </Text>
      <Text style={styles.sectionTitle}>Ingredients</Text>
      {recipe.ingredients.map((ingredient, index) => (
        <Text key={`${ingredient.name}-${index}`} style={styles.ingredient}>
          {ingredient.quantity} {ingredient.unit} {ingredient.name}
        </Text>
      ))}

      <Text style={styles.sectionTitle}>Steps</Text>
      {recipe.steps.map((step, index) => (
        <Text key={`${recipe.id}-step-${index}`} style={styles.step}>
          {index + 1}. {step}
        </Text>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#B6DCC6',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  heroImage: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  heroShimmer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
  },
  heroLogoOverlay: {
    position: 'absolute',
    width: 84,
    height: 84,
    tintColor: '#FFFFFF',
    opacity: 0.9,
    top: '50%',
    left: '50%',
    transform: [{ translateX: -42 }, { translateY: -42 }],
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
    color: '#1F1F1F',
  },
  meta: {
    fontSize: 13,
    color: '#5F6368',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 18,
    marginBottom: 8,
    color: '#1F1F1F',
  },
  ingredient: {
    fontSize: 13,
    color: '#1F1F1F',
    marginBottom: 4,
  },
  step: {
    fontSize: 13,
    color: '#1F1F1F',
    marginBottom: 6,
  },
});
