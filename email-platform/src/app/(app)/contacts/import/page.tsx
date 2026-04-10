"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ImportPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [listId, setListId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<null | {
    imported: number;
    updated: number;
    skipped: number;
    invalid: number;
  }>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return toast.error("Please choose a file");
    setLoading(true);
    const body = new FormData();
    body.append("file", file);
    if (listId) body.append("listId", listId);
    body.append(
      "mapping",
      JSON.stringify({ email: "email", firstName: "first_name", lastName: "last_name" }),
    );
    const res = await fetch("/api/contacts/import", { method: "POST", body });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      toast.error(data.error ?? "Import failed");
      return;
    }
    setResult(data);
    toast.success(`Imported ${data.imported}, updated ${data.updated}`);
    router.refresh();
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Import contacts</h1>
        <p className="text-sm text-muted-foreground">CSV or XLSX. First row should be a header row.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Upload file</CardTitle>
          <CardDescription>
            Required column: <code>email</code>. Optional: <code>first_name</code>, <code>last_name</code>.
            Any other columns become custom attributes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file">File</Label>
              <Input
                id="file"
                type="file"
                accept=".csv,.xlsx,.xls,text/csv"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="listId">List ID (optional)</Label>
              <Input
                id="listId"
                placeholder="cl..."
                value={listId}
                onChange={(e) => setListId(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Importing..." : "Import"}
            </Button>
          </form>

          {result && (
            <div className="mt-6 grid grid-cols-4 gap-3 text-center">
              <div className="p-3 rounded-md bg-success/10">
                <div className="text-xl font-bold text-success">{result.imported}</div>
                <div className="text-xs text-muted-foreground">Imported</div>
              </div>
              <div className="p-3 rounded-md bg-primary/10">
                <div className="text-xl font-bold text-primary">{result.updated}</div>
                <div className="text-xs text-muted-foreground">Updated</div>
              </div>
              <div className="p-3 rounded-md bg-muted">
                <div className="text-xl font-bold">{result.skipped}</div>
                <div className="text-xs text-muted-foreground">Skipped</div>
              </div>
              <div className="p-3 rounded-md bg-destructive/10">
                <div className="text-xl font-bold text-destructive">{result.invalid}</div>
                <div className="text-xs text-muted-foreground">Invalid</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
