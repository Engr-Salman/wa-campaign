export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid place-items-center bg-muted/30 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2 justify-center">
          <div className="h-8 w-8 rounded-md bg-primary text-primary-foreground grid place-items-center font-bold">
            B
          </div>
          <span className="font-semibold tracking-tight text-lg">BulkMail</span>
        </div>
        {children}
      </div>
    </div>
  );
}
