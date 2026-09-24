import { useState } from 'react';
import { Download, LogOut, RotateCcw } from 'lucide-react';
import { fmtTime } from './data';
import { resetDemo, useCrown } from './store';
import { Avatar, Button, Confirm, PageHeader, Panel, useToast } from './kit';
import type { Session } from './Login';
export function SettingsAdmin({
  session,
  onSignOut
}: {
  session: Session;
  onSignOut: () => void;
}) {
  const crown = useCrown();
  const toast = useToast();
  const [confirmReset, setConfirmReset] = useState(false);
  function exportCsv() {
    const svc = new Map(crown.services.map(s => [s.id, s]));
    const bar = new Map(crown.barbers.map(b => [b.id, b.name]));
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = [['Date', 'Time', 'Name', 'Phone', 'Service', 'Price', 'Barber', 'Status', 'Booked by', 'Note'], ...[...crown.bookings].sort((a, b) => a.date.localeCompare(b.date) || a.time - b.time).map(b => [b.date, fmtTime(b.time), b.name, b.phone, svc.get(b.serviceId)?.name ?? '', String(svc.get(b.serviceId)?.price ?? ''), bar.get(b.barberId) ?? '', b.status, b.source, b.note])];
    const blob = new Blob([rows.map(r => r.map(c => esc(String(c))).join(',')).join('\n')], {
      type: 'text/csv'
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `crown-bookings-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast({
      text: 'Bookings downloaded (CSV)'
    });
  }
  return <>
      <PageHeader title="Settings" description="Your account and the shop's records." />
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Account" bodyClass="grid gap-3 p-4">
          <div className="flex items-center gap-3">
            <Avatar name={session.name} />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-fg">{session.name}</p>
              <p className="truncate text-[12px] text-fg-subtle">{session.email}</p>
            </div>
          </div>
          <p className="text-[12px] text-fg-subtle">Password changes and staff logins arrive with the live version.</p>
          <Button variant="secondary" className="justify-self-start" icon={<LogOut className="h-4 w-4" strokeWidth={1.75} />} onClick={onSignOut}>
            Sign out
          </Button>
        </Panel>
        <Panel title="Records" bodyClass="grid gap-3 p-4">
          <p className="text-[13px] text-fg-muted">Every booking as a spreadsheet, with prices, for the books or taxes. Opens in Excel or Numbers.</p>
          <Button variant="secondary" className="justify-self-start" icon={<Download className="h-4 w-4" strokeWidth={1.75} />} onClick={exportCsv}>
            Download {crown.bookings.length} bookings
          </Button>
          <div className="mt-2 border-t border-stroke pt-3">
            <p className="text-[13px] text-fg-muted">Demo data lives in this browser only. Reset puts the samples back.</p>
            <Button variant="danger" className="mt-2" icon={<RotateCcw className="h-4 w-4" strokeWidth={1.75} />} onClick={() => setConfirmReset(true)}>
              Reset demo data
            </Button>
          </div>
        </Panel>
      </div>
      <Confirm open={confirmReset} title="Reset all demo data?" body="Bookings, messages, photos, prices, hours and profiles go back to the starting samples. This cannot be undone." confirmLabel="Reset everything" onCancel={() => setConfirmReset(false)} onConfirm={() => {
      resetDemo();
      setConfirmReset(false);
      toast({
        text: 'Demo data reset'
      });
    }} />
    </>;
}