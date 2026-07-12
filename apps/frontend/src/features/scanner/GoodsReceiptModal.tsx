import React, { useRef } from 'react';
import './GoodsReceiptModal.css';
import { ScannedItem } from './ScannerPage';

interface GoodsReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  items: ScannedItem[];
  isSubmitting?: boolean;
  viewMode?: boolean;
  receiptNo?: string;
  receiptDate?: string;
  supplierName?: string;
}

const formatVND = (amount: number) => new Intl.NumberFormat('vi-VN').format(amount);

// Hàm đọc số thành chữ (đơn giản hóa)
function numberToWords(number: number): string {
  if (number === 0) return 'Không đồng';
  // Note: Đây là bản demo đơn giản. Để đầy đủ có thể dùng thư viện đọc số tiếng việt.
  return `${formatVND(number)} đồng`; 
}

export default function GoodsReceiptModal({
  isOpen,
  onClose,
  onConfirm,
  items,
  isSubmitting = false,
  viewMode = false,
  receiptNo,
  receiptDate,
  supplierName: propSupplierName
}: GoodsReceiptModalProps) {
  if (!isOpen) return null;

  const totalQty = items.reduce((sum, item) => sum + item.qty, 0);
  const totalAmount = items.reduce((sum, item) => sum + item.qty * (item.product.purchasePrice || 0), 0);
  
  // Thông tin giả lập nhà cung cấp (lấy từ sản phẩm đầu tiên có nhà cung cấp)
  const firstSupplier = items.find(item => item.product.supplier)?.product.supplier;
  const supplierName = propSupplierName || firstSupplier?.name || 'Khách lẻ / Chưa xác định';

  const today = new Date();
  const dateStr = receiptDate || `Ngày ${today.getDate().toString().padStart(2, '0')} Tháng ${(today.getMonth() + 1).toString().padStart(2, '0')} Năm ${today.getFullYear()}`;
  const displayReceiptNo = receiptNo || `NH${Date.now().toString().slice(-6)}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="receipt-modal-overlay">
      <div className="receipt-modal-content">
        
        {/* Vùng chỉ hiển thị trên màn hình, bị ẩn khi in */}
        <div className="receipt-modal-header no-print">
          <h2>Xác nhận Phiếu Nhập Kho</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Vùng in */}
        <div className="printable-receipt">
          <div className="receipt-header">
            <div className="company-info">
              <h3 style={{ textTransform: 'uppercase' }}>CÔNG TY TNHH QUẢN LÝ KHO</h3>
              <p>Địa chỉ: 123 Đường ABC, Quận X, TP Y</p>
              <p>Tel: 0123.456.789 - Hotline: 0987.654.321</p>
            </div>
            <div className="receipt-meta">
              <p>Số phiếu: <strong>{displayReceiptNo}</strong></p>
              <p>{dateStr}</p>
            </div>
          </div>

          <h1 className="receipt-title">PHIẾU NHẬP KHO</h1>

          <div className="supplier-info">
            <div className="info-row">
              <span className="label">Nhà cung cấp:</span>
              <span className="value border-bottom">{supplierName}</span>
              <span className="label" style={{ marginLeft: '20px' }}>SĐT:</span>
              <span className="value border-bottom">........................</span>
            </div>
            <div className="info-row">
              <span className="label">Địa chỉ:</span>
              <span className="value border-bottom">..........................................................................................</span>
            </div>
          </div>

          <table className="receipt-table">
            <thead>
              <tr>
                <th>STT</th>
                <th>Mã hàng</th>
                <th>Tên hàng</th>
                <th>ĐVT</th>
                <th>Số lượng</th>
                <th>Đơn giá</th>
                <th>% CK</th>
                <th>Thành tiền</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const price = item.product.purchasePrice || 0;
                const total = item.qty * price;
                return (
                  <tr key={index}>
                    <td style={{ textAlign: 'center' }}>{index + 1}</td>
                    <td style={{ textAlign: 'center' }}>{item.product.internalSku || item.product.supplierBarcode}</td>
                    <td>{item.product.name}</td>
                    <td style={{ textAlign: 'center' }}>{item.product.unit || 'Cái'}</td>
                    <td style={{ textAlign: 'center' }}>{item.qty}</td>
                    <td style={{ textAlign: 'right' }}>{formatVND(price)}</td>
                    <td style={{ textAlign: 'center' }}></td>
                    <td style={{ textAlign: 'right' }}>{formatVND(total)}</td>
                    <td></td>
                  </tr>
                );
              })}
              <tr className="font-bold">
                <td colSpan={4} style={{ textAlign: 'center' }}>Tổng cộng (1)</td>
                <td style={{ textAlign: 'center' }}>{totalQty}</td>
                <td></td>
                <td></td>
                <td style={{ textAlign: 'right' }}>{formatVND(totalAmount)}</td>
                <td></td>
              </tr>
              <tr className="font-bold">
                <td colSpan={7} style={{ textAlign: 'center' }}>Nợ cũ (2)</td>
                <td style={{ textAlign: 'right' }}>0</td>
                <td></td>
              </tr>
              <tr className="font-bold">
                <td colSpan={7} style={{ textAlign: 'center' }}>Số tiền thanh toán (3)</td>
                <td style={{ textAlign: 'right' }}>0</td>
                <td></td>
              </tr>
              <tr className="font-bold">
                <td colSpan={7} style={{ textAlign: 'center' }}>Còn nợ (1 + 2 - 3)</td>
                <td style={{ textAlign: 'right' }}>{formatVND(totalAmount)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>

          <div className="amount-in-words">
            <p>Số tiền bằng chữ: <i>{numberToWords(totalAmount)}</i></p>
          </div>

          <div className="signatures">
            <div className="signature-box">
              <p className="font-bold" style={{textTransform: 'uppercase'}}>Thủ kho</p>
              <p className="italic">(Ký, họ tên)</p>
            </div>
            <div className="signature-box">
              <p className="italic">{dateStr}</p>
              <p className="font-bold" style={{textTransform: 'uppercase'}}>Người giao hàng</p>
              <p className="italic">(Ký, họ tên)</p>
            </div>
          </div>
        </div>

        {/* Vùng chức năng (Không in) */}
        <div className="receipt-modal-actions no-print">
          {viewMode ? (
            <>
              <button className="btn btn-secondary" onClick={onClose}>Đóng</button>
              <button className="btn btn-info" onClick={handlePrint}>🖨 In phiếu</button>
            </>
          ) : (
            <>
              <button className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>Hủy bỏ</button>
              <button className="btn btn-info" onClick={handlePrint} disabled={isSubmitting}>🖨 In phiếu</button>
              <button className="btn btn-primary" onClick={onConfirm} disabled={isSubmitting}>
                {isSubmitting ? '⏳ Đang xử lý...' : '✓ Xác nhận Tạo phiếu'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
