"use client";
import { useState, type FormEvent } from "react";
import { Badge, Button, useToast, Card, EmptyState } from "@ops/ui";
import { colors, spacing, radius, motion, baseInputStyle, baseLabelStyle } from "@ops/ui";
import { authFetch } from "@ops/auth/client";
import { Package, Plus, Edit3, Trash2, Save, X } from "lucide-react";

const C = colors;
const S = spacing;
const R = radius;

const inputStyle: React.CSSProperties = {
  ...baseInputStyle,
  boxSizing: "border-box",
};
const LBL: React.CSSProperties = { ...baseLabelStyle };

type ProductType = "CORE" | "ADDON" | "AD_D";
type Product = {
  id: string; name: string; active: boolean; type: ProductType;
  premiumThreshold?: number | null; commissionBelow?: number | null;
  commissionAbove?: number | null; bundledCommission?: number | null;
  standaloneCommission?: number | null; enrollFeeThreshold?: number | null;
  notes?: string;
};

const TYPE_LABELS: Record<ProductType, string> = {
  CORE: "Core", ADDON: "Add-on", AD_D: "AD&D",
};

const TYPE_COLORS: Record<ProductType, string> = {
  CORE: C.primary400, ADDON: C.accentTeal, AD_D: C.warning,
};

/* ── Product Card ─────────────────────────────────────────────── */

