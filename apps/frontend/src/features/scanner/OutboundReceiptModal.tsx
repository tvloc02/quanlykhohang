import React from 'react';
import './GoodsReceiptModal.css';
import { ScannedItem } from './ScannerPage';

interface OutboundReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  items: ScannedItem[];
  isSubmitting?: boolean;
}

const formatVND = (amount: number) => new Intl.NumberFormat('vi-VN').format(amount);

export default function OutboundReceiptModal({
  isOpen,
  onClose,
  onConfirm,
  items,
  isSubmitting = false,
}: OutboundReceiptModalProps) {
  if (!isOpen) return null;

  const totalQty = items.reduce((sum, item) => sum + item.qty, 0);

  const today = new Date();
  const dateStr = `Ngày ${today.getDate().toString().padStart(2, '0')} Tháng ${(today.getMonth() + 1).toString().padStart(2, '0')} Năm ${today.getFullYear()}`;
  const displayReceiptNo = `XK${Date.now().toString().slice(-6)}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="receipt-modal-overlay">
      <div className="receipt-modal-content">

        {/* Vùng chỉ hiển thị trên màn hình */}
        <div className="receipt-modal-header no-print">
          <h2>Xác nhận Phiếu Xuất Kho</h2>
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

          <h1 className="receipt-title">PHIẾU XUẤT KHO</h1>

          <div className="supplier-info">
            <div className="info-row">
              <span className="label">Người nhận:</span>
              <span className="value border-bottom">........................................................................................</span>
            </div>
            <div className="info-row">
              <span className="label">Lý do xuất:</span>
              <span className="value border-bottom">........................................................................................</span>
            </div>
            <div className="info-row">
              <span className="label">Xuất tại kho:</span>
              <span className="value border-bottom">........................................................................................</span>
            </div>
          </div>

          <table className="receipt-table">
            <thead>
              <tr>
                <th>STT</th>
                <th>Mã hàng</th>
                <th>Tên hàng</th>
                <th>ĐVT</th>
                <th>SL yêu cầu</th>
                <th>SL thực xuất</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index}>
                  <td style={{ textAlign: 'center' }}>{index + 1}</td>
                  <td style={{ textAlign: 'center' }}>{item.product.internalSku || item.product.supplierBarcode}</td>
                  <td>{item.product.name}</td>
                  <td style={{ textAlign: 'center' }}>{item.product.unit || 'Cái'}</td>
                  <td style={{ textAlign: 'center' }}>{item.qty}</td>
                  <td style={{ textAlign: 'center' }}></td>
                  <td></td>
                </tr>
              ))}
              <tr className="font-bold">
                <td colSpan={4} style={{ textAlign: 'center' }}>Tổng cộng</td>
                <td style={{ textAlign: 'center' }}>{totalQty}</td>
                <td></td>
                <td></td>
              </tr>
            </tbody>
          </table>

          <div className="signatures">
            <div className="signature-box">
              <p className="font-bold" style={{ textTransform: 'uppercase' }}>Thủ kho</p>
              <p className="italic">(Ký, họ tên)</p>
            </div>
            <div className="signature-box">
              <p className="font-bold" style={{ textTransform: 'uppercase' }}>Người vận chuyển</p>
              <p className="italic">(Ký, họ tên)</p>
            </div>
            <div className="signature-box">
              <p className="italic">{dateStr}</p>
              <p className="font-bold" style={{ textTransform: 'uppercase' }}>Người nhận</p>
              <p className="italic">(Ký, họ tên)</p>
            </div>
          </div>
        </div>

        {/* Vùng chức năng (Không in) */}
        <div className="receipt-modal-actions no-print">
          <button className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>Hủy bỏ</button>
          <button className="btn btn-info" onClick={handlePrint} disabled={isSubmitting}>🖨 In phiếu</button>
          <button className="btn btn-primary" onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? '⏳ Đang xử lý...' : '✓ Xác nhận Tạo phiếu xuất'}
          </button>
        </div>
      </div>
    </div>
  );
}
