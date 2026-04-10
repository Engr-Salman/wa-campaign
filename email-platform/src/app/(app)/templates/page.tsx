import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default async function TemplatesPage() {
  const user = await requireUser();
  const templates = await prisma.template.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { updatedAt: "desc" },
  });
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
          <p className="text-sm text-muted-foreground">Reusable email designs with merge tags.</p>
        </div>
        <Button asChild>
          <Link href="/templates/new">
            <Plus className="h-4 w-4" /> New template
          </Link>
        </Button>
      </div>
      {templates.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            No templates yet. Create your first MJML template.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <Card key={t.id}>
              <CardHeader>
                <CardTitle className="text-base">{t.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xs uppercase text-muted-foreground mb-1">{t.kind}</div>
                {t.subject && <div className="text-sm font-medium truncate">{t.subject}</div>}
                {t.description && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{t.description}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