function ProductCard({
  product, onSave, onDelete,
}: {
  product: Product;
  onSave: (id: string, data: Partial<Product>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [edit, setEdit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [d, setD] = useState({
    name: product.name, active: product.active, type: product.type, notes: product.notes ?? "",
    premiumThreshold: String(product.premiumThreshold ?? ""),
    commissionBelow: String(product.commissionBelow ?? ""),
    commissionAbove: String(product.commissionAbove ?? ""),
    bundledCommission: String(product.bundledCommission ?? ""),
    standaloneCommission: String(product.standaloneCommission ?? ""),
    enrollFeeThreshold: String(product.enrollFeeThreshold ?? ""),
  });
  const [saving, setSaving] = useState(false);
  const col = TYPE_COLORS[product.type];

  const cardStyle: React.CSSProperties = {
    background: C.bgSurface,
    border: `1px solid ${C.borderDefault}`,
    borderRadius: R.xl,
    overflow: "hidden",
    transition: `box-shadow ${motion.duration.fast} ${motion.easing.out}, transform ${motion.duration.fast} ${motion.easing.out}`,
  };

  const topBorderStyle: React.CSSProperties = {
    height: 3,
    background: col,
    width: "100%",
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(product.id, {
      name: d.name, active: d.active, type: d.type as ProductType, notes: d.notes || undefined,
      premiumThreshold: d.premiumThreshold ? Number(d.premiumThreshold) : null,
      commissionBelow: d.commissionBelow ? Number(d.commissionBelow) : null,
      commissionAbove: d.commissionAbove ? Number(d.commissionAbove) : null,
      bundledCommission: d.bundledCommission ? Number(d.bundledCommission) : null,
      standaloneCommission: d.standaloneCommission ? Number(d.standaloneCommission) : null,
      enrollFeeThreshold: d.enrollFeeThreshold ? Number(d.enrollFeeThreshold) : null,
    });
    setEdit(false); setSaving(false);
  };

  return (
    <div className="hover-lift animate-fade-in-up" style={cardStyle}>
      <div style={topBorderStyle} />
      <div style={{ padding: S[5] }}>
        {!edit ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: S[3] }}>
              <div style={{ display: "flex", alignItems: "center", gap: S[2], flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: C.textPrimary }}>{product.name}</span>
                <Badge color={col}>{TYPE_LABELS[product.type]}</Badge>
                <span
                  onClick={(e) => { e.stopPropagation(); onSave(product.id, { active: !product.active }); }}
                  style={{ cursor: "pointer" }}
                  title={product.active ? "Click to deactivate" : "Click to activate"}
                >
                  <Badge color={product.active ? C.success : C.textMuted} dot>
                    {product.active ? "Active" : "Inactive"}
                  </Badge>
                </span>
              </div>
              <div style={{ display: "flex", gap: S[2], flexShrink: 0 }}>
                <Button variant="ghost" size="sm" onClick={() => setEdit(true)}>
                  <Edit3 size={12} /> Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: C.danger }}
                >
                  <Trash2 size={12} />
                </Button>
              </div>
            </div>

            <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.7 }}>
              {product.type === "CORE" && (
                <>
                  {product.commissionBelow != null && <span>Below ${product.premiumThreshold}: <strong style={{ color: C.textSecondary }}>{product.commissionBelow}%</strong></span>}
                  {product.commissionAbove != null && <span> {"\u00B7"} Above ${product.premiumThreshold}: <strong style={{ color: C.textSecondary }}>{product.commissionAbove}%</strong></span>}
                </>
              )}
              {(product.type === "ADDON" || product.type === "AD_D") && (
                <>
                  {product.bundledCommission != null && <span>Bundled: <strong style={{ color: C.textSecondary }}>{product.bundledCommission}%</strong></span>}
                  {product.bundledCommission == null && product.type === "ADDON" && <span style={{ color: C.textMuted }}>Bundled: matches core</span>}
                  {product.standaloneCommission != null && <span> {"\u00B7"} Standalone: <strong style={{ color: C.textSecondary }}>{product.standaloneCommission}%</strong></span>}
                </>
              )}
              {product.notes ? <span> {"\u00B7"} {product.notes}</span> : ""}
            </div>

            {showDeleteConfirm && (
              <div
                className="animate-slide-down"
                style={{
                  marginTop: S[3], padding: "10px 14px",
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.2)",
                  borderRadius: R.lg,
                  display: "flex", justifyContent: "space-between", alignItems: "center", gap: S[3],
                }}
              >
                <span style={{ fontSize: 13, color: C.danger }}>
                  Delete &ldquo;{product.name}&rdquo;? This will deactivate it.
                </span>
                <div style={{ display: "flex", gap: S[2], flexShrink: 0 }}>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => { onDelete(product.id); setShowDeleteConfirm(false); }}
                  >
                    <Trash2 size={11} /> Delete
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ display: "grid", gap: S[3] }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: S[2] }}>
              <div>
                <label style={LBL}>Name</label>
                <input className="input-focus" style={inputStyle} value={d.name} onChange={e => setD(x => ({ ...x, name: e.target.value }))} />
              </div>
              <div>
                <label style={LBL}>Type</label>
                <select className="input-focus" style={{ ...inputStyle, height: 42 }} value={d.type} onChange={e => setD(x => ({ ...x, type: e.target.value as ProductType }))}>
                  <option value="CORE">Core Product</option>
                  <option value="ADDON">Add-on</option>
                  <option value="AD_D">AD&D</option>
                </select>
              </div>
            </div>

            {d.type === "CORE" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: S[2] }}>
                <div><label style={LBL}>Premium Threshold ($)</label><input className="input-focus" style={inputStyle} type="number" step="0.01" value={d.premiumThreshold} placeholder="e.g. 250" onChange={e => setD(x => ({ ...x, premiumThreshold: e.target.value }))} /></div>
                <div><label style={LBL}>Commission Below (%)</label><input className="input-focus" style={inputStyle} type="number" step="0.01" value={d.commissionBelow} placeholder="e.g. 30" onChange={e => setD(x => ({ ...x, commissionBelow: e.target.value }))} /></div>
                <div><label style={LBL}>Commission Above (%)</label><input className="input-focus" style={inputStyle} type="number" step="0.01" value={d.commissionAbove} placeholder="e.g. 40" onChange={e => setD(x => ({ ...x, commissionAbove: e.target.value }))} /></div>
              </div>
            )}

            {(d.type === "ADDON" || d.type === "AD_D") && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: S[2] }}>
                <div><label style={LBL}>Bundled Commission (%){d.type === "ADDON" ? " \u2014 blank = match core" : ""}</label><input className="input-focus" style={inputStyle} type="number" step="0.01" value={d.bundledCommission} placeholder={d.type === "AD_D" ? "e.g. 70" : "blank = match core"} onChange={e => setD(x => ({ ...x, bundledCommission: e.target.value }))} /></div>
                <div><label style={LBL}>Standalone Commission (%)</label><input className="input-focus" style={inputStyle} type="number" step="0.01" value={d.standaloneCommission} placeholder={d.type === "AD_D" ? "e.g. 35" : "e.g. 30"} onChange={e => setD(x => ({ ...x, standaloneCommission: e.target.value }))} /></div>
                <div><label style={LBL}>Enroll Fee Threshold ($)</label><input className="input-focus" style={inputStyle} type="number" step="0.01" value={d.enrollFeeThreshold} placeholder="e.g. 50" onChange={e => setD(x => ({ ...x, enrollFeeThreshold: e.target.value }))} /></div>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: S[2], alignItems: "end" }}>
              <div><label style={LBL}>Notes</label><input className="input-focus" style={inputStyle} value={d.notes} placeholder="Notes" onChange={e => setD(x => ({ ...x, notes: e.target.value }))} /></div>
              <label style={{ display: "flex", alignItems: "center", gap: S[2], fontSize: 13, paddingBottom: 6, color: C.textSecondary, cursor: "pointer" }}>
                <input type="checkbox" checked={d.active} onChange={e => setD(x => ({ ...x, active: e.target.checked }))} /> Active
              </label>
            </div>

            <div style={{ display: "flex", gap: S[2] }}>
              <Button variant="success" disabled={saving} onClick={handleSave}>
                <Save size={14} /> {saving ? "Saving..." : "Save"}
              </Button>
              <Button variant="ghost" onClick={() => setEdit(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Props ──────────────────────────────────────────────────── */

export interface PayrollProductsProps {
  API: string;
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
}

/* ── Component ──────────────────────────────────────────────── */

export default function PayrollProducts({ API, products, setProducts }: PayrollProductsProps) {
  const [cfgMsg, setCfgMsg] = useState("");
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProduct, setNewProduct] = useState<{
    name: string; type: ProductType; notes: string;
    premiumThreshold: string; commissionBelow: string; commissionAbove: string;
    bundledCommission: string; standaloneCommission: string; enrollFeeThreshold: string;
  }>({
    name: "", type: "CORE", notes: "",
    premiumThreshold: "", commissionBelow: "", commissionAbove: "",
    bundledCommission: "", standaloneCommission: "", enrollFeeThreshold: "",
  });

  async function saveProduct(id: string, data: Partial<Product>) {
    try {
      const res = await authFetch(`${API}/api/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const updated = await res.json();
        setProducts(prev => prev.map(p => p.id === id ? updated : p));
        setCfgMsg("Product updated");
      } else {
        const err = await res.json().catch(() => ({}));
        setCfgMsg(`Error: ${err.error ?? `Request failed (${res.status})`}`);
      }
    } catch (e: any) {
      setCfgMsg(`Error: Unable to reach API \u2014 ${e.message ?? "network error"}`);
    }
  }

  async function deleteProduct(id: string) {
    try {
      const res = await authFetch(`${API}/api/products/${id}`, { method: "DELETE" });
      if (res.ok) {
        setProducts(prev => prev.filter(p => p.id !== id));
        setCfgMsg("Product deleted");
      } else {
        const err = await res.json().catch(() => ({}));
        setCfgMsg(`Error: ${err.error ?? `Request failed (${res.status})`}`);
      }
    } catch (e: any) {
      setCfgMsg(`Error: Unable to reach API \u2014 ${e.message ?? "network error"}`);
    }
  }

  async function addProduct(e: FormEvent) {
    e.preventDefault(); setCfgMsg("");
    try {
      const body: Record<string, unknown> = {
        name: newProduct.name,
        type: newProduct.type,
        notes: newProduct.notes || undefined,
      };
      if (newProduct.type === "CORE") {
        if (newProduct.premiumThreshold) body.premiumThreshold = Number(newProduct.premiumThreshold);
        if (newProduct.commissionBelow)  body.commissionBelow  = Number(newProduct.commissionBelow);
        if (newProduct.commissionAbove)  body.commissionAbove  = Number(newProduct.commissionAbove);
      } else {
        if (newProduct.bundledCommission)    body.bundledCommission    = Number(newProduct.bundledCommission);
        if (newProduct.standaloneCommission) body.standaloneCommission = Number(newProduct.standaloneCommission);
        if (newProduct.enrollFeeThreshold)   body.enrollFeeThreshold   = Number(newProduct.enrollFeeThreshold);
      }
      const res = await authFetch(`${API}/api/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const p = await res.json();
        setProducts(prev => [...prev, p]);
        setNewProduct({ name: "", type: "CORE", notes: "", premiumThreshold: "", commissionBelow: "", commissionAbove: "", bundledCommission: "", standaloneCommission: "", enrollFeeThreshold: "" });
        setCfgMsg("Product added");
        setShowAddProduct(false);
      } else {
        const err = await res.json().catch(() => ({}));
        setCfgMsg(`Error: ${err.error ?? `Request failed (${res.status})`}`);
      }
    } catch (e: any) {
      setCfgMsg(`Error: Unable to reach API \u2014 ${e.message ?? "network error"}`);
    }
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: 800 }}>
      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: S[5] }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.textPrimary }}>Products & Commission</h2>
          <p style={{ color: C.textMuted, fontSize: 13, margin: "4px 0 0" }}>Configure product types and commission rates</p>
        </div>
        <Button variant="primary" onClick={() => setShowAddProduct(v => !v)}>
          <Plus size={14} /> Add Product
        </Button>
      </div>

      {/* Add product form */}
      {showAddProduct && (
        <Card className="animate-slide-down" style={{ borderRadius: R["2xl"], marginBottom: S[5] }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: C.textPrimary, marginBottom: S[4] }}>New Product</div>
          <form onSubmit={addProduct} style={{ display: "grid", gap: S[3] }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: S[2] }}>
              <div>
                <label style={LBL}>Name</label>
                <input className="input-focus" style={inputStyle} value={newProduct.name} placeholder="Product name *" required onChange={e => setNewProduct(x => ({ ...x, name: e.target.value }))} />
              </div>
              <div>
                <label style={LBL}>Type</label>
                <select className="input-focus" style={{ ...inputStyle, height: 42 }} value={newProduct.type} onChange={e => setNewProduct(x => ({ ...x, type: e.target.value as ProductType }))}>
                  <option value="CORE">Core Product</option>
                  <option value="ADDON">Add-on</option>
                  <option value="AD_D">AD&D</option>
                </select>
              </div>
            </div>
            {newProduct.type === "CORE" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: S[2] }}>
                <div><label style={LBL}>Premium Threshold ($)</label><input className="input-focus" style={inputStyle} type="number" step="0.01" value={newProduct.premiumThreshold} placeholder="e.g. 250" onChange={e => setNewProduct(x => ({ ...x, premiumThreshold: e.target.value }))} /></div>
                <div><label style={LBL}>Commission Below (%)</label><input className="input-focus" style={inputStyle} type="number" step="0.01" value={newProduct.commissionBelow} placeholder="e.g. 30" onChange={e => setNewProduct(x => ({ ...x, commissionBelow: e.target.value }))} /></div>
                <div><label style={LBL}>Commission Above (%)</label><input className="input-focus" style={inputStyle} type="number" step="0.01" value={newProduct.commissionAbove} placeholder="e.g. 40" onChange={e => setNewProduct(x => ({ ...x, commissionAbove: e.target.value }))} /></div>
              </div>
            )}
            {(newProduct.type === "ADDON" || newProduct.type === "AD_D") && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: S[2] }}>
                <div><label style={LBL}>Bundled Commission (%){newProduct.type === "ADDON" ? " \u2014 blank = match core" : ""}</label><input className="input-focus" style={inputStyle} type="number" step="0.01" value={newProduct.bundledCommission} placeholder={newProduct.type === "AD_D" ? "e.g. 70" : "blank = match core"} onChange={e => setNewProduct(x => ({ ...x, bundledCommission: e.target.value }))} /></div>
                <div><label style={LBL}>Standalone Commission (%)</label><input className="input-focus" style={inputStyle} type="number" step="0.01" value={newProduct.standaloneCommission} placeholder={newProduct.type === "AD_D" ? "e.g. 35" : "e.g. 30"} onChange={e => setNewProduct(x => ({ ...x, standaloneCommission: e.target.value }))} /></div>
                <div><label style={LBL}>Enroll Fee Threshold ($)</label><input className="input-focus" style={inputStyle} type="number" step="0.01" value={newProduct.enrollFeeThreshold} placeholder="e.g. 50" onChange={e => setNewProduct(x => ({ ...x, enrollFeeThreshold: e.target.value }))} /></div>
              </div>
            )}
            <input className="input-focus" style={inputStyle} value={newProduct.notes} placeholder="Notes (optional)" onChange={e => setNewProduct(x => ({ ...x, notes: e.target.value }))} />
            <div style={{ display: "flex", gap: S[2], alignItems: "center", flexWrap: "wrap" }}>
              <Button variant="success" type="submit">
                <Plus size={14} /> Add Product
              </Button>
              <Button variant="ghost" type="button" onClick={() => setShowAddProduct(false)}>Cancel</Button>
              {cfgMsg && (
                <span style={{ color: cfgMsg.startsWith("Error") ? C.danger : C.success, fontWeight: 600, fontSize: 13 }}>
                  {cfgMsg}
                </span>
              )}
            </div>
          </form>
        </Card>
      )}

      {/* Product grid */}
      {products.length === 0 ? (
        <Card style={{ borderRadius: R["2xl"] }}>
          <EmptyState
            icon={<Package size={32} />}
            title="No products configured yet"
            description="Add your first product above."
          />
        </Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: S[4] }} className="grid-mobile-1">
          {products.map((p, i) => (
            <div key={p.id} className={`animate-fade-in-up stagger-${Math.min(i + 1, 10)}`}>
              <ProductCard product={p} onSave={saveProduct} onDelete={deleteProduct} />
            </div>
          ))}
        </div>
      )}

      {!showAddProduct && cfgMsg && (
        <div style={{ marginTop: S[4], color: cfgMsg.startsWith("Error") ? C.danger : C.success, fontWeight: 600, fontSize: 13 }}>
          {cfgMsg}
        </div>
      )}

      {/* Enrollment fee rules note */}
      <div style={{
        marginTop: S[5], padding: S[4],
        background: C.bgSurface,
        border: `1px solid ${C.borderSubtle}`,
        borderRadius: R.lg,
        fontSize: 12, color: C.textMuted, lineHeight: 1.7,
      }}>
        <strong style={{ color: C.textTertiary }}>Enrollment fee rules:</strong>{" "}
        $125 {"\u2192"} +$10 bonus {"\u00B7"} $99 {"\u2192"} $0 {"\u00B7"} Below $99 {"\u2192"} halves all commission (unless approved) {"\u00B7"} Standalone add-ons: $50 threshold instead of $99
      </div>
    </div>
  );
}
