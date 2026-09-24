import { useRef, useState, type DragEvent } from 'react';
import { ArrowLeft, ArrowRight, ExternalLink, ImagePlus, Images, Loader2, Star, Trash2, Upload } from 'lucide-react';
import { STYLE_LABELS, homepagePhotos, setSlice, storageUsedKb, uid, useCrown, type CutStyle, type Photo } from './store';
import { Button, Confirm, Drawer, Empty, Field, LinkButton, PageHeader, SITE_URL, Segmented, Switch, inputCls, useToast } from './kit';

// Phone photos are 3-5 MB. Shrink to 1400px JPEG (about 150-250 KB) before saving.
async function shrink(file: File, max = 1400): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.8);
  } finally {
    URL.revokeObjectURL(url);
  }
}
const STYLES = Object.keys(STYLE_LABELS) as CutStyle[];
export function GalleryAdmin() {
  const crown = useCrown();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [filter, setFilter] = useState<CutStyle | 'all'>('all');
  const [editId, setEditId] = useState<string | null>(null);
  const [confirmSamples, setConfirmSamples] = useState(false);
  const photos = [...crown.gallery].sort((a, b) => b.createdAt - a.createdAt);
  const shown = filter === 'all' ? photos : photos.filter(p => p.style === filter);
  const onHome = new Set(homepagePhotos(crown).map(p => p.id));
  const starred = photos.filter(p => p.featured).length;
  const samples = photos.filter(p => p.sample).length;
  const editing = photos.find(p => p.id === editId) ?? null;
  const patch = (id: string, p: Partial<Photo>) => setSlice('gallery', xs => xs.map(x => x.id === id ? {
    ...x,
    ...p
  } : x));
  async function add(files: FileList | File[]) {
    const list = [...files].filter(f => f.type.startsWith('image/'));
    if (!list.length) {
      toast({
        text: 'Those files are not photos. Choose JPG or PNG images.',
        tone: 'error'
      });
      return;
    }
    setPending(list.length);
    const added: Photo[] = [];
    let failed = 0;
    for (const f of list) {
      try {
        added.push({
          id: uid(),
          src: await shrink(f),
          caption: '',
          style: filter === 'all' ? 'classic' : filter,
          featured: false,
          createdAt: Date.now() + added.length
        });
      } catch {
        failed++;
      }
      setPending(n => n - 1);
    }
    setPending(0);
    if (added.length) {
      const r = setSlice('gallery', xs => [...xs, ...added]);
      if (!r.ok && r.reason === 'full') toast({
        text: 'Not enough room in the demo. Remove a few photos first.',
        tone: 'error'
      });else {
        toast({
          text: `${added.length} photo${added.length === 1 ? '' : 's'} added`
        });
        if (added.length === 1) setEditId(added[0].id);
      }
    }
    if (failed) toast({
      text: `${failed} file${failed === 1 ? '' : 's'} could not be opened. Try JPG.`,
      tone: 'error'
    });
  }
  function remove(p: Photo) {
    setEditId(null);
    setSlice('gallery', xs => xs.filter(x => x.id !== p.id));
    toast({
      text: 'Photo removed',
      undo: () => setSlice('gallery', xs => [...xs, p])
    });
  }
  function move(p: Photo, dir: -1 | 1) {
    const i = photos.findIndex(x => x.id === p.id);
    const o = photos[i + dir];
    if (!o) return;
    setSlice('gallery', xs => xs.map(x => x.id === p.id ? {
      ...x,
      createdAt: o.createdAt
    } : x.id === o.id ? {
      ...x,
      createdAt: p.createdAt
    } : x));
  }
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) add(e.dataTransfer.files);
  };
  const idx = editing ? photos.findIndex(p => p.id === editing.id) : -1;
  return <div onDragOver={e => {
    e.preventDefault();
    setDragging(true);
  }} onDragLeave={e => e.currentTarget === e.target && setDragging(false)} onDrop={onDrop} className="relative">
      <PageHeader title="Gallery" description="Photos show on the website's Gallery page. Starred ones also appear on the home page (up to 5)." actions={<>
            <LinkButton variant="secondary" href={`${SITE_URL}#/gallery`} target="_blank" rel="noreferrer" icon={<ExternalLink className="h-4 w-4" strokeWidth={1.75} />}>
              View on site
            </LinkButton>
            <Button variant="primary" disabled={pending > 0} onClick={() => input.current?.click()} icon={pending ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> : <ImagePlus className="h-4 w-4" strokeWidth={1.75} />}>
              {pending ? `Adding ${pending}…` : 'Upload photos'}
            </Button>
            <input ref={input} type="file" accept="image/*" multiple className="sr-only" id="gal-upload" onChange={e => e.target.files && add(e.target.files).finally(() => e.target.value = '')} />
          </>} />

      <div className="rounded-xl border border-stroke bg-panel">
        <div className="flex flex-col gap-3 border-b border-stroke p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="overflow-x-auto">
            <Segmented label="Filter by style" value={filter} onChange={setFilter} options={[{
            id: 'all' as const,
            label: 'All',
            count: photos.length
          }, ...STYLES.filter(s => photos.some(p => p.style === s)).map(s => ({
            id: s,
            label: STYLE_LABELS[s],
            count: photos.filter(p => p.style === s).length
          }))]} />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[12px] text-fg-subtle">
            <span className="num">
              <Star className="mr-1 inline h-3.5 w-3.5 -translate-y-px text-amber-500" fill="currentColor" strokeWidth={0} aria-hidden="true" />
              {Math.min(starred, 5)}/5 on home page
            </span>
            <span className="num">{(storageUsedKb() / 1024).toFixed(1)} MB used</span>
            {samples > 0 && <Button size="sm" variant="ghost" icon={<Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />} onClick={() => setConfirmSamples(true)}>
                Remove {samples} samples
              </Button>}
          </div>
        </div>

        {photos.length === 0 && !pending ? <Empty icon={<Images className="h-5 w-5" strokeWidth={1.75} />} title="No photos yet" body="Drag photos here or press Upload photos. While this is empty, the website hides its Recent cuts section." action={<Button variant="primary" icon={<Upload className="h-4 w-4" strokeWidth={1.75} />} onClick={() => input.current?.click()}>
                Upload photos
              </Button>} /> : <ul className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({
          length: pending
        }).map((_, i) => <li key={'p' + i} className="aspect-square animate-pulse rounded-lg bg-sunken" />)}
            {shown.map(p => <li key={p.id}>
                <button type="button" onClick={() => setEditId(p.id)} className="group block w-full text-left" aria-label={`Edit photo: ${p.caption || STYLE_LABELS[p.style]}`}>
                  <span className="relative block aspect-square overflow-hidden rounded-lg bg-sunken ring-1 ring-stroke">
                    <img src={p.src} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                    {onHome.has(p.id) && <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
                        <Star className="h-3 w-3 text-amber-400" fill="currentColor" strokeWidth={0} aria-hidden="true" /> Home
                      </span>}
                    {p.sample && <span className="absolute right-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">Sample</span>}
                  </span>
                  <span className="mt-1.5 block truncate text-[12px] font-medium text-fg">{p.caption || <span className="text-fg-subtle">No caption</span>}</span>
                  <span className="block text-[11px] text-fg-subtle">{STYLE_LABELS[p.style]}</span>
                </button>
              </li>)}
          </ul>}
      </div>

      {dragging && <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-accent/10 backdrop-blur-[2px]">
          <div className="rounded-xl border-2 border-dashed border-accent bg-panel px-8 py-6 text-center shadow-xl">
            <Upload className="mx-auto h-6 w-6 text-accent" strokeWidth={1.75} />
            <p className="mt-2 text-[14px] font-semibold text-fg">Drop to upload</p>
          </div>
        </div>}

      <Drawer open={!!editing} onClose={() => setEditId(null)} title="Edit photo" subtitle={editing && `${idx + 1} of ${photos.length}`} footer={editing && <>
              <Button variant="danger" className="mr-auto" icon={<Trash2 className="h-4 w-4" strokeWidth={1.75} />} onClick={() => remove(editing)}>
                Remove
              </Button>
              <Button variant="primary" onClick={() => setEditId(null)}>
                Done
              </Button>
            </>}>
        {editing && <div className="grid gap-4">
            <img src={editing.src} alt={editing.caption || 'Haircut photo'} className="aspect-[4/5] w-full rounded-lg object-cover ring-1 ring-stroke" />
            <Field label="Caption" id="ph-cap" hint="Shown in the photo viewer on the website.">
              <input key={editing.id} id="ph-cap" className={inputCls()} defaultValue={editing.caption} placeholder="e.g. Skin fade with a hard part" onBlur={e => e.target.value.trim() !== editing.caption && patch(editing.id, {
            caption: e.target.value.trim()
          })} />
            </Field>
            <Field label="Style" id="ph-style">
              <select id="ph-style" className={inputCls()} value={editing.style} onChange={e => patch(editing.id, {
            style: e.target.value as CutStyle
          })}>
                {STYLES.map(s => <option key={s} value={s}>
                    {STYLE_LABELS[s]}
                  </option>)}
              </select>
            </Field>
            <div className="flex items-center justify-between rounded-lg border border-stroke px-3 py-2">
              <div>
                <p className="text-[13px] font-medium text-fg">Show on home page</p>
                <p className="text-[12px] text-fg-subtle">{onHome.has(editing.id) ? 'Showing now' : starred >= 5 && !editing.featured ? 'Home page is full; newest starred show' : 'Up to 5 photos'}</p>
              </div>
              <Switch hideLabel label="Show on home page" checked={editing.featured} onChange={v => patch(editing.id, {
            featured: v
          })} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-stroke px-3 py-2">
              <p className="text-[13px] font-medium text-fg">Order</p>
              <div className="flex gap-1">
                <Button size="sm" variant="secondary" disabled={idx <= 0} icon={<ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />} onClick={() => move(editing, -1)}>
                  Earlier
                </Button>
                <Button size="sm" variant="secondary" disabled={idx >= photos.length - 1} icon={<ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />} onClick={() => move(editing, 1)}>
                  Later
                </Button>
              </div>
            </div>
          </div>}
      </Drawer>

      <Confirm open={confirmSamples} title={`Remove ${samples} sample photos?`} body="These are stand-in photos. Your own uploads stay. You can undo right after." confirmLabel="Remove samples" onCancel={() => setConfirmSamples(false)} onConfirm={() => {
      const before = crown.gallery;
      setConfirmSamples(false);
      setSlice('gallery', xs => xs.filter(x => !x.sample));
      toast({
        text: `Removed ${samples} samples`,
        undo: () => setSlice('gallery', before)
      });
    }} />
    </div>;
}