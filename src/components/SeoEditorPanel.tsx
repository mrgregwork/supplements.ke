import { useState } from "react";

interface Props {
  entityType: "product" | "category" | "subcategory";
  entityId: string;
  initialTitle: string;
  initialDescription: string;
}

const TITLE_MAX = 60;
const DESC_MAX = 160;

function CharCount({ value, max }: { value: string; max: number }) {
  const len = value.length;
  const color =
    len > max ? "text-red-500" : len > max * 0.9 ? "text-amber-500" : "text-green-600";
  return (
    <span className={`text-xs font-mono ${color}`}>
      {len}/{max}
    </span>
  );
}

export default function SeoEditorPanel({
  entityType,
  entityId,
  initialTitle,
  initialDescription,
}: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initialTitle || "");
  const [description, setDescription] = useState(initialDescription || "");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  const save = async () => {
    setSaving(true);
    setStatus("idle");
    try {
      const res = await fetch("/api/admin/seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType, entityId, seoTitle: title, seoDescription: description }),
      });
      if (!res.ok) throw new Error();
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 3000);
    } catch {
      setStatus("error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Trigger button — sits inside the AdminToolbar */}
      <button
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded transition"
        title="Edit SEO"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        SEO
      </button>

      {/* Slide-up panel */}
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-2xl bg-card border border-border shadow-2xl rounded-t-2xl p-6 mb-0 animate-in slide-in-from-bottom duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-semibold text-base">Edit SEO</h2>
                <p className="text-xs text-muted-foreground capitalize">{entityType} page</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground transition"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Meta Title */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium">Meta Title</label>
                <CharCount value={title} max={TITLE_MAX} />
              </div>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Page title shown in Google search results"
              />
              {/* Live Google preview */}
              <p className="mt-1 text-xs text-blue-600 dark:text-blue-400 truncate">
                {title || <span className="italic text-muted-foreground">No title set</span>}
              </p>
            </div>

            {/* Meta Description */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium">Meta Description</label>
                <CharCount value={description} max={DESC_MAX} />
              </div>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                placeholder="Brief description shown under the title in Google search results"
              />
              <p className="mt-1 text-xs text-muted-foreground truncate">
                {description || <span className="italic">No description set</span>}
              </p>
            </div>

            {/* Google SERP preview */}
            <div className="mb-5 p-3 border border-border rounded-lg bg-muted/30">
              <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Google Preview</p>
              <p className="text-[15px] text-blue-700 dark:text-blue-400 font-medium leading-tight truncate">
                {title || "No title"}
              </p>
              <p className="text-xs text-green-700 dark:text-green-500 mb-1">supplements.ke</p>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {description || "No description"}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={save}
                disabled={saving}
                className="px-5 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:opacity-90 transition disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save SEO"}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 text-sm border border-border rounded-md hover:bg-muted transition"
              >
                Cancel
              </button>
              {status === "saved" && (
                <span className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Saved!
                </span>
              )}
              {status === "error" && (
                <span className="text-sm text-red-500">Save failed — try again</span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
