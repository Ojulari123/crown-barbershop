'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Camera, ExternalLink, ImagePlus, Plus, Scissors, Trash2, UserRound, X } from 'lucide-react';
import { BARBERS, cx, type Barber } from '@/lib/data';
import { setSlice, uid, uploadImage, useCrown } from '@/lib/store';
import { Avatar, Button, Confirm, Field, LinkButton, PageHeader, Panel, SITE_URL, inputCls, useToast } from './kit';
import { SaveBar, useDirtyGuard } from './PricesAdmin';

// Portrait photos are shrunk to 900px so they sit comfortably in demo storage.
async function toPhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const s = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * s);
    c.height = Math.round(img.naturalHeight * s);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.84);
  } finally {
    URL.revokeObjectURL(url);
  }
}
function Specialties({
  value,
  onChange
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const t = draft.trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setDraft('');
  };
  return <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg bg-panel px-2 py-1.5 ring-1 ring-inset ring-stroke-strong focus-within:ring-2 focus-within:ring-accent">
      {value.map(sp => <span key={sp} className="inline-flex h-7 items-center gap-1 rounded-md bg-accent-soft pl-2 pr-1 text-[13px] font-medium text-accent">
          {sp}
          <button type="button" aria-label={`Remove ${sp}`} onClick={() => onChange(value.filter(x => x !== sp))} className="flex h-5 w-5 items-center justify-center rounded hover:bg-accent/10">
            <X className="h-3 w-3" strokeWidth={2.5} />
          </button>
        </span>)}
      <input id="tm-spec" value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        add();
      } else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
    }} onBlur={add} placeholder={value.length ? 'Add another…' : 'e.g. Skin fades, then press Enter'} className="h-7 min-w-[160px] flex-1 bg-transparent px-1 text-[14px] text-fg placeholder:text-fg-subtle focus:outline-none" />
    </div>;
}
export function TeamAdmin({
  onDirty
}: {
  onDirty: (d: boolean) => void;
}) {
  const crown = useCrown();
  const toast = useToast();
  const [team, setTeam] = useState<Barber[]>(crown.barbers);
  const [sel, setSel] = useState<string>(() => crown.barbers.find(b => b.id !== 'any')?.id ?? 'any');
  const [remove, setRemove] = useState<Barber | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const dirty = JSON.stringify(team) !== JSON.stringify(crown.barbers);
  useDirtyGuard(dirty);
  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  const b = team.find(x => x.id === sel) ?? team[0];
  const set = (p: Partial<Barber>) => setTeam(t => t.map(x => x.id === b.id ? {
    ...x,
    ...p
  } : x));
  const real = team.filter(x => x.id !== 'any');
  const bio = b?.bio ?? BARBERS.find(x => x.id === b?.id)?.bio ?? '';
  function save() {
    if (team.some(x => !x.name.trim())) return toast({
      text: 'Every barber needs a name.',
      tone: 'error'
    });
    const r = setSlice('barbers', team.map(x => ({
      ...x,
      name: x.name.trim(),
      note: x.note.trim(),
      bio: x.bio?.trim()
    })));
    if (!r.ok && r.reason === 'full') return toast({
      text: 'Not enough demo storage for that photo. Try a smaller one.',
      tone: 'error'
    });
    toast({
      text: 'Saved · About page and booking updated'
    });
  }
  function addBarber() {
    const id = uid();
    setTeam(t => [...t, {
      id,
      name: '',
      note: '',
      role: 'Barber',
      bio: '',
      specialties: []
    }]);
    setSel(id);
    window.setTimeout(() => document.getElementById('tm-name')?.focus(), 30);
  }
  async function onFile(f?: File) {
    if (!f) return;
    if (!f.type.startsWith('image/')) return toast({
      text: 'Choose a photo (JPG or PNG).',
      tone: 'error'
    });
    try {
      set({
        // Uploaded right away so the draft holds the stored URL (Save then compares URL to URL).
        photo: await uploadImage(await toPhoto(f), 'portrait')
      });
    } catch {
      toast({
        text: 'That photo could not be opened. Try a JPG.',
        tone: 'error'
      });
    }
  }
  return <>
      <PageHeader title="Behind the chair" description="The barber profiles on the website's About page, plus who customers can pick when booking." actions={<>
            <LinkButton variant="secondary" href={`${SITE_URL}about`} target="_blank" rel="noreferrer" icon={<ExternalLink className="h-4 w-4" strokeWidth={1.75} />}>
              View on site
            </LinkButton>
            <Button variant="primary" icon={<Plus className="h-4 w-4" strokeWidth={2} />} onClick={addBarber}>
              Add barber
            </Button>
          </>} />

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* team list */}
        <Panel title="Team" bodyClass="p-2">
          <ul className="grid gap-1">
            {team.map(x => <li key={x.id}>
                <button type="button" onClick={() => setSel(x.id)} aria-current={sel === x.id ? 'true' : undefined} className={cx('flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left', sel === x.id ? 'bg-accent-soft' : 'hover:bg-sunken')}>
                  {x.photo ? <img src={x.photo} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" /> : x.id === 'any' ? <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sunken text-fg-subtle ring-1 ring-stroke">
                      <UserRound className="h-4 w-4" strokeWidth={1.75} />
                    </span> : <Avatar name={x.name || '?'} />}
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium text-fg">{x.name || 'New barber'}</span>
                    <span className="block truncate text-[12px] text-fg-subtle">{x.id === 'any' ? 'Booking option' : x.role || 'Barber'}</span>
                  </span>
                </button>
              </li>)}
          </ul>
        </Panel>

        {b && <div className="grid gap-4">
            <Panel title={b.id === 'any' ? '"First available" option' : b.name || 'New barber'} action={b.id !== 'any' && <Button size="sm" variant="ghost" icon={<Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />} onClick={() => setRemove(b)}>
                    Remove
                  </Button>} bodyClass="p-4 md:p-5">
              {b.id === 'any' ? <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Label" id="tm-name">
                    <input id="tm-name" className={inputCls()} value={b.name} onChange={e => set({
                name: e.target.value
              })} />
                  </Field>
                  <Field label="Line under it" id="tm-note">
                    <input id="tm-note" className={inputCls()} value={b.note} onChange={e => set({
                note: e.target.value
              })} />
                  </Field>
                </div> : <div className="grid gap-6 md:grid-cols-[200px_minmax(0,1fr)]">
                  {/* photo */}
                  <div>
                    <p className="mb-1.5 text-[13px] font-medium text-fg">Photo</p>
                    <div onDragOver={e => e.preventDefault()} onDrop={e => {
                e.preventDefault();
                onFile(e.dataTransfer.files[0]);
              }} className="relative overflow-hidden rounded-t-[999px] rounded-b-xl bg-gradient-to-b from-[#eef3fa] to-[#c9d6ec] ring-1 ring-stroke">
                      <div className="aspect-[4/5]">
                        {b.photo ? <img src={b.photo} alt={`${b.name} portrait`} className="h-full w-full object-cover" /> : <span className="flex h-full w-full flex-col items-center justify-center gap-2 text-[#14215c]">
                            <span className="font-display text-[72px] italic leading-none">{(b.name || '?')[0]}</span>
                            <span className="text-[12px] font-medium opacity-70">No photo yet</span>
                          </span>}
                      </div>
                    </div>
                    <input ref={file} type="file" accept="image/*" className="sr-only" id="tm-photo" onChange={e => onFile(e.target.files?.[0]).finally(() => e.target.value = '')} />
                    <div className="mt-2 flex gap-1.5">
                      <Button size="sm" variant="secondary" className="flex-1" icon={b.photo ? <Camera className="h-3.5 w-3.5" strokeWidth={1.75} /> : <ImagePlus className="h-3.5 w-3.5" strokeWidth={1.75} />} onClick={() => file.current?.click()}>
                        {b.photo ? 'Replace' : 'Upload'}
                      </Button>
                      {b.photo && <Button size="sm" variant="ghost" onClick={() => set({
                  photo: undefined
                })}>
                          Remove
                        </Button>}
                    </div>
                    <p className="mt-1.5 text-[11px] text-fg-subtle">A tall photo works best. Drag one onto the frame or tap Upload.</p>
                  </div>

                  {/* text */}
                  <div className="grid content-start gap-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Name" id="tm-name">
                        <input id="tm-name" className={inputCls()} value={b.name} onChange={e => set({
                    name: e.target.value
                  })} />
                      </Field>
                      <Field label="Title" id="tm-role" hint="Shown on the name plate">
                        <input id="tm-role" className={inputCls()} value={b.role ?? ''} placeholder="Barber" onChange={e => set({
                    role: e.target.value
                  })} />
                      </Field>
                    </div>
                    <Field label="About" id="tm-bio" hint={`Leave a blank line between paragraphs. ${bio.length}/600`}>
                      <textarea id="tm-bio" rows={6} maxLength={600} className={inputCls(false, 'h-auto py-2 leading-relaxed')} value={bio} onChange={e => set({
                  bio: e.target.value
                })} />
                    </Field>
                    <Field label="Good at" id="tm-spec" hint="Type a skill and press Enter.">
                      <Specialties value={b.specialties ?? []} onChange={v => set({
                  specialties: v
                })} />
                    </Field>
                    <Field label="Line on the booking form" id="tm-note" hint="One short line under the name when customers pick a barber.">
                      <input id="tm-note" className={inputCls()} value={b.note} onChange={e => set({
                  note: e.target.value
                })} />
                    </Field>
                  </div>
                </div>}
            </Panel>

            {b.id !== 'any' && <Panel title="Preview on the website">
                <div className="overflow-hidden rounded-b-xl bg-[#14215c] p-6 text-[#e6edf9] md:p-8">
                  <div className="grid items-center gap-6 sm:grid-cols-[150px_1fr]">
                    <div className="mx-auto w-[150px] rounded-t-[999px] rounded-b-lg bg-gradient-to-b from-[#dfe5ee] to-[#8e9ab0] p-1.5">
                      <div className="aspect-[4/5] overflow-hidden rounded-t-[999px] rounded-b-md bg-gradient-to-b from-[#eef3fa] to-[#c9d6ec]">
                        {b.photo ? <img src={b.photo} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center font-display text-[56px] italic text-[#14215c]">{(b.name || '?')[0]}</span>}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e6edf9]/65">{b.role || 'Barber'}</p>
                      <p className="mt-1 font-display text-[40px] leading-none">{b.name || 'Name'}</p>
                      <div className="mt-3 grid gap-2 text-[14px] leading-relaxed text-[#e6edf9]/85">
                        {(bio || b.note || 'Their bio shows here.').split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
                      </div>
                      {!!b.specialties?.length && <ul className="mt-3 flex flex-wrap gap-1.5">
                          {b.specialties.map(sp => <li key={sp} className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2 py-1 text-[12px] ring-1 ring-white/15">
                              <Scissors className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" /> {sp}
                            </li>)}
                        </ul>}
                    </div>
                  </div>
                </div>
              </Panel>}
          </div>}
      </div>

      {real.length === 0 && <p className="mt-3 text-[13px] text-fg-subtle">With no barbers listed, the website hides the Behind the chair section.</p>}

      <SaveBar dirty={dirty} onSave={save} onDiscard={() => setTeam(crown.barbers)} label="Unsaved profile changes" />
      <Confirm open={!!remove} title={`Remove ${remove?.name || 'this barber'}?`} body="They disappear from the About page and the booking form once you save. Existing bookings stay." confirmLabel="Remove" onCancel={() => setRemove(null)} onConfirm={() => {
      if (remove) {
        setTeam(t => t.filter(x => x.id !== remove.id));
        setSel(team.find(x => x.id !== remove.id && x.id !== 'any')?.id ?? 'any');
      }
      setRemove(null);
    }} />
    </>;
}