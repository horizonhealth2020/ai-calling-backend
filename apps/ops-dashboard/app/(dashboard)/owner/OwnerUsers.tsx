"use client";
import React, { useState, useEffect } from "react";
import {
  Badge,
  Button,
  EmptyState,
  SkeletonTable,
  Select,
  useToast,
  colors,
  radius,
  typography,
  motion,
  baseCardStyle,
  baseInputStyle,
  baseLabelStyle,
  baseThStyle,
  baseTdStyle,
  semanticColors,
} from "@ops/ui";
import { authFetch } from "@ops/auth/client";
import {
  Users,
  Shield,
  Edit3,
  Trash2,
  Save,
  X,
  AlertTriangle,
  UserPlus,
  Check,
  Lock,
} from "lucide-react";

type User = { id: string; name: string; email: string; roles: string[]; active: boolean; createdAt: string };
type PermUser = { id: string; name: string; roles: string[]; permissions: Record<string, { granted: boolean; isDefault: boolean; isOverride: boolean }> };
type PermData = { users: PermUser[]; configurablePermissions: string[] };

const ROLES = ["SUPER_ADMIN", "OWNER_VIEW", "MANAGER", "PAYROLL", "SERVICE", "ADMIN", "CUSTOMER_SERVICE"] as const;

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: semanticColors.accentTealMid,
  OWNER_VIEW: semanticColors.accentGreenDark,
  MANAGER: semanticColors.accentTealDark,
  PAYROLL: semanticColors.warningBrown,
  SERVICE: semanticColors.neutralSlate,
  ADMIN: semanticColors.accentTealDeep,
  CUSTOMER_SERVICE: semanticColors.warningAmber,
};

const PERM_LABELS: Record<string, string> = {
  "create:sale": "Sales",
  "create:chargeback": "Chargebacks",
  "create:pending_term": "Pending Terms",
  "create:rep": "Reps",
  "create:agent": "Agents",
  "create:product": "Products",
  "create:lead_source": "Lead Sources",
};

/* -- Inline style constants -- */

const CARD: React.CSSProperties = {
  ...baseCardStyle,
  borderRadius: radius["2xl"],
};

const LBL: React.CSSProperties = {
  ...baseLabelStyle,
};

const SECTION_TITLE: React.CSSProperties = {
  fontSize: typography.sizes.md.fontSize,
  fontWeight: typography.weights.bold,
  color: colors.textPrimary,
  letterSpacing: typography.tracking.tight,
  margin: 0,
};

const SECTION_SUBTITLE: React.CSSProperties = {
  fontSize: typography.sizes.sm.fontSize,
  color: colors.textTertiary,
  margin: "4px 0 0",
};

const TD: React.CSSProperties = {
  ...baseTdStyle,
};

/* -- RoleCheckboxes -- */

function RoleCheckboxes({ selected, onChange }: { selected: string[]; onChange: (roles: string[]) => void }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {ROLES.map((r) => {
        const checked = selected.includes(r);
        const c = ROLE_COLORS[r];
        return (
          <label
            key={r}
            className="input-focus"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: checked ? 700 : 500,
              padding: "6px 12px",
              borderRadius: radius.full,
              border: `1px solid ${checked ? c + "50" : colors.borderDefault}`,
              background: checked ? c + "15" : "transparent",
              color: checked ? c : colors.textSecondary,
              transition: `all ${motion.duration.fast} ${motion.easing.out}`,
              userSelect: "none",
            }}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => onChange(e.target.checked ? [...selected, r] : selected.filter((x) => x !== r))}
              style={{ accentColor: c, width: 13, height: 13 }}
            />
            {r}
          </label>
        );
      })}
    </div>
  );
}

/* -- DeleteConfirm -- */

function DeleteConfirm({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div
      className="animate-slide-down"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 16px",
        background: colors.dangerBg,
        border: `1px solid ${colors.danger}30`,
        borderRadius: radius.lg,
      }}
    >
      <AlertTriangle size={15} color={colors.danger} />
      <span style={{ fontSize: typography.sizes.sm.fontSize, color: colors.textSecondary, flex: 1 }}>
        Permanently delete <strong style={{ color: colors.textPrimary }}>{name}</strong>? This cannot be undone.
      </span>
      <Button variant="danger" size="sm" icon={<Trash2 size={13} />} onClick={onConfirm}>
        Delete
      </Button>
      <Button variant="ghost" size="sm" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}

/* -- UserRow -- */

