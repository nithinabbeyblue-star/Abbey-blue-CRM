"use client";

import { useState, useEffect, useCallback } from "react";

interface Task {
  id: string;
  content: string;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
  user: { name: string };
}

export function CaseTasksSection({ ticketId }: { ticketId: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTask, setNewTask] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}/tasks`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch {
      // silent
    }
    setLoading(false);
  }, [ticketId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  async function handleAdd() {
    if (!newTask.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newTask.trim() }),
      });
      if (res.ok) {
        setNewTask("");
        await fetchTasks();
      }
    } catch {
      // silent
    }
    setAdding(false);
  }

  async function handleToggle(taskId: string, completed: boolean) {
    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, completed } : t
      )
    );
    try {
      await fetch(`/api/tickets/${ticketId}/tasks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, completed }),
      });
      await fetchTasks();
    } catch {
      await fetchTasks();
    }
  }

  async function handleDelete(taskId: string) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    try {
      await fetch(`/api/tickets/${ticketId}/tasks?taskId=${taskId}`, {
        method: "DELETE",
      });
    } catch {
      await fetchTasks();
    }
  }

  const pending = tasks.filter((t) => !t.completed);
  const completed = tasks.filter((t) => t.completed);

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
          To-Do List
        </h2>
        {tasks.length > 0 && (
          <span className="text-xs text-muted">
            {completed.length}/{tasks.length} done
          </span>
        )}
      </div>

      {/* Add task */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder="Add a task... (e.g. Follow up with client)"
          className="flex-1 rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          onClick={handleAdd}
          disabled={adding || !newTask.trim()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {adding ? "..." : "Add"}
        </button>
      </div>

      {/* Task list */}
      <div className="mt-4">
        {loading ? (
          <p className="py-4 text-center text-xs text-muted">Loading tasks...</p>
        ) : tasks.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted">
            No tasks yet. Add one to track what needs to be done.
          </p>
        ) : (
          <div className="space-y-1">
            {/* Pending tasks first */}
            {pending.map((task) => (
              <div
                key={task.id}
                className="group flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() => handleToggle(task.id, true)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">{task.content}</p>
                  <p className="text-[11px] text-muted">
                    {task.user.name} &bull;{" "}
                    {new Date(task.createdAt).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(task.id)}
                  className="invisible rounded p-1 text-muted hover:text-red-500 group-hover:visible"
                  title="Delete task"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}

            {/* Completed tasks */}
            {completed.length > 0 && (
              <>
                {pending.length > 0 && (
                  <div className="my-2 border-t border-border" />
                )}
                {completed.map((task) => (
                  <div
                    key={task.id}
                    className="group flex items-start gap-3 rounded-lg px-2 py-2 opacity-60 hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={true}
                      onChange={() => handleToggle(task.id, false)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground line-through">{task.content}</p>
                      <p className="text-[11px] text-muted">
                        {task.user.name} &bull; done{" "}
                        {task.completedAt
                          ? new Date(task.completedAt).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                            })
                          : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(task.id)}
                      className="invisible rounded p-1 text-muted hover:text-red-500 group-hover:visible"
                      title="Delete task"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Progress bar */}
      {tasks.length > 0 && (
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${(completed.length / tasks.length) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
