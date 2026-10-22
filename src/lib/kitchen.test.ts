import { defaultPreferences, recommendRecipes, type InventoryItem, type MatchableRecipe } from "./kitchen";

const recipe: MatchableRecipe = {
  id: "fried-rice",
  title: "Egg fried rice",
  category: "Dinner",
  minutes: 20,
  servings: 2,
  calories: 0,
  image: "",
  description: "",
  ingredients: ["Eggs", "Rice", "Oil", "Fish sauce"],
  tag: "",
  requirements: [
    { name: "Eggs", amount: 2, unit: "pieces" },
    { name: "Rice", amount: 200, unit: "g" },
    { name: "Oil", amount: 1, unit: "tbsp" },
    { name: "Fish sauce", amount: 1, unit: "tsp", optional: true },
  ],
  equipment: ["Wok"],
  dietaryTags: ["Balanced meals"],
  instructions: ["Heat the wok.", "Cook the rice with eggs."],
  difficulty: "Easy",
};

const inventory: InventoryItem[] = [
  { id: "eggs", name: "Eggs", category: "Eggs", remainingQuantity: 3, unit: "pieces", addedAt: "" },
  { id: "rice", name: "Rice", category: "Pantry", remainingQuantity: 300, unit: "g", addedAt: "" },
  { id: "oil", name: "Oil", category: "Seasonings", remainingQuantity: 2, unit: "tbsp", expiresOn: "2026-10-24", addedAt: "" },
];

describe("inventory-aware recipe recommendations", () => {
  it("requires enough quantities and the needed equipment before marking ready", () => {
    expect(recommendRecipes([recipe], inventory, ["Wok"], defaultPreferences)[0].ready).toBe(true);
    expect(recommendRecipes([recipe], inventory.slice(0, 1), ["Wok"], defaultPreferences)).toHaveLength(0);
    expect(recommendRecipes([recipe], inventory, [], defaultPreferences)).toHaveLength(0);
  });

  it("filters known allergens and respects ingredient quantities for serving changes", () => {
    const preferences = { ...defaultPreferences, allergies: ["eggs"], servings: 4 };
    expect(recommendRecipes([recipe], inventory, ["Wok"], preferences)).toHaveLength(0);
    const noAllergy = { ...defaultPreferences, servings: 4 };
    const result = recommendRecipes([recipe], inventory, ["Wok"], noAllergy, "almost");
    expect(result[0].missing.map((item) => item.name)).toEqual(["Eggs", "Rice"]);
    expect(result[0].ready).toBe(false);
  });

  it("does not infer remaining quantity for unknown inventory quantities", () => {
    const unknown = [{ ...inventory[0], remainingQuantity: null }];
    expect(recommendRecipes([recipe], [...unknown, ...inventory.slice(1)], ["Wok"], defaultPreferences)).toHaveLength(0);
  });

  it("converts matching metric mass and volume units without guessing package contents", () => {
    const metricInventory = [
      { id: "rice", name: "Rice", category: "Pantry", remainingQuantity: 0.3, unit: "kg", addedAt: "" },
    ];
    const riceRecipe = { ...recipe, requirements: [{ name: "Rice", amount: 200, unit: "g" }], ingredients: ["Rice"], equipment: [] };
    expect(recommendRecipes([riceRecipe], metricInventory, [], defaultPreferences)[0].ready).toBe(true);
  });
});
