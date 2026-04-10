import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function SuppressionPage() {
  const user = await requireUser();
  const entries = await prisma.suppressionEntry.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Suppression list</h1>
        <p className="text-sm text-muted-foreground">
          Emails here will never receive any campaign. Unsubscribes, hard bounces, and complaints
          are added automatically.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recent entries</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              Suppression list is empty — good sign.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead>Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          e.reason === "BOUNCE_HARD" || e.reason === "COMPLAINT"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {e.reason}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{e.note}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(e.createdAt).toLocaleString()}
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
