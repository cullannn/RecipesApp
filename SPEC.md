# SPEC.md -- DealChef (working name)

## Toronto-first assumptions (MVP)
- Default market: Toronto, Ontario, Canada
- User location input:
  - Mobile: request location permission (optional)
  - All platforms: allow manual entry of Canadian postal code (required fallback)
- Postal code format validation: Canadian format (e.g., M5V 2T6). Normalize by stripping spaces and uppercasing.
- Nearby store set for Toronto MVP:
  - No Frills, Loblaws, Real Canadian Superstore, Metro, FreshCo, Food Basics, Walmart, Costco (optional), Longo's (optional)
- Currency display: CAD

## 2) Platforms
- iOS, Android, Web via Expo (single codebase)
- Offline-friendly for the grocery list screen (view + check off items)

## 3) MVP Scope (must ship)
### A) Onboarding + Location
- User enters:
  - Postal code / ZIP (required for web; optional for mobile if location permission granted)
  - Dietary preferences (none / vegetarian / pescatarian / halal / keto / etc. -- keep minimal initially)
  - Allergies (free text MVP)
  - Household size (optional)
- App stores these preferences locally.

## Deals Provider Strategy (Mock -> Flipp)

### Phase 1 (MVP): Mock deals provider (must ship)
- Implement `mockDealsProvider` that returns deals for Toronto postal codes.
- Deals are stored as local fixtures under `src/fixtures/deals/toronto/*.json`.
- Fixtures should include:
  - store, item title, price, unit, category, imageUrl (optional), validFrom/validTo
- The app must work fully end-to-end with the mock provider.

### Phase 2: Flipp integration (after MVP)
- Implement `flippDealsProvider` behind the same interface.
- Keep the UI and business logic unchanged when switching providers.
- Add a feature flag:
  - Default: `USE_DEALS_PROVIDER=mock`
  - Optional: `USE_DEALS_PROVIDER=flipp` when configured
- API credentials (if any) must never be committed:
  - Use `.env` + `app.config.ts` (Expo) and document setup in `README.md`.

### B) Recipe Suggestions
- User sees recipe cards ranked by:
  - Number of ingredients currently on deal
  - Estimated cost savings (rough heuristic MVP)
  - Match to dietary preferences
- Recipe detail shows:
  - Ingredients list (with amounts)
  - Steps
  - Which ingredients are "on deal"
  - "Add to plan" button

## Recipe library (MVP)
- Local JSON recipe library with 30-50 recipes
- Emphasis on common Canadian grocery items and simple home cooking
- Each recipe must have:
  - tags: vegetarian / dairy-free / gluten-free etc (optional)
  - ingredient category hints to enable grocery grouping

### C) Meal Planning
- User selects:
  - Number of meals to plan: [3 / 5 / 7 / custom]
  - Optional: max cooking time, servings
- App generates a plan:
  - A set of recipes whose combined ingredients maximize deal usage and variety
  - Avoid repeating the same recipe (unless user allows)
- User can swap recipes within the plan.

### D) Grocery List Builder
- App generates a consolidated grocery list from the meal plan:
  - Combine duplicate ingredients (e.g., "onion" from multiple recipes)
  - Normalize units where possible (MVP: basic + leave some as separate lines if hard)
  - Mark items that have a matching deal (store + price)
- Grocery list UX:
  - Sections: Produce / Meat / Dairy / Pantry / Frozen / Other (best-effort categorization)
  - Check-off items, persistent
  - "Sort by store" toggle (MVP: one store at a time or best deal)
- Export/share as text

## Fixtures (MVP requirement)
- Provide at least:
  - 80+ deal items across 6+ Toronto stores
  - 8+ categories (produce, meat, dairy, pantry, frozen, snacks, beverages, household)
- Deals should include common recipe ingredients (chicken thighs, ground beef, tofu, onions, tomatoes, pasta, rice, canned beans, eggs, milk, etc.)
- Valid dates can be static but must be plausible (e.g., 7-day window)

