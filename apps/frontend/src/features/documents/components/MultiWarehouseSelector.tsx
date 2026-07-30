import React, { useEffect, useRef, useState } from 'react';
import { Warehouse, Check, ChevronDown, X, Building2 } from 'lucide-react';

interface MultiWarehouseSelectorProps {
  selectedWarehouses: string[];
  onChange: (warehouses: string[]) => void;
  options: string[];
  label?: string;
  loading?: boolean;
}

export default function MultiWarehouseSelector({
  selectedWarehouses,
  onChange,
  options,
  label = 'Kho áp dụng (có thể chọn nhiều kho)',
  loading = false,
}: MultiWarehouseSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const normalizedOptions = Array.from(new Set(options.map((option) => option.trim()).filter(Boolean)));
  const isAllSelected =
    selectedWarehouses.includes('Tất cả các kho') ||
    (normalizedOptions.length > 0 && selectedWarehouses.length === normalizedOptions.length);

  const handleToggleAll = () => {
    if (isAllSelected) {
      onChange([]);
    } else {
      onChange(['Tất cả các kho', ...normalizedOptions]);
    }
  };

  const handleToggleOption = (wh: string) => {
    if (wh === 'Tất cả các kho') {
      handleToggleAll();
      return;
    }

    let updated: string[];
    if (selectedWarehouses.includes(wh)) {
      updated = selectedWarehouses.filter((item) => item !== wh && item !== 'Tất cả các kho');
    } else {
      const nextList = [...selectedWarehouses.filter((item) => item !== 'Tất cả các kho'), wh];
      updated = normalizedOptions.length > 0 && nextList.length === normalizedOptions.length ? ['Tất cả các kho', ...normalizedOptions] : nextList;
    }
    onChange(updated);
  };

  const handleRemoveBadge = (wh: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (wh === 'Tất cả các kho') {
      onChange([]);
      return;
    }

    onChange(selectedWarehouses.filter((item) => item !== wh && item !== 'Tất cả các kho'));
  };

  const displaySelectedText = () => {
    if (loading) return 'Đang tải danh sách kho...';
    if (normalizedOptions.length === 0) return 'Không có kho nào';
    if (selectedWarehouses.length === 0) return 'Chọn kho áp dụng...';
    if (isAllSelected) return 'Tất cả các kho';
    return `Đã chọn (${selectedWarehouses.filter((w) => w !== 'Tất cả các kho').length} kho)`;
  };

  const realSelectedList = selectedWarehouses.filter((w) => w !== 'Tất cả các kho');
  const triggerClassName = isOpen
    ? 'flex min-h-[44px] w-full cursor-pointer items-center justify-between rounded-t-2xl rounded-b-none border-2 border-cyan-500 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-xs transition-all hover:border-cyan-500 focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10'
    : 'flex min-h-[44px] w-full cursor-pointer items-center justify-between rounded-2xl border-2 border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-xs transition-all hover:border-cyan-500 focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10';

  return (
    <div className="relative w-full space-y-1.5" ref={dropdownRef}>
      {label && (
        <label className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
          <Warehouse className="h-4 w-4 text-cyan-600" />
          {label}:
        </label>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={triggerClassName}
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 pr-2">
          {selectedWarehouses.length === 0 ? (
            <span className="text-sm font-normal text-slate-400">{displaySelectedText()}</span>
          ) : isAllSelected ? (
            <span className="inline-flex items-center gap-1 rounded-lg border border-cyan-300 bg-cyan-100 px-2.5 py-1 text-xs font-extrabold text-cyan-800">
              <Building2 className="h-3.5 w-3.5" />
              Tất cả các kho
            </span>
          ) : (
            realSelectedList.map((wh) => (
              <span
                key={wh}
                className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-800"
              >
                {wh}
                <span onClick={(e) => handleRemoveBadge(wh, e)} className="rounded-full p-0.5 text-cyan-700 transition hover:bg-cyan-200">
                  <X className="h-3 w-3" />
                </span>
              </span>
            ))
          )}
        </div>
        <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-[10000] -mt-px max-h-80 overflow-hidden rounded-b-[18px] border-x-2 border-b-2 border-cyan-500 border-t-0 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.16)]">
          <div className="max-h-80 overflow-y-auto p-2.5">
          {loading ? (
            <div className="rounded-[14px] px-3 py-4 text-sm font-semibold text-slate-500">Đang tải danh sách kho...</div>
          ) : normalizedOptions.length === 0 ? (
            <div className="rounded-[14px] px-3 py-4 text-sm font-semibold text-slate-500">Không có kho nào để chọn.</div>
          ) : (
            <>
              <div
                onClick={handleToggleAll}
                className={`flex cursor-pointer items-center justify-between rounded-[14px] px-3 py-2 text-sm font-bold transition ${
                  isAllSelected ? 'bg-cyan-50 text-cyan-800' : 'text-slate-800 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`flex h-4 w-4 items-center justify-center rounded border transition ${
                      isAllSelected ? 'border-cyan-600 bg-cyan-600 text-white' : 'border-slate-300 bg-white'
                    }`}
                  >
                    {isAllSelected && <Check className="h-3 w-3 stroke-[3]" />}
                  </div>
                  <span>Tất cả các kho</span>
                </div>
                <span className="rounded-full bg-cyan-100/70 px-2 py-0.5 text-xs font-extrabold text-cyan-600">Tất cả</span>
              </div>

              <div className="my-1 border-t border-slate-100" />

              {normalizedOptions.map((wh) => {
                const isSelected = isAllSelected || selectedWarehouses.includes(wh);
                return (
                  <div
                    key={wh}
                    onClick={() => handleToggleOption(wh)}
                    className={`flex cursor-pointer items-center justify-between rounded-[14px] px-3 py-2 text-sm font-semibold transition ${
                      isSelected ? 'bg-cyan-50/70 font-bold text-cyan-900' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`flex h-4 w-4 items-center justify-center rounded border transition ${
                          isSelected ? 'border-cyan-600 bg-cyan-600 text-white' : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                      </div>
                      <span>{wh}</span>
                    </div>
                  </div>
                );
              })}
            </>
          )}
          </div>
        </div>
      )}
    </div>
  );
}
