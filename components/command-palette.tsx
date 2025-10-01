'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type SearchItem = {
  id: string;
  localChatID?: string;
  title: string;
  unreadCount: number;
  participants: Array<{ displayName?: string; username?: string; id?: string }>;
};

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<SearchItem>>([]);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === 'Escape') {
        if (open) {
          e.preventDefault();
          setOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
      try {
        document.body.classList.add('cmdk-open');
      } catch {}
    } else {
      setQuery('');
      setResults([]);
      setSelected(0);
      try {
        document.body.classList.remove('cmdk-open');
      } catch {}
    }
  }, [open]);

  const fetchResults = useCallback(async (q: string) => {
    if (q.trim().length < 3) {
      setResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/beeper/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) return;
      const data = await res.json();
      setResults(data.items || []);
    } catch (_) {
      // noop
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchResults(query), 150);
    return () => clearTimeout(t);
  }, [query, fetchResults]);

  const onEnter = useCallback(() => {
    const item = results[selected];
    if (!item) return;
    setOpen(false);
    router.push(`/inbox/${encodeURIComponent(item.id)}`);
  }, [results, selected, router]);

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/20 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-xl rounded-lg border bg-background p-2 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setSelected((i) => Math.min(i + 1, Math.max(0, results.length - 1)));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setSelected((i) => Math.max(i - 1, 0));
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  onEnter();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setOpen(false);
                }
              }}
              placeholder="Search chats or contacts…"
              className="w-full rounded-md border border-zinc-300 bg-background p-2 text-sm dark:border-zinc-700"
            />
            <div className="max-h-80 overflow-y-auto mt-2">
              {results.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">Type at least 3 characters…</div>
              ) : (
                results.map((item, idx) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setSelected(idx);
                      onEnter();
                    }}
                    className={`w-full text-left p-2 rounded-md text-sm ${idx === selected ? 'bg-muted' : ''}`}
                  >
                    <div className="font-medium">{item.title}</div>
                    {item.participants?.length ? (
                      <div className="text-xs text-muted-foreground truncate">
                        {item.participants.map((p) => p.displayName || p.username || p.id).filter(Boolean).join(', ')}
                      </div>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}


