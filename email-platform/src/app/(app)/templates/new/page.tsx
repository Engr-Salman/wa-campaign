"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const DEFAULT_MJML = `<mjml>
  <mj-body background-color="#f6f6f6">
    <mj-section background-color="#ffffff" padding="24px">
      <mj-column>
        <mj-text font-size="20px" font-weight="700">Hi {{first_name}},</mj-text>
        <mj-text>
          Thanks for being part of our community. This is an example template
          you can customize to fit your brand.
        </mj-text>
        <mj-button href="https://example.com" background-color="#2563eb">
          Visit our site
        </mj-button>
        <mj-divider border-color="#e5e7eb" />
        <mj-text font-size="12px" color="#888">
          You can unsubscribe at any time. Preferences: {{preferences_url}}
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;

export default function NewTemplatePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    description: "",
    subject: "",
    preheader: "",
    kind: "MJML" as "MJML" | "HTML",
    source: DEFAULT_MJML,
  });
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      toast.error(data.error ?? "Failed to save");
      return;
    }
    if (data.warnings?.length) {
      toast.warning(`Saved with ${data.warnings.length} warnings`);
    } else {
      toast.success("Template saved");
    }
    router.push("/templates");
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New template</h1>
        <p className="text-sm text-muted-foreground">
          Write MJML or HTML. Use merge tags like <code>{"{{first_name}}"}</code>.
        </p>
      </div>
      <form onSubmit={onSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="preheader">Preheader</Label>
              <Input
                id="preheader"
                value={form.preheader}
                onChange={(e) => setForm({ ...form, preheader: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={form.kind === "MJML" ? "default" : "outline"}
                size="sm"
                onClick={() => setForm({ ...form, kind: "MJML" })}
              >
                MJML
              </Button>
              <Button
                type="button"
                variant={form.kind === "HTML" ? "default" : "outline"}
                size="sm"
                onClick={() => setForm({ ...form, kind: "HTML" })}
              >
                Raw HTML
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Source</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              rows={18}
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              className="font-mono text-xs"
            />
            <div className="flex items-center gap-2 mt-4">
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : "Save template"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPreview(form.source)}
                disabled={form.kind !== "HTML"}
              >
                Preview (HTML only)
              </Button>
            </div>
          </CardContent>
        </Card>

        {preview && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <iframe className="w-full h-96 rounded border" srcDoc={preview} />
            </CardContent>
          </Card>
        )}
      </form>
    </div>
  );
}
