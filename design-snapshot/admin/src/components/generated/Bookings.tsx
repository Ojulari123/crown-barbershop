import { useMemo, useState } from 'react';
import { Ban, CalendarPlus, Check, CheckCheck, MessageSquareText, Pencil, Phone, RotateCcw, Search, UserX } from 'lucide-react';
import { cx, fmtTime, torontoNow } from './data';
import { fmtYmd, hoursOn, isDayOff, relativeDay, setSlice, uid, useCrown, ymdPlus, type Booking, type BookingStatus, type CrownState } from './store';
import { DateField } from './DateField';
import { Avatar, Button, Drawer, Empty, Field, IconButton, LinkButton, Menu, PageHeader, Segmented, StatusBadge, inputCls, smsHref, telHref, timeAgo, useToast, type MenuItem } from './kit';

// ---------- shared helpers ----------

export function describe(crown: CrownState, b: Booking) {
  const svc = crown.services.find(s => s.id === b.serviceId);
  const barber = crown.barbers.find(x => x.id === b.barberId);
  return {
    service: svc?.name ?? 'Removed service',
    price: svc?.price,
    minutes: svc?.minutes ?? 30,
    barber: !barber || barber.id === 'any' ? 'First available' : barber.name
  };
}
export function useBookingActions() {
  const toast = useToast();
  return (b: Booking, status: BookingStatus) => {
    const before = b.status;
    setSlice('bookings', list => list.map(x => x.id === b.id ? {
      ...x,
      status
    } : x));
    const verb: Record<BookingStatus, string> = {
      confirmed: 'Confirmed',
      done: 'Marked done',
      cancelled: 'Cancelled',
      'no-show': 'Marked no-show',
      requested: 'Reopened'
    };
    toast({
      text: `${verb[status]} · ${b.name}`,
      undo: () => setSlice('bookings', list => list.map(x => x.id === b.id ? {
        ...x,
        status: before
      } : x))
    });
  };
}

// The one obvious next step for a booking, shown as a button; everything else lives in the menu.
export function primaryAction(b: Booking): {
  label: string;
  status: BookingStatus;
  icon: typeof Check;
} | null {
  if (b.status === 'requested') return {
    label: 'Confirm',
    status: 'confirmed',
    icon: Check
  };
  if (b.status === 'confirmed' && b.date <= torontoNow().ymd) return {
    label: 'Done',
    status: 'done',
    icon: CheckCheck
  };
  return null;
}
export function menuFor(b: Booking, setStatus: (b: Booking, s: BookingStatus) => void, onEdit: (b: Booking) => void): MenuItem[] {
  const items: MenuItem[] = [{
    label: `Call ${b.phone}`,
    icon: <Phone className="h-4 w-4" strokeWidth={1.75} />,
    onSelect: () => {},
    href: telHref(b.phone)
  }, {
    label: 'Send a text',
    icon: <MessageSquareText className="h-4 w-4" strokeWidth={1.75} />,
    onSelect: () => {},
    href: smsHref(b.phone)
  }, {
    label: 'Change details',
    icon: <Pencil className="h-4 w-4" strokeWidth={1.75} />,
    onSelect: () => onEdit(b)
  }, 'divider'];
  if (b.status === 'requested') items.push({
    label: 'Confirm',
    icon: <Check className="h-4 w-4" strokeWidth={1.75} />,
    onSelect: () => setStatus(b, 'confirmed')
  });
  if (b.status === 'confirmed') {
    items.push({
      label: 'Mark done',
      icon: <CheckCheck className="h-4 w-4" strokeWidth={1.75} />,
      onSelect: () => setStatus(b, 'done')
    });
    items.push({
      label: 'Mark no-show',
      icon: <UserX className="h-4 w-4" strokeWidth={1.75} />,
      onSelect: () => setStatus(b, 'no-show')
    });
  }
  if (b.status === 'requested' || b.status === 'confirmed') items.push({
    label: b.status === 'requested' ? 'Decline' : 'Cancel booking',
    icon: <Ban className="h-4 w-4" strokeWidth={1.75} />,
    danger: true,
    onSelect: () => setStatus(b, 'cancelled')
  });else items.push({
    label: 'Reopen',
    icon: <RotateCcw className="h-4 w-4" strokeWidth={1.75} />,
    onSelect: () => setStatus(b, b.status === 'done' ? 'confirmed' : 'requested')
  });
  return items;
}

