import { useState } from "react";

interface OrderNote {
  id: string;
  message: string;
  createdByEmail: string;
  createdAt: string;
}

interface Props {
  orderId: string;
  notes: OrderNote[];
}

export default function AdminOrderNotes({ orderId, notes: initialNotes }: Props) {
  const [notes, setNotes] = useState(initialNotes);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submitNote() {
    if (!message.trim()) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add note");
      setNotes((prev) => [...prev, data.note]);
      setMessage("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-card border rounded-lg p-4 space-y-3">
      <h3 className="font-semibold">Notes</h3>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-3 py-2 rounded text-sm">{error}</div>
      )}

      <div className="space-y-2">
        {notes.length === 0 && <p className="text-sm text-muted-foreground">No notes yet.</p>}
        {notes.map((n) => (
          <div key={n.id} className="text-sm border-b last:border-0 pb-2 last:pb-0">
            <p>{n.message}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date(n.createdAt).toLocaleString("en-GB")} &middot; {n.createdByEmail}
            </p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submitNote(); }}
          placeholder="Add a note..."
          className="flex-1 px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          type="button"
          onClick={submitNote}
          disabled={loading || !message.trim()}
          className="px-4 py-2 rounded-lg border bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition disabled:opacity-50"
        >
          {loading ? "Adding..." : "Add"}
        </button>
      </div>
    </div>
  );
}
