import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatPercent } from "@/lib/utils";

export default async function CampaignDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireUser();
  const campaign = await prisma.campaign.findFirst({
    where: { id: params.id, organizationId: user.organizationId },
    include: {
      senderAccount: true,
      template: true,
      listTargets: { include: { list: true } },
    },
  });
  if (!campaign) notFound();

  const rate = (n: number) => formatPercent(n, campaign.totalRecipients);

  const stats = [
    { label: "Sent", value: campaign.sentCount, rate: rate(campaign.sentCount) },
    { label: "Delivered", value: campaign.deliveredCount, rate: rate(campaign.deliveredCount) },
    { label: "Opened", value: campaign.openCount, rate: rate(campaign.openCount) },
    { label: "Clicked", value: campaign.clickCount, rate: rate(campaign.clickCount) },
    { label: "Bounced", value: campaign.bounceCount, rate: rate(campaign.bounceCount) },
    { label: "Unsub", value: campaign.unsubCount, rate: rate(campaign.unsubCount) },
    { label: "Failed", value: campaign.failedCount, rate: rate(campaign.failedCount) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-muted-foreground">
            <Link href="/campaigns" className="hover:underline">
              Campaigns
            </Link>{" "}
            / {campaign.name}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">{campaign.name}</h1>
          <div className="flex items-center gap-2 mt-2">
            <Badge
              variant={
                campaign.status === "COMPLETED"
                  ? "success"
                  : campaign.status === "FAILED"
                    ? "destructive"
                    : campaign.status === "SENDING"
                      ? "default"
                      : "secondary"
              }
            >
              {campaign.status}
            </Badge>
            <span className="text-sm text-muted-foreground">{campaign.subject}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {campaign.status === "SENDING" && (
            <form action={`/api/campaigns/${campaign.id}/pause`} method="post">
              <Button variant="outline" type="submit">
                Pause
              </Button>
            </form>
          )}
          {campaign.status === "PAUSED" && (
            <form action={`/api/campaigns/${campaign.id}/resume`} method="post">
              <Button type="submit">Resume</Button>
            </form>
          )}
          {["SCHEDULED", "QUEUED", "SENDING", "PAUSED"].includes(campaign.status) && (
            <form action={`/api/campaigns/${campaign.id}/cancel`} method="post">
              <Button variant="destructive" type="submit">
                Cancel
              </Button>
            </form>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-6">
              <div className="text-xs uppercase text-muted-foreground tracking-wide">{s.label}</div>
              <div className="text-2xl font-bold mt-1">{s.value.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">{s.rate}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <dt className="text-muted-foreground">Sender</dt>
            <dd className="col-span-2">
              {campaign.senderAccount?.name} &lt;{campaign.senderAccount?.fromEmail}&gt;
            </dd>
            <Separator className="col-span-3" />
            <dt className="text-muted-foreground">Template</dt>
            <dd className="col-span-2">{campaign.template?.name ?? "—"}</dd>
            <Separator className="col-span-3" />
            <dt className="text-muted-foreground">Lists</dt>
            <dd className="col-span-2">
              {campaign.listTargets.map((t) => t.list.name).join(", ") || "—"}
            </dd>
            <Separator className="col-span-3" />
            <dt className="text-muted-foreground">Scheduled</dt>
            <dd className="col-span-2">
              {campaign.scheduledAt
                ? new Date(campaign.scheduledAt).toLocaleString()
                : "Immediate"}
            </dd>
            <Separator className="col-span-3" />
            <dt className="text-muted-foreground">Started / Completed</dt>
            <dd className="col-span-2">
              {campaign.startedAt ? new Date(campaign.startedAt).toLocaleString() : "—"} /{" "}
              {campaign.completedAt ? new Date(campaign.completedAt).toLocaleString() : "—"}
            </dd>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