// ---------- detail drawer ----------

export function BookingDetail({
  id,
  onClose,
  onEdit
}: {
  id: string | null;
  onClose: () => void;
  onEdit: (b: Booking) => void;
}) {
  const crown = useCrown();
  const setStatus = useBookingActions();
  const b = crown.bookings.find(x => x.id === id) ?? null;
  const d = b ? describe(crown, b) : null;
  const act = b ? primaryAction(b) : null;
  return <Drawer open={!!b} onClose={onClose} title={b?.name ?? ''} subtitle={b && `${relativeDay(b.date)} at ${fmtTime(b.time)}`} footer={b && <>
            {(b.status === 'requested' || b.status === 'confirmed') && <Button variant="danger" onClick={() => setStatus(b, 'cancelled')}>
                {b.status === 'requested' ? 'Decline' : 'Cancel'}
              </Button>}
            <Button variant="secondary" icon={<Pencil className="h-4 w-4" strokeWidth={1.75} />} onClick={() => onEdit(b)}>
              Change
            </Button>
            {act && <Button variant="primary" icon={<act.icon className="h-4 w-4" strokeWidth={2} />} onClick={() => setStatus(b, act.status)}>
                {act.label}
              </Button>}
          </>}>
      {b && d && <div className="grid gap-5">
          <div className="flex items-center justify-between gap-3">
            <StatusBadge status={b.status} />
            <span className="text-[12px] text-fg-subtle">
              {b.source === 'online' ? 'Booked on the website' : b.source === 'phone' ? 'Booked by phone' : 'Walk-in'} · {timeAgo(b.createdAt)} ago
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <LinkButton variant="secondary" href={telHref(b.phone)} icon={<Phone className="h-4 w-4" strokeWidth={1.75} />}>
              Call
            </LinkButton>
            <LinkButton variant="secondary" href={smsHref(b.phone)} icon={<MessageSquareText className="h-4 w-4" strokeWidth={1.75} />}>
              Text
            </LinkButton>
          </div>
          <dl className="divide-y divide-stroke rounded-lg border border-stroke">
            {[['Phone', <span className="num">{b.phone}</span>], ['Service', `${d.service}${d.price != null ? ` · $${d.price}` : ''}`], ['Length', `${d.minutes} min`], ['Barber', d.barber], ['When', `${fmtYmd(b.date)} · ${fmtTime(b.time)}`]].map(([k, v]) => <div key={k as string} className="flex items-center justify-between gap-4 px-3.5 py-2.5 text-[13px]">
                <dt className="text-fg-subtle">{k}</dt>
                <dd className="text-right font-medium text-fg">{v}</dd>
              </div>)}
          </dl>
          {b.note && <div>
              <p className="text-[12px] font-medium text-fg-subtle">Note from customer</p>
              <p className="mt-1 rounded-lg bg-sunken px-3.5 py-2.5 text-[14px] text-fg">{b.note}</p>
            </div>}
        </div>}
    </Drawer>;
}

// ---------- add / change form ----------

