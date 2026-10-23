"use client";

import { useState } from "react";
import {
  recommendRecipes,
  type InventoryItem,
  type RecipeMatch,
  type UserPreferences,
} from "@cookwhat/shared";
import type { MatchableRecipe } from "@cookwhat/shared";

type Props = {
  recipes: MatchableRecipe[];
  inventory: InventoryItem[];
  equipment: string[];
  preferences: UserPreferences;
  onPreferencesChange: (preferences: UserPreferences) => void;
  onAddMissing: (items: { name: string; quantity: string }[]) => void;
  onPlan: (recipe: MatchableRecipe) => void;
};

const dietaryOptions = ["Healthy everyday meals", "High protein", "Balanced meals", "Lower sodium", "Lower added sugar", "Vegetarian", "Vegan", "Pescatarian", "Thai food", "No specific preference"];
const modes = [
  { id: "ready", label: "Cook with what I have" },
  { id: "almost", label: "Almost ready" },
  { id: "soon", label: "Use soon" },
  { id: "healthy", label: "Healthy choices" },
] as const;

export function RecommendationsView({ recipes, inventory, equipment, preferences, onPreferencesChange, onAddMissing, onPlan }: Props) {
  const [mode, setMode] = useState<(typeof modes)[number]["id"]>("ready");
  const [showPreferences, setShowPreferences] = useState(false);
  const [allergyInput, setAllergyInput] = useState("");
  const [dislikeInput, setDislikeInput] = useState("");
  const matches = recommendRecipes(recipes, inventory, equipment, preferences, mode);

  function toggleDiet(value: string) {
      const diet = value === "No specific preference"
        ? preferences.diet.includes(value) ? [] : [value]
        : preferences.diet.includes(value)
          ? preferences.diet.filter((item) => item !== value)
          : [...preferences.diet.filter((item) => item !== "No specific preference"), value];
    onPreferencesChange({ ...preferences, diet });
  }

  function addTerm(field: "allergies" | "dislikes", value: string, clear: () => void) {
    const term = value.trim();
    if (!term || preferences[field].some((item) => item.toLowerCase() === term.toLowerCase())) return;
    onPreferencesChange({ ...preferences, [field]: [...preferences[field], term] });
    clear();
  }

  return (
    <section className="recommendations-view">
      <div className="recommendation-heading"><div><p className="eyebrow">GOOD FOOD, RIGHT FROM YOUR KITCHEN</p><h1>What can I cook?</h1><p className="intro-copy">Recipes are matched against the amounts you have and the equipment you selected.</p></div>
        <button className={`secondary-button ${showPreferences ? "is-selected" : ""}`} onClick={() => setShowPreferences((value) => !value)}>Preferences <span>＋</span></button>
      </div>

      {showPreferences && <section className="preferences-panel" aria-label="Dietary preferences">
        <div className="preferences-heading"><div><strong>Make these ideas yours</strong><span>Allergies are exclusions when they match a recipe ingredient. Dietary labels use listed ingredients, not verified nutrition.</span></div><button className="icon-button" aria-label="Close preferences" onClick={() => setShowPreferences(false)}>×</button></div>
        <div className="preference-tags">{dietaryOptions.map((item) => <label key={item} className={preferences.diet.includes(item) ? "preference-selected" : ""}><input type="checkbox" checked={preferences.diet.includes(item)} onChange={() => toggleDiet(item)} />{item}</label>)}</div>
        <div className="preference-columns">
          <PreferenceTerms title="Allergies" values={preferences.allergies} input={allergyInput} setInput={setAllergyInput} onAdd={() => addTerm("allergies", allergyInput, () => setAllergyInput(""))} onRemove={(value) => onPreferencesChange({ ...preferences, allergies: preferences.allergies.filter((item) => item !== value) })} placeholder="e.g. peanuts" />
          <PreferenceTerms title="Dislikes" values={preferences.dislikes} input={dislikeInput} setInput={setDislikeInput} onAdd={() => addTerm("dislikes", dislikeInput, () => setDislikeInput(""))} onRemove={(value) => onPreferencesChange({ ...preferences, dislikes: preferences.dislikes.filter((item) => item !== value) })} placeholder="e.g. cilantro" />
        </div>
        <div className="preference-settings"><label>Maximum cook time<select value={preferences.maxCookingMinutes ?? ""} onChange={(event) => onPreferencesChange({ ...preferences, maxCookingMinutes: event.target.value ? Number(event.target.value) : null })}><option value="">No limit</option><option value="20">20 minutes</option><option value="30">30 minutes</option><option value="45">45 minutes</option></select></label><label>Cooking skill<select value={preferences.skillLevel} onChange={(event) => onPreferencesChange({ ...preferences, skillLevel: event.target.value as UserPreferences["skillLevel"] })}><option>Any</option><option>Easy</option><option>Medium</option></select></label><label>Servings<input type="number" min="1" max="12" value={preferences.servings} onChange={(event) => onPreferencesChange({ ...preferences, servings: Math.min(12, Math.max(1, Number(event.target.value) || 1)) })} /></label></div>
      </section>}

      <div className="recommendation-tabs" role="tablist" aria-label="Recipe recommendation mode">
        {modes.map((item) => <button key={item.id} role="tab" aria-selected={mode === item.id} className={mode === item.id ? "active" : ""} onClick={() => setMode(item.id)}>{item.label}</button>)}
      </div>
      <p className="matching-summary">{matches.length} {matches.length === 1 ? "recipe" : "recipes"} · based on {inventory.length} kitchen {inventory.length === 1 ? "item" : "items"} and {equipment.length} {equipment.length === 1 ? "tool" : "tools"}</p>

      {matches.length === 0 ? <div className="recommendation-empty"><span>—</span><h2>{mode === "ready" ? "Nothing ready just yet" : "No matches for these filters"}</h2><p>{inventory.length === 0 ? "Add ingredients to My kitchen to get recommendations based on what you actually have." : "Try Almost ready, update your kitchen quantities, or review your preferences and equipment."}</p></div> :
        <div className="recommendation-list">{matches.map((match) => <RecommendationItem key={match.recipe.id} match={match} servings={preferences.servings} onAddMissing={onAddMissing} onPlan={onPlan} />)}</div>}
    </section>
  );
}

