import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Users, Send, MousePointerClick, Eye, AlertTriangle } from "lucide-react";
import { formatPercent } from "@/lib/utils";

export default async function DashboardPage() {
  const user = await requireUser();
  const orgId = user.organizationId;

  const [contactCount, campaignStats, recentCampaigns, suppressedCount] = await Promise.all([
    prisma.contact.count({
      where: { organizationId: orgId, status: "SUBSCRIBED" },
    }),
    prisma.campaign.aggregate({
      where: { organizationId: orgId },
      _sum: {
        sentCount: true,
        openCount: true,
        clickCount: true,
        bounceCount: true,
      },
    }),
    prisma.campaign.findMany({
      where: { organizationId: orgId },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.suppressionEntry.count({ where: { organizationId: orgId } }),
  ]);

  const sent = campaignStats._sum.sentCount ?? 0;
  const opened = campaignStats._sum.openCount ?? 0;
  const clicked = campaignStats._sum.clickCount ?? 0;
  const bounced = campaignStats._sum.bounceCount ?? 0;

  const kpis = [
    {
      label: "Subscribers",
      value: contactCount.toLocaleString(),
      icon: Users,
      hint: `${suppressedCount.toLocaleString()} suppressed`,
    },
    { label: "Emails sent", value: sent.toLocaleString(), icon: Send, hint: "lifetime" },
    { label: "Open rate", value: formatPercent(opened, sent), icon: Eye, hint: `${opened.toLocaleString()} opens` },
    {
      label: "Click rate",
      value: formatPercent(clicked, sent),
      icon: MousePointerClick,
      hint: `${clicked.toLocaleString()} clicks`,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back. Here is what your workspace looks like today.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{k.label}</CardTitle>
              <k.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{k.value}</div>
              <p className="text-xs text-muted-foreground">{k.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {bounced > sent * 0.05 && sent > 100 ? (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="pt-6 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <div>
              <div className="font-medium">High bounce rate detected</div>
              <div className="text-sm text-muted-foreground">
                Over 5% of your recent sends bounced. Review list hygiene and sender reputation.
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Recent campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          {recentCampaigns.length === 0 ? (
            <div className="text-sm text-muted-foreground py-12 text-center">
              No campaigns yet.{" "}
              <Link href="/campaigns/new" className="text-primary hover:underline">
                Create your first one
              </Link>
              .
            </div>
          ) : (
            <div className="space-y-2">
              {recentCampaigns.map((c) => (
                <Link
                  key={c.id}
                  href={`/campaigns/${c.id}`}
                  className="flex items-center gap-4 p-3 rounded-md hover:bg-accent transition"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{c.subject}</div>
                  </div>
                  <Badge
                    variant={
                      c.status === "COMPLETED"
                        ? "success"
                        : c.status === "FAILED"
                          ? "destructive"
                          : c.status === "SENDING"
                            ? "default"
                            : "secondary"
                    }
                  >
                    {c.status}
                  </Badge>
                  <div className="text-sm text-muted-foreground w-24 text-right">
                    {c.sentCount}/{c.totalRecipients}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
