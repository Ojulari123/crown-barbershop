import { useEffect, useState } from 'react';
import { Archive, ArchiveRestore, ArrowLeft, Inbox, MailOpen, MessageSquareText, Phone } from 'lucide-react';
import { cx } from './data';
import { setSlice, useCrown, type Message } from './store';
import { Avatar, Button, Empty, IconButton, LinkButton, PageHeader, Segmented, smsHref, telHref, timeAgo, useToast } from './kit';
export function MessagesView({
  initialId
}: {
  initialId?: string | null;
}) {
  const crown = useCrown();
  const toast = useToast();
  const [box, setBox] = useState<'inbox' | 'archived'>('inbox');
  const [openId, setOpenId] = useState<string | null>(initialId ?? null);
  const list = crown.messages.filter(m => box === 'inbox' ? !m.archived : m.archived).sort((a, b) => b.createdAt - a.createdAt);
  const open = crown.messages.find(m => m.id === openId) ?? null;
  const unread = crown.messages.filter(m => !m.read && !m.archived).length;
  const patch = (id: string, p: Partial<Message>) => setSlice('messages', xs => xs.map(x => x.id === id ? {
    ...x,
    ...p
  } : x));

  // desktop: open the newest message by default
  useEffect(() => {
    if (!openId && list.length && window.matchMedia('(min-width: 1024px)').matches) setOpenId(list[0].id);
  }, [box]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open && !open.read) patch(open.id, {
      read: true
    });
  }, [open?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function archive(m: Message, v: boolean) {
    patch(m.id, {
      archived: v
    });
    const next = list.find(x => x.id !== m.id);
    setOpenId(window.matchMedia('(min-width: 1024px)').matches ? next?.id ?? null : null);
    toast({
      text: v ? `Archived · ${m.name}` : `Moved to inbox · ${m.name}`,
      undo: () => patch(m.id, {
        archived: !v
      })
    });
  }
  return <>
      <PageHeader title="Messages" description={unread ? `${unread} unread from the website's question form` : "Questions sent from the website's question form."} />

      <div className="flex h-[calc(100dvh-230px)] min-h-[440px] overflow-hidden rounded-xl border border-stroke bg-panel">
        {/* list */}
        <div className={cx('flex w-full flex-col border-stroke lg:w-[340px] lg:shrink-0 lg:border-r', open && 'hidden lg:flex')}>
          <div className="border-b border-stroke p-2.5">
            <Segmented label="Folders" value={box} onChange={v => {
            setBox(v);
            setOpenId(null);
          }} options={[{
            id: 'inbox',
            label: 'Inbox',
            count: unread
          }, {
            id: 'archived',
            label: 'Archived'
          }]} />
          </div>
          {list.length === 0 ? <Empty compact icon={<Inbox className="h-5 w-5" strokeWidth={1.75} />} title={box === 'inbox' ? 'Inbox clear' : 'Nothing archived'} body={box === 'inbox' ? 'New questions from the website show up here.' : undefined} /> : <ul className="min-h-0 flex-1 divide-y divide-stroke overflow-y-auto">
              {list.map(m => <li key={m.id}>
                  <button type="button" onClick={() => setOpenId(m.id)} aria-current={openId === m.id ? 'true' : undefined} className={cx('flex w-full items-start gap-3 px-3.5 py-3 text-left', openId === m.id ? 'bg-accent-soft' : 'hover:bg-sunken')}>
                    <span className="relative">
                      <Avatar name={m.name} size="sm" />
                      {!m.read && <span className="absolute -left-1 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-panel bg-accent" aria-label="unread" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={cx('truncate text-[13px]', m.read ? 'text-fg' : 'font-semibold text-fg')}>{m.name}</span>
                        <span className="num shrink-0 text-[11px] text-fg-subtle">{timeAgo(m.createdAt)}</span>
                      </span>
                      <span className={cx('mt-0.5 line-clamp-2 text-[12px]', m.read ? 'text-fg-subtle' : 'text-fg-muted')}>{m.body}</span>
                    </span>
                  </button>
                </li>)}
            </ul>}
        </div>

        {/* reading pane */}
        <div className={cx('min-w-0 flex-1 flex-col', open ? 'flex' : 'hidden lg:flex')}>
          {open ? <>
              <div className="flex items-center justify-between gap-2 border-b border-stroke px-4 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <IconButton label="Back to messages" size="sm" className="lg:hidden" icon={<ArrowLeft className="h-4 w-4" strokeWidth={2} />} onClick={() => setOpenId(null)} />
                  <Avatar name={open.name} />
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-fg">{open.name}</p>
                    <p className="num truncate text-[12px] text-fg-subtle">
                      {open.phone} · {new Date(open.createdAt).toLocaleString('en-CA', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                  })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <IconButton label="Mark as unread" size="sm" icon={<MailOpen className="h-4 w-4" strokeWidth={1.75} />} onClick={() => {
                patch(open.id, {
                  read: false
                });
                setOpenId(null);
              }} />
                  <IconButton label={open.archived ? 'Move to inbox' : 'Archive'} size="sm" icon={open.archived ? <ArchiveRestore className="h-4 w-4" strokeWidth={1.75} /> : <Archive className="h-4 w-4" strokeWidth={1.75} />} onClick={() => archive(open, !open.archived)} />
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
                <p className="max-w-[62ch] whitespace-pre-wrap text-[15px] leading-relaxed text-fg">{open.body}</p>
              </div>
              <div className="flex flex-wrap gap-2 border-t border-stroke bg-sunken px-4 py-3">
                <LinkButton variant="primary" href={telHref(open.phone)} icon={<Phone className="h-4 w-4" strokeWidth={1.75} />}>
                  Call back
                </LinkButton>
                <LinkButton variant="secondary" href={smsHref(open.phone)} icon={<MessageSquareText className="h-4 w-4" strokeWidth={1.75} />}>
                  Send a text
                </LinkButton>
                {!open.archived && <Button variant="ghost" className="ml-auto" icon={<Archive className="h-4 w-4" strokeWidth={1.75} />} onClick={() => archive(open, true)}>
                    Done, archive
                  </Button>}
              </div>
            </> : <Empty icon={<Inbox className="h-5 w-5" strokeWidth={1.75} />} title="Select a message" body="Pick one on the left to read it." />}
        </div>
      </div>
    </>;
}