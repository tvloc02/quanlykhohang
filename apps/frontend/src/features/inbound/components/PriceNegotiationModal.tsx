import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Scale, Send, CheckCircle2, MessageSquare, History, Tag, AlertCircle } from 'lucide-react';

export type NegotiationRound = {
  round: number;
  supplierPrice?: number | null;
  enterprisePrice?: number | null;
};

export type PriceNegotiationItem = {
  detailId: string;
  productId: string;
  sku: string;
  productName: string;
  quantity: number;
  listPrice: number; // Đơn giá niêm yết ban đầu
  requestedPrice: number; // Giá đặt mua ban đầu
  rounds: NegotiationRound[]; // Danh sách các lần phản hồi qua lại
  newEnterprisePrice: number | null; // Giá doanh nghiệp nhập phản hồi mới nhất
};

interface PriceNegotiationModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  onSaveFeedback: (payload: {
    items: Array<{ detailId: string; newPrice: number }>;
    note: string;
    acceptedSupplierPrice: boolean;
  }) => Promise<void>;
  saving: boolean;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value || 0);
}

function formatOptionalMoney(value: number, hasValue: boolean) {
  return hasValue ? formatMoney(value) : '—';
}

export function PriceNegotiationModal({
  isOpen,
  onClose,
  order,
  onSaveFeedback,
  saving,
}: PriceNegotiationModalProps) {
  const [items, setItems] = useState<PriceNegotiationItem[]>([]);
  const [note, setNote] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!order || !order.details) {
      setItems([]);
      return;
    }

    // Parse details to populate negotiation items and rounds
    const parsedItems: PriceNegotiationItem[] = (order.details || []).map((detail: any) => {
      const requestedPrice = Number(detail.requestedPrice ?? detail.unitPrice ?? 0);
      const supplierPrice = Number(detail.supplierPrice ?? 0);
      const listPrice = Number(detail.listPrice ?? detail.product?.price ?? detail.product?.purchasePrice ?? detail.supplierProduct?.purchasePrice ?? 0);

      // Check if there are rounds stored in item or description
      let rounds: NegotiationRound[] = [];
      if (Array.isArray(detail.rounds) && detail.rounds.length > 0) {
        rounds = detail.rounds;
      } else if (supplierPrice > 0) {
        rounds = [{ round: 1, supplierPrice: supplierPrice, enterprisePrice: requestedPrice }];
      } else {
        rounds = [];
      }

      const latestEnterprisePrice = [...rounds].reverse().find((round) => round.enterprisePrice != null)?.enterprisePrice ?? null;

      return {
        detailId: detail.id || detail.rowId,
        productId: detail.product?.id || detail.productId || '',
        sku: detail.product?.internalSku || detail.product?.sku || '-',
        productName: detail.product?.name || detail.productName || 'Sản phẩm',
        quantity: Number(detail.expectedQty || detail.quantity || 1),
        listPrice: listPrice,
        requestedPrice: requestedPrice,
        rounds: rounds,
        newEnterprisePrice: latestEnterprisePrice,
      };
    });

    setItems(parsedItems);
    setNote(order.description ? `Phản hồi về đơn hàng ${order.poNumber}` : '');
  }, [order]);

  if (!isOpen || !mounted || !order) return null;

  // Determine max number of rounds across items
  const maxRounds = Math.max(1, ...items.map((i) => i.rounds.length));

  const getSupplierPriceForItem = (i: PriceNegotiationItem) => {
    const latestRound = [...i.rounds].reverse().find((r) => r.supplierPrice != null);
    if (latestRound && latestRound.supplierPrice != null) return Number(latestRound.supplierPrice);
    return Number(i.requestedPrice || 0);
  };

  // Calculations for totals
  const totalQuantity = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalRequestedAmount = items.reduce((sum, i) => sum + i.quantity * i.requestedPrice, 0);
  const totalLatestSupplierAmount = items.reduce((sum, i) => {
    return sum + i.quantity * getSupplierPriceForItem(i);
  }, 0);
  const totalNewEnterpriseAmount = items.reduce((sum, i) => sum + i.quantity * Number(i.newEnterprisePrice ?? getSupplierPriceForItem(i)), 0);
  const hasSupplierResponse = items.some((i) => i.rounds.some((round) => round.supplierPrice != null));
  const hasEnterpriseResponse = items.some((i) => i.rounds.some((round) => round.enterprisePrice != null));
  const hasNewEnterprisePrice = items.some((i) => i.newEnterprisePrice != null);

  const handlePriceChange = (detailId: string, val: string) => {
    const num = Number(val);
    setItems((prev) =>
      prev.map((item) =>
        item.detailId === detailId
          ? { ...item, newEnterprisePrice: val.trim() === '' || Number.isNaN(num) ? null : num }
          : item
      )
    );
  };

  const handleAcceptSupplierPrices = () => {
    setItems((prev) =>
      prev.map((item) => {
        return {
          ...item,
          newEnterprisePrice: getSupplierPriceForItem(item),
        };
      })
    );
  };

  const handleSubmit = (acceptedSupplierPrice: boolean) => {
    const finalItems = items.map((i) => {
      const priceToUse = acceptedSupplierPrice
        ? getSupplierPriceForItem(i)
        : (i.newEnterprisePrice ?? getSupplierPriceForItem(i));
      return {
        detailId: i.detailId,
        newPrice: Number(priceToUse),
      };
    });

    const payload = {
      items: finalItems,
      note: note.trim(),
      acceptedSupplierPrice,
    };
    onSaveFeedback(payload);
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/40 p-4 animate-in fade-in duration-200">
      <div style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }} className="flex max-h-[92vh] w-[96vw] max-w-[1600px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl border-2 border-cyan-500">
        
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-cyan-700 bg-cyan-600 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
          <div className="rounded-xl bg-white/10 p-2.5">
              <Scale className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black tracking-tight text-white">
                  Phản Hồi & Thương Lượng Giá Đơn Hàng #{order.poNumber}
                </h3>
                <span className="rounded-full bg-white/10 px-3 py-0.5 text-xs font-bold text-white">
                  Thương lượng giá qua lại
                </span>
              </div>
              <p className="text-xs font-medium text-slate-300">
                Nhà cung cấp: <span className="font-bold text-white">{order.supplier?.name || order.supplierName || 'NCC'}</span> • Cập nhật giá phản hồi chính xác theo từng sản phẩm
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl p-2 text-white/80 transition hover:bg-white/20 hover:text-white"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* THÔNG TIN TỔNG QUAN VỀ LẦN PHẢN HỒI */}
        <div className="bg-cyan-50 border-b border-cyan-100 px-6 py-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
          <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
            <span className="block text-xs font-bold uppercase text-slate-500">Mặt hàng thương lượng</span>
            <span className="text-base font-black text-slate-800">{items.length} sản phẩm</span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
            <span className="block text-xs font-bold uppercase text-slate-500">Tổng tiền đặt mua</span>
            <span className="text-base font-black text-slate-700">{formatMoney(totalRequestedAmount)}</span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
            <span className="block text-xs font-bold uppercase text-slate-500">Tổng NCC phản hồi</span>
            <span className="text-base font-black text-slate-800">{formatOptionalMoney(totalLatestSupplierAmount, hasSupplierResponse)}</span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
            <span className="block text-xs font-bold uppercase text-slate-500">Tổng DN phản hồi</span>
            <span className="text-base font-black text-slate-800">{formatOptionalMoney(totalNewEnterpriseAmount, hasEnterpriseResponse || items.some((i) => i.newEnterprisePrice != null))}</span>
          </div>
        </div>

        {/* BODY: BẢNG SẢN PHẨM PHẢN HỒI GIA */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6" style={{ scrollbarWidth: 'thin', scrollbarColor: '#9bdbe8 transparent' }}>
          <div className="flex items-center justify-center gap-4 text-center">
            <div className="flex items-center justify-center gap-2 text-center">
              <Tag className="h-5 w-5 text-slate-600" />
              <h4 className="text-sm font-bold uppercase text-slate-800 text-center">
                Bảng so sánh & Phản hồi giá sản phẩm (Tiêu đề & Nội dung Căn Giữa)
              </h4>
            </div>
            <button
              type="button"
              onClick={handleAcceptSupplierPrices}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              Áp dụng tất cả giá NCC đề xuất
            </button>
          </div>

          {/* TABLE CONTAINER */}
          <div className="overflow-hidden rounded-2xl border-2 border-slate-200 shadow-sm">
            <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#9bdbe8 transparent' }}>
              <table className="min-w-[1500px] w-full border-collapse bg-white">
                <thead>
                  <tr className="bg-cyan-50 border-b-2 border-cyan-100">
                    <th className="w-12 border border-slate-200 px-3 py-3.5 text-center text-xs font-black uppercase text-slate-800">
                      STT
                    </th>
                    <th className="w-32 border border-slate-200 px-3 py-3.5 text-center text-xs font-black uppercase text-slate-800">
                      Mã sản phẩm
                    </th>
                    <th className="min-w-[220px] border border-slate-200 px-3 py-3.5 text-center text-xs font-black uppercase text-slate-800">
                      Tên sản phẩm
                    </th>
                    <th className="w-24 border border-slate-200 px-3 py-3.5 text-center text-xs font-black uppercase text-slate-800">
                      Số lượng
                    </th>
                    <th className="w-32 border border-slate-200 px-3 py-3.5 text-center text-xs font-black uppercase text-slate-800">
                      Đơn giá niêm yết
                    </th>
                    <th className="w-32 border border-slate-200 px-3 py-3.5 text-center text-xs font-black uppercase text-slate-800">
                      Giá đặt mua
                    </th>
                    
                    {/* RENDER COLUMNS FOR EACH ROUND OF NEGOTIATION */}
                    {Array.from({ length: maxRounds }).map((_, rIdx) => (
                      <React.Fragment key={rIdx}>
                        <th className="w-36 border border-cyan-100 px-3 py-3.5 text-center text-xs font-bold uppercase text-cyan-800 bg-cyan-50">
                          Giá NCC phản hồi {maxRounds > 1 ? `(Lần ${rIdx + 1})` : ''}
                        </th>
                        <th className="w-36 border border-cyan-100 px-3 py-3.5 text-center text-xs font-bold uppercase text-cyan-800 bg-cyan-50">
                          Giá DN phản hồi {maxRounds > 1 ? `(Lần ${rIdx + 1})` : ''}
                        </th>
                      </React.Fragment>
                    ))}

                    <th className="w-40 border border-cyan-100 px-3 py-3.5 text-center text-xs font-bold uppercase text-cyan-800 bg-cyan-50">
                      Nhập giá DN phản hồi
                    </th>
                    <th className="w-40 border border-cyan-100 px-3 py-3.5 text-center text-xs font-bold uppercase text-cyan-800 bg-cyan-50">
                      Thành tiền
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {items.map((item, index) => {
    const lineTotal = item.quantity * Number(item.newEnterprisePrice || 0);
                    return (
                      <tr key={item.detailId} className="hover:bg-cyan-50/30 transition">
                        <td className="border border-slate-200 px-3 py-3 text-center text-sm font-normal text-slate-700 align-middle">
                          {index + 1}
                        </td>
                        <td className="border border-slate-200 px-3 py-3 text-center text-sm font-normal text-slate-700 align-middle">
                          {item.sku}
                        </td>
                        <td className="border border-slate-200 px-3 py-3 text-center text-sm font-normal text-slate-700 align-middle">
                          <div>
                            <p className="font-normal text-slate-700">{item.productName}</p>
                          </div>
                        </td>
                        <td className="border border-slate-200 px-3 py-3 text-center text-sm font-normal text-slate-700 align-middle">
                          {item.quantity}
                        </td>
                        <td className="border border-slate-200 px-3 py-3 text-center text-sm font-normal text-slate-700 align-middle">
                          {formatMoney(item.listPrice)}
                        </td>
                        <td className="border border-slate-200 px-3 py-3 text-center text-sm font-normal text-slate-700 align-middle">
                          {formatMoney(item.requestedPrice)}
                        </td>

                        {/* ROUND VALUES */}
                        {Array.from({ length: maxRounds }).map((_, rIdx) => {
                          const roundData = item.rounds[rIdx];
                          return (
                            <React.Fragment key={rIdx}>
                              <td className="border border-slate-200 px-3 py-3 text-center text-sm font-normal text-slate-700 align-middle">
                                {roundData?.supplierPrice != null ? formatMoney(roundData.supplierPrice) : '—'}
                              </td>
                              <td className="border border-slate-200 px-3 py-3 text-center text-sm font-normal text-slate-700 align-middle">
                                {roundData?.enterprisePrice != null ? formatMoney(roundData.enterprisePrice) : '—'}
                              </td>
                            </React.Fragment>
                          );
                        })}

                        {/* EDITABLE NEW ENTERPRISE COUNTER-OFFER PRICE */}
                        <td className="border border-slate-200 px-3 py-3 text-center align-middle bg-white">
                          <div className="flex items-center justify-center">
                            <input
                              type="number"
                              min={0}
                              value={item.newEnterprisePrice ?? ''}
                              onChange={(e) => handlePriceChange(item.detailId, e.target.value)}
                              placeholder="Nhập giá"
                              className="h-10 w-36 rounded-xl border border-slate-300 bg-white px-2 text-center text-sm font-semibold text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                            />
                          </div>
                        </td>

                        {/* LINE TOTAL */}
                        <td className="border border-slate-200 px-3 py-3 text-center text-sm font-normal text-slate-700 align-middle">
                          {item.newEnterprisePrice == null ? '—' : formatMoney(lineTotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* FOOTER TOTALS ROW (CENTERED) */}
                <tfoot className="bg-cyan-50 border-t-2 border-cyan-200">
                  <tr>
                    <td colSpan={3} className="border border-slate-300 px-3 py-3.5 text-center text-xs font-normal uppercase text-slate-700">
                      TỔNG CỘNG
                    </td>
                    <td className="border border-slate-300 px-3 py-3.5 text-center text-sm font-normal text-slate-700">
                      {totalQuantity}
                    </td>
                    <td className="border border-slate-300 px-3 py-3.5 text-center text-xs font-normal text-slate-700">
                      -
                    </td>
                    <td className="border border-slate-300 px-3 py-3.5 text-center text-sm font-normal text-slate-700">
                      {formatMoney(totalRequestedAmount)}
                    </td>

                    {/* ROUND TOTALS */}
                    {Array.from({ length: maxRounds }).map((_, rIdx) => {
                      const roundSupplierTotal = items.reduce((sum, i) => {
                        const r = i.rounds[rIdx];
                        return sum + i.quantity * Number(r?.supplierPrice || 0);
                      }, 0);
                      const roundEnterpriseTotal = items.reduce((sum, i) => {
                        const r = i.rounds[rIdx];
                        return sum + i.quantity * Number(r?.enterprisePrice || 0);
                      }, 0);
                      return (
                        <React.Fragment key={rIdx}>
                          <td className="border border-slate-300 px-3 py-3.5 text-center text-sm font-normal text-slate-700">
                            {formatMoney(roundSupplierTotal)}
                          </td>
                          <td className="border border-slate-300 px-3 py-3.5 text-center text-sm font-normal text-slate-700">
                            {formatMoney(roundEnterpriseTotal)}
                          </td>
                        </React.Fragment>
                      );
                    })}

                    <td className="border border-slate-300 px-3 py-3.5 text-center text-sm font-normal text-slate-700">
                      {formatOptionalMoney(totalNewEnterpriseAmount, items.some((i) => i.newEnterprisePrice != null))}
                    </td>
                    <td className="border border-slate-300 px-3 py-3.5 text-center text-base font-normal text-slate-700">
                      {formatOptionalMoney(totalNewEnterpriseAmount, items.some((i) => i.newEnterprisePrice != null))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* GHI CHÚ / NỘI DUNG PHẢN HỒI */}
          <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-4 space-y-2">
            <label className="flex items-center gap-2 text-xs font-black uppercase text-slate-700">
              <MessageSquare className="h-4 w-4 text-slate-600" />
              Ghi chú & Lý do điều chỉnh giá phản hồi
            </label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Nhập ghi chú thương lượng giá gửi cho Nhà cung cấp..."
              className="w-full rounded-xl border-2 border-slate-200 bg-white p-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 resize-none"
            />
          </div>
        </div>

        {/* FOOTER ACTIONS */}
        <div className="flex items-center justify-between border-t-2 border-slate-100 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border-2 border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
          >
            Hủy bỏ
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={saving || items.length === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-500 bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 shadow-md active:scale-95 disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              {saving ? 'Đang gửi...' : `Đồng ý giá NCC đề xuất (${formatMoney(totalLatestSupplierAmount)})`}
            </button>
            <button
              type="button"
              onClick={() => handleSubmit(false)}
              disabled={saving || items.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-cyan-700 shadow-md active:scale-95 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {saving ? 'Đang gửi...' : 'Gửi phản hồi giá mới'}
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}
