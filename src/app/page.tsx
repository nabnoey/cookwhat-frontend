"use client";

import { useEffect, useMemo, useState } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { addDays, format, isSameDay, startOfWeek, subDays } from "date-fns";
import { signIn, signOut, useSession } from "next-auth/react";
import {
  getMealKey,
  getPlannedIngredients,
  starterRecipes,
  type PlannedMeals,
  type Recipe,
} from "@/lib/recipes";
import { RecipeCard } from "@/app/recipe-card";
import { BarcodeScanner } from "@/app/barcode-scanner";
import { KitchenView } from "@/app/kitchen-view";
import { RecommendationsView } from "@/app/recommendations-view";
import {
  defaultPreferences,
  isMatchableRecipe,
  recommendRecipes,
  type InventoryItem,
  type MatchableRecipe,
  type UserPreferences,
} from "@/lib/kitchen";

type View = "Overview" | "My kitchen" | "Scan barcode" | "Meal planner" | "Recipes" | "Shopping list";
type GroceryItem = { id: string; name: string; checked: boolean; quantity?: string };
type AuthMode = "signin" | "signup";

const slots = ["breakfast", "lunch", "dinner"] as const;
const navigation: { label: View; icon: string }[] = [
  { label: "Overview", icon: "⌂" },
  { label: "My kitchen", icon: "▤" },
  { label: "Recipes", icon: "♧" },
  { label: "Meal planner", icon: "▦" },
  { label: "Scan barcode", icon: "▥" },
  { label: "Shopping list", icon: "☷" },
];