## 4) Nice-to-have (post-MVP)
- Account login + cloud sync
- Pantry inventory / "I already have this"
- Budget cap ($) + optimization under budget
- Nutritional targets (protein/calories)
- Store pickup / deep linking to store
- Price history + alerts

## 5) Non-goals for MVP
- Perfect nutrition calculations
- Perfect unit conversions for all ingredients
- Full coupon stacking logic
- Payments / subscriptions

## 6) Key Screens (routes)
Using Expo Router:
- /onboarding (postal code, dietary prefs)
- /(tabs)/deals (browse + filters)
- /(tabs)/recipes (recommended list)
- /recipe/[id] (detail)
- /(tabs)/plan (choose meals -> generated plan)
- /(tabs)/list (grocery list + check-off)
- /(tabs)/settings

## 7) Data Model (MVP)
### DealItem
- id
- title
- store
- price
- unit (string)
- category
- imageUrl?
- validFrom?
- validTo?
- location (postal code region / latlon region)

### Recipe
- id
- title
- imageUrl?
- servings (number)
- cookTimeMins (number)
- tags (dietary tags)
- ingredients: Array<RecipeIngredient>
- steps: string[]
- categories (optional)

### RecipeIngredient
- name
- quantity (number | string)
- unit (string)
- optional (boolean)
- category (for grocery grouping, best effort)

### MealPlan
- id
- mealsRequested (number)
- recipes: Recipe[]
- createdAt
- constraints (dietary, cookTime, etc.)

### GroceryListItem
- name
- totalQuantity (string for MVP)
- category
- checked (boolean)
- matchedDeal?: { store, price, dealId }

## 8) Deal -> Recipe matching heuristic (MVP)
- Normalize ingredient/deal names:
  - lowercase
  - strip punctuation
  - naive stemming rules (e.g., "tomatoes" -> "tomato")
- A recipe scores higher if more ingredients match deal items.
- Tie-breakers:
  - fewer "non-deal" ingredients
  - variety across proteins / categories
- This heuristic must be deterministic for testing.

## 9) Technical Architecture
- Expo + TypeScript + Expo Router
- State:
  - React Query for API + caching
  - Zustand or React Context for local UI state (meal plan, list)
- Storage:
  - AsyncStorage (mobile) + localStorage (web) via a thin abstraction
- Networking:
  - `src/providers/dealsProvider.ts` with implementations:
    - `mockDealsProvider`
    - `flippDealsProvider` (stubbed initially)
- Recipes source:
  - Start with local JSON recipe library (20-50 recipes)
  - Later: external recipes API

## Deals Provider Interface (required)

`src/providers/dealsProvider.ts` exports:

- types:
  - `DealItem`
  - `DealsQuery`:
    - postalCode: string
    - lat?: number
    - lon?: number
    - radiusKm?: number (default 10)
    - stores?: string[]
    - categories?: string[]
- interface:
  - `DealsProvider`:
    - `searchDeals(query: DealsQuery): Promise<DealItem[]>`

Implementations:
- `mockDealsProvider.ts` (Phase 1)
- `flippDealsProvider.ts` (Phase 2, stubbed in MVP with TODOs)

## 10) Privacy & Permissions
- Location:
  - Ask permission on mobile; always allow manual postal code entry
- Store postal code and preferences locally by default
- No account required for MVP

## 11) Quality Bar / Definition of Done
- Runs on iOS, Android, Web
- No TypeScript errors (`npm run typecheck`)
- Lint passes (`npm run lint`)
- Basic tests for:
  - deal/ingredient matching normalization
  - meal plan selection determinism
## Provider swap acceptance criteria
- Switching provider via feature flag must not require any UI code changes.
- App works end-to-end with mock provider.
- Flipp provider may be stubbed for MVP, but must compile and follow the same interface.
- Core flows work:
  1) set postal code
  2) browse deals
  3) pick meals count
  4) generate plan
  5) view grocery list and check off items
