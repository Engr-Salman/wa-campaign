import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { formatPercent } from "@/lib/utils";

export default async function CampaignsPage() {
  const user = await requireUser();
  const campaigns = await prisma.campaign.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
          <p className="text-sm text-muted-foreground">All drafts, scheduled, and completed sends.</p>
        </div>
        <Button asChild>
          <Link href="/campaigns/new">
            <Plus className="h-4 w-4" /> New campaign
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {campaigns.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              No campaigns yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Open</TableHead>
                  <TableHead>Click</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link href={`/campaigns/${c.id}`} className="font-medium hover:underline">
                        {c.name}
                      </Link>
                      <div className="text-xs text-muted-foreground truncate max-w-sm">
                        {c.subject}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          c.status === "COMPLETED"
                            ? "success"
                            : c.status === "FAILED"
                              ? "destructive"
                              : c.status === "SENDING"
                                ? "default"
                                : c.status === "PAUSED"
                                  ? "warning"
                                  : "secondary"
                        }
                      >
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{c.totalRecipients.toLocaleString()}</TableCell>
                    <TableCell>{c.sentCount.toLocaleString()}</TableCell>
                    <TableCell>{formatPercent(c.openCount, c.sentCount)}</TableCell>
                    <TableCell>{formatPercent(c.clickCount, c.sentCount)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(c.updatedAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
