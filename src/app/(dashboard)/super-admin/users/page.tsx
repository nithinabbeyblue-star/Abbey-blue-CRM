"use client";

import { useEffect, useState, useCallback } from "react";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  _count: { createdTickets: number; assignedTickets: number };
}

const ROLES = ["SUPER_ADMIN", "KEY_COORDINATOR", "SALES", "ADMIN"];

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "bg-purple-100 text-purple-700",
  KEY_COORDINATOR: "bg-blue-100 text-blue-700",
  SALES: "bg-green-100 text-green-700",
  ADMIN: "bg-orange-100 text-orange-700",
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
  });
  const [message, setMessage] = useState({ text: "", type: "" });
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = useCallback(async () => {
    const res = await fetch("/api/users");
    const data = await res.json();
    setUsers(data.users || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  function resetForm() {
    setFormData({ name: "", email: "", password: "", role: "SALES" });
    setEditingUser(null);
    setShowForm(false);
  }

  function startEdit(user: User) {
    setEditingUser(user);
    setFormData({ name: user.name, email: user.email, password: "", role: user.role });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage({ text: "", type: "" });

    try {
      if (editingUser) {
        // Update
        const body: Record<string, string> = {};
        if (formData.name !== editingUser.name) body.name = formData.name;
        if (formData.email !== editingUser.email) body.email = formData.email;
        if (formData.role !== editingUser.role) body.role = formData.role;
        if (formData.password) body.password = formData.password;

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
        // Create
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });

        if (res.ok) {
          setMessage({ text: "User created successfully", type: "success" });
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

  async function toggleActive(user: User) {
    setMessage({ text: "", type: "" });
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !user.isActive }),
    });

    if (res.ok) {
      setMessage({
        text: `${user.name} has been ${user.isActive ? "deactivated" : "activated"}`,
        type: "success",
      });
      fetchUsers();
    } else {
      const data = await res.json();
      setMessage({ text: data.error || "Failed to update", type: "error" });
    }
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
        <button
          onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
        >
          {showForm ? "Cancel" : "+ New User"}
        </button>
      </div>

      {/* Message */}
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                Password {editingUser ? "(leave blank to keep)" : ""}{" "}
                {!editingUser && <span className="text-danger">*</span>}
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required={!editingUser}
                minLength={6}
                placeholder={editingUser ? "Leave blank to keep current" : "Min 6 characters"}
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
                  <option key={r} value={r}>
                    {r.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
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
              <th className="px-4 py-3 text-left font-medium text-muted">Role</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Tickets</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Joined</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-border last:border-0 hover:bg-gray-50/50">
                <td className="px-4 py-3 font-medium text-foreground">{user.name}</td>
                <td className="px-4 py-3 text-muted">{user.email}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${ROLE_COLORS[user.role] || "bg-gray-100 text-gray-700"}`}>
                    {user.role.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${user.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {user.isActive ? "Active" : "Inactive"}
                  </span>
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
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEdit(user)}
                      className="rounded border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-gray-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => toggleActive(user)}
                      className={`rounded px-2.5 py-1 text-xs font-medium ${
                        user.isActive
                          ? "border border-red-200 text-red-600 hover:bg-red-50"
                          : "border border-green-200 text-green-600 hover:bg-green-50"
                      }`}
                    >
                      {user.isActive ? "Deactivate" : "Activate"}
                    </button>
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
