"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import PusherClient from "pusher-js";

interface ChatMember {
  userId: string;
  user: { id: string; name: string; role: string };
}

interface AttachmentItem {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
}

interface MessageItem {
  id: string;
  content: string;
  createdAt: string;
  sender: { id: string; name: string; role: string };
  attachments?: AttachmentItem[];
}

interface PendingFile {
  file: File;
  uploading: boolean;
  error?: string;
}

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "text-purple-600",
  ADMIN_MANAGER: "text-blue-600",
  SALES_MANAGER: "text-orange-600",
  ADMIN: "text-green-600",
  SALES: "text-amber-600",
};

export function ChatPanel({
  ticketId,
  currentUserId,
}: {
  ticketId: string;
  currentUserId: string;
}) {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Load chat room and messages
  useEffect(() => {
    async function loadChat() {
      try {
        // Get chat room info
        const roomRes = await fetch(`/api/tickets/${ticketId}/chat`);
        if (!roomRes.ok) {
          setError("Chat not available for this case");
          setLoading(false);
          return;
        }
        const roomData = await roomRes.json();
        const room = roomData.chatRoom;
        setRoomId(room.id);
        setMembers(room.members);

        // Load messages
        const msgRes = await fetch(`/api/chat/${room.id}/messages`);
        if (msgRes.ok) {
          const msgData = await msgRes.json();
          setMessages(msgData.messages || []);
        }

        // Mark as read
        fetch(`/api/chat/${room.id}/read`, { method: "POST" });
      } catch {
        setError("Failed to load chat");
      }
      setLoading(false);
    }
    loadChat();
  }, [ticketId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Pusher real-time subscription
  useEffect(() => {
    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
    if (!pusherKey || !pusherCluster) return;

    const pusher = new PusherClient(pusherKey, {
      cluster: pusherCluster,
      authEndpoint: "/api/pusher/auth",
    });

    const channel = pusher.subscribe(`private-case-${ticketId}`);

    channel.bind("new-message", (data: MessageItem) => {
      // Don't duplicate messages we sent ourselves
      if (data.sender.id === currentUserId) return;
      setMessages((prev) => [...prev, data]);

      // Mark as read
      if (roomId) {
        fetch(`/api/chat/${roomId}/read`, { method: "POST" });
      }
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(`private-case-${ticketId}`);
      pusher.disconnect();
    };
  }, [ticketId, currentUserId, roomId]);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    const newFiles: PendingFile[] = Array.from(files)
      .filter((f) => f.size <= 10 * 1024 * 1024) // 10MB limit
      .map((f) => ({ file: f, uploading: false }));
    if (newFiles.length < (files?.length || 0)) {
      alert("Some files were skipped (max 10MB each)");
    }
    setPendingFiles((prev) => [...prev, ...newFiles]);
    e.target.value = "";
  }

  function removePendingFile(index: number) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function uploadFile(file: File): Promise<{
    fileName: string;
    fileUrl: string;
    fileKey: string;
    fileSize: number;
    mimeType: string;
  } | { error: string }> {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/chat/${roomId}/attachments/presign`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        console.error(`Chat attachment upload failed (${res.status}):`, errText);
        let errMessage = "File upload failed";
        try {
          const parsed = JSON.parse(errText) as { error?: string };
          if (typeof parsed?.error === "string") errMessage = parsed.error;
        } catch {
          /* use default */
        }
        return { error: errMessage };
      }

      const data = await res.json();
      return {
        fileName: data.fileName,
        fileUrl: data.fileUrl,
        fileKey: data.fileKey,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
      };
    } catch (err) {
      console.error("Chat attachment upload error:", err);
      return { error: "File upload failed" };
    }
  }

  async function handleSend() {
    if ((!newMessage.trim() && pendingFiles.length === 0) || !roomId) return;

    setSending(true);
    const content = newMessage.trim();
    setNewMessage("");
    const filesToUpload = [...pendingFiles];
    setPendingFiles([]);

    // Parse @mentions from content
    const mentionPattern = /@(\w+(?:\s\w+)*)/g;
    const mentionedNames = [...content.matchAll(mentionPattern)].map((m) => m[1].toLowerCase());
    const mentionedIds = members
      .filter((m) => mentionedNames.some((name) => m.user.name.toLowerCase().includes(name)))
      .map((m) => m.userId)
      .filter((id) => id !== currentUserId);

    try {
      // Upload files first
      let attachments: { fileName: string; fileUrl: string; fileKey: string; fileSize: number; mimeType: string }[] = [];
      if (filesToUpload.length > 0) {
        const results = await Promise.all(filesToUpload.map((pf) => uploadFile(pf.file)));
        const firstError = results.find((r): r is { error: string } => r !== null && "error" in r && typeof (r as { error: string }).error === "string");
        attachments = results.filter((r): r is { fileName: string; fileUrl: string; fileKey: string; fileSize: number; mimeType: string } => r !== null && !("error" in r));
        if (attachments.length === 0 && !content) {
          setError(firstError?.error ?? "File upload failed");
          setSending(false);
          return;
        }
        if (firstError) setError(firstError.error);
      }

      const res = await fetch(`/api/chat/${roomId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content || "",
          mentions: mentionedIds,
          ...(attachments.length > 0 ? { attachments } : {}),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data.message]);
      }
    } catch {
      setNewMessage(content);
      setPendingFiles(filesToUpload);
    }

    setSending(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "@") {
      setShowMentions(true);
    } else if (e.key === " " || e.key === "Escape") {
      setShowMentions(false);
    }
  }

  function insertMention(name: string) {
    setNewMessage((prev) => prev + `@${name} `);
    setShowMentions(false);
    inputRef.current?.focus();
  }

  function formatTimestamp(dateStr: string): string {
    const d = new Date(dateStr);
    const date = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    return `${date} - ${time}`;
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center rounded-xl border border-border bg-card shadow-sm">
        <p className="text-center text-xs text-muted">Loading chat...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[400px] flex-col rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Case Chat</h2>
        </div>
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="text-center">
            <p className="text-xs text-muted">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Group messages by date
  let lastDate = "";

  return (
    <div className="flex min-h-[400px] h-full flex-col rounded-xl border border-border bg-card shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
          Case Chat
        </h2>
        <div className="flex -space-x-1.5">
          {members.slice(0, 5).map((m) => (
            <div
              key={m.userId}
              title={`${m.user.name} (${m.user.role.replace(/_/g, " ")})`}
              className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-gray-200 text-[10px] font-semibold text-gray-600"
            >
              {m.user.name.charAt(0).toUpperCase()}
            </div>
          ))}
          {members.length > 5 && (
            <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-gray-300 text-[10px] font-semibold text-gray-600">
              +{members.length - 5}
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-xs text-muted">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => {
              const msgDate = formatDate(msg.createdAt);
              const showDateSep = msgDate !== lastDate;
              lastDate = msgDate;
              const isOwn = msg.sender.id === currentUserId;

              return (
                <div key={msg.id}>
                  {showDateSep && (
                    <div className="my-3 flex items-center gap-2">
                      <div className="flex-1 border-t border-border" />
                      <span className="text-[10px] font-medium text-muted">{msgDate}</span>
                      <div className="flex-1 border-t border-border" />
                    </div>
                  )}
                  <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] ${isOwn ? "text-right" : ""}`}>
                      <div className="mb-0.5 flex items-center gap-1.5">
                        {!isOwn && (
                          <span
                            className={`text-xs font-semibold ${ROLE_COLORS[msg.sender.role] || "text-gray-600"}`}
                          >
                            {msg.sender.name}
                          </span>
                        )}
                        <span className="text-[10px] text-muted">{formatTimestamp(msg.createdAt)}</span>
                      </div>
                      <div
                        className={`inline-block rounded-xl px-3 py-2 text-sm ${
                          isOwn
                            ? "bg-primary text-white"
                            : "bg-gray-100 text-foreground"
                        }`}
                      >
                        {msg.content && <span>{msg.content}</span>}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className={`${msg.content ? "mt-1.5 border-t pt-1.5" : ""} ${isOwn ? "border-white/20" : "border-gray-200"} space-y-1`}>
                            {msg.attachments.map((att) => (
                              <a
                                key={att.id}
                                href={att.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex items-center gap-1.5 text-xs ${isOwn ? "text-white/90 hover:text-white" : "text-primary hover:underline"}`}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                </svg>
                                <span className="truncate max-w-[180px]">{att.fileName}</span>
                                <span className="flex-shrink-0 opacity-70">({formatFileSize(att.fileSize)})</span>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="relative border-t border-border px-4 py-3">
        {/* @mention dropdown */}
        {showMentions && (
          <div className="absolute bottom-full left-4 right-4 mb-1 max-h-40 overflow-y-auto rounded-lg border border-border bg-white shadow-lg">
            {members
              .filter((m) => m.userId !== currentUserId)
              .map((m) => (
                <button
                  key={m.userId}
                  onClick={() => insertMention(m.user.name)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-[10px] font-semibold">
                    {m.user.name.charAt(0)}
                  </span>
                  <span className="font-medium">{m.user.name}</span>
                  <span className="text-xs text-muted">{m.user.role.replace(/_/g, " ")}</span>
                </button>
              ))}
          </div>
        )}

        {/* Pending files preview */}
        {pendingFiles.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {pendingFiles.map((pf, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 rounded-md bg-gray-100 px-2 py-1 text-xs text-foreground"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                <span className="max-w-[120px] truncate">{pf.file.name}</span>
                <span className="text-muted">({formatFileSize(pf.file.size)})</span>
                <button
                  onClick={() => removePendingFile(i)}
                  className="ml-0.5 text-muted hover:text-danger"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
            title="Attach file"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-gray-50 hover:text-foreground disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
          <textarea
            ref={inputRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (@ to mention)"
            rows={1}
            className="flex-1 resize-none rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={handleSend}
            disabled={(!newMessage.trim() && pendingFiles.length === 0) || sending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {sending ? "..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
