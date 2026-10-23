import { format } from "date-fns";
import type { MatchableRecipe } from "./kitchen";

export type Recipe = {
  id: string;
  title: string;
  category: "Breakfast" | "Lunch" | "Dinner";
  minutes: number;
  servings: number;
  calories: number;
  image: string;
  description: string;
  ingredients: string[];
  tag: string;
};

export const starterRecipes: MatchableRecipe[] = [
  {
    id: "tuscan-chicken",
    title: "Creamy Tuscan chicken",
    category: "Dinner",
    minutes: 30,
    servings: 4,
    calories: 420,
    image: "https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=900&q=85",
    description: "Golden chicken in a silky sun-dried tomato cream sauce.",
    ingredients: ["Chicken breast", "Sun-dried tomatoes", "Spinach", "Cream", "Garlic"],
    tag: "HIGH PROTEIN",
    requirements: [
      { name: "Chicken breast", amount: 500, unit: "g" },
      { name: "Sun-dried tomatoes", amount: 100, unit: "g" },
      { name: "Spinach", amount: 100, unit: "g" },
      { name: "Cream", amount: 200, unit: "ml" },
      { name: "Garlic", amount: 2, unit: "pieces" },
    ],
    equipment: ["Frying pan"],
    dietaryTags: ["High protein"],
    instructions: ["Season and sear the chicken until golden.", "Soften the garlic and sun-dried tomatoes.", "Add cream and spinach, then simmer until the chicken is cooked through."],
    difficulty: "Easy",
  },
  {
    id: "green-goddess",
    title: "Green goddess bowl",
    category: "Lunch",
    minutes: 20,
    servings: 2,
    calories: 360,
    image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=85",
    description: "A bright, crunchy bowl with quinoa and herby dressing.",
    ingredients: ["Quinoa", "Avocado", "Cucumber", "Edamame", "Green goddess dressing"],
    tag: "PLANT POWER",
    requirements: [
      { name: "Quinoa", amount: 150, unit: "g" },
      { name: "Avocado", amount: 1, unit: "pieces" },
      { name: "Cucumber", amount: 1, unit: "pieces" },
      { name: "Edamame", amount: 100, unit: "g" },
      { name: "Green goddess dressing", amount: 30, unit: "ml" },
    ],
    equipment: ["Pot"],
    dietaryTags: ["Vegetarian", "Balanced meals", "Healthy everyday meals"],
    instructions: ["Cook the quinoa and let it cool slightly.", "Slice the avocado and cucumber.", "Build the bowls and finish with dressing."],
    difficulty: "Easy",
  },
  {
    id: "berry-oats",
    title: "Berry overnight oats",
    category: "Breakfast",
    minutes: 10,
    servings: 1,
    calories: 290,
    image: "https://images.unsplash.com/photo-1517673132405-a56a62b18caf?auto=format&fit=crop&w=900&q=85",
    description: "Creamy make-ahead oats with a handful of fresh berries.",
    ingredients: ["Rolled oats", "Greek yogurt", "Blueberries", "Honey"],
    tag: "MAKE AHEAD",
    requirements: [
      { name: "Rolled oats", amount: 50, unit: "g" },
      { name: "Greek yogurt", amount: 100, unit: "g" },
      { name: "Blueberries", amount: 50, unit: "g" },
      { name: "Honey", amount: 1, unit: "tsp", optional: true },
    ],
    equipment: [],
    dietaryTags: ["Vegetarian", "Balanced meals"],
    instructions: ["Stir oats and yogurt together in a jar.", "Cover and chill overnight.", "Top with berries and honey before serving."],
    difficulty: "Easy",
  },
  {
    id: "salmon-rice",
    title: "Miso-glazed salmon",
    category: "Dinner",
    minutes: 25,
    servings: 2,
    calories: 510,
    image: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=900&q=85",
    description: "Sticky miso salmon over fluffy rice with sesame greens.",
    ingredients: ["Salmon fillet", "White miso", "Jasmine rice", "Broccoli", "Sesame seeds"],
    tag: "FAMILY FAVORITE",
    requirements: [
      { name: "Salmon fillet", amount: 300, unit: "g" },
      { name: "White miso", amount: 30, unit: "g" },
      { name: "Jasmine rice", amount: 150, unit: "g" },
      { name: "Broccoli", amount: 200, unit: "g" },
      { name: "Sesame seeds", amount: 1, unit: "tsp", optional: true },
    ],
    equipment: ["Oven", "Pot"],
    dietaryTags: ["Pescatarian", "Balanced meals", "High protein"],
    instructions: ["Cook the jasmine rice.", "Brush salmon with miso and bake until it flakes easily.", "Steam broccoli and serve with rice."],
    difficulty: "Medium",
  },
  {
    id: "tomato-pasta",
    title: "Roasted tomato pasta",
    category: "Dinner",
    minutes: 35,
    servings: 4,
    calories: 445,
    image: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=900&q=85",
    description: "Jammy blistered tomatoes, basil, and plenty of parmesan.",
    ingredients: ["Rigatoni", "Cherry tomatoes", "Fresh basil", "Parmesan", "Olive oil"],
    tag: "ONE PAN",
    requirements: [
      { name: "Rigatoni", amount: 250, unit: "g" },
      { name: "Cherry tomatoes", amount: 300, unit: "g" },
      { name: "Fresh basil", amount: 10, unit: "g" },
      { name: "Parmesan", amount: 30, unit: "g" },
      { name: "Olive oil", amount: 1, unit: "tbsp" },
    ],
    equipment: ["Pot"],
    dietaryTags: ["Vegetarian"],
    instructions: ["Roast tomatoes with olive oil until soft and blistered.", "Boil rigatoni until al dente.", "Toss together with basil and parmesan."],
    difficulty: "Easy",
  },
  {
    id: "avo-toast",
    title: "Smashed avo toast",
    category: "Breakfast",
    minutes: 12,
    servings: 2,
    calories: 315,
    image: "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=900&q=85",
    description: "Sourdough, lemony avocado, chili flakes, and a jammy egg.",
    ingredients: ["Sourdough", "Avocado", "Eggs", "Lemon", "Chili flakes"],
    tag: "QUICK & EASY",
    requirements: [
      { name: "Sourdough", amount: 2, unit: "pieces" },
      { name: "Avocado", amount: 1, unit: "pieces" },
      { name: "Eggs", amount: 2, unit: "pieces" },
      { name: "Lemon", amount: 0.5, unit: "pieces" },
      { name: "Chili flakes", amount: 1, unit: "tsp", optional: true },
    ],
    equipment: ["Frying pan"],
    dietaryTags: ["Vegetarian", "High protein"],
    instructions: ["Toast the sourdough.", "Mash avocado with lemon and spread on toast.", "Fry the eggs and finish with chili flakes."],
    difficulty: "Easy",
  },
  {
    id: "thai-basil-tofu",
    title: "Thai basil tofu",
    category: "Dinner",
    minutes: 25,
    servings: 2,
    calories: 0,
    image: "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=900&q=85",
    description: "Crisp tofu with holy basil, garlic, and a savory soy-chili sauce.",
    ingredients: ["Firm tofu", "Thai basil", "Garlic", "Chili", "Soy sauce", "Jasmine rice"],
    tag: "THAI-INSPIRED",
    requirements: [
      { name: "Firm tofu", amount: 250, unit: "g" },
      { name: "Thai basil", amount: 20, unit: "g" },
      { name: "Garlic", amount: 2, unit: "pieces" },
      { name: "Chili", amount: 1, unit: "pieces", optional: true },
      { name: "Soy sauce", amount: 1, unit: "tbsp" },
      { name: "Jasmine rice", amount: 150, unit: "g" },
    ],
    equipment: ["Wok", "Pot"],
    dietaryTags: ["Vegetarian", "Vegan", "Thai food", "High protein"],
    instructions: ["Cook the jasmine rice.", "Brown the tofu in a hot wok.", "Stir-fry garlic and chili, add soy sauce and basil, and serve over rice."],
    difficulty: "Easy",
  },
];

export type PlannedMeals = Record<string, string>;

export function getMealKey(date: Date, slot: string) {
  return `${format(date, "yyyy-MM-dd")}-${slot}`;
}

export function getPlannedIngredients(meals: PlannedMeals, recipes: Recipe[]) {
  const usedIds = new Set(Object.values(meals));
  return Array.from(
    new Set(recipes.filter((recipe) => usedIds.has(recipe.id)).flatMap((recipe) => recipe.ingredients)),
  );
}
