import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";

export default async function SettingsPage() {
  const user = await requireUser();
  const org = await prisma.organization.findUnique({
    where: { id: user.organizationId },
  });
  if (!org) return null;
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Workspace, compliance, and team configuration.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
          <CardDescription>Shown in email footers and legal notices.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <dt className="text-muted-foreground">Name</dt>
            <dd className="col-span-2">{org.name}</dd>
            <Separator className="col-span-3" />
            <dt className="text-muted-foreground">Slug</dt>
            <dd className="col-span-2">{org.slug}</dd>
            <Separator className="col-span-3" />
            <dt className="text-muted-foreground">Legal name</dt>
            <dd className="col-span-2">{org.legalName ?? "—"}</dd>
            <Separator className="col-span-3" />
            <dt className="text-muted-foreground">Address</dt>
            <dd className="col-span-2">
              {[org.addressLine1, org.city, org.country].filter(Boolean).join(", ") || "—"}
            </dd>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Compliance</CardTitle>
          <CardDescription>These defaults protect your sender reputation and legal posture.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li>
              <span className="text-muted-foreground">Enforce unsubscribe footer:</span>{" "}
              {org.enforceUnsubFooter ? "Enabled" : "Disabled"}
            </li>
            <li>
              <span className="text-muted-foreground">Require double opt-in:</span>{" "}
              {org.requireDoubleOptIn ? "Enabled" : "Disabled"}
            </li>
            <li>
              <span className="text-muted-foreground">Large-send confirmation threshold:</span>{" "}
              {org.largeSendThreshold.toLocaleString()}
            </li>
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            This workspace operates under best-effort CAN-SPAM / GDPR compliance. You remain
            responsible for obtaining proper consent from your recipients.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Diagnostics</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <Link href="/api/health" className="text-primary hover:underline" target="_blank">
            Health check →
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