type Draft = Omit<Booking, 'id' | 'createdAt'>;
export function BookingForm({
  open,
  editing,
  onClose,
  preset
}: {
  open: boolean;
  editing: Booking | null;
  onClose: () => void;
  preset?: Partial<Omit<Booking, 'id' | 'createdAt'>>;
}) {
  const crown = useCrown();
  const toast = useToast();
  const blank = (): Draft => ({
    name: '',
    phone: '',
    note: '',
    serviceId: crown.services[0]?.id ?? '',
    barberId: crown.barbers[0]?.id ?? 'any',
    date: torontoNow().ymd,
    time: 600,
    status: 'confirmed',
    source: 'phone',
    ...preset
  });
  const [d, setD] = useState<Draft>(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const key = open ? editing?.id ?? 'new' : null;
  if (key !== openedFor) {
    setOpenedFor(key);
    if (open) {
      setD(editing ? {
        ...editing
      } : blank());
      setErrors({});
    }
  }
  const svc = crown.services.find(s => s.id === d.serviceId);
  const ranges = hoursOn(crown, d.date);
  const slots = useMemo(() => {
    const out: number[] = [];
    for (const [a, b] of ranges) for (let m = a; m + (svc?.minutes ?? 30) <= b; m += 15) out.push(m);
    return out;
  }, [ranges, svc?.minutes]);
  const set = <K extends keyof Draft,>(k: K, v: Draft[K]) => setD(x => ({
    ...x,
    [k]: v
  }));
  function save() {
    const e: Record<string, string> = {};
    if (d.name.trim().length < 2) e.name = 'Enter the customer name.';
    if (d.phone.replace(/\D/g, '').length < 10) e.phone = 'Enter a 10-digit phone number.';
    if (!ranges.length) e.date = isDayOff(crown, d.date) ? 'That date is marked as a day off.' : 'The shop is closed that day.';else if (!slots.includes(d.time)) e.time = 'Pick a time within opening hours.';
    setErrors(e);
    const first = Object.keys(e)[0];
    if (first) return document.getElementById(`bf-${first}`)?.focus();
    const clean = {
      ...d,
      name: d.name.trim(),
      phone: d.phone.trim(),
      note: d.note.trim()
    };
    if (editing) {
      setSlice('bookings', l => l.map(x => x.id === editing.id ? {
        ...x,
        ...clean
      } : x));
      toast({
        text: `Saved changes · ${clean.name}`
      });
    } else {
      const r = setSlice('bookings', l => [...l, {
        ...clean,
        id: uid(),
        createdAt: Date.now()
      }]);
      if (!r.ok && r.reason === 'full') return toast({
        text: 'Could not save: demo storage is full.',
        tone: 'error'
      });
      toast({
        text: `Booking added · ${clean.name}`
      });
    }
    onClose();
  }
  return <Drawer open={open} onClose={onClose} title={editing ? 'Change booking' : 'New booking'} subtitle={editing ? editing.name : 'For phone calls and walk-ins'} footer={<>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save}>
            {editing ? 'Save changes' : 'Add booking'}
          </Button>
        </>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Customer name" id="bf-name" error={errors.name} className="sm:col-span-2">
          <input id="bf-name" autoComplete="off" className={inputCls(!!errors.name)} value={d.name} onChange={e => set('name', e.target.value)} />
        </Field>
        <Field label="Phone" id="bf-phone" error={errors.phone} className="sm:col-span-2">
          <input id="bf-phone" type="tel" inputMode="tel" autoComplete="off" className={inputCls(!!errors.phone, 'num')} value={d.phone} onChange={e => set('phone', e.target.value)} />
        </Field>
        <Field label="Service" id="bf-service" className="sm:col-span-2">
          <select id="bf-service" className={inputCls()} value={d.serviceId} onChange={e => set('serviceId', e.target.value)}>
            {crown.services.map(s => <option key={s.id} value={s.id}>
                {s.name} · ${s.price} · {s.minutes} min
              </option>)}
          </select>
        </Field>
        <Field label="Date" id="bf-date" error={errors.date}>
          <DateField id="bf-date" value={d.date} min={ymdPlus(-30)} max={ymdPlus(120)} invalid={!!errors.date} stateOf={ymd => isDayOff(crown, ymd) ? 'off' : hoursOn(crown, ymd).length ? 'normal' : 'closed'} onChange={v => v && set('date', v)} />
        </Field>
        <Field label="Time" id="bf-time" error={errors.time}>
          <select id="bf-time" className={inputCls(!!errors.time, 'num')} value={d.time} disabled={!slots.length} onChange={e => set('time', Number(e.target.value))}>
            {!slots.includes(d.time) && <option value={d.time}>{slots.length ? 'Pick a time' : 'Closed'}</option>}
            {slots.map(m => <option key={m} value={m}>
                {fmtTime(m)}
              </option>)}
          </select>
        </Field>
        <Field label="Barber" id="bf-barber">
          <select id="bf-barber" className={inputCls()} value={d.barberId} onChange={e => set('barberId', e.target.value)}>
            {crown.barbers.map(b => <option key={b.id} value={b.id}>
                {b.name}
              </option>)}
          </select>
        </Field>
        <Field label="Booked by" id="bf-source">
          <select id="bf-source" className={inputCls()} value={d.source} onChange={e => set('source', e.target.value as Draft['source'])}>
            <option value="phone">Phone call</option>
            <option value="walk-in">Walk-in</option>
            <option value="online">Website</option>
          </select>
        </Field>
        <Field label="Note" id="bf-note" className="sm:col-span-2">
          <textarea id="bf-note" rows={3} className={inputCls(false, 'h-auto py-2')} value={d.note} onChange={e => set('note', e.target.value)} />
        </Field>
      </div>
    </Drawer>;
}

// ---------- bookings page ----------

type Tab = 'requests' | 'upcoming' | 'past';
export function BookingsView() {
  const crown = useCrown();
  const setStatus = useBookingActions();
  const today = torontoNow().ymd;
  const [tab, setTab] = useState<Tab>(() => crown.bookings.some(b => b.status === 'requested') ? 'requests' : 'upcoming');
  const [q, setQ] = useState('');
  const [detail, setDetail] = useState<string | null>(null);
  const [form, setForm] = useState<{
    open: boolean;
    editing: Booking | null;
  }>({
    open: false,
    editing: null
  });
  const edit = (b: Booking) => {
    setDetail(null);
    setForm({
      open: true,
      editing: b
    });
  };
  const counts = {
    requests: crown.bookings.filter(b => b.status === 'requested').length,
    upcoming: crown.bookings.filter(b => b.status === 'confirmed' && b.date >= today).length,
    past: crown.bookings.filter(b => b.date < today || ['done', 'cancelled', 'no-show'].includes(b.status)).length
  };
  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const digits = needle.replace(/\D/g, '');
    const inTab = (b: Booking) => tab === 'requests' ? b.status === 'requested' : tab === 'upcoming' ? b.status === 'confirmed' && b.date >= today : b.date < today || ['done', 'cancelled', 'no-show'].includes(b.status);
    const match = (b: Booking) => !needle || b.name.toLowerCase().includes(needle) || digits.length >= 3 && b.phone.replace(/\D/g, '').includes(digits);
    const list = crown.bookings.filter(b => inTab(b) && match(b));
    list.sort((a, b) => tab === 'past' ? b.date.localeCompare(a.date) || b.time - a.time : a.date.localeCompare(b.date) || a.time - b.time);
    const map = new Map<string, Booking[]>();
    list.forEach(b => map.set(b.date, [...(map.get(b.date) ?? []), b]));
    return [...map.entries()];
  }, [crown.bookings, tab, q, today]);
  return <>
      <PageHeader title="Bookings" description="Requests from the website, phone bookings and walk-ins." actions={<Button variant="primary" icon={<CalendarPlus className="h-4 w-4" strokeWidth={1.75} />} onClick={() => setForm({
      open: true,
      editing: null
    })}>
            New booking
          </Button>} />

      <div className="overflow-hidden rounded-xl border border-stroke bg-panel">
        <div className="flex flex-col gap-3 border-b border-stroke p-3 md:flex-row md:items-center md:justify-between">
          <Segmented label="Booking lists" value={tab} onChange={setTab} options={[{
          id: 'requests',
          label: 'To confirm',
          count: counts.requests
        }, {
          id: 'upcoming',
          label: 'Upcoming',
          count: counts.upcoming
        }, {
          id: 'past',
          label: 'Past',
          count: counts.past
        }]} />
          <label className="relative block md:w-72">
            <span className="sr-only">Search by name or phone</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" strokeWidth={1.75} aria-hidden="true" />
            <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search name or phone…" className={inputCls(false, 'pl-9')} />
          </label>
        </div>

        {groups.length === 0 ? <Empty icon={<CalendarPlus className="h-5 w-5" strokeWidth={1.75} />} title={q ? 'No matches' : tab === 'requests' ? 'Nothing to confirm' : 'No bookings here yet'} body={q ? 'Try part of the name, or the last 4 digits of the phone number.' : 'New website requests land in "To confirm".'} /> : <table className="w-full text-left text-[13px]">
            <thead className="hidden border-b border-stroke bg-sunken text-[12px] font-medium text-fg-subtle md:table-header-group">
              <tr>
                <th scope="col" className="w-[120px] px-4 py-2 font-medium">
                  Time
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Customer
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Service
                </th>
                <th scope="col" className="hidden px-4 py-2 font-medium lg:table-cell">
                  Barber
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Status
                </th>
                <th scope="col" className="w-[150px] px-4 py-2 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            {groups.map(([date, list]) => <tbody key={date} className="border-b border-stroke last:border-0">
                <tr>
                  <th colSpan={6} scope="colgroup" className="bg-panel px-4 pb-1 pt-4 text-left">
                    <span className="text-[13px] font-semibold text-fg">{relativeDay(date)}</span>
                    <span className="ml-2 text-[12px] font-normal text-fg-subtle">
                      {fmtYmd(date, {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric'
                })} · {list.length} booking{list.length === 1 ? '' : 's'}
                    </span>
                  </th>
                </tr>
                {list.map(b => {
            const d = describe(crown, b);
            const act = primaryAction(b);
            return <tr key={b.id} onClick={() => setDetail(b.id)} className="group cursor-pointer border-t border-stroke/70 first:border-0 hover:bg-sunken">
                      <td className="num whitespace-nowrap px-4 py-2.5 align-middle font-semibold text-fg">{fmtTime(b.time)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={b.name} size="sm" />
                          <div className="min-w-0">
                            <button type="button" onClick={() => setDetail(b.id)} className="block truncate text-left font-medium text-fg hover:underline focus-visible:underline">
                              {b.name}
                            </button>
                            <div className="num text-[12px] text-fg-subtle">{b.phone}</div>
                            {/* phones: service + status under the name */}
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 md:hidden">
                              <span className="text-[12px] text-fg-muted">{d.service}</span>
                              <StatusBadge status={b.status} />
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-4 py-2.5 md:table-cell">
                        <div className="text-fg">{d.service}</div>
                        <div className="num text-[12px] text-fg-subtle">
                          {d.price != null && `$${d.price} · `}
                          {d.minutes} min
                        </div>
                      </td>
                      <td className="hidden px-4 py-2.5 text-fg-muted lg:table-cell">{d.barber}</td>
                      <td className="hidden px-4 py-2.5 md:table-cell">
                        <StatusBadge status={b.status} />
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                          {act && <Button size="sm" variant={act.status === 'confirmed' ? 'primary' : 'secondary'} icon={<act.icon className="h-3.5 w-3.5" strokeWidth={2} />} onClick={() => setStatus(b, act.status)}>
                              <span className="hidden sm:inline">{act.label}</span>
                            </Button>}
                          <IconButton label={`Call ${b.name}`} size="sm" icon={<Phone className="h-4 w-4" strokeWidth={1.75} />} onClick={() => window.location.href = telHref(b.phone)} className={cx('hidden sm:inline-flex')} />
                          <Menu items={menuFor(b, setStatus, edit)} label={`More actions for ${b.name}`} />
                        </div>
                      </td>
                    </tr>;
          })}
              </tbody>)}
          </table>}
      </div>

      <BookingDetail id={detail} onClose={() => setDetail(null)} onEdit={edit} />
      <BookingForm open={form.open} editing={form.editing} onClose={() => setForm(f => ({
      ...f,
      open: false
    }))} />
    </>;
}