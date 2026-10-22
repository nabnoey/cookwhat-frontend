import { getMealKey, getPlannedIngredients, type Recipe } from "./recipes";

const recipes: Recipe[] = [
  {
    id: "one",
    title: "Tomato bowl",
    category: "Lunch",
    minutes: 20,
    servings: 2,
    calories: 300,
    image: "",
    description: "",
    ingredients: ["Tomatoes", "Basil"],
    tag: "",
  },
  {
    id: "two",
    title: "Pasta",
    category: "Dinner",
    minutes: 30,
    servings: 4,
    calories: 400,
    image: "",
    description: "",
    ingredients: ["Tomatoes", "Pasta"],
    tag: "",
  },
];

describe("meal planning helpers", () => {
  it("builds stable date-and-slot keys", () => {
    expect(getMealKey(new Date("2026-10-19T00:00:00.000Z"), "dinner")).toBe("2026-10-19-dinner");
  });

  it("returns unique ingredients for planned recipes only", () => {
    expect(getPlannedIngredients({ monday: "one", tuesday: "two" }, recipes)).toEqual([
      "Tomatoes",
      "Basil",
      "Pasta",
    ]);
  });
});
