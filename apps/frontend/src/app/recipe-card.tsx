"use client";

import type { Recipe } from "@cookwhat/shared";

export function RecipeCard({ recipe, onAdd }: { recipe: Recipe; onAdd: (recipe: Recipe) => void }) {
  return (
    <article className="recipe-card">
      <div className="recipe-image" style={{ backgroundImage: `url("${recipe.image}")` }}>
        <span className="recipe-tag">{recipe.tag}</span>
        <button
          className="favorite-button"
          aria-label={`Add ${recipe.title} to meal plan`}
          onClick={() => onAdd(recipe)}
        >
          ＋
        </button>
      </div>
      <div className="recipe-card-copy">
        <div className="recipe-category">
          {recipe.category} <span>·</span> {recipe.minutes} min
        </div>
        <h3>{recipe.title}</h3>
        <p>{recipe.description}</p>
        <div className="recipe-card-meta">
          <span>◷ {recipe.minutes} min</span>
          <span>♧ {recipe.servings} servings</span>
          <button onClick={() => onAdd(recipe)}>Add to plan <span>↗</span></button>
        </div>
      </div>
    </article>
  );
}
