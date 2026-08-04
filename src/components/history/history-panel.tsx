"use client";

import { useUser } from "@clerk/nextjs";
import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface HistoryItem {
  id: string;
  sourceExcerpt: string;
  level: string;
  tone: string;
  format: string;
  createdAt: string;
}

export function HistoryPanel() {
  const { isLoaded, isSignedIn } = useUser();
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;

    fetch("/api/history")
      .then(async (res) => {
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error ?? "Failed to load history");
        }
        return res.json() as Promise<{ items: HistoryItem[] }>;
      })
      .then((data) => {
        if (!cancelled) setItems(data.items);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load history");
      });

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/history/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setItems((prev) => prev?.filter((item) => item.id !== id) ?? prev);
    } catch {
      toast.error("Couldn't delete that item — try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAll = async () => {
    setClearing(true);
    try {
      const res = await fetch("/api/history", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to clear");
      setItems([]);
      toast.success("History cleared");
    } catch {
      toast.error("Couldn't clear history — try again.");
    } finally {
      setClearing(false);
    }
  };

  if (!isLoaded || !isSignedIn) return null;

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg">Recent translations</h2>
          {items && items.length > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={handleClearAll} disabled={clearing}>
              Clear all
            </Button>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {!error && items === null && (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        )}

        {items?.length === 0 && <p className="text-sm text-muted-foreground">No translations yet — they&apos;ll show up here.</p>}

        {items && items.length > 0 && (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-2 rounded-lg border p-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="font-normal">
                      {item.level}
                    </Badge>
                    <Badge variant="secondary" className="font-normal">
                      {item.tone}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{item.sourceExcerpt}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleDelete(item.id)}
                  disabled={deletingId === item.id}
                  aria-label="Delete this translation"
                  className="shrink-0"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
