import { PrismaClient } from "@prisma/client";
import { starterRecipes } from "@cookwhat/shared";

const prisma = new PrismaClient();

async function main() {
  const categories = ["Vegetables", "Fruit", "Meat", "Seafood", "Eggs", "Protein", "Pantry", "Seasonings", "Dairy", "Other"];
  for (const name of categories) {
    await prisma.ingredientCategory.upsert({
      where: { slug: name.toLowerCase().replaceAll(" ", "-") },
      update: {},
      create: { name, slug: name.toLowerCase().replaceAll(" ", "-") },
    });
  }

  for (const recipe of starterRecipes) {
    const instructionsText = JSON.stringify(recipe.instructions);
    await prisma.recipe.upsert({
      where: { id: recipe.id },
      update: {},
      create: {
        id: recipe.id,
        title: recipe.title,
        description: recipe.description,
        category: recipe.category,
        cookingMinutes: recipe.minutes,
        servings: recipe.servings,
        calories: recipe.calories,
        imageUrl: recipe.image,
        ingredients: JSON.stringify(recipe.ingredients),
        dietaryTags: JSON.stringify(recipe.dietaryTags),
        equipment: JSON.stringify(recipe.equipment),
        instructionsText,
        difficulty: recipe.difficulty,
        recipeIngredients: {
          create: recipe.requirements.map((ingredient) => ({
            name: ingredient.name,
            amount: ingredient.amount,
            unit: ingredient.unit,
            optional: ingredient.optional ?? false,
          })),
        },
        instructions: {
          create: recipe.instructions.map((text, index) => ({ step: index + 1, text })),
        },
      },
    });
  }
}

main()
  .catch((error: unknown) => {
    console.error("CookWhat seed failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
