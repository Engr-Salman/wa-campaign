"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface Sender {
  id: string;
  name: string;
  fromName: string;
  fromEmail: string;
  status: string;
  lastError?: string | null;
  maxPerHour: number;
}

export default function SendersPage() {
  const [senders, setSenders] = useState<Sender[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [form, setForm] = useState({
    name: "",
    fromName: "",
    fromEmail: "",
    replyTo: "",
    host: "",
    port: 587,
    secure: false,
    username: "",
    password: "",
  });

  async function load() {
    const res = await fetch("/api/senders");
    const data = await res.json();
    setSenders(data.senders ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function createSender(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/senders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        type: "SMTP",
        fromName: form.fromName,
        fromEmail: form.fromEmail,
        replyTo: form.replyTo || undefined,
        config: {
          type: "SMTP",
          host: form.host,
          port: Number(form.port),
          secure: form.secure,
          username: form.username || undefined,
          password: form.password || undefined,
        },
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const d = await res.json();
      toast.error(d.error ?? "Failed");
      return;
    }
    toast.success("Sender created");
    setShowForm(false);
    await load();
  }

  async function testSender(id: string) {
    if (!testTo) return toast.error("Enter a destination email");
    const res = await fetch("/api/senders/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ senderId: id, to: testTo }),
    });
    const d = await res.json();
    if (!res.ok || !d.ok) return toast.error(d.error ?? "Test failed");
    toast.success("Test sent");
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sender accounts</h1>
          <p className="text-sm text-muted-foreground">Connect SMTP or API providers.</p>
        </div>
        <Button onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Cancel" : "Add sender"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>New SMTP sender</CardTitle>
            <CardDescription>Credentials are encrypted at rest with AES-256-GCM.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={createSender} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>From name</Label>
                <Input required value={form.fromName} onChange={(e) => setForm({ ...form, fromName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>From email</Label>
                <Input
                  required
                  type="email"
                  value={form.fromEmail}
                  onChange={(e) => setForm({ ...form, fromEmail: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Reply-to</Label>
                <Input
                  type="email"
                  value={form.replyTo}
                  onChange={(e) => setForm({ ...form, replyTo: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>SMTP host</Label>
                <Input
                  required
                  placeholder="smtp.example.com"
                  value={form.host}
                  onChange={(e) => setForm({ ...form, host: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Port</Label>
                <Input
                  required
                  type="number"
                  value={form.port}
                  onChange={(e) => setForm({ ...form, port: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Username</Label>
                <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.secure}
                  onChange={(e) => setForm({ ...form, secure: e.target.checked })}
                />
                Use SSL/TLS (implicit)
              </label>
              <div className="md:col-span-2">
                <Button type="submit" disabled={loading}>
                  {loading ? "Saving..." : "Save sender"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Existing senders</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {senders.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">No senders yet.</div>
          )}
          {senders.map((s) => (
            <div key={s.id} className="flex items-center justify-between p-3 border rounded-md">
              <div>
                <div className="font-medium">{s.name}</div>
                <div className="text-sm text-muted-foreground">
                  {s.fromName} &lt;{s.fromEmail}&gt;
                </div>
                {s.lastError && <div className="text-xs text-destructive mt-1">{s.lastError}</div>}
              </div>
              <div className="flex items-center gap-3">
                <Badge
                  variant={
                    s.status === "VERIFIED"
                      ? "success"
                      : s.status === "FAILED"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {s.status}
                </Badge>
                <Input
                  placeholder="test@example.com"
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                  className="w-48"
                />
                <Button size="sm" variant="outline" onClick={() => testSender(s.id)}>
                  Test
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
