"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import PusherClient from "pusher-js";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  metadata: string | null;
  createdAt: string;
}

export function NotificationBell({
  userId,
  userRole,
}: {
  userId: string;
  userRole: string;
}) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      // silently fail
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Poll every 30s as fallback
  useEffect(() => {
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Real-time via Pusher — only init when server has Pusher configured to avoid "Connection failed" with empty keys
  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    fetch("/api/pusher/status")
      .then((r) => r.json())
      .then((data: { configured?: boolean }) => {
        if (cancelled || !data?.configured) return;
        const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
        const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
        if (!pusherKey || !pusherCluster) return;

        const pusher = new PusherClient(pusherKey, {
          cluster: pusherCluster,
          authEndpoint: "/api/pusher/auth",
        });

        const channel = pusher.subscribe(`private-user-${userId}`);
        channel.bind("notification", () => {
          fetchNotifications();
        });

        return () => {
          channel.unbind_all();
          pusher.unsubscribe(`private-user-${userId}`);
          pusher.disconnect();
        };
      });

    return () => {
      cancelled = true;
    };
  }, [userId, fetchNotifications]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Register push notifications (service worker)
  useEffect(() => {
    async function registerPush() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

      try {
        const registration = await navigator.serviceWorker.register("/sw.js");

        // Check if VAPID key is available
        const vapidRes = await fetch("/api/push/vapid-key");
        if (!vapidRes.ok) return;
        const { publicKey } = await vapidRes.json();
        if (!publicKey) return;

        const existing = await registration.pushManager.getSubscription();
        if (existing) return; // Already subscribed

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer,
        });

        // Send subscription to server
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(subscription.toJSON()),
        });
      } catch {
        // Push not supported or denied
      }
    }
    registerPush();
  }, []);

  async function markAllRead() {
    await fetch("/api/notifications", { method: "PATCH" });
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}`, { method: "PATCH" });
    setUnreadCount((prev) => Math.max(0, prev - 1));
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  }

  function getNotifUrl(notif: Notification): string | null {
    if (notif.type === "ACCESS_REQUEST") return "/super-admin/users";
    if (!notif.metadata) return null;
    try {
      const meta = JSON.parse(notif.metadata);
      if (meta.ticketId) {
        if (userRole === "SALES") return `/sales/tickets/${meta.ticketId}`;
        if (userRole === "SUPER_ADMIN") return `/super-admin/tickets/${meta.ticketId}`;
        return `/admin/tickets/${meta.ticketId}`;
      }
    } catch {
      // invalid metadata
    }
    return null;
  }

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  const TYPE_COLORS: Record<string, string> = {
    CASE_ASSIGNED: "bg-blue-100 text-blue-600",
    STATUS_CHANGE: "bg-green-100 text-green-600",
    MENTION: "bg-purple-100 text-purple-600",
    DOCUMENT_UPLOAD: "bg-orange-100 text-orange-600",
    NEW_MESSAGE: "bg-indigo-100 text-indigo-600",
    ACCESS_REQUEST: "bg-amber-100 text-amber-600",
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-text transition-colors hover:bg-white/10 hover:text-white"
        title="Notifications"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-80 rounded-xl border border-border bg-white shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-primary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-muted">
                No notifications yet
              </div>
            ) : (
              notifications.map((notif) => {
                const url = getNotifUrl(notif);
                const Tag = url ? "a" : "div";
                return (
                  <Tag
                    key={notif.id}
                    {...(url ? { href: url, onClick: () => { markRead(notif.id); setOpen(false); } } : {})}
                    className={`flex gap-3 border-b border-border px-4 py-3 last:border-0 ${
                      !notif.isRead ? "bg-blue-50/50" : ""
                    } ${url ? "cursor-pointer hover:bg-gray-50" : ""}`}
                  >
                    <div
                      className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        TYPE_COLORS[notif.type] || "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {notif.type === "CASE_ASSIGNED" && "A"}
                      {notif.type === "STATUS_CHANGE" && "S"}
                      {notif.type === "MENTION" && "@"}
                      {notif.type === "DOCUMENT_UPLOAD" && "D"}
                      {notif.type === "NEW_MESSAGE" && "M"}
                      {notif.type === "ACCESS_REQUEST" && "R"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{notif.title}</p>
                      <p className="mt-0.5 text-xs text-muted line-clamp-2">{notif.body}</p>
                      <p className="mt-1 text-[10px] text-muted">{timeAgo(notif.createdAt)}</p>
                    </div>
                    {!notif.isRead && (
                      <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                    )}
                  </Tag>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
