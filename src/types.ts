export type DealItem = {
  id: string;
  title: string;
  store: string;
  price: number;
  wasPrice?: number;
  unit: string;
  category: string;
  imageUrl?: string;
  validFrom?: string;
  validTo?: string;
  location?: string;
};

export type DealsQuery = {
  postalCode: string;
  lat?: number;
  lon?: number;
  radiusKm?: number;
  stores?: string[];
  categories?: string[];
};

export type RecipeIngredient = {
  name: string;
  quantity: number | string;
  unit: string;
  optional?: boolean;
  category: string;
};

export type Recipe = {
  id: string;
  title: string;
  imageUrl?: string;
  servings: number;
  cookTimeMins: number;
  tags?: string[];
  ingredients: RecipeIngredient[];
  steps: string[];
  categories?: string[];
};

export type RecipeHistoryEntry = {
  id: string;
  createdAt: string;
  recipes: Recipe[];
};

export type MealPlan = {
  id: string;
  mealsRequested: number;
  recipes: Recipe[];
  createdAt: string;
  selectedStore?: string;
  constraints?: {
    dietary?: string[];
    cuisineThemes?: string[];
    aiPrompt?: string;
    maxCookTimeMins?: number;
    servings?: number;
  };
};

export type GroceryListItem = {
  id: string;
  name: string;
  totalQuantity: string;
  category: string;
  checked: boolean;
  matchedDeal?: {
    store: string;
    price: number;
    dealId: string;
  };
};
