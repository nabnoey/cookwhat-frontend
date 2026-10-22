"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import Image from "next/image";
import { InventoryItem, inventoryCategories, inventoryUnits } from "@/lib/kitchen";

type ProductLookup = {
  name: string;
  brand: string;
  imageUrl: string;
  category: string;
  packageSize: string;
};

type Props = {
  onClose: () => void;
  onSave: (item: Omit<InventoryItem, "id" | "addedAt">) => void;
};

const validBarcode = /^(?:\d{8}|\d{12}|\d{13}|\d{14})$/;

export function BarcodeScanner({ onClose, onSave }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [barcode, setBarcode] = useState("");
  const [product, setProduct] = useState<ProductLookup | null>(null);
  const [state, setState] = useState<"idle" | "scanning" | "looking" | "not-found" | "ready" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => () => controlsRef.current?.stop(), []);

  function stopCamera() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    if (videoRef.current?.srcObject) {
      for (const track of (videoRef.current.srcObject as MediaStream).getTracks()) track.stop();
      videoRef.current.srcObject = null;
    }
  }

  async function lookup(value: string) {
    const cleaned = value.trim();
    if (!validBarcode.test(cleaned)) {
      setError("Use an 8, 12, 13, or 14 digit barcode.");
      setState("error");
      return;
    }
    stopCamera();
    setBarcode(cleaned);
    setError("");
    setProduct(null);
    setState("looking");
    try {
      const response = await fetch(`/api/products/${encodeURIComponent(cleaned)}`);
      const result = (await response.json()) as { found?: boolean; product?: ProductLookup; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Product lookup failed.");
      if (!result.found || !result.product) {
        setState("not-found");
        return;
      }
      setProduct(result.product);
      setState("ready");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Product lookup failed.");
      setState("error");
    }
  }

  async function startCamera() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser cannot access a camera. Enter the barcode below instead.");
      setState("error");
      return;
    }
    try {
      setState("scanning");
      readerRef.current = new BrowserMultiFormatReader();
      if (!videoRef.current) throw new Error("The camera preview is unavailable.");
      controlsRef.current = await readerRef.current.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result) => {
          if (result) void lookup(result.getText());
        },
      );
    } catch (cause) {
      stopCamera();
      const message = cause instanceof Error ? cause.message : "";
      setError(message.toLowerCase().includes("permission") || message.toLowerCase().includes("denied")
        ? "Camera permission was denied. Allow camera access or enter the barcode manually."
        : "Could not start the camera. Check camera permissions or enter the barcode manually.");
      setState("error");
    }
  }

  function saveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const quantityValue = String(form.get("remainingQuantity") ?? "");
    const remainingQuantity = quantityValue === "" ? null : Number(quantityValue);
    if (remainingQuantity !== null && (!Number.isFinite(remainingQuantity) || remainingQuantity < 0)) {
      setError("Remaining quantity must be zero or greater, or left blank if unknown.");
      return;
    }
    onSave({
      name: String(form.get("name") ?? "").trim(),
      category: String(form.get("category") ?? "Pantry"),
      brand: String(form.get("brand") ?? "").trim(),
      barcode,
      imageUrl: product?.imageUrl,
      packageSize: String(form.get("packageSize") ?? "").trim(),
      ownedQuantity: Number(form.get("ownedQuantity")) || undefined,
      remainingQuantity,
      unit: String(form.get("unit") ?? "pieces"),
      expiresOn: String(form.get("expiresOn") ?? "") || undefined,
      note: String(form.get("note") ?? "").trim() || undefined,
    });
    onClose();
  }

  const canEdit = state === "ready" || state === "not-found" || (state === "error" && validBarcode.test(barcode));

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="scanner-modal" role="dialog" aria-modal="true" aria-labelledby="scanner-title">
        <button className="modal-close" aria-label="Close scanner" onClick={onClose}>×</button>
        <p className="eyebrow">ADD A PACKAGED ITEM</p>
        <h2 id="scanner-title">Scan a barcode</h2>
        <p className="scanner-intro">The barcode identifies the product, not how much is left. Confirm your remaining amount before saving.</p>

        {!canEdit && <>
          <div className={`scanner-frame ${state === "scanning" ? "camera-active" : ""}`}>
            <video ref={videoRef} className={`scanner-video ${state === "scanning" ? "" : "scanner-video-hidden"}`} muted playsInline aria-label="Live barcode camera preview" />
            {state !== "scanning" && <div className="scanner-placeholder"><span className="scan-mark">▥</span><span>Place the barcode inside the frame</span></div>}
            {state === "scanning" && <div className="scan-line" />}
          </div>
          <div className="scanner-actions">
            {state === "scanning" ? <button className="secondary-button" onClick={() => { stopCamera(); setState("idle"); }}>Stop camera</button> : <button className="primary-button" onClick={startCamera}>Open camera</button>}
            <span>Camera access is requested only when you start scanning.</span>
          </div>
          <form className="manual-barcode-form" onSubmit={(event) => { event.preventDefault(); void lookup(barcode); }}>
            <label htmlFor="manual-barcode">Or enter a barcode</label>
            <div><input id="manual-barcode" inputMode="numeric" autoComplete="off" value={barcode} onChange={(event) => setBarcode(event.target.value.replace(/\D/g, "").slice(0, 14))} placeholder="EAN-13 or UPC" /><button className="secondary-button">Look up</button></div>
          </form>
          {state === "looking" && <p className="lookup-status" role="status">Looking up product…</p>}
          {error && <p className="form-error scanner-error" role="alert">{error}</p>}
        </>}

        {state === "not-found" && <div className="lookup-notice" role="status"><strong>We couldn’t find that barcode.</strong><span>Add the product details yourself below; the barcode will still be saved.</span></div>}
        {state === "error" && canEdit && <div className="lookup-notice" role="alert"><strong>Lookup unavailable. Add the product details yourself.</strong><span>{error}</span></div>}
        {state === "ready" && product && <div className="lookup-notice recognized" role="status">
          {product.imageUrl && <Image src={product.imageUrl} alt="" width={64} height={64} unoptimized />}
          <div><strong>{product.name}</strong><span>{product.brand ? `${product.brand} · ` : ""}Found in Open Food Facts. Check the details before saving.</span></div>
        </div>}

        {canEdit && <form className="modal-form scanner-product-form" onSubmit={saveProduct}>
          <label>Product name<input name="name" defaultValue={product?.name ?? ""} required autoFocus /></label>
          <div className="form-row"><label>Category<select name="category" defaultValue={product?.category ?? "Pantry"}>{inventoryCategories.map((item) => <option key={item}>{item}</option>)}</select></label><label>Brand<input name="brand" defaultValue={product?.brand ?? ""} placeholder="Optional" /></label></div>
          <label>Package size <span className="field-hint">as printed on pack</span><input name="packageSize" defaultValue={product?.packageSize ?? ""} placeholder="e.g. 1 L, 400 g" /></label>
          <div className="form-row"><label>Packages owned<input name="ownedQuantity" type="number" min="0" step="any" placeholder="Unknown" /></label><label>Remaining amount<input name="remainingQuantity" type="number" min="0" step="any" placeholder="Unknown" /></label></div>
          <div className="form-row"><label>Remaining unit<select name="unit" defaultValue="pieces">{inventoryUnits.map((item) => <option key={item}>{item}</option>)}</select></label><label>Use by<input name="expiresOn" type="date" /></label></div>
          {error && !canEdit && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button full-button">Save to My Kitchen</button>
        </form>}
      </section>
    </div>
  );
}