function PreferenceTerms({ title, values, input, setInput, onAdd, onRemove, placeholder }: {
  title: string;
  values: string[];
  input: string;
  setInput: (value: string) => void;
  onAdd: () => void;
  onRemove: (value: string) => void;
  placeholder: string;
}) {
  return <div className="preference-terms"><strong>{title}</strong><form onSubmit={(event) => { event.preventDefault(); onAdd(); }}><input value={input} onChange={(event) => setInput(event.target.value)} placeholder={placeholder} /><button aria-label={`Add ${title.toLowerCase()}`}>＋</button></form><div>{values.map((item) => <button key={item} onClick={() => onRemove(item)}>{item} ×</button>)}</div></div>;
}

function RecommendationItem({ match, servings, onAddMissing, onPlan }: {
  match: RecipeMatch;
  servings: number;
  onAddMissing: (items: { name: string; quantity: string }[]) => void;
  onPlan: (recipe: MatchableRecipe) => void;
}) {
  const { recipe, available, missing, optionalMissing, usesSoon } = match;
  const scaled = (amount: number) => Math.round(amount * (servings / recipe.servings) * 100) / 100;
  return <article className="recommendation-item">
    <div className="recommendation-photo" style={{ backgroundImage: `url("${recipe.image}")` }} aria-hidden="true" />
    <div className="recommendation-content">
      <div className="recommendation-meta"><span>{recipe.minutes} min</span><span>{recipe.difficulty}</span>{recipe.dietaryTags.map((tag) => <span key={tag}>{tag}</span>)}</div>
      <h2>{recipe.title}</h2><p>{recipe.description}</p>
      <div className="match-progress"><div><span>Ingredient match</span><strong>{match.matchPercent}%</strong></div><i><b style={{ width: `${match.matchPercent}%` }} /></i></div>
      <div className="match-ingredients">
        <span className="available-ingredients">Have: {available.map((item) => item.name).join(", ") || "none yet"}</span>
        {missing.length > 0 && <span className="missing-ingredients">Need: {missing.map((item) => `${item.name} (${scaled(item.amount)} ${item.unit})`).join(", ")}</span>}
        {optionalMissing.length > 0 && <span className="optional-ingredients">Optional: {optionalMissing.map((item) => item.name).join(", ")}</span>}
        {usesSoon.length > 0 && <span className="soon-ingredients">Use soon: {usesSoon.join(", ")}</span>}
      </div>
      <details className="recipe-details">
        <summary>Ingredients & method <span>⌄</span></summary>
        <div className="recipe-detail-columns"><div><strong>For {servings} servings</strong><ul>{recipe.requirements.map((item) => <li key={item.name} className={available.some((entry) => entry.name === item.name) ? "ingredient-have" : item.optional ? "ingredient-optional" : "ingredient-need"}><span>{item.name}</span><span>{scaled(item.amount)} {item.unit}{item.optional ? " · optional" : ""}</span></li>)}</ul><p className="equipment-note">Equipment: {recipe.equipment.join(", ") || "No special equipment"}</p></div><div><strong>How to make it</strong><ol>{recipe.instructions.map((instruction) => <li key={instruction}>{instruction}</li>)}</ol></div></div>
      </details>
      <div className="recommendation-actions">{missing.length > 0 && <button className="text-button" onClick={() => onAddMissing(missing.map((item) => ({ name: item.name, quantity: `${scaled(item.amount)} ${item.unit}` })))}>Add missing to list ↗</button>}{match.ready && <span className="ready-label">Ready to cook</span>}<button className="primary-button" onClick={() => onPlan(recipe)}>Add to meal plan</button></div>
    </div>
  </article>;
}
