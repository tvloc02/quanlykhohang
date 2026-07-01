import React from 'react';
import { Maximize2 } from 'lucide-react';

type PortalWindowProps = {
  title: string;
  eyebrow: string;
  icon: React.ReactNode;
  compact?: boolean;
  active?: boolean;
  onOpen?: () => void;
  children: React.ReactNode;
};

export default function PortalWindow({ title, eyebrow, icon, compact, active, onOpen, children }: PortalWindowProps) {
  return (
    <section
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (onOpen && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onOpen();
        }
      }}
      className={`flex h-full min-h-0 flex-col overflow-hidden rounded-xl border-2 bg-white shadow-sm transition ${
        active ? 'border-cyan-500 shadow-cyan-900/10' : 'border-slate-200 hover:border-cyan-300 hover:shadow-md'
      } ${onOpen ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-center justify-between gap-3 border-b-2 border-slate-100 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          {!compact && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            {!compact && <p className="text-xs font-black uppercase text-cyan-600">{eyebrow}</p>}
            <h2 className={`${compact ? 'text-base' : 'text-xl'} truncate font-black text-slate-900`}>{title}</h2>
          </div>
        </div>
        {onOpen && !compact && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onOpen();
            }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-cyan-50 hover:text-cyan-600"
            title="Phóng lớn"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className={`${compact ? 'p-4' : 'p-5'} min-h-0 flex-1 overflow-auto`}>{children}</div>
    </section>
  );
}
