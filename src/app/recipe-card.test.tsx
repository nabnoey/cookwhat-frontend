import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { RecipeCard } from "./recipe-card";
import type { Recipe } from "@/lib/recipes";

const recipe: Recipe = {
  id: "weekday-pasta",
  title: "Weeknight pasta",
  category: "Dinner",
  minutes: 25,
  servings: 2,
  calories: 400,
  image: "",
  description: "A comforting bowl, ready in a flash.",
  ingredients: ["Pasta", "Tomatoes"],
  tag: "QUICK & EASY",
};

describe("RecipeCard", () => {
  it("adds the selected recipe to the meal plan", () => {
    const onAdd = jest.fn();
    render(createElement(RecipeCard, { recipe, onAdd }));

    fireEvent.click(screen.getByRole("button", { name: "Add Weeknight pasta to meal plan" }));

    expect(onAdd).toHaveBeenCalledWith(recipe);
    expect(screen.getByRole("heading", { name: "Weeknight pasta" })).toBeInTheDocument();
  });
});
