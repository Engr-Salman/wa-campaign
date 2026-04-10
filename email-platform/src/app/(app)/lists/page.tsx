import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default async function ListsPage() {
  const user = await requireUser();
  const lists = await prisma.contactList.findMany({
    where: { organizationId: user.organizationId },
    include: { _count: { select: { members: true } } },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Lists</h1>
          <p className="text-sm text-muted-foreground">Organize contacts into audiences.</p>
        </div>
        <Button asChild>
          <Link href="/lists/new">
            <Plus className="h-4 w-4" /> New list
          </Link>
        </Button>
      </div>
      {lists.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            No lists yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {lists.map((l) => (
            <Card key={l.id}>
              <CardHeader>
                <CardTitle className="text-base">{l.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{l._count.members.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">members</div>
                {l.description && <p className="mt-2 text-sm text-muted-foreground">{l.description}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