function UserRow({
  user,
  onSave,
  onDelete,
}: {
  user: User;
  onSave: (id: string, data: Partial<User> & { password?: string }) => Promise<string | null>;
  onDelete: (id: string) => Promise<string | null>;
}) {
  const [edit, setEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [d, setD] = useState({ name: user.name, email: user.email, roles: user.roles, active: user.active, password: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const { toast } = useToast();

  if (confirmDelete) {
    return (
      <tr>
        <td colSpan={5} style={{ ...baseTdStyle, padding: "10px 16px" }}>
          <DeleteConfirm
            name={user.name}
            onConfirm={async () => {
              const e = await onDelete(user.id);
              if (e) {
                toast("error", e);
                setConfirmDelete(false);
              }
            }}
            onCancel={() => setConfirmDelete(false)}
          />
        </td>
      </tr>
    );
  }

  if (!edit) {
    return (
      <tr className="row-hover" style={{ transition: `background ${motion.duration.fast} ${motion.easing.out}` }}>
        <td style={{ ...baseTdStyle, fontWeight: typography.weights.semibold, color: colors.textPrimary }}>{user.name}</td>
        <td style={{ ...baseTdStyle, color: colors.textSecondary, fontSize: typography.sizes.sm.fontSize }}>{user.email}</td>
        <td style={baseTdStyle}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {user.roles.map((r) => (
              <Badge key={r} color={ROLE_COLORS[r] ?? colors.textTertiary} size="sm">
                {r}
              </Badge>
            ))}
          </div>
        </td>
        <td style={baseTdStyle}>
          <Badge
            color={user.active ? colors.success : colors.textMuted}
            dot
            size="sm"
          >
            {user.active ? "Active" : "Inactive"}
          </Badge>
        </td>
        <td style={{ ...baseTdStyle, textAlign: "right" }}>
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <button
              title="Edit user"
              className="btn-hover"
              onClick={() => setEdit(true)}
              style={{
                padding: "6px 8px",
                background: "transparent",
                border: `1px solid ${colors.borderDefault}`,
                borderRadius: radius.md,
                color: colors.textSecondary,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                transition: `all ${motion.duration.fast} ${motion.easing.out}`,
              }}
            >
              <Edit3 size={14} />
            </button>
            <button
              title="Delete user"
              className="btn-hover"
              onClick={() => setConfirmDelete(true)}
              style={{
                padding: "6px 8px",
                background: colors.dangerBg,
                border: `1px solid ${colors.danger}25`,
                borderRadius: radius.md,
                color: colors.danger,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                transition: `all ${motion.duration.fast} ${motion.easing.out}`,
              }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr>
      <td
        colSpan={5}
        className="animate-slide-down"
        style={{
          ...TD,
          background: colors.bgSurfaceRaised,
          padding: 20,
          borderLeft: `3px solid ${colors.accentTeal}`,
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div>
            <label style={LBL}>Name</label>
            <input className="input-focus" style={{ ...baseInputStyle, boxSizing: "border-box" }} value={d.name} onChange={(e) => setD((x) => ({ ...x, name: e.target.value }))} />
          </div>
          <div>
            <label style={LBL}>Email</label>
            <input className="input-focus" style={{ ...baseInputStyle, boxSizing: "border-box" }} value={d.email} onChange={(e) => setD((x) => ({ ...x, email: e.target.value }))} />
          </div>
          <div>
            <label style={LBL}>New Password</label>
            <input
              className="input-focus"
              style={{ ...baseInputStyle, boxSizing: "border-box" }}
              type="password"
              placeholder="Leave blank to keep"
              value={d.password}
              onChange={(e) => setD((x) => ({ ...x, password: e.target.value }))}
            />
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={LBL}>Roles</label>
          <RoleCheckboxes selected={d.roles} onChange={(roles) => setD((x) => ({ ...x, roles }))} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <Select
            label="Status"
            style={{ width: "auto" }}
            value={String(d.active)}
            onChange={(e) => setD((x) => ({ ...x, active: e.target.value === "true" }))}
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </Select>
        </div>
        {err && (
          <div
            className="animate-fade-in"
            style={{
              color: colors.danger,
              fontSize: typography.sizes.sm.fontSize,
              marginBottom: 12,
              padding: "10px 14px",
              background: colors.dangerBg,
              borderRadius: radius.lg,
              border: `1px solid ${colors.danger}25`,
            }}
          >
            {err}
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <Button
            variant="primary"
            size="sm"
            icon={<Save size={13} />}
            loading={saving}
            disabled={saving || d.roles.length === 0}
            onClick={async () => {
              setSaving(true);
              setErr("");
              const payload: Record<string, unknown> = { name: d.name, email: d.email, roles: d.roles, active: d.active };
              if (d.password) payload.password = d.password;
              const e = await onSave(user.id, payload);
              if (e) {
                setErr(e);
                setSaving(false);
              } else {
                toast("success", `${d.name} saved successfully`);
                setEdit(false);
              }
            }}
          >
            Save Changes
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={<X size={13} />}
            onClick={() => {
              setEdit(false);
              setErr("");
            }}
          >
            Cancel
          </Button>
        </div>
      </td>
    </tr>
  );
}

/* -- UsersSection -- */

function UsersSection({
  users,
  usersLoaded,
  onSave,
  onDelete,
  API,
}: {
  users: User[];
  usersLoaded: boolean;
  onSave: (id: string, data: Partial<User> & { password?: string }) => Promise<string | null>;
  onDelete: (id: string) => Promise<string | null>;
  API: string;
}) {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", roles: ["MANAGER"] as string[] });
  const [creating, setCreating] = useState(false);

  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h2 style={{ ...SECTION_TITLE, fontSize: typography.sizes.lg.fontSize }}>User Management</h2>
          <p style={SECTION_SUBTITLE}>Manage platform access and role assignments</p>
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={<UserPlus size={14} />}
          onClick={() => setShowCreate((v) => !v)}
        >
          {showCreate ? "Cancel" : "New User"}
        </Button>
      </div>

      {/* Create user form */}
      {showCreate && (
        <div
          className="animate-slide-down"
          style={{ ...CARD, marginBottom: 24, borderTop: `3px solid ${colors.primary500}` }}
        >
          <h3 style={{ ...SECTION_TITLE, marginBottom: 20 }}>Create New User</h3>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setCreating(true);
              try {
                const res = await authFetch(`${API}/api/users`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(newUser),
                });
                if (res.ok) {
                  toast("success", `User "${newUser.name}" created successfully`);
                  setNewUser({ name: "", email: "", password: "", roles: ["MANAGER"] });
                  setShowCreate(false);
                } else {
                  const err = await res.json().catch(() => ({}));
                  toast("error", err.error ?? `Request failed (${res.status})`);
                }
              } catch (e: unknown) {
                toast("error", `Unable to reach API \u2014 ${e instanceof Error ? e.message : "network error"}`);
              } finally {
                setCreating(false);
              }
            }}
          >
            <div
              className="stack-mobile"
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 16 }}
            >
              <div>
                <label style={LBL}>Full Name</label>
                <input
                  className="input-focus"
                  style={{ ...baseInputStyle, boxSizing: "border-box" }}
                  required
                  placeholder="Jane Smith"
                  value={newUser.name}
                  onChange={(e) => setNewUser((x) => ({ ...x, name: e.target.value }))}
                />
              </div>
              <div>
                <label style={LBL}>Email Address</label>
                <input
                  className="input-focus"
                  style={{ ...baseInputStyle, boxSizing: "border-box" }}
                  type="email"
                  required
                  placeholder="jane@company.com"
                  value={newUser.email}
                  onChange={(e) => setNewUser((x) => ({ ...x, email: e.target.value }))}
                />
              </div>
              <div>
                <label style={LBL}>Password (min 8)</label>
                <input
                  className="input-focus"
                  style={{ ...baseInputStyle, boxSizing: "border-box" }}
                  type="password"
                  required
                  minLength={8}
                  placeholder="Secure password"
                  value={newUser.password}
                  onChange={(e) => setNewUser((x) => ({ ...x, password: e.target.value }))}
                />
              </div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={LBL}>Roles</label>
              <RoleCheckboxes selected={newUser.roles} onChange={(roles) => setNewUser((x) => ({ ...x, roles }))} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Button
                type="submit"
                variant="primary"
                icon={<Check size={14} />}
                loading={creating}
                disabled={creating || newUser.roles.length === 0}
              >
                Create User
              </Button>
              <Button variant="ghost" type="button" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Users table */}
      <div className="animate-fade-in-up stagger-2" style={{ ...CARD, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 24px", borderBottom: `1px solid ${colors.borderSubtle}`, display: "flex", alignItems: "center", gap: 10 }}>
          <Users size={16} color={colors.textTertiary} />
          <span style={{ fontSize: typography.sizes.sm.fontSize, fontWeight: typography.weights.semibold, color: colors.textSecondary }}>
            {usersLoaded ? `${users.length} user${users.length !== 1 ? "s" : ""}` : "Loading..."}
          </span>
        </div>

        {!usersLoaded ? (
          <div style={{ padding: 24 }}>
            <SkeletonTable rows={5} columns={5} />
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: colors.bgSurfaceInset }}>
                  <th style={baseThStyle}>Name</th>
                  <th style={baseThStyle}>Email</th>
                  <th style={baseThStyle}>Roles</th>
                  <th style={baseThStyle}>Status</th>
                  <th style={{ ...baseThStyle, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <EmptyState
                        icon={<Users size={32} />}
                        title="No users found"
                        description="Create a new user to get started."
                        action={{ label: "Create User", onClick: () => setShowCreate(true) }}
                      />
                    </td>
                  </tr>
                ) : (
                  users.map((u) => <UserRow key={u.id} user={u} onSave={onSave} onDelete={onDelete} />)
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

/* -- PermissionTable -- */

function PermissionTable({
  permData,
  onSavePermissions,
}: {
  permData: PermData | null;
  onSavePermissions: (overrides: { userId: string; permission: string; granted: boolean }[]) => Promise<void>;
}) {
  const [changes, setChanges] = useState<Record<string, Record<string, boolean>>>({});
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  if (!permData) {
    return (
      <div style={{ ...CARD, padding: 24, marginTop: 24 }}>
        <SkeletonTable rows={5} columns={8} />
      </div>
    );
  }

  const hasChanges = Object.keys(changes).length > 0;

  const handleToggle = (userId: string, perm: string, currentGranted: boolean) => {
    setChanges((prev) => {
      const userChanges = { ...(prev[userId] || {}) };
      const newValue = !currentGranted;
      const original = permData.users.find((u) => u.id === userId)?.permissions[perm]?.granted;
      if (newValue === original) {
        delete userChanges[perm];
        if (Object.keys(userChanges).length === 0) {
          const next = { ...prev };
          delete next[userId];
          return next;
        }
      } else {
        userChanges[perm] = newValue;
      }
      return { ...prev, [userId]: userChanges };
    });
  };

  const handleSave = async () => {
    const overrides: { userId: string; permission: string; granted: boolean }[] = [];
    for (const [userId, perms] of Object.entries(changes)) {
      for (const [perm, granted] of Object.entries(perms)) {
        overrides.push({ userId, permission: perm, granted });
      }
    }
    if (overrides.length === 0) return;

    setSaving(true);
    try {
      await onSavePermissions(overrides);
      setChanges({});
      toast("success", `Updated ${overrides.length} permission${overrides.length !== 1 ? "s" : ""}`);
    } catch (e: unknown) {
      toast("error", e instanceof Error ? e.message : "Failed to save permissions");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ ...CARD, padding: 0, overflow: "hidden", marginTop: 24 }}>
      <div style={{ padding: "16px 24px", borderBottom: `1px solid ${colors.borderSubtle}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Shield size={16} color={colors.textTertiary} />
          <span style={{ fontSize: typography.sizes.sm.fontSize, fontWeight: typography.weights.semibold, color: colors.textSecondary }}>
            Permission Management
          </span>
        </div>
        {hasChanges && (
          <Button
            variant="primary"
            size="sm"
            icon={<Save size={14} />}
            loading={saving}
            onClick={handleSave}
          >
            Save Permissions
          </Button>
        )}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: colors.bgSurfaceInset }}>
              <th style={baseThStyle}>User</th>
              {permData.configurablePermissions.map((p) => (
                <th key={p} style={{ ...baseThStyle, textAlign: "center", fontSize: typography.sizes.xs.fontSize, padding: "10px 6px" }}>
                  {PERM_LABELS[p] ?? p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Hard-coded locked rows */}
            <tr style={{ background: `${colors.bgSurfaceInset}60` }}>
              <td style={{ ...baseTdStyle, display: "flex", alignItems: "center", gap: 6 }}>
                <Lock size={12} color={colors.textMuted} />
                <span style={{ color: colors.textMuted, fontSize: typography.sizes.sm.fontSize }}>Payroll Access</span>
              </td>
              {permData.configurablePermissions.map((p) => (
                <td key={p} style={{ ...baseTdStyle, textAlign: "center" }}>
                  <input type="checkbox" checked={false} disabled title="SUPER_ADMIN only" style={{ opacity: 0.3 }} />
                </td>
              ))}
            </tr>
            <tr style={{ background: `${colors.bgSurfaceInset}60` }}>
              <td style={{ ...baseTdStyle, display: "flex", alignItems: "center", gap: 6 }}>
                <Lock size={12} color={colors.textMuted} />
                <span style={{ color: colors.textMuted, fontSize: typography.sizes.sm.fontSize }}>User Creation</span>
              </td>
              {permData.configurablePermissions.map((p) => (
                <td key={p} style={{ ...baseTdStyle, textAlign: "center" }}>
                  <input type="checkbox" checked={false} disabled title="SUPER_ADMIN only" style={{ opacity: 0.3 }} />
                </td>
              ))}
            </tr>

            {/* User permission rows */}
            {permData.users.map((user) => (
              <tr key={user.id} className="row-hover" style={{ transition: `background ${motion.duration.fast} ${motion.easing.out}` }}>
                <td style={baseTdStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: typography.weights.semibold, color: colors.textPrimary, fontSize: typography.sizes.sm.fontSize }}>{user.name}</span>
                    <div style={{ display: "flex", gap: 3 }}>
                      {user.roles.map((r) => (
                        <Badge key={r} color={ROLE_COLORS[r] ?? colors.textTertiary} size="sm">
                          {r}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </td>
                {permData.configurablePermissions.map((perm) => {
                  const userPerm = user.permissions[perm];
                  const currentGranted = changes[user.id]?.[perm] ?? userPerm?.granted ?? false;
                  const isOverrideOrChanged = userPerm?.isOverride || (changes[user.id] && perm in changes[user.id]);

                  return (
                    <td key={perm} style={{ ...baseTdStyle, textAlign: "center", position: "relative" }}>
                      <input
                        type="checkbox"
                        checked={currentGranted}
                        onChange={() => handleToggle(user.id, perm, currentGranted)}
                        style={{ accentColor: colors.accentTeal, width: 15, height: 15, cursor: "pointer" }}
                      />
                      {isOverrideOrChanged && (
                        <span
                          style={{
                            position: "absolute",
                            top: 8,
                            right: 8,
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: colors.accentTeal,
                          }}
                          title="Custom override"
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* -- OwnerUsers -- */

export default function OwnerUsers({ API }: { API: string }) {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [permData, setPermData] = useState<PermData | null>(null);

  useEffect(() => {
    authFetch(`${API}/api/users`)
      .then((r) => r.ok ? r.json() : [])
      .then((u) => { setUsers(u); setUsersLoaded(true); })
      .catch(() => { setUsers([]); setUsersLoaded(true); });

    authFetch(`${API}/api/permissions`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { setPermData(d); })
      .catch(() => { toast("error", "Failed to load users"); });
  }, [API]);

  async function saveUser(id: string, data: Partial<User> & { password?: string }): Promise<string | null> {
    try {
      const res = await authFetch(`${API}/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const u = await res.json();
        setUsers((prev) => prev.map((x) => (x.id === id ? u : x)));
        return null;
      }
      const err = await res.json().catch(() => ({}));
      return err.error ?? "Failed to save";
    } catch (e: unknown) {
      return `Unable to reach API \u2014 ${e instanceof Error ? e.message : "network error"}`;
    }
  }

  async function deleteUser(id: string): Promise<string | null> {
    try {
      const res = await authFetch(`${API}/api/users/${id}`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        setUsers((prev) => prev.filter((x) => x.id !== id));
        toast("success", "User deleted");
        return null;
      }
      const err = await res.json().catch(() => ({}));
      return err.error ?? "Failed to delete user";
    } catch (e: unknown) {
      return `Unable to reach API \u2014 ${e instanceof Error ? e.message : "network error"}`;
    }
  }

  async function savePermissions(overrides: { userId: string; permission: string; granted: boolean }[]): Promise<void> {
    const res = await authFetch(`${API}/api/permissions`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ overrides }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? `Request failed (${res.status})`);
    }
    const fresh = await authFetch(`${API}/api/permissions`).then((r) => r.ok ? r.json() : null);
    if (fresh) setPermData(fresh);
  }

  return (
    <div className="animate-fade-in">
      <UsersSection
        users={users}
        usersLoaded={usersLoaded}
        onSave={saveUser}
        onDelete={deleteUser}
        API={API}
      />
      <PermissionTable permData={permData} onSavePermissions={savePermissions} />
    </div>
  );
}
