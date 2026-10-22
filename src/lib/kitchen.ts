import type { Recipe } from "@/lib/recipes";

export const inventoryCategories = [
  "Vegetables",
  "Fruit",
  "Meat",
  "Seafood",
  "Eggs",
  "Protein",
  "Pantry",
  "Seasonings",
  "Dairy",
  "Other",
] as const;

export const inventoryUnits = [
  "pieces",
  "bulbs",
  "bottles",
  "cans",
  "packs",
  "g",
  "kg",
  "ml",
  "L",
  "tbsp",
  "tsp",
] as const;

export const equipmentOptions = [
  "Pot",
  "Wok",
  "Frying pan",
  "Rice cooker",
  "Microwave",
  "Oven",
  "Air fryer",
  "Blender",
  "Steamer",
] as const;

export type InventoryItem = {
  id: string;
  name: string;
  category: string;
  brand?: string;
  barcode?: string;
  imageUrl?: string;
  packageSize?: string;
  ownedQuantity?: number;
  remainingQuantity: number | null;
  unit: string;
  expiresOn?: string;
  note?: string;
  addedAt: string;
};

export type UserPreferences = {
  diet: string[];
  allergies: string[];
  dislikes: string[];
  maxCookingMinutes: number | null;
  skillLevel: "Any" | "Easy" | "Medium";
  servings: number;
};

export type RecipeRequirement = {
  name: string;
  amount: number;
  unit: string;
  optional?: boolean;
};

export type MatchableRecipe = Recipe & {
  requirements: RecipeRequirement[];
  equipment: string[];
  dietaryTags: string[];
  instructions: string[];
  difficulty: "Easy" | "Medium";
};

export function isMatchableRecipe(recipe: Recipe): recipe is MatchableRecipe {
  const candidate = recipe as Partial<MatchableRecipe>;
  return Array.isArray(candidate.requirements) &&
    candidate.requirements.length > 0 &&
    Array.isArray(candidate.equipment) &&
    Array.isArray(candidate.instructions) &&
    typeof candidate.difficulty === "string";
}

export type RecipeMatch = {
  recipe: MatchableRecipe;
  available: RecipeRequirement[];
  missing: RecipeRequirement[];
  optionalMissing: RecipeRequirement[];
  matchPercent: number;
  usesSoon: string[];
  ready: boolean;
};

export const defaultPreferences: UserPreferences = {
  diet: [],
  allergies: [],
  dislikes: [],
  maxCookingMinutes: null,
  skillLevel: "Any",
  servings: 2,
};

const normalize = (value: string) =>
  value
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ก-๙]+/g, " ")
    .trim();

function findInventoryItem(ingredient: string, inventory: InventoryItem[]) {
  const target = normalize(ingredient);
  const singular = (value: string) => value.replace(/s$/, "");
  return inventory.find((item) => {
    if (item.remainingQuantity === null || item.remainingQuantity <= 0) return false;
    const name = normalize(item.name);
    return name === target || singular(name) === singular(target);
  });
}

function canCover(required: RecipeRequirement, item: InventoryItem | undefined, servings: number, baseServings: number) {
  if (!item || item.remainingQuantity === null) return false;
  const conversions: Record<string, { family: string; factor: number }> = {
    g: { family: "mass", factor: 1 },
    kg: { family: "mass", factor: 1000 },
    ml: { family: "volume", factor: 1 },
    L: { family: "volume", factor: 1000 },
    tsp: { family: "spoon", factor: 1 },
    tbsp: { family: "spoon", factor: 3 },
  };
  const availableUnit = conversions[item.unit];
  const requiredUnit = conversions[required.unit];
  if (availableUnit || requiredUnit) {
    if (!availableUnit || !requiredUnit || availableUnit.family !== requiredUnit.family) return false;
    const available = item.remainingQuantity * availableUnit.factor;
    const needed = required.amount * (servings / baseServings) * requiredUnit.factor;
    return available >= needed;
  }
  if (item.unit.toLowerCase() !== required.unit.toLowerCase()) return false;
  return item.remainingQuantity >= required.amount * (servings / baseServings);
}

export function recommendRecipes(
  recipes: MatchableRecipe[],
  inventory: InventoryItem[],
  equipment: string[],
  preferences: UserPreferences,
  mode: "ready" | "almost" | "soon" | "healthy" = "ready",
  now = new Date(),
): RecipeMatch[] {
  const allergenTerms = preferences.allergies.map(normalize).filter(Boolean);
  const dislikes = preferences.dislikes.map(normalize).filter(Boolean);
  const equipped = new Set(equipment.map(normalize));

  const matches = recipes
    .filter((recipe) => {
      const ingredients = [...recipe.ingredients, ...recipe.requirements.map((item) => item.name)].map(normalize);
      if (allergenTerms.some((allergen) => ingredients.some((ingredient) => ingredient.includes(allergen)))) return false;
      if (dislikes.some((dislike) => ingredients.some((ingredient) => ingredient.includes(dislike)))) return false;
      if (
        preferences.diet.some((diet) => diet !== "No specific preference") &&
        preferences.diet.some((diet) => diet !== "No specific preference" && !recipe.dietaryTags.includes(diet))
      ) return false;
      if (preferences.maxCookingMinutes && recipe.minutes > preferences.maxCookingMinutes) return false;
      if (preferences.skillLevel === "Easy" && recipe.difficulty !== "Easy") return false;
      return recipe.equipment.every((tool) => equipped.has(normalize(tool)));
    })
    .map((recipe) => {
      const available: RecipeRequirement[] = [];
      const missing: RecipeRequirement[] = [];
      const optionalMissing: RecipeRequirement[] = [];
      const soonDays = 5 * 24 * 60 * 60 * 1000;
      const usesSoon: string[] = [];
      for (const requirement of recipe.requirements) {
        const item = findInventoryItem(requirement.name, inventory);
        if (canCover(requirement, item, preferences.servings, recipe.servings)) {
          available.push(requirement);
          if (item?.expiresOn) {
            const expiry = new Date(`${item.expiresOn}T23:59:59`);
            if (expiry.getTime() >= now.getTime() && expiry.getTime() - now.getTime() <= soonDays) {
              usesSoon.push(item.name);
            }
          }
        } else if (requirement.optional) {
          optionalMissing.push(requirement);
        } else {
          missing.push(requirement);
        }
      }
      const requiredCount = recipe.requirements.filter((item) => !item.optional).length;
      const matchPercent = requiredCount
        ? Math.round((available.length / requiredCount) * 100)
        : 100;
      return {
        recipe,
        available,
        missing,
        optionalMissing,
        matchPercent,
        usesSoon,
        ready: missing.length === 0,
      };
    });

  return matches
    .filter((match) => {
      if (mode === "ready") return match.ready;
      if (mode === "almost") return match.missing.length > 0 && match.missing.length <= 2;
      if (mode === "soon") return match.usesSoon.length > 0;
      return preferences.diet.length === 0 || preferences.diet.some((tag) => match.recipe.dietaryTags.includes(tag));
    })
    .sort((left, right) => {
      if (mode === "soon") return right.usesSoon.length - left.usesSoon.length;
      if (mode === "healthy") return right.matchPercent - left.matchPercent;
      return right.matchPercent - left.matchPercent || left.recipe.minutes - right.recipe.minutes;
    });
}

export function isExpiringSoon(item: InventoryItem, now = new Date()) {
  if (!item.expiresOn) return false;
  const expiry = new Date(`${item.expiresOn}T23:59:59`);
  const difference = expiry.getTime() - now.getTime();
  return difference >= 0 && difference <= 5 * 24 * 60 * 60 * 1000;
}
