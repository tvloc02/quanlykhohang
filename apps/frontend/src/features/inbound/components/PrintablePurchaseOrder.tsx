import React from 'react';
import { numberToVietnameseWords } from '../../../utils/numberToVietnamese';

type Props = {
  order: any;
  companyName?: string;
};

export const PrintablePurchaseOrder = React.forwardRef<HTMLDivElement, Props>(({ order, companyName }, ref) => {
  if (!order) return null;

  const totalAmount =
    order.details?.reduce(
      (sum: number, item: any) => sum + Number(item.expectedQty || 0) * Number(item.unitPrice || 0),
      0
    ) ||
    order.totalAmount ||
    0;

  const totalQuantity =
    order.details?.reduce((sum: number, item: any) => sum + Number(item.expectedQty || 0), 0) || 0;

  const orderDate = order.orderDate || order.createdAt ? new Date(order.orderDate || order.createdAt) : new Date();
  const day = orderDate.getDate().toString().padStart(2, '0');
  const month = (orderDate.getMonth() + 1).toString().padStart(2, '0');
  const year = orderDate.getFullYear();

  const supplierName = order.supplier?.name || order.supplierName || '..........................................................';
  const myCompanyName = companyName || 'CÔNG TY CỔ PHẦN ĐẦU TƯ VÀ CÔNG NGHỆ VIỆT HƯNG';

  return (
    <>
      <style>{`
        @media print {
          body > *:not(#printable-po-container) {
            display: none !important;
          }
          #printable-po-container {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: white !important;
            margin: 0 !important;
            padding: 20px !important;
          }
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
        }
      `}</style>
      <div
        id="printable-po-container"
        ref={ref}
        className="hidden print:block bg-white p-8 font-serif text-black w-full"
        style={{ WebkitPrintColorAdjust: 'exact', colorAdjust: 'exact' }}
      >
        {/* Header Quốc Hiệu Tiêu Ngữ */}
        <div className="text-center mb-6">
          <h2 className="font-bold text-base uppercase tracking-wide">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</h2>
          <p className="font-bold text-sm">Độc lập – Tự do – Hạnh phúc</p>
          <div className="w-44 h-0.5 bg-black mx-auto mt-1 mb-6"></div>

          <h1 className="text-2xl font-bold uppercase tracking-wider mb-1">ĐƠN ĐẶT HÀNG</h1>
          <p className="text-sm italic">
            Số: <b>{order.poNumber || '........'}</b>
          </p>
        </div>

        {/* Thông tin đơn đặt hàng */}
        <div className="mb-5 text-sm space-y-2 leading-relaxed">
          <p>
            Kính gửi: Công ty <b>{supplierName}</b>
          </p>
          <p>
            Công ty <b>{myCompanyName}</b> có nhu cầu đặt hàng tại Quý công ty theo mẫu yêu cầu.
          </p>
          <p className="font-bold uppercase mt-4">CHI TIẾT ĐƠN HÀNG:</p>
        </div>

        {/* Bảng sản phẩm */}
        <table className="w-full border-collapse border border-black text-sm mb-4">
          <thead>
            <tr className="text-center font-bold bg-gray-50">
              <th className="border border-black p-2 w-12">STT</th>
              <th className="border border-black p-2">Tên sản phẩm</th>
              <th className="border border-black p-2 w-32">Mã sản phẩm</th>
              <th className="border border-black p-2 w-24">Số lượng</th>
              <th className="border border-black p-2 w-32">Đơn giá</th>
              <th className="border border-black p-2 w-36">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {(order.details || []).map((detail: any, index: number) => {
              const expectedQty = Number(detail.expectedQty || 0);
              const price = Number(detail.unitPrice || 0);
              const lineTotal = detail.totalLineAmount ? Number(detail.totalLineAmount) : expectedQty * price;

              return (
                <tr key={detail.id || index}>
                  <td className="border border-black p-2 text-center">{index + 1}</td>
                  <td className="border border-black p-2 font-medium">{detail.product?.name || '-'}</td>
                  <td className="border border-black p-2 text-center font-mono">{detail.product?.internalSku || '-'}</td>
                  <td className="border border-black p-2 text-right font-semibold">{new Intl.NumberFormat('vi-VN').format(expectedQty)}</td>
                  <td className="border border-black p-2 text-right">{new Intl.NumberFormat('vi-VN').format(price)} đ</td>
                  <td className="border border-black p-2 text-right font-bold">{new Intl.NumberFormat('vi-VN').format(lineTotal)} đ</td>
                </tr>
              );
            })}
            <tr className="font-bold bg-gray-50">
              <td className="border border-black p-2 text-center" colSpan={3}>Cộng</td>
              <td className="border border-black p-2 text-right">{new Intl.NumberFormat('vi-VN').format(totalQuantity)}</td>
              <td className="border border-black p-2"></td>
              <td className="border border-black p-2 text-right">{new Intl.NumberFormat('vi-VN').format(totalAmount)} đ</td>
            </tr>
          </tbody>
        </table>

        {/* Viết bằng chữ */}
        <div className="mb-8 text-sm">
          <p className="italic">
            - Tổng số tiền (Viết bằng chữ): <span className="font-bold not-italic">{numberToVietnameseWords(totalAmount)}</span>
          </p>
        </div>

        {/* Chữ ký 2 bên: Người tạo đơn & Người phê duyệt */}
        <div className="flex justify-between text-sm text-center mt-10 px-6">
          <div className="w-1/2">
            <p className="font-bold uppercase">NGƯỜI TẠO ĐƠN</p>
            <p className="italic text-xs text-gray-600 mb-20">(Ký, ghi rõ họ tên)</p>
            <p className="font-bold">{order.creatorName || order.creator?.fullName || order.creator?.email || '................................'}</p>
          </div>
          <div className="w-1/2">
            <p className="italic text-xs mb-1">Ngày {day} tháng {month} năm {year}</p>
            <p className="font-bold uppercase">NGƯỜI PHÊ DUYỆT</p>
            <p className="italic text-xs text-gray-600 mb-20">(Ký, ghi rõ họ tên)</p>
            <p className="font-bold">{order.approverName || order.approver?.fullName || order.approver?.email || '................................'}</p>
          </div>
        </div>
      </div>
    </>
  );
});

PrintablePurchaseOrder.displayName = 'PrintablePurchaseOrder';
