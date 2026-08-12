import React, { useState } from 'react';
import SalesInvoiceDocPage from '../../documents/pages/SalesInvoiceDocPage';
import StockInDocPage from '../../documents/pages/StockInDocPage';
import StockOutDocPage from '../../documents/pages/StockOutDocPage';
import TransferDocPage from '../../documents/pages/TransferDocPage';
import { FileText, ArrowDownRight, ArrowUpRight, ArrowLeftRight } from 'lucide-react';

export default function VatManagementPage() {
  const [activeTab, setActiveTab] = useState<'sales-invoice' | 'stock-in' | 'stock-out' | 'transfer'>('sales-invoice');

  return (
    <div className="space-y-4 pb-12">
      {/* CONDENSED TAB CAROUSEL FOR VAT & DOCUMENTS */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-slate-200 bg-white p-2 shadow-sm">
        <button
          onClick={() => setActiveTab('sales-invoice')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
            activeTab === 'sales-invoice'
              ? 'bg-cyan-600 text-white shadow-sm font-black'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <FileText size={15} />
          Hóa đơn bán hàng / VAT Điện tử
        </button>

        <button
          onClick={() => setActiveTab('stock-in')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
            activeTab === 'stock-in'
              ? 'bg-cyan-600 text-white shadow-sm font-black'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <ArrowDownRight size={15} />
          Chứng từ Phiếu nhập kho
        </button>

        <button
          onClick={() => setActiveTab('stock-out')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
            activeTab === 'stock-out'
              ? 'bg-cyan-600 text-white shadow-sm font-black'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <ArrowUpRight size={15} />
          Chứng từ Phiếu xuất kho
        </button>

        <button
          onClick={() => setActiveTab('transfer')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
            activeTab === 'transfer'
              ? 'bg-cyan-600 text-white shadow-sm font-black'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <ArrowLeftRight size={15} />
          Chứng từ Phiếu điều chuyển
        </button>
      </div>

      {/* TAB CONTENT */}
      <div>
        {activeTab === 'sales-invoice' && <SalesInvoiceDocPage />}
        {activeTab === 'stock-in' && <StockInDocPage />}
        {activeTab === 'stock-out' && <StockOutDocPage />}
        {activeTab === 'transfer' && <TransferDocPage />}
      </div>
    </div>
  );
}