export default function Home() {
  const { data: session, status: sessionStatus } = useSession();
  const [view, setView] = useState<View>("Overview");
  const [activeDate, setActiveDate] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [recipes, setRecipes] = useState<Recipe[]>(starterRecipes);
  const [meals, setMeals] = useState<PlannedMeals>({});
  const [groceries, setGroceries] = useState<GroceryItem[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [showRecipeForm, setShowRecipeForm] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [groceryInput, setGroceryInput] = useState("");
  const [formError, setFormError] = useState("");
  const [readyToPersist, setReadyToPersist] = useState(false);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);
  const [showScanner, setShowScanner] = useState(false);
  const [accountKitchenReady, setAccountKitchenReady] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("cookwhat-state");
      if (saved) {
        const state = JSON.parse(saved) as {
          recipes?: Recipe[];
          meals?: PlannedMeals;
          groceries?: GroceryItem[];
          inventory?: InventoryItem[];
          equipment?: string[];
          preferences?: UserPreferences;
        };
        if (Array.isArray(state.recipes)) setRecipes([...starterRecipes, ...state.recipes.filter((recipe) => !starterRecipes.some((base) => base.id === recipe.id))]);
        if (state.meals && typeof state.meals === "object") setMeals(state.meals);
        if (Array.isArray(state.groceries)) setGroceries(state.groceries);
        if (Array.isArray(state.inventory)) setInventory(state.inventory);
        if (Array.isArray(state.equipment)) setEquipment(state.equipment);
        if (state.preferences && typeof state.preferences === "object") setPreferences({ ...defaultPreferences, ...state.preferences });
      }
    } catch (error) {
      console.error("Could not restore saved CookWhat data.", error);
    } finally {
      setReadyToPersist(true);
    }
  }, []);

  useEffect(() => {
    if (!readyToPersist) return;
    window.localStorage.setItem("cookwhat-state", JSON.stringify({ recipes, meals, groceries, inventory, equipment, preferences }));
  }, [readyToPersist, recipes, meals, groceries, inventory, equipment, preferences]);

  useEffect(() => {
    if (sessionStatus !== "authenticated" || !session?.user?.id || !readyToPersist) {
      setAccountKitchenReady(false);
      return;
    }
    let cancelled = false;
    setAccountKitchenReady(false);
    void fetch("/api/kitchen")
      .then(async (response) => {
        const result = await response.json() as {
          inventory?: InventoryItem[];
          equipment?: string[];
          preferences?: UserPreferences | null;
          error?: string;
        };
        if (!response.ok) throw new Error(result.error ?? "Could not load your saved kitchen.");
        if (cancelled) return;
        if (result.inventory?.length || result.equipment?.length || result.preferences) {
          setInventory(result.inventory ?? []);
          setEquipment(result.equipment ?? []);
          setPreferences(result.preferences ? { ...defaultPreferences, ...result.preferences } : defaultPreferences);
        }
        setAccountKitchenReady(true);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error("Could not load the saved kitchen.", error);
        setToast("Your kitchen is available on this device; account sync could not be reached.");
      });
    return () => { cancelled = true; };
  }, [readyToPersist, session?.user?.id, sessionStatus]);

  useEffect(() => {
    if (sessionStatus !== "authenticated" || !accountKitchenReady) return;
    const timeout = window.setTimeout(() => {
      void fetch("/api/kitchen", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventory, equipment, preferences }),
      }).then(async (response) => {
        if (response.ok) return;
        const result = await response.json() as { error?: string };
        throw new Error(result.error ?? "Could not save your kitchen.");
      }).catch((error: unknown) => {
        console.error("Could not sync the kitchen to the account.", error);
        setToast("Kitchen changes are saved on this device but could not sync to your account.");
      });
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [accountKitchenReady, equipment, inventory, preferences, sessionStatus]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(activeDate, index)), [activeDate]);
  const matchingRecipes = useMemo(
    () =>
      recipes.filter((recipe) => {
        const matchesText = `${recipe.title} ${recipe.description} ${recipe.ingredients.join(" ")}`.toLowerCase().includes(query.toLowerCase());
        return matchesText && (category === "All" || recipe.category === category);
      }),
    [category, query, recipes],
  );
  const datesInView = new Set(weekDays.map((day) => format(day, "yyyy-MM-dd")));
  const mealsInView = Object.fromEntries(
    Object.entries(meals).filter(([key]) => datesInView.has(key.slice(0, 10))),
  );
  const checkedCount = groceries.filter((item) => item.checked).length;
  const weeklyGroceries = getPlannedIngredients(mealsInView, recipes);
  const recommendableRecipes = recipes.filter(isMatchableRecipe);
  const readyRecipes = recommendRecipes(recommendableRecipes, inventory, equipment, preferences, "ready");

  function moveMeal(result: DropResult) {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    setMeals((previous) => {
      const next = { ...previous };
      if (source.droppableId !== "recipe-source") {
        delete next[source.droppableId];
      }
      next[destination.droppableId] = draggableId;
      return next;
    });
  }

  function addToNextOpenSlot(recipe: Recipe) {
    for (const day of weekDays) {
      const key = getMealKey(day, recipe.category.toLowerCase());
      if (!meals[key]) {
        setMeals((previous) => ({ ...previous, [key]: recipe.id }));
        setToast(`${recipe.title} added to your plan`);
        return;
      }
    }
    setToast("That meal slot is already full. Try dragging it to a day.");
  }

  function addGroceryItem(name: string) {
    const cleaned = name.trim();
    if (!cleaned) return;
    setGroceries((previous) => [...previous, { id: crypto.randomUUID(), name: cleaned, checked: false }]);
    setGroceryInput("");
  }

  function addInventoryItem(item: Omit<InventoryItem, "id" | "addedAt">) {
    const match = inventory.find((entry) =>
      (item.barcode && entry.barcode === item.barcode) ||
      (!item.barcode && entry.name.trim().toLowerCase() === item.name.trim().toLowerCase() && entry.unit === item.unit),
    );
    if (match) {
      if (match.unit !== item.unit) {
        setToast(`${match.name} is already tracked in ${match.unit}. Edit that entry to keep units consistent.`);
        return;
      }
      const increase = item.remainingQuantity === null || match.remainingQuantity === null
        ? null
        : match.remainingQuantity + item.remainingQuantity;
      if (window.confirm(`${match.name} is already in your kitchen. Increase its remaining amount${increase === null ? "" : ` to ${increase} ${match.unit}`}?`)) {
        setInventory((previous) => previous.map((entry) => entry.id === match.id
          ? { ...entry, remainingQuantity: increase, ownedQuantity: entry.ownedQuantity && item.ownedQuantity ? entry.ownedQuantity + item.ownedQuantity : entry.ownedQuantity ?? item.ownedQuantity }
          : entry));
        setToast(increase === null ? `${match.name} kept as an unknown amount` : `${match.name} quantity updated`);
      }
      return;
    }
    setInventory((previous) => [...previous, { ...item, id: crypto.randomUUID(), addedAt: new Date().toISOString() }]);
    setToast(`${item.name} added to My kitchen`);
  }

  function addMissingGroceries(items: { name: string; quantity: string }[]) {
    const additions = items.filter(({ name }) =>
      !groceries.some((item) => item.name.trim().toLowerCase() === name.trim().toLowerCase()),
    );
    setGroceries((previous) => [...previous, ...additions.map(({ name, quantity }) => ({ id: crypto.randomUUID(), name, quantity, checked: false }))]);
    setView("Shopping list");
    setToast(additions.length ? `${additions.length} missing ingredients added` : "Those ingredients are already on your list");
  }

  async function submitAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError("");
    setAuthBusy(true);
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "");
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    try {
      if (authMode === "signup") {
        const response = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        const result = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(result.error ?? "Could not create your account.");
      }
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) throw new Error("That email and password combination was not recognized.");
      setShowAuth(false);
      setToast(authMode === "signup" ? "Your account is ready. Welcome to CookWhat!" : "Welcome back!");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      setAuthBusy(false);
    }
  }

  function saveRecipe(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    if (!title) {
      setFormError("Add a recipe name.");
      return;
    }
    const requirements = String(form.get("requirements") ?? "").split("\n").map((line) => {
      const [ingredient, amount, unit] = line.split("|").map((part) => part.trim());
      return { name: ingredient ?? "", amount: Number(amount), unit: unit ?? "" };
    }).filter((item) => item.name);
    if (requirements.some((item) => !Number.isFinite(item.amount) || item.amount <= 0 || !item.unit)) {
      setFormError("Use one ingredient per line in the format: name | amount | unit.");
      return;
    }
    if (requirements.length === 0) {
      setFormError("Add at least one measured ingredient.");
      return;
    }
    const ingredients = requirements.map((item) => item.name);
    const recipe: MatchableRecipe = {
      id: crypto.randomUUID(),
      title,
      category: String(form.get("category")) as Recipe["category"],
      minutes: Math.max(1, Number(form.get("minutes")) || 30),
      servings: Math.max(1, Number(form.get("servings")) || 2),
      calories: 0,
      image: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=900&q=85",
      description: "A new favorite, added to your recipe box.",
      ingredients,
      tag: "YOUR RECIPE",
      requirements,
      equipment: String(form.get("equipment") ?? "").split(",").map((item) => item.trim()).filter(Boolean),
      dietaryTags: String(form.get("dietaryTags") ?? "").split(",").map((item) => item.trim()).filter(Boolean),
      instructions: String(form.get("instructions") ?? "").split("\n").map((item) => item.trim()).filter(Boolean),
      difficulty: String(form.get("difficulty") ?? "Easy") as "Easy" | "Medium",
    };
    setRecipes((previous) => [...previous, recipe]);
    setShowRecipeForm(false);
    setToast(`${title} saved to your recipes`);
  }

  function buildShoppingList() {
    const additions = weeklyGroceries.filter(
      (ingredient) => !groceries.some((item) => item.name.toLowerCase() === ingredient.toLowerCase()),
    );
    setGroceries((previous) => [
      ...previous,
      ...additions.map((name) => ({ id: crypto.randomUUID(), name, checked: false })),
    ]);
    setView("Shopping list");
    setToast(additions.length ? `${additions.length} ingredients added to your list` : "Your planned ingredients are already on the list");
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={() => setView("Overview")} aria-label="CookWhat home">
          <span className="brand-mark">cw</span>
          <span>cookwhat<span className="brand-period">.</span></span>
        </a>
        <div className="sidebar-label">MENU</div>
        <nav className="main-nav" aria-label="Main navigation">
          {navigation.map((item) => (
            <button key={item.label} className={`nav-item ${view === item.label ? "active" : ""}`} onClick={() => item.label === "Scan barcode" ? setShowScanner(true) : setView(item.label)}>
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
              {item.label === "Shopping list" && groceries.length > 0 && <span className="nav-count">{groceries.length - checkedCount}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <span className="help-sparkle">✳</span>
            <p>A little planning goes a long way.</p>
            <button onClick={() => setView("Meal planner")}>Plan your week <span>↗</span></button>
          </div>
          <div className="profile-row">
            <div className="avatar">{session?.user?.name?.slice(0, 1).toUpperCase() ?? "A"}</div>
            <div className="profile-copy"><strong>{session?.user?.name ?? "Alex Morgan"}</strong><span>Home cook</span></div>
            {session ? (
              <button className="icon-button profile-action" aria-label="Sign out" onClick={() => signOut({ redirect: false })}>↗</button>
            ) : (
              <button className="icon-button profile-action" aria-label="Sign in" onClick={() => { setAuthMode("signin"); setShowAuth(true); }}>···</button>
            )}
          </div>
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div className="breadcrumb">Workspace <span>/</span> <strong>{view}</strong></div>
          <div className="topbar-actions">
            <label className="search-box">
              <span aria-hidden="true">⌕</span>
              <input aria-label="Search recipes" placeholder="Search recipes..." value={query} onChange={(event) => setQuery(event.target.value)} onFocus={() => setView("Recipes")} />
              <kbd>⌘ K</kbd>
            </label>
            <button className="topbar-avatar" aria-label={session?.user?.name ?? "Your profile"} onClick={() => session ? setView("Overview") : (setAuthMode("signin"), setShowAuth(true))}>
              {session?.user?.name?.slice(0, 1).toUpperCase() ?? "A"}
            </button>
          </div>
        </header>

        <div className="page-content">
          {view === "Overview" && (
            <>
              <div className="welcome-row">
                <div>
                  <p className="eyebrow">{format(new Date(), "EEEE, MMMM d").toUpperCase()}</p>
                  <h1>Dinner starts with<br /><em>what’s here.</em></h1>
                  <p className="intro-copy">{inventory.length ? `${inventory.length} ingredients on hand. Let’s make something good.` : "Add what’s in your kitchen and find something lovely to make."}</p>
                  <div className="discover-actions"><button className="primary-button" onClick={() => setView("Recipes")}>See what I can cook</button><button className="secondary-button" onClick={() => setShowScanner(true)}>▥ Scan a product</button><button className="quiet-action" onClick={() => setView("My kitchen")}>Open My kitchen ↗</button></div>
                </div>
                <div className="kitchen-glance"><span className="eyebrow">IN YOUR KITCHEN</span><strong>{inventory.length}</strong><span>{inventory.length === 1 ? "ingredient" : "ingredients"} · {equipment.length} {equipment.length === 1 ? "tool" : "tools"}</span><button onClick={() => setView("My kitchen")}>Manage kitchen ↗</button></div>
              </div>

              {readyRecipes.length > 0 && <section className="section-block home-recommendations">
                <div className="section-heading"><div><p className="eyebrow">MATCHED TO YOUR KITCHEN</p><h2>Ready to make</h2></div><button className="text-button" onClick={() => setView("Recipes")}>See all matches ↗</button></div>
                <div className="recipe-strip">{readyRecipes.slice(0, 2).map(({ recipe }) => <RecipeCard key={recipe.id} recipe={recipe} onAdd={addToNextOpenSlot} />)}</div>
              </section>}

              <section className="section-block">
                <div className="section-heading">
                  <div><p className="eyebrow">THE WEEK AHEAD</p><h2>Your meal plan</h2></div>
                  <button className="text-button" onClick={() => setView("Meal planner")}>Open planner <span>↗</span></button>
                </div>
                <div className="mini-week">
                  {weekDays.map((day) => {
                    const dayMeals = slots.map((slot) => ({ slot, recipe: recipes.find((recipe) => recipe.id === meals[getMealKey(day, slot)]) })).filter((entry) => entry.recipe);
                    return <button key={day.toISOString()} className={`mini-day ${isSameDay(day, new Date()) ? "today" : ""}`} onClick={() => setView("Meal planner")}>
                      <span className="mini-day-name">{format(day, "EEE")}</span><strong>{format(day, "d")}</strong>
                      {dayMeals.length ? <span className="mini-day-dots"><i />{dayMeals.length > 1 && <i />}<small>{dayMeals.length} meal{dayMeals.length > 1 ? "s" : ""}</small></span> : <span className="mini-empty">Plan a meal</span>}
                    </button>;
                  })}
                </div>
              </section>

              {inventory.length === 0 && <section className="home-first-step"><span>01</span><div><strong>Start with what’s already at home</strong><p>Add pantry staples and fresh ingredients. Recommendations only count ingredients you actually have.</p></div><button className="text-button" onClick={() => setView("My kitchen")}>Add ingredients ↗</button></section>}
            </>
          )}

          {view === "My kitchen" && <KitchenView inventory={inventory} equipment={equipment} onChange={setInventory} onEquipmentChange={setEquipment} onScan={() => setShowScanner(true)} onAdd={addInventoryItem} />}

          {view === "Meal planner" && (
            <section className="planner-view">
              <div className="planner-heading">
                <div><p className="eyebrow">MAKE ROOM FOR THE GOOD STUFF</p><h1>Meal planner</h1><p className="intro-copy">Drag a recipe onto a day, or tap a slot to clear it.</p></div>
                <div className="week-controls"><button aria-label="Previous week" className="icon-button" onClick={() => setActiveDate((date) => subDays(date, 7))}>←</button><strong>{format(activeDate, "MMM d")} – {format(addDays(activeDate, 6), "MMM d")}</strong><button aria-label="Next week" className="icon-button" onClick={() => setActiveDate((date) => addDays(date, 7))}>→</button><button className="secondary-button" onClick={buildShoppingList}>Build shopping list <span>↗</span></button></div>
              </div>
              <DragDropContext onDragEnd={moveMeal}>
                <div className="planner-grid">
                  {weekDays.map((day) => <div className={`planner-day ${isSameDay(day, new Date()) ? "is-today" : ""}`} key={day.toISOString()}>
                    <div className="planner-day-heading"><span>{format(day, "EEE").toUpperCase()}</span><strong>{format(day, "d")}</strong></div>
                    {slots.map((slot) => {
                      const key = getMealKey(day, slot);
                      const recipe = recipes.find((item) => item.id === meals[key]);
                      return <Droppable droppableId={key} key={key}>
                        {(provided, snapshot) => <div ref={provided.innerRef} {...provided.droppableProps} className={`meal-slot ${snapshot.isDraggingOver ? "drag-over" : ""} ${recipe ? "has-recipe" : ""}`}>
                          <span className="slot-label">{slot}</span>
                          {recipe ? <div className="planned-recipe">
                            <div className="planned-photo" style={{ backgroundImage: `url("${recipe.image}")` }} />
                            <div className="planned-copy"><strong>{recipe.title}</strong><small>{recipe.minutes} min</small></div>
                            <button className="remove-meal" aria-label={`Remove ${recipe.title} from ${format(day, "EEEE")} ${slot}`} onClick={() => setMeals((previous) => { const next = { ...previous }; delete next[key]; return next; })}>×</button>
                          </div> : <span className="drop-hint">+ Add a meal</span>}
                          {provided.placeholder}
                        </div>}
                      </Droppable>;
                    })}
                  </div>)}
                </div>
                <div className="planner-recipe-source"><div className="section-heading"><div><p className="eyebrow">NEED A LITTLE INSPIRATION?</p><h2>Drag something delicious in</h2></div><button className="text-button" onClick={() => setView("Recipes")}>All recipes ↗</button></div>
                  <Droppable droppableId="recipe-source" direction="horizontal">
                    {(provided) => <div ref={provided.innerRef} {...provided.droppableProps} className="drag-recipe-list">{recipes.slice(0, 5).map((recipe, index) => <Draggable key={recipe.id} draggableId={recipe.id} index={index}>{(provided, snapshot) => <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} className={`drag-recipe ${snapshot.isDragging ? "is-dragging" : ""}`}><div className="drag-recipe-photo" style={{ backgroundImage: `url("${recipe.image}")` }} /><span><strong>{recipe.title}</strong><small>{recipe.minutes} min · {recipe.category}</small></span><span className="drag-grip" aria-hidden="true">⠿</span></div>}</Draggable>)}{provided.placeholder}</div>}
                  </Droppable>
                </div>
              </DragDropContext>
            </section>
          )}

          {view === "Recipes" && (
            <section className="recipes-view">
              <RecommendationsView recipes={recommendableRecipes} inventory={inventory} equipment={equipment} preferences={preferences} onPreferencesChange={setPreferences} onAddMissing={addMissingGroceries} onPlan={(recipe) => { addToNextOpenSlot(recipe); }} />
              <div className="recipe-box-divider"><div className="section-heading"><div><p className="eyebrow">YOUR SAVED IDEAS</p><h2>Recipe box</h2></div><button className="primary-button" onClick={() => { setFormError(""); setShowRecipeForm(true); }}>＋ Add a recipe</button></div></div>
              <div className="filter-row"><div className="category-filters">{["All", "Breakfast", "Lunch", "Dinner"].map((item) => <button className={category === item ? "selected" : ""} key={item} onClick={() => setCategory(item)}>{item}</button>)}</div><span>{matchingRecipes.length} recipes</span></div>
              <div className="recipe-grid">{matchingRecipes.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} onAdd={addToNextOpenSlot} />)}</div>
              {matchingRecipes.length === 0 && <div className="empty-state"><span>⌕</span><h3>No recipes found</h3><p>Try a different search, or add a new favorite.</p></div>}
            </section>
          )}

          {view === "Shopping list" && (
            <section className="shopping-view">
              <div className="shopping-heading"><div><p className="eyebrow">A LITTLE PREP, A LOT LESS STRESS</p><h1>Shopping list</h1><p className="intro-copy">{groceries.length - checkedCount} things left to pick up. You’ve got this.</p></div><button className="secondary-button" onClick={buildShoppingList}>＋ Add planned ingredients</button></div>
              <form className="grocery-add" onSubmit={(event) => { event.preventDefault(); addGroceryItem(groceryInput); }}><span>＋</span><input aria-label="Add an item to your shopping list" placeholder="Add something to your list..." value={groceryInput} onChange={(event) => setGroceryInput(event.target.value)} /><button type="submit">Add item</button></form>
              {groceries.length ?               <div className="grocery-card"><div className="grocery-card-heading"><div><span className="grocery-emoji">◫</span><strong>This week’s groceries</strong></div><span>{checkedCount} of {groceries.length} done</span></div><div className="grocery-progress"><i style={{ width: `${groceries.length ? checkedCount / groceries.length * 100 : 0}%` }} /></div><ul className="grocery-list">{groceries.map((item) => <li key={item.id} className={item.checked ? "checked" : ""}><label><input type="checkbox" checked={item.checked} onChange={() => setGroceries((previous) => previous.map((entry) => entry.id === item.id ? { ...entry, checked: !entry.checked } : entry))} /><span className="custom-check">✓</span><span>{item.name}{item.quantity && <small className="grocery-quantity">{item.quantity}</small>}</span></label><button className="remove-grocery" aria-label={`Remove ${item.name}`} onClick={() => setGroceries((previous) => previous.filter((entry) => entry.id !== item.id))}>×</button></li>)}</ul><button className="clear-checked" onClick={() => setGroceries((previous) => previous.filter((item) => !item.checked))}>Clear checked items</button></div> : <div className="empty-state"><span>☷</span><h3>Your list is looking nice and empty</h3><p>Add a few things, or build a list from this week’s meal plan.</p><button className="primary-button" onClick={buildShoppingList}>Build from meal plan</button></div>}
            </section>
          )}
        </div>
        <footer className="page-footer"><span>Made for a little more joy around the table.</span><span>COOK WHAT YOU LOVE <i>✳</i></span></footer>
      </section>

      {showRecipeForm && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowRecipeForm(false); }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="recipe-modal-title"><button className="modal-close" aria-label="Close" onClick={() => setShowRecipeForm(false)}>×</button><p className="eyebrow">SAVE SOMETHING DELICIOUS</p><h2 id="recipe-modal-title">Add a recipe</h2><form onSubmit={saveRecipe} className="modal-form"><label>Recipe name<input name="title" placeholder="e.g. Sunday tomato pasta" required /></label><div className="form-row"><label>Category<select name="category"><option>Breakfast</option><option>Lunch</option><option selected>Dinner</option></select></label><label>Cook time (min)<input name="minutes" type="number" min="1" defaultValue="30" /></label></div><div className="form-row"><label>Servings<input name="servings" type="number" min="1" defaultValue="2" /></label><label>Difficulty<select name="difficulty"><option>Easy</option><option>Medium</option></select></label></div><label>Measured ingredients <span className="field-hint">one per line: name | amount | unit</span><textarea name="requirements" rows={4} placeholder={"Eggs | 2 | pieces\\nRice | 150 | g"} required /></label><label>Equipment <span className="field-hint">comma-separated</span><input name="equipment" placeholder="Wok, Rice cooker" /></label><label>Dietary tags <span className="field-hint">comma-separated, if known</span><input name="dietaryTags" placeholder="Vegetarian, Thai food" /></label><label>Instructions <span className="field-hint">one step per line</span><textarea name="instructions" rows={3} placeholder={"Cook the rice.\\nFry the eggs."} /></label>{formError && <p className="form-error">{formError}</p>}<button className="primary-button full-button" type="submit">Save to recipe box <span>↗</span></button></form></section></div>}

      {showScanner && <BarcodeScanner onClose={() => setShowScanner(false)} onSave={addInventoryItem} />}
      {showAuth && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowAuth(false); }}><section className="modal-card auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title"><button className="modal-close" aria-label="Close" onClick={() => setShowAuth(false)}>×</button><span className="brand-mark auth-mark">cw</span><p className="eyebrow">YOUR KITCHEN, YOUR WAY</p><h2 id="auth-modal-title">{authMode === "signin" ? "Welcome back." : "Make yourself at home."}</h2><p className="auth-copy">Sign in to keep all your good plans together.</p><form onSubmit={submitAuth} className="modal-form">{authMode === "signup" && <label>Your name<input name="name" autoComplete="name" placeholder="Alex Morgan" required /></label>}<label>Email address<input name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></label><label>Password<input name="password" type="password" autoComplete={authMode === "signin" ? "current-password" : "new-password"} minLength={8} placeholder="At least 8 characters" required /></label>{authError && <p className="form-error">{authError}</p>}<button className="primary-button full-button" disabled={authBusy}>{authBusy ? "One moment..." : authMode === "signin" ? "Sign in" : "Create your account"} <span>↗</span></button></form><p className="auth-switch">{authMode === "signin" ? "New around here?" : "Already have an account?"} <button onClick={() => { setAuthMode(authMode === "signin" ? "signup" : "signin"); setAuthError(""); }}>{authMode === "signin" ? "Create an account" : "Sign in"}</button></p></section></div>}
      {toast && <div className="toast" role="status"><span>✓</span>{toast}</div>}
    </main>
  );
}
