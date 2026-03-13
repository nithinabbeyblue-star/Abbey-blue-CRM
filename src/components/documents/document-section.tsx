"use client";

import { useState, useEffect, useCallback, useRef } from "react";


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
  PASSPORT: "\u{1F4D8}",
  PHOTO: "\u{1F4F7}",
  BANK_STATEMENT: "\u{1F3E6}",
  VISA_FORM: "\u{1F4CB}",
  SUPPORTING_DOC: "\u{1F4CE}",
  OTHER: "\u{1F4C4}",
};

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "\u2014";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentSection({ ticketId }: { ticketId: string; caseType?: string | null }) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [selectedType, setSelectedType] = useState("OTHER");
  const xhrRef = useRef<XMLHttpRequest | null>(null);

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
    setUploadProgress(0);
    setMessage({ text: "", type: "" });

    try {
      // Try presigned S3 upload first for progress tracking
      let usePresign = false;
      setUploadProgress(5);

      try {
        const presignRes = await fetch("/api/upload/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            mimeType: file.type || "application/octet-stream",
            folder: `tickets/${ticketId}`,
          }),
        });

        if (presignRes.ok) {
          const { uploadUrl, fileKey, fileUrl } = await presignRes.json();
          setUploadProgress(10);

          // Upload directly to S3 with progress tracking
          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhrRef.current = xhr;

            xhr.upload.addEventListener("progress", (ev) => {
              if (ev.lengthComputable) {
                const pct = Math.round(10 + (ev.loaded / ev.total) * 80);
                setUploadProgress(pct);
              }
            });

            xhr.addEventListener("load", () => {
              if (xhr.status >= 200 && xhr.status < 300) resolve();
              else reject(new Error(`S3 upload failed (${xhr.status})`));
            });

            xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
            xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")));

            xhr.open("PUT", uploadUrl);
            xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
            xhr.send(file);
          });

          // Mark presign as successful only after S3 upload completes
          usePresign = true;
          xhrRef.current = null;
          setUploadProgress(92);

          // Save document record in our database
          const saveRes = await fetch(`/api/tickets/${ticketId}/documents`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileName: file.name,
              fileKey,
              fileUrl,
              fileType: selectedType,
              fileSize: file.size,
              mimeType: file.type || "application/octet-stream",
            }),
          });

          if (!saveRes.ok) {
            const errData = await saveRes.json().catch(() => ({ error: "Failed to save" }));
            throw new Error(errData.error || "Failed to save document record");
          }
        }
      } catch (presignErr) {
        // If S3 direct upload failed (e.g. CORS), fall through to FormData server upload
        if (usePresign) throw presignErr;
        console.warn("Presigned upload failed, falling back to server upload:", presignErr);
      }

      // Fallback: FormData upload (server uploads to Google Drive or S3)
      if (!usePresign) {
        setUploadProgress(20);
        const formData = new FormData();
        formData.append("file", file);
        formData.append("fileType", selectedType);

        const res = await fetch(`/api/tickets/${ticketId}/documents`, {
          method: "POST",
          body: formData,
        });

        setUploadProgress(90);

        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: "Upload failed" }));
          throw new Error(errData.error || "Failed to upload document");
        }
      }

      setUploadProgress(100);
      setMessage({ text: "Document uploaded successfully", type: "success" });
      await fetchDocuments();
    } catch (err) {
      const errMsg =
        err instanceof DOMException && err.name === "AbortError"
          ? "Upload cancelled"
          : err instanceof TypeError && err.message === "Failed to fetch"
            ? "Network error. Check your connection and try again."
            : err instanceof Error
              ? err.message
              : "Upload failed";
      setMessage({ text: errMsg, type: "error" });
      console.error("Document upload failed:", err);
    } finally {
      setUploading(false);
      setUploadProgress(0);
      xhrRef.current = null;
      e.target.value = "";
    }
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
        const text = await res.text();
        let errMsg = `Server error (${res.status})`;
        try {
          const json = JSON.parse(text);
          errMsg = json.error || errMsg;
        } catch { /* ignore */ }
        setMessage({ text: errMsg, type: "error" });
      }
    } catch {
      setMessage({ text: "Failed to delete document", type: "error" });
    } finally {
      setDeleting(null);
    }
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

      {/* Upload Progress Bar */}
      {uploading && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px] text-muted">
            <span>
              {uploadProgress < 10
                ? "Preparing..."
                : uploadProgress < 90
                  ? "Uploading to storage..."
                  : uploadProgress < 100
                    ? "Saving record..."
                    : "Complete!"}
            </span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Message */}
      <div className="mt-3 min-h-[32px]">
        {message.text && (
          <div
            className={`rounded-lg border px-3 py-2 text-xs ${
              message.type === "success"
                ? "border-green-200 bg-green-50 text-green-700"
                : message.type === "info"
                  ? "border-blue-200 bg-blue-50 text-blue-700"
                  : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {message.type === "error" && (
              <span className="mr-1 font-semibold">Error:</span>
            )}
            {message.text}
          </div>
        )}
      </div>

      {/* Document List */}
      <div className="mt-1">
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
                  <span className="text-lg">{TYPE_ICONS[doc.fileType] || "\u{1F4C4}"}</span>
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
