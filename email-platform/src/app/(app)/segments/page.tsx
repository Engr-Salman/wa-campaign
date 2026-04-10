import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Filter } from "lucide-react";

export default async function SegmentsPage() {
  const user = await requireUser();
  const segments = await prisma.segment.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Segments</h1>
        <p className="text-sm text-muted-foreground">
          Dynamic audiences built from filters. Segments re-evaluate on every send.
        </p>
      </div>
      {segments.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            <Filter className="h-8 w-8 mx-auto mb-3 opacity-50" />
            No segments yet. Build your first segment from the Contacts page.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {segments.map((s) => (
            <Card key={s.id}>
              <CardHeader>
                <CardTitle className="text-base">{s.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{s.description}</p>
                <pre className="mt-3 p-3 rounded-md bg-muted text-xs overflow-auto">
                  {JSON.stringify(s.definition, null, 2)}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
