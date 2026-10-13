import { ShieldX } from 'lucide-react';
import { usePageTitle } from '@/context/PageMetaContext';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';

/** Shown when the (demo) role lacks a permission. Real enforcement happens on the server. */
export default function UnauthorizedPage() {
  usePageTitle('Access restricted');
  return (
    <Card className="mx-auto mt-8 max-w-lg text-center">
      <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-danger/10 text-danger">
        <ShieldX className="h-6 w-6" aria-hidden="true" />
      </span>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">403</p>
      <h1 className="mt-1 text-xl font-semibold">You don’t have access to this page</h1>
      <p className="mt-2 text-sm text-muted">
        Your role doesn’t include the permission needed here. Ask a super administrator if you need access.
        (In this demo, role checks only affect what is displayed — the backend will enforce permissions.)
      </p>
      <Button to="/" className="mt-6">
        Back to dashboard
      </Button>
    </Card>
  );
}
