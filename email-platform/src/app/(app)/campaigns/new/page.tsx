"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Option {
  id: string;
  name: string;
}

// Step-by-step campaign wizard: details → audience → content → review.
// Backed entirely by REST endpoints — no server actions so state stays
// easy to reason about.
export default function NewCampaignPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [senders, setSenders] = useState<Option[]>([]);
  const [templates, setTemplates] = useState<Option[]>([]);
  const [lists, setLists] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    subject: "",
    preheader: "",
    senderAccountId: "",
    templateId: "",
    listIds: [] as string[],
    scheduledAt: "" as string,
    utmSource: "newsletter",
    utmMedium: "email",
    utmCampaign: "",
  });

  useEffect(() => {
    (async () => {
      const [s, t, l] = await Promise.all([
        fetch("/api/senders").then((r) => r.json()),
        fetch("/api/templates").then((r) => r.json()),
        fetch("/api/lists").then((r) => r.json()),
      ]);
      setSenders(s.senders ?? []);
      setTemplates(t.templates ?? []);
      setLists(l.lists ?? []);
    })();
  }, []);

  async function createAndLaunch() {
    setLoading(true);
    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        segmentIds: [],
        abEnabled: false,
        abSplitPercent: 20,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined,
      }),
    });
    if (!res.ok) {
      setLoading(false);
      const d = await res.json();
      toast.error(d.error ?? "Failed to create campaign");
      return;
    }
    const { id } = await res.json();
    const launch = await fetch(`/api/campaigns/${id}/launch`, { method: "POST" });
    setLoading(false);
    if (!launch.ok) {
      toast.warning("Campaign created but launch failed — edit before launching");
      router.push(`/campaigns/${id}`);
      return;
    }
    toast.success("Campaign launched");
    router.push(`/campaigns/${id}`);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New campaign</h1>
        <p className="text-sm text-muted-foreground">Step {step} of 4</p>
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
            <CardDescription>Name your campaign and pick a sender.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Sender account</Label>
              <select
                value={form.senderAccountId}
                onChange={(e) => setForm({ ...form, senderAccountId: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                required
              >
                <option value="">Select...</option>
                {senders.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end">
              <Button
                disabled={!form.name || !form.senderAccountId}
                onClick={() => setStep(2)}
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Audience</CardTitle>
            <CardDescription>Pick one or more contact lists.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {lists.map((l) => (
                <label key={l.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.listIds.includes(l.id)}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        listIds: e.target.checked
                          ? [...form.listIds, l.id]
                          : form.listIds.filter((x) => x !== l.id),
                      })
                    }
                  />
                  {l.name}
                </label>
              ))}
              {lists.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No lists available. Create one in the Lists page first.
                </p>
              )}
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button disabled={form.listIds.length === 0} onClick={() => setStep(3)}>
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Content</CardTitle>
            <CardDescription>Subject, preheader, and template.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Preheader</Label>
              <Input
                value={form.preheader}
                onChange={(e) => setForm({ ...form, preheader: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Template</Label>
              <select
                value={form.templateId}
                onChange={(e) => setForm({ ...form, templateId: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="">Select...</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button
                disabled={!form.subject || !form.templateId}
                onClick={() => setStep(4)}
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Review &amp; launch</CardTitle>
            <CardDescription>
              Launch immediately or schedule a future send.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid grid-cols-3 gap-3 text-sm">
              <dt className="text-muted-foreground">Name</dt>
              <dd className="col-span-2">{form.name}</dd>
              <dt className="text-muted-foreground">Subject</dt>
              <dd className="col-span-2">{form.subject}</dd>
              <dt className="text-muted-foreground">Lists</dt>
              <dd className="col-span-2">{form.listIds.length} selected</dd>
            </dl>
            <div className="space-y-2">
              <Label>Schedule (optional)</Label>
              <Input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to send immediately.
              </p>
            </div>
            <div className="p-3 rounded-md bg-warning/10 text-sm border border-warning/30">
              Double-check your audience. Once launched, unsubscribed and suppressed
              contacts will be skipped automatically.
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(3)}>
                Back
              </Button>
              <Button onClick={createAndLaunch} disabled={loading}>
                {loading ? "Launching..." : form.scheduledAt ? "Schedule" : "Launch now"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
