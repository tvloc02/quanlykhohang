
import React from "react";
import { numberToVietnameseWords } from "../../../utils/numberToVietnamese";

type Props = {
  order: any;
};

export const PrintableStockInReceipt = React.forwardRef<HTMLDivElement, Props>(({ order }, ref) => {
  if (!order) return null;

  const totalAmount = order.details?.reduce((sum: number, item: any) => sum + (Number(item.actualQty || item.requestedQty || 0) * Number(item.unitPrice || 0)), 0) || 0;
  
  const createdDate = order.createdAt ? new Date(order.createdAt) : new Date();

  return (
    <div ref={ref} className="hidden print:block bg-white p-8 font-serif text-black w-full" style={{ WebkitPrintColorAdjust: "exact", colorAdjust: "exact" }}>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="font-bold text-base">CÔNG TY CỔ PHẦN ĐẦU TƯ VÀ CÔNG NGHỆ VIỆT HƯNG</h2>
          <p className="text-sm">Số 2, ngách 84/2 đường Trần Quang Diệu, Phường Ô Chợ Dừa,</p>
          <p className="text-sm">Quận Đống đa, Thành phố Hà Nội, Việt Nam</p>
        </div>
        <div className="text-center">
          <p className="font-bold text-base">Mẫu số: 01 - VT</p>
          <p className="text-xs italic">(Ban hành theo Thông tư số 200/2014/TT-BTC</p>
          <p className="text-xs italic">Ngày 22/12/2014 của Bộ Tài chính)</p>
        </div>
      </div>

      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold mb-1">PHIẾU NHẬP KHO</h1>
        <div className="flex justify-center gap-12 text-sm">
          <p className="italic">Ngày {createdDate.getDate().toString().padStart(2, "0")} tháng {(createdDate.getMonth() + 1).toString().padStart(2, "0")} năm {createdDate.getFullYear()}</p>
          <div className="text-left">
            <p>Nợ: ........</p>
            <p>Có: ........</p>
          </div>
        </div>
        <p className="text-sm">Số: <b>{order.orderCode}</b></p>
      </div>

      <div className="mb-4 text-sm space-y-1">
        <p>- Họ và tên người giao: <b>{order.currentStepUserEmail || order.sourcePurchaseOrder?.supplier?.name || ".........................................................."}</b></p>
        <p>- Theo hóa đơn số {order.sourcePurchaseOrderNo || "..............."} ngày {createdDate.getDate().toString().padStart(2, "0")} tháng {(createdDate.getMonth() + 1).toString().padStart(2, "0")} năm {createdDate.getFullYear()} của <b>{order.sourcePurchaseOrder?.supplier?.name || "...................................."}</b></p>
        <p>- Nhập tại kho: <b>KHO-NVL</b> <span className="ml-8">Địa điểm: ..............................................................</span></p>
      </div>

      <table className="w-full border-collapse border border-black text-sm mb-4">
        <thead>
          <tr className="text-center font-bold">
            <th className="border border-black p-1 w-10" rowSpan={2}>STT</th>
            <th className="border border-black p-1" rowSpan={2}>Tên, nhãn hiệu, quy cách, phẩm chất vật tư, dụng cụ sản phẩm, hàng hóa</th>
            <th className="border border-black p-1 w-24" rowSpan={2}>Mã số</th>
            <th className="border border-black p-1 w-16" rowSpan={2}>Đơn vị tính</th>
            <th className="border border-black p-1" colSpan={2}>Số lượng</th>
            <th className="border border-black p-1 w-24" rowSpan={2}>Đơn giá</th>
            <th className="border border-black p-1 w-32" rowSpan={2}>Thành tiền</th>
          </tr>
          <tr className="text-center font-bold">
            <th className="border border-black p-1 w-16">Theo chứng từ</th>
            <th className="border border-black p-1 w-16">Thực nhập</th>
          </tr>
          <tr className="text-center font-bold bg-gray-100">
            <td className="border border-black p-1">A</td>
            <td className="border border-black p-1">B</td>
            <td className="border border-black p-1">C</td>
            <td className="border border-black p-1">D</td>
            <td className="border border-black p-1">1</td>
            <td className="border border-black p-1">2</td>
            <td className="border border-black p-1">3</td>
            <td className="border border-black p-1">4</td>
          </tr>
        </thead>
        <tbody>
          {(order.details || []).map((detail: any, index: number) => {
            const actualQty = Number(detail.actualQty || detail.requestedQty || 0);
            const requestedQty = Number(detail.requestedQty || 0);
            const price = Number(detail.unitPrice || 0);
            const lineTotal = actualQty * price;

            return (
              <tr key={detail.id || index}>
                <td className="border border-black p-1 text-center">{index + 1}</td>
                <td className="border border-black p-1">{detail.product?.name || ""}</td>
                <td className="border border-black p-1 text-center">{detail.product?.internalSku || ""}</td>
                <td className="border border-black p-1 text-center">{detail.product?.unit || "Cái"}</td>
                <td className="border border-black p-1 text-right">{new Intl.NumberFormat("vi-VN").format(requestedQty)}</td>
                <td className="border border-black p-1 text-right">{new Intl.NumberFormat("vi-VN").format(actualQty)}</td>
                <td className="border border-black p-1 text-right">{new Intl.NumberFormat("vi-VN").format(price)}</td>
                <td className="border border-black p-1 text-right">{new Intl.NumberFormat("vi-VN").format(lineTotal)}</td>
              </tr>
            );
          })}
          <tr className="font-bold">
            <td className="border border-black p-1 text-center" colSpan={4}>Cộng</td>
            <td className="border border-black p-1 text-right">
              {new Intl.NumberFormat("vi-VN").format(order.details?.reduce((s: number, d: any) => s + Number(d.requestedQty || 0), 0) || 0)}
            </td>
            <td className="border border-black p-1 text-right">
              {new Intl.NumberFormat("vi-VN").format(order.details?.reduce((s: number, d: any) => s + Number(d.actualQty || d.requestedQty || 0), 0) || 0)}
            </td>
            <td className="border border-black p-1"></td>
            <td className="border border-black p-1 text-right">{new Intl.NumberFormat("vi-VN").format(totalAmount)}</td>
          </tr>
        </tbody>
      </table>

      <div className="mb-6 text-sm">
        <p className="mb-1">- Tổng số tiền (Viết bằng chữ): <span className="font-bold italic">{numberToVietnameseWords(totalAmount)}</span></p>
        <p>- Số chứng từ gốc kèm theo: ........................................................................................</p>
      </div>

      <div className="flex justify-between text-sm text-center">
        <div>
          <p className="font-bold">Người lập phiếu</p>
          <p className="italic mb-16">(Ký, họ tên)</p>
        </div>
        <div>
          <p className="font-bold">Người giao hàng</p>
          <p className="italic mb-16">(Ký, họ tên)</p>
        </div>
        <div>
          <p className="font-bold">Thủ kho</p>
          <p className="italic mb-16">(Ký, họ tên)</p>
        </div>
        <div>
          <p className="italic mb-1">Ngày {createdDate.getDate().toString().padStart(2, "0")} tháng {(createdDate.getMonth() + 1).toString().padStart(2, "0")} năm {createdDate.getFullYear()}</p>
          <p className="font-bold">Kế toán trưởng</p>
          <p className="italic mb-16">(Hoặc bộ phận có nhu cầu nhập)<br/>(Ký, họ tên)</p>
        </div>
      </div>
    </div>
  );
});

