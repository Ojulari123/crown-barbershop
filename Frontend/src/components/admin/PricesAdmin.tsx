'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ExternalLink, Plus, Trash2 } from 'lucide-react';
import { cx, type Service, type ServiceCategory } from '@/lib/data';
import { setSlice, uid, useCrown } from '@/lib/store';
import { Button, IconButton, LinkButton, PageHeader, SITE_URL, Switch, inputCls, useToast } from './kit';
type Row = Service & {
  visible: boolean;
};

// Floating "unsaved changes" bar shared by Prices, Hours and Settings.
export function SaveBar({
  dirty,
  onSave,
  onDiscard,
  label = 'Unsaved changes'
}: {
  dirty: boolean;
  onSave: () => void;
  onDiscard: () => void;
  label?: string;
}) {
  return <AnimatePresence>
      {dirty && <motion.div initial={{
      y: 16,
      opacity: 0
    }} animate={{
      y: 0,
      opacity: 1
    }} exit={{
      y: 16,
      opacity: 0,
      transition: {
        duration: 0.12
      }
    }} transition={{
      type: 'spring',
      duration: 0.3,
      bounce: 0
    }} role="region" aria-label="Unsaved changes" className="sticky bottom-20 z-20 mx-auto mt-4 flex w-full max-w-xl items-center justify-between gap-3 rounded-xl bg-[#101828] py-2 pl-4 pr-2 text-white shadow-[0_16px_40px_-12px_rgb(16_24_40/0.5)] md:bottom-5 dark:bg-[#e7eaf0] dark:text-[#101828]">
          <span className="text-[13px] font-medium">{label}</span>
          <span className="flex gap-1.5">
            <button type="button" onClick={onDiscard} className="h-8 rounded-lg px-3 text-[13px] font-medium hover:bg-white/10 dark:hover:bg-black/5 pointer-coarse:h-10">
              Discard
            </button>
            <button type="button" onClick={onSave} className="h-8 rounded-lg bg-white px-3.5 text-[13px] font-semibold text-[#101828] hover:bg-white/90 dark:bg-[#101828] dark:text-white pointer-coarse:h-10">
              Save changes
            </button>
          </span>
        </motion.div>}
    </AnimatePresence>;
}
export function useDirtyGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
}
const GROUPS: {
  id: ServiceCategory;
  label: string;
}[] = [{
  id: 'cuts',
  label: 'Haircuts'
}, {
  id: 'shaves',
  label: 'Shaves & beards'
}];
export function PricesAdmin({
  onDirty
}: {
  onDirty: (d: boolean) => void;
}) {
  const crown = useCrown();
  const toast = useToast();
  const saved: Row[] = crown.services.map(s => ({
    ...s,
    visible: s.visible !== false
  }));
  const [rows, setRows] = useState<Row[]>(saved);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const dirty = JSON.stringify(rows) !== JSON.stringify(saved);
  useDirtyGuard(dirty);
  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  const set = (id: string, p: Partial<Row>) => setRows(xs => xs.map(x => x.id === id ? {
    ...x,
    ...p
  } : x));
  function save() {
    const e: Record<string, string> = {};
    rows.forEach(r => {
      if (!r.name.trim()) e[r.id] = 'Name needed';else if (!(r.price >= 0 && r.price <= 999)) e[r.id] = 'Price 0 to 999';else if (!(r.minutes >= 5 && r.minutes <= 240)) e[r.id] = 'Minutes 5 to 240';
    });
    setErrors(e);
    const first = Object.keys(e)[0];
    if (first) {
      toast({
        text: 'Fix the highlighted rows first.',
        tone: 'error'
      });
      document.getElementById(`svc-name-${first}`)?.focus();
      return;
    }
    setSlice('services', rows.map(r => ({
      ...r,
      name: r.name.trim(),
      detail: r.detail.trim()
    })));
    toast({
      text: 'Prices saved · website updated'
    });
  }
  function addRow(category: ServiceCategory) {
    const id = uid();
    setRows(xs => [...xs, {
      id,
      name: '',
      detail: '',
      minutes: 30,
      price: 25,
      category,
      visible: true
    }]);
    window.setTimeout(() => document.getElementById(`svc-name-${id}`)?.focus(), 30);
  }
  const cell = 'px-3 py-2 align-middle';
  const small = (err?: boolean, extra?: string) => inputCls(err, cx('h-8 text-[13px] pointer-coarse:h-10', extra));
  return <>
      <PageHeader title="Prices" description="What customers see on the price board and booking form." actions={<LinkButton variant="secondary" href={`${SITE_URL}prices`} target="_blank" rel="noreferrer" icon={<ExternalLink className="h-4 w-4" strokeWidth={1.75} />}>
            View on site
          </LinkButton>} />

      <div className="grid gap-4">
        {GROUPS.map(g => {
        const list = rows.filter(r => r.category === g.id);
        return <section key={g.id} aria-labelledby={`grp-${g.id}`} className="overflow-hidden rounded-xl border border-stroke bg-panel">
              <header className="flex items-center justify-between border-b border-stroke px-4 py-2.5">
                <h2 id={`grp-${g.id}`} className="text-[14px] font-semibold text-fg">
                  {g.label} <span className="ml-1 font-normal text-fg-subtle">{list.length}</span>
                </h2>
                <Button size="sm" variant="ghost" icon={<Plus className="h-3.5 w-3.5" strokeWidth={2} />} onClick={() => addRow(g.id)}>
                  Add service
                </Button>
              </header>
              {/* relative: sr-only labels inside the table would otherwise escape the scroller and widen the page */}
              <div className="relative overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-[13px]">
                  <thead className="bg-sunken text-[12px] text-fg-subtle">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-medium">Service</th>
                      <th scope="col" className="px-3 py-2 font-medium">Description</th>
                      <th scope="col" className="w-[96px] px-3 py-2 font-medium">Minutes</th>
                      <th scope="col" className="w-[104px] px-3 py-2 font-medium">Price</th>
                      <th scope="col" className="w-[92px] px-3 py-2 font-medium">On site</th>
                      <th scope="col" className="w-[52px] px-3 py-2"><span className="sr-only">Remove</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stroke">
                    {list.map(r => <tr key={r.id} className={cx(!r.visible && 'bg-sunken/60')}>
                        <td className={cell}>
                          <label htmlFor={`svc-name-${r.id}`} className="sr-only">Service name</label>
                          <input id={`svc-name-${r.id}`} className={small(!!errors[r.id] && !r.name.trim())} value={r.name} onChange={e => set(r.id, {
                      name: e.target.value
                    })} />
                          {errors[r.id] && <p role="alert" className="mt-1 text-[11px] font-medium text-red-600">{errors[r.id]}</p>}
                        </td>
                        <td className={cell}>
                          <label htmlFor={`svc-det-${r.id}`} className="sr-only">Description</label>
                          <input id={`svc-det-${r.id}`} className={small(false)} value={r.detail} onChange={e => set(r.id, {
                      detail: e.target.value
                    })} />
                        </td>
                        <td className={cell}>
                          <label htmlFor={`svc-min-${r.id}`} className="sr-only">Minutes</label>
                          <input id={`svc-min-${r.id}`} type="number" inputMode="numeric" min={5} step={5} className={small(false, 'num')} value={r.minutes} onChange={e => set(r.id, {
                      minutes: Number(e.target.value)
                    })} />
                        </td>
                        <td className={cell}>
                          <label htmlFor={`svc-price-${r.id}`} className="sr-only">Price in dollars</label>
                          <div className="relative">
                            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle">$</span>
                            <input id={`svc-price-${r.id}`} type="number" inputMode="decimal" min={0} className={small(false, 'num pl-6')} value={r.price} onChange={e => set(r.id, {
                        price: Number(e.target.value)
                      })} />
                          </div>
                        </td>
                        <td className={cell}>
                          <Switch hideLabel label={`Show ${r.name || 'service'} on website`} checked={r.visible} onChange={v => set(r.id, {
                      visible: v
                    })} />
                        </td>
                        <td className={cell}>
                          <IconButton label={`Remove ${r.name || 'service'}`} size="sm" icon={<Trash2 className="h-4 w-4" strokeWidth={1.75} />} onClick={() => setRows(xs => xs.filter(x => x.id !== r.id))} />
                        </td>
                      </tr>)}
                  </tbody>
                </table>
              </div>
            </section>;
      })}
      </div>

      <SaveBar dirty={dirty} onSave={save} onDiscard={() => {
      setRows(saved);
      setErrors({});
    }} />
    </>;
}