import React from 'react';
import Inbound from '../Inbound';

export default function ReturnSupplierPage() {
  return (
    <Inbound
      featureMode="return-supplier"
      title="DANH SÁCH PHIẾU XUẤT TRẢ NHÀ CUNG CẤP"
      codePrefix="XNCC"
      partnerLabel="Nhà cung cấp"
    />
  );
}
