"use client";

import { useEffect, useState, useCallback } from "react";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  mustSetPassword: boolean;
  employeeId: string | null;
  age: string | null;
  gender: string | null;
  contactNumber: string | null;
  homeAddress: string | null;
  lastLoginCity: string | null;
  lastLoginCountry: string | null;
  createdAt: string;
  _count: { createdTickets: number; assignedTickets: number };
}

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  let pw = "";
  for (let i = 0; i < 12; i++) {
    pw += chars[Math.floor(Math.random() * chars.length)];
  }
  return pw;
}

const ROLES = ["SUPER_ADMIN", "SALES_MANAGER", "ADMIN_MANAGER", "SALES", "ADMIN"];
const GENDERS = ["Male", "Female", "Other"];

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "bg-purple-100 text-purple-700",
  SALES_MANAGER: "bg-teal-100 text-teal-700",
  ADMIN_MANAGER: "bg-blue-100 text-blue-700",
  SALES: "bg-green-100 text-green-700",
  ADMIN: "bg-orange-100 text-orange-700",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  ACTIVE: "bg-green-100 text-green-700",
  SUSPENDED: "bg-red-100 text-red-700",
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "SALES",
    employeeId: "",
    age: "",
    gender: "",
    contactNumber: "",
    homeAddress: "",
    tempPassword: "",
  });
  const [message, setMessage] = useState({ text: "", type: "" });
  const [submitting, setSubmitting] = useState(false);
  const [killingAll, setKillingAll] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      setUsers(data.users || []);
      if (!res.ok && data.error) {
        setMessage({ text: data.error, type: "error" });
      }
    } catch {
      setUsers([]);
      setMessage({ text: "Failed to load users", type: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  function resetForm() {
    setFormData({
      name: "",
      email: "",
      password: "",
      role: "SALES",
      employeeId: "",
      age: "",
      gender: "",
      contactNumber: "",
      homeAddress: "",
      tempPassword: "",
    });
    setEditingUser(null);
    setShowForm(false);
  }

  function startEdit(user: User) {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
      employeeId: user.employeeId || "",
      age: user.age || "",
      gender: user.gender || "",
      contactNumber: user.contactNumber || "",
      homeAddress: user.homeAddress || "",
      tempPassword: "",
    });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage({ text: "", type: "" });

    try {
      if (editingUser) {
        const body: Record<string, string> = {};
        if (formData.name !== editingUser.name) body.name = formData.name;
        if (formData.email !== editingUser.email) body.email = formData.email;
        if (formData.role !== editingUser.role) body.role = formData.role;
        if (formData.password) body.password = formData.password;
        if (formData.employeeId !== (editingUser.employeeId || "")) body.employeeId = formData.employeeId;
        if (formData.age !== (editingUser.age || "")) body.age = formData.age;
        if (formData.gender !== (editingUser.gender || "")) body.gender = formData.gender;
        if (formData.contactNumber !== (editingUser.contactNumber || "")) body.contactNumber = formData.contactNumber;
        if (formData.homeAddress !== (editingUser.homeAddress || "")) body.homeAddress = formData.homeAddress;

        const res = await fetch(`/api/users/${editingUser.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (res.ok) {
          setMessage({ text: "User updated successfully", type: "success" });
          resetForm();
          fetchUsers();
        } else {
          const data = await res.json();
          setMessage({ text: data.error || "Failed to update", type: "error" });
        }
      } else {
        // Create — with optional temp password
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
            role: formData.role,
            employeeId: formData.employeeId,
            age: formData.age || undefined,
            gender: formData.gender || undefined,
            contactNumber: formData.contactNumber || undefined,
            homeAddress: formData.homeAddress || undefined,
            tempPassword: formData.tempPassword || undefined,
          }),
        });

        if (res.ok) {
          setMessage({
            text: formData.tempPassword
              ? `User created with temp password. Credentials sent to admin email.`
              : "User created (PENDING — awaiting password set)",
            type: "success",
          });
          resetForm();
          fetchUsers();
        } else {
          const data = await res.json();
          setMessage({ text: data.error || "Failed to create", type: "error" });
        }
      }
    } catch {
      setMessage({ text: "Something went wrong", type: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAction(userId: string, action: string) {
    const labels: Record<string, string> = {
      grant_access: "grant access to",
      suspend: "deactivate",
      reactivate: "reactivate",
    };

    const user = users.find((u) => u.id === userId);
    if (!user) return;

    if (action === "suspend") {
      if (!confirm(`Are you sure you want to DEACTIVATE ${user.name}? This will immediately kill all their active sessions.`)) {
        return;
      }
    }

    setMessage({ text: "", type: "" });
    const res = await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });

    if (res.ok) {
      setMessage({
        text: `Successfully ${labels[action] || action}d ${user.name}`,
        type: "success",
      });
      fetchUsers();
    } else {
      const data = await res.json();
      setMessage({ text: data.error || "Action failed", type: "error" });
    }
  }

  async function handleKillAllSessions() {
    if (!confirm("Are you sure you want to kill ALL non-admin sessions? This will force every Sales, Admin, and Key Coordinator user to re-login immediately.")) {
      return;
    }

    setKillingAll(true);
    setMessage({ text: "", type: "" });

    try {
      const res = await fetch("/api/governance/kill-all-sessions", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setMessage({
          text: `Successfully killed ${data.count} user session${data.count !== 1 ? "s" : ""}. All non-admin users must re-login.`,
          type: "success",
        });
      } else {
        const data = await res.json();
        setMessage({ text: data.error || "Failed to kill sessions", type: "error" });
      }
    } catch {
      setMessage({ text: "Failed to kill sessions", type: "error" });
    }

    setKillingAll(false);
  }

  if (loading) {
    return <div className="py-16 text-center text-sm text-muted">Loading users...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
          <p className="mt-1 text-sm text-muted">Create and manage employee accounts</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleKillAllSessions}
            disabled={killingAll}
            className="rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            {killingAll ? "Killing..." : "Kill All Sessions"}
          </button>
          <button
            onClick={() => { resetForm(); setShowForm(!showForm); }}
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
          >
            {showForm ? "Cancel" : "+ New User"}
          </button>
        </div>
      </div>

      {message.text && (
        <div
          className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
            message.type === "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Create / Edit Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mt-6 rounded-xl border border-border bg-card p-6 shadow-sm"
        >
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            {editingUser ? `Edit: ${editingUser.name}` : "Create New User"}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Full Name <span className="text-danger">*</span>
              </label>
              <input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Email <span className="text-danger">*</span>
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Employee ID <span className="text-danger">*</span>
              </label>
              <input
                value={formData.employeeId}
                onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                required={!editingUser}
                placeholder="e.g. ABL-001"
                className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Role <span className="text-danger">*</span>
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Age</label>
              <input
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                placeholder="e.g. 28"
                className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Gender</label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Select...</option>
                {GENDERS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Contact Number</label>
              <input
                value={formData.contactNumber}
                onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                placeholder="+353 ..."
                className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-foreground">Home Address</label>
              <input
                value={formData.homeAddress}
                onChange={(e) => setFormData({ ...formData, homeAddress: e.target.value })}
                placeholder="Street, City, County"
                className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            {editingUser && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Password (leave blank to keep)
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  minLength={6}
                  placeholder="Leave blank to keep current"
                  className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            )}
            {!editingUser && (
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Temporary Password
                </label>
                <div className="flex gap-2">
                  <input
                    value={formData.tempPassword}
                    onChange={(e) => setFormData({ ...formData, tempPassword: e.target.value })}
                    minLength={8}
                    placeholder="Generate or enter a temp password"
                    className="flex-1 rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-mono outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, tempPassword: generatePassword() })}
                    className="rounded-lg border border-primary bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/10"
                  >
                    Generate
                  </button>
                </div>
                <p className="mt-1 text-xs text-muted">
                  If set, credentials will be emailed to the admin. The user will be forced to change this after approval.
                </p>
              </div>
            )}
          </div>
          <div className="mt-4 flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
            >
              {submitting ? "Saving..." : editingUser ? "Update User" : "Create User"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-foreground hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Users Table */}
      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-gray-50/50">
              <th className="px-4 py-3 text-left font-medium text-muted">Name</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Email</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Employee ID</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Role</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Location</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Tickets</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Joined</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-border last:border-0 hover:bg-gray-50/50">
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">{user.name}</p>
                  {user.status === "PENDING" && !user.mustSetPassword && (
                    <p className="text-xs text-amber-600">Awaiting first login</p>
                  )}
                  {user.status === "PENDING" && user.mustSetPassword && (
                    <p className="text-xs text-blue-600">Ready for approval</p>
                  )}
                  {user.status === "ACTIVE" && user.mustSetPassword && (
                    <p className="text-xs text-orange-600">Changing password</p>
                  )}
                </td>
                <td className="px-4 py-3 text-muted">{user.email}</td>
                <td className="px-4 py-3 text-xs text-muted">{user.employeeId || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${ROLE_COLORS[user.role] || "bg-gray-100 text-gray-700"}`}>
                    {user.role.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[user.status] || "bg-gray-100 text-gray-700"}`}>
                    {user.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-muted">
                  {user.lastLoginCity && user.lastLoginCountry
                    ? `${user.lastLoginCity}, ${user.lastLoginCountry}`
                    : "—"}
                </td>
                <td className="px-4 py-3 text-xs text-muted">
                  {user._count.createdTickets > 0 && `${user._count.createdTickets} created`}
                  {user._count.createdTickets > 0 && user._count.assignedTickets > 0 && " / "}
                  {user._count.assignedTickets > 0 && `${user._count.assignedTickets} assigned`}
                  {user._count.createdTickets === 0 && user._count.assignedTickets === 0 && "—"}
                </td>
                <td className="px-4 py-3 text-xs text-muted">
                  {new Date(user.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => startEdit(user)}
                      className="rounded border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-gray-50"
                    >
                      Edit
                    </button>

                    {/* PENDING → Grant Access (API validates password exists) */}
                    {user.status === "PENDING" && (
                      <button
                        onClick={() => handleAction(user.id, "grant_access")}
                        className="rounded border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100"
                      >
                        Grant Access
                      </button>
                    )}

                    {/* ACTIVE → Kill Switch */}
                    {user.status === "ACTIVE" && (
                      <button
                        onClick={() => handleAction(user.id, "suspend")}
                        className="rounded border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        Kill Switch
                      </button>
                    )}

                    {/* SUSPENDED → Reactivate */}
                    {user.status === "SUSPENDED" && (
                      <button
                        onClick={() => handleAction(user.id, "reactivate")}
                        className="rounded border border-green-200 px-2.5 py-1 text-xs font-medium text-green-600 hover:bg-green-50"
                      >
                        Reactivate
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
