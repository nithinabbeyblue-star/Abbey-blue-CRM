"use client";

import { useState, useEffect, useCallback } from "react";

interface DocumentItem {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number | null;
  mimeType: string | null;
  createdAt: string;
  downloadUrl: string;
  uploadedBy: { name: string };
}

const DOC_TYPES = [
  { value: "PASSPORT", label: "Passport" },
  { value: "PHOTO", label: "Photo" },
  { value: "BANK_STATEMENT", label: "Bank Statement" },
  { value: "VISA_FORM", label: "Visa Form" },
  { value: "SUPPORTING_DOC", label: "Supporting Doc" },
  { value: "OTHER", label: "Other" },
];

const TYPE_ICONS: Record<string, string> = {
  PASSPORT: "📘",
  PHOTO: "📷",
  BANK_STATEMENT: "🏦",
  VISA_FORM: "📋",
  SUPPORTING_DOC: "📎",
  OTHER: "📄",
};

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentSection({ ticketId }: { ticketId: string }) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [selectedType, setSelectedType] = useState("OTHER");

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}/documents`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
      }
    } catch {
      // silently fail
    }
    setLoading(false);
  }, [ticketId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setMessage({ text: "File must be under 10MB", type: "error" });
      return;
    }

    setUploading(true);
    setMessage({ text: "", type: "" });

    try {
      // Step 1: Get presigned upload URL
      const presignRes = await fetch(`/api/tickets/${ticketId}/documents/presign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          fileSize: file.size,
        }),
      });

      if (!presignRes.ok) {
        const err = await presignRes.json();
        throw new Error(err.error || "Failed to get upload URL");
      }

      const { uploadUrl, key, fileName } = await presignRes.json();

      // Step 2: Upload directly to S3
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload file to storage");
      }

      // Step 3: Confirm upload — save DB record
      const confirmRes = await fetch(`/api/tickets/${ticketId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName,
          fileKey: key,
          fileType: selectedType,
          fileSize: file.size,
          mimeType: file.type || "application/octet-stream",
        }),
      });

      if (!confirmRes.ok) {
        throw new Error("Failed to save document record");
      }

      setMessage({ text: "Document uploaded successfully", type: "success" });
      await fetchDocuments();
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : "Upload failed",
        type: "error",
      });
    }

    setUploading(false);
    // Reset file input
    e.target.value = "";
  }

  async function handleDelete(docId: string) {
    if (!confirm("Delete this document? This cannot be undone.")) return;

    setDeleting(docId);
    setMessage({ text: "", type: "" });

    try {
      const res = await fetch(`/api/tickets/${ticketId}/documents/${docId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setMessage({ text: "Document deleted", type: "success" });
        await fetchDocuments();
      } else {
        const data = await res.json();
        setMessage({ text: data.error || "Failed to delete", type: "error" });
      }
    } catch {
      setMessage({ text: "Failed to delete document", type: "error" });
    }

    setDeleting(null);
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
        Documents
      </h2>

      {/* Upload Form */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-muted">Document Type</label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
          >
            {DOC_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            className={`inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${
              uploading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-primary hover:bg-primary-hover"
            }`}
          >
            {uploading ? "Uploading..." : "Choose File & Upload"}
            <input
              type="file"
              className="hidden"
              disabled={uploading}
              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
              onChange={handleUpload}
            />
          </label>
        </div>
      </div>

      {/* Message */}
      {message.text && (
        <div
          className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
            message.type === "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Document List */}
      <div className="mt-4">
        {loading ? (
          <p className="py-4 text-center text-xs text-muted">Loading documents...</p>
        ) : documents.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted">
            No documents uploaded yet.
          </p>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between rounded-lg border border-border bg-white px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{TYPE_ICONS[doc.fileType] || "📄"}</span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{doc.fileName}</p>
                    <p className="text-xs text-muted">
                      {doc.fileType.replace(/_/g, " ")} &bull; {formatFileSize(doc.fileSize)}{" "}
                      &bull; by {doc.uploadedBy.name} &bull;{" "}
                      {new Date(doc.createdAt).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={doc.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-primary hover:bg-gray-50"
                  >
                    Download
                  </a>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    disabled={deleting === doc.id}
                    className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    {deleting === doc.id ? "..." : "Delete"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
