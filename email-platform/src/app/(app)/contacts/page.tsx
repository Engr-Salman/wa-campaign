import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserPlus, Upload } from "lucide-react";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string };
}) {
  const user = await requireUser();
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const pageSize = 50;
  const q = searchParams.q ?? "";
  const where = {
    organizationId: user.organizationId,
    ...(q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" as const } },
            { firstName: { contains: q, mode: "insensitive" as const } },
            { lastName: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, contacts] = await Promise.all([
    prisma.contact.count({ where }),
    prisma.contact.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
          <p className="text-sm text-muted-foreground">{total.toLocaleString()} total</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/contacts/import">
              <Upload className="h-4 w-4" /> Import
            </Link>
          </Button>
          <Button asChild>
            <Link href="/contacts/new">
              <UserPlus className="h-4 w-4" /> Add contact
            </Link>
          </Button>
        </div>
      </div>

      <form className="flex gap-2" action="/contacts">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by email or name"
          className="flex h-9 w-full md:max-w-md rounded-md border border-input bg-transparent px-3 text-sm"
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>All contacts</CardTitle>
        </CardHeader>
        <CardContent>
          {contacts.length === 0 ? (
            <div className="text-center py-16 text-sm text-muted-foreground">
              No contacts yet. Import a CSV or add one manually.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Bounce</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.email}</TableCell>
                    <TableCell>
                      {[c.firstName, c.lastName].filter(Boolean).join(" ") || (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          c.status === "SUBSCRIBED"
                            ? "success"
                            : c.status === "UNSUBSCRIBED"
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {c.bounceState === "NONE" ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <Badge variant={c.bounceState === "HARD" ? "destructive" : "warning"}>
                          {c.bounceState}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{c.engagementScore}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {total > pageSize && (
        <div className="flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            Page {page} of {Math.ceil(total / pageSize)}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild disabled={page <= 1}>
              <Link href={`/contacts?q=${encodeURIComponent(q)}&page=${page - 1}`}>Previous</Link>
            </Button>
            <Button variant="outline" size="sm" asChild disabled={page * pageSize >= total}>
              <Link href={`/contacts?q=${encodeURIComponent(q)}&page=${page + 1}`}>Next</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
