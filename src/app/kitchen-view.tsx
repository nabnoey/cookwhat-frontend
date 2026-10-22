"use client";

import { useMemo, useState } from "react";
import {
  equipmentOptions,
  inventoryCategories,
  inventoryUnits,
  isExpiringSoon,
  type InventoryItem,
} from "@/lib/kitchen";

type Props = {
  inventory: InventoryItem[];
  equipment: string[];
  onChange: (items: InventoryItem[]) => void;
  onEquipmentChange: (items: string[]) => void;
  onScan: () => void;
  onAdd: (item: Omit<InventoryItem, "id" | "addedAt">) => void;
};

export function KitchenView({ inventory, equipment, onChange, onEquipmentChange, onScan, onAdd }: Props) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [formError, setFormError] = useState("");
  const filtered = useMemo(
    () => inventory.filter((item) =>
      `${item.name} ${item.brand ?? ""} ${item.category}`.toLowerCase().includes(search.toLowerCase()) &&
      (filter === "All" || item.category === filter),
    ),
    [filter, inventory, search],
  );
  const expiring = inventory.filter((item) => isExpiringSoon(item));
  const lowStock = inventory.filter((item) => item.remainingQuantity !== null && item.remainingQuantity <= 1);

  function addManualItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const remainingText = String(form.get("remainingQuantity") ?? "").trim();
    const remainingQuantity = remainingText === "" ? null : Number(remainingText);
    if (!name) {
      setFormError("Enter an ingredient name.");
      return;
    }
    if (remainingQuantity !== null && (!Number.isFinite(remainingQuantity) || remainingQuantity < 0)) {
      setFormError("Remaining amount must be zero or greater, or left blank if unknown.");
      return;
    }
    const details = {
      name,
      category: String(form.get("category") ?? "Other"),
      brand: String(form.get("brand") ?? "").trim() || undefined,
      packageSize: String(form.get("packageSize") ?? "").trim() || undefined,
      ownedQuantity: Number(form.get("ownedQuantity")) || undefined,
      remainingQuantity,
      unit: String(form.get("unit") ?? "pieces"),
      expiresOn: String(form.get("expiresOn") ?? "") || undefined,
      note: String(form.get("note") ?? "").trim() || undefined,
    };
    if (editingItem) {
      onChange(inventory.map((item) => item.id === editingItem.id ? { ...item, ...details } : item));
      setEditingItem(null);
    } else onAdd(details);
    setShowForm(false);
  }

  function updateRemaining(item: InventoryItem, value: string) {
    const remainingQuantity = value === "" ? null : Number(value);
    if (remainingQuantity !== null && (!Number.isFinite(remainingQuantity) || remainingQuantity < 0)) return;
    onChange(inventory.map((entry) => entry.id === item.id ? { ...entry, remainingQuantity } : entry));
  }

  function updateDate(item: InventoryItem, expiresOn: string) {
    onChange(inventory.map((entry) => entry.id === item.id ? { ...entry, expiresOn: expiresOn || undefined } : entry));
  }

  return (
    <section className="kitchen-view">
      <div className="kitchen-heading">
        <div><p className="eyebrow">WHAT’S IN YOUR KITCHEN</p><h1>My kitchen</h1><p className="intro-copy">Keep a simple list of what you have, and how much is left.</p></div>
        <div className="kitchen-actions"><button className="secondary-button" onClick={onScan}>▥ <span>Scan barcode</span></button><button className="primary-button" onClick={() => { setFormError(""); setEditingItem(null); setShowForm((value) => !value); }}>＋ Add ingredient</button></div>
      </div>

      {(lowStock.length > 0 || expiring.length > 0) && <div className="kitchen-alerts" aria-live="polite">
        {lowStock.length > 0 && <span><i /> {lowStock.length} running low</span>}
        {expiring.length > 0 && <span><i /> {expiring.length} expiring in 5 days</span>}
      </div>}

      {showForm && <form className="inventory-form" onSubmit={addManualItem}>
        <div className="inventory-form-heading"><strong>{editingItem ? `Edit ${editingItem.name}` : "Add an ingredient"}</strong><button type="button" className="icon-button" aria-label="Close form" onClick={() => { setShowForm(false); setEditingItem(null); }}>×</button></div>
        <div className="inventory-form-grid">
          <label>Ingredient<input name="name" placeholder="e.g. Fish sauce" defaultValue={editingItem?.name} required /></label>
          <label>Category<select name="category" defaultValue={editingItem?.category ?? "Vegetables"}>{inventoryCategories.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Remaining amount<input name="remainingQuantity" type="number" min="0" step="any" placeholder="Leave blank if unknown" defaultValue={editingItem?.remainingQuantity ?? ""} /></label>
          <label>Unit<select name="unit" defaultValue={editingItem?.unit ?? "pieces"}>{inventoryUnits.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>Brand <span className="field-hint">optional</span><input name="brand" placeholder="Brand" defaultValue={editingItem?.brand} /></label>
          <label>Package size <span className="field-hint">optional</span><input name="packageSize" placeholder="e.g. 750 ml" defaultValue={editingItem?.packageSize} /></label>
          <label>Use by <span className="field-hint">optional</span><input name="expiresOn" type="date" defaultValue={editingItem?.expiresOn} /></label>
          <label>Note <span className="field-hint">optional</span><input name="note" placeholder="Anything to remember" defaultValue={editingItem?.note} /></label>
        </div>
        {formError && <p className="form-error">{formError}</p>}
        <button className="primary-button">{editingItem ? "Save changes" : "Save ingredient"}</button>
      </form>}

      <div className="inventory-toolbar">
        <label className="inventory-search"><span aria-hidden="true">⌕</span><input aria-label="Search kitchen inventory" placeholder="Search your kitchen..." value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <label className="filter-select"><span className="sr-only">Filter category</span><select value={filter} onChange={(event) => setFilter(event.target.value)}><option>All</option>{inventoryCategories.map((item) => <option key={item}>{item}</option>)}</select></label>
        <span className="inventory-total">{inventory.length} {inventory.length === 1 ? "item" : "items"}</span>
      </div>

      {inventory.length === 0 ? <div className="kitchen-empty"><div className="empty-line-art" aria-hidden="true">＋</div><h2>Your kitchen starts here</h2><p>Add a few ingredients or scan a package. We’ll use what you have to find recipes that make sense.</p><div><button className="primary-button" onClick={() => setShowForm(true)}>Add your first ingredient</button><button className="secondary-button" onClick={onScan}>Scan a barcode</button></div></div> :
        filtered.length === 0 ? <div className="kitchen-empty compact"><h2>No matches</h2><p>Try a different ingredient or category.</p></div> :
          <div className="inventory-table-wrap"><table className="inventory-table"><thead><tr><th>Ingredient</th><th>Category</th><th>Remaining</th><th>Use by</th><th aria-label="Actions" /></tr></thead>
            <tbody>{filtered.map((item) => {
              const expiringSoon = isExpiringSoon(item);
              const low = item.remainingQuantity !== null && item.remainingQuantity <= 1;
              return <tr key={item.id}>
                <td><div className="inventory-name">{item.imageUrl ? <span className="inventory-thumb" style={{ backgroundImage: `url("${item.imageUrl}")` }} aria-hidden="true" /> : <span className="inventory-thumb inventory-initial" aria-hidden="true">{item.name.slice(0, 1).toUpperCase()}</span>}<span className="inventory-name-copy"><strong>{item.name}</strong><span>{[item.brand, item.barcode ? `Barcode ${item.barcode}` : null].filter(Boolean).join(" · ") || item.packageSize || item.note || "Added to your kitchen"}</span></span></div></td>
                <td><span className="category-text">{item.category}</span></td>
                <td><div className="quantity-control"><button aria-label={`Use one ${item.unit} of ${item.name}`} disabled={item.remainingQuantity === null || item.remainingQuantity <= 0} onClick={() => updateRemaining(item, String(Math.max(0, (item.remainingQuantity ?? 0) - 1)))}>−</button><input aria-label={`Remaining ${item.name}`} type="number" min="0" step="any" placeholder="Unknown" value={item.remainingQuantity ?? ""} onChange={(event) => updateRemaining(item, event.target.value)} /><button aria-label={`Add one ${item.unit} of ${item.name}`} disabled={item.remainingQuantity === null} onClick={() => updateRemaining(item, String((item.remainingQuantity ?? 0) + 1))}>+</button><span>{item.unit}</span></div>{item.remainingQuantity === 0 ? <small className="stock-note">Finished</small> : low && <small className="stock-note">Running low</small>}</td>
                <td><label className={`expiry-field ${expiringSoon ? "expiring" : ""}`}><span className="sr-only">Use by date for {item.name}</span><input type="date" value={item.expiresOn ?? ""} onChange={(event) => updateDate(item, event.target.value)} />{expiringSoon && <small>Use soon</small>}</label></td>
                <td><div className="inventory-row-actions"><button className="edit-inventory" onClick={() => { setEditingItem(item); setFormError(""); setShowForm(true); }}>Edit</button><button className="edit-inventory" onClick={() => updateRemaining(item, "0")}>Finish</button><button className="remove-inventory" aria-label={`Remove ${item.name}`} onClick={() => onChange(inventory.filter((entry) => entry.id !== item.id))}>×</button></div></td>
              </tr>;
            })}</tbody></table></div>}

      <section className="equipment-section"><div><p className="eyebrow">COOKING TOOLS</p><h2>Your equipment</h2><p className="intro-copy">Recommendations only include recipes you can cook with your tools.</p></div>
        <div className="equipment-list">{equipmentOptions.map((item) => <label key={item} className={equipment.includes(item) ? "equipment-selected" : ""}><input type="checkbox" checked={equipment.includes(item)} onChange={() => onEquipmentChange(equipment.includes(item) ? equipment.filter((tool) => tool !== item) : [...equipment, item])} /><span className="equipment-check">✓</span>{item}</label>)}<label className="equipment-custom"><span>＋</span><input aria-label="Add custom equipment" placeholder="Add other..." onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); const value = event.currentTarget.value.trim(); if (value && !equipment.includes(value)) onEquipmentChange([...equipment, value]); event.currentTarget.value = ""; } }} /></label></div>
        {equipment.filter((item) => !equipmentOptions.includes(item as typeof equipmentOptions[number])).length > 0 && <div className="custom-equipment">{equipment.filter((item) => !equipmentOptions.includes(item as typeof equipmentOptions[number])).map((item) => <button key={item} onClick={() => onEquipmentChange(equipment.filter((tool) => tool !== item))}>{item} ×</button>)}</div>}
      </section>
    </section>
  );
}
