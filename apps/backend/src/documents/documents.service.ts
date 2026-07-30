import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StockInOrder } from '../inbound/stock-in-orders/entities/stock-in-order.entity';
import { OutboundOrder } from '../outbound/entities/outbound-order.entity';
import { TransferOrder } from '../delivery/entities/delivery-order.entity';
import { Customer } from '../entities/customer.entity';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(StockInOrder)
    private readonly stockInOrderRepo: Repository<StockInOrder>,
    @InjectRepository(OutboundOrder)
    private readonly stockOutOrderRepo: Repository<OutboundOrder>,
    @InjectRepository(TransferOrder)
    private readonly transferOrderRepo: Repository<TransferOrder>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
  ) {}

  async getSalesInvoices() {
    const orders = await this.stockOutOrderRepo.find({
      relations: ['details', 'details.product', 'customer'],
    });

    return orders.map((order, idx) => ({
      id: order.id,
      invoiceNo: `HD-${new Date().getFullYear()}-${String(idx + 1).padStart(4, '0')}`,
      invoiceName: order.description?.trim() || order.orderNo || 'Hóa đơn bán hàng',
      orderCode: order.orderNo || `SO-${order.id.slice(0, 6)}`,
      customerName: order.customer?.name || 'Khách hàng cá nhân',
      customerTaxCode: '0101234567',
      address: order.customer?.address || 'Hà Nội, Việt Nam',
      issuedDate: order.expectedDate ? new Date(order.expectedDate).toISOString() : new Date().toISOString(),
      paymentMethod: 'Chuyển khoản / Tiền mặt',
      status: order.status || 'COMPLETED',
      items: (order.details || []).map((d) => ({
        id: d.id,
        productCode: d.product?.internalSku || 'SKU-ITEM',
        productName: d.product?.name || 'Sản phẩm kinh doanh',
        unit: d.product?.unit || 'Cái',
        quantity: d.requiredQty || 1,
        unitPrice: Number(d.unitPrice) || 5000000,
        taxRate: 10,
      })),
    }));
  }

  async getStockInNotes() {
    const orders = await this.stockInOrderRepo.find({
      order: { createdAt: 'DESC' },
      relations: ['details', 'details.product'],
    });

    return orders.map((order, idx) => ({
      id: order.id,
      receiptNo: order.orderCode || `PNK-${String(idx + 1).padStart(4, '0')}`,
      supplierName: 'Nhà cung cấp đối tác',
      warehouseName: 'Kho chính tổng',
      delivererName: order.currentStepUserEmail || 'Nguyễn Văn A',
      createdDate: order.createdAt ? new Date(order.createdAt).toISOString() : new Date().toISOString(),
      note: order.note || 'Nhập kho theo đơn đặt hàng',
      status: order.status || 'COMPLETED',
      items: (order.details || []).map((d) => ({
        id: d.id,
        productCode: d.product?.internalSku || 'SKU-001',
        productName: d.product?.name || 'Sản phẩm nhập kho',
        unit: d.product?.unit || 'Chiếc',
        quantityExpected: d.requestedQty || 1,
        quantityActual: d.actualQty || d.requestedQty || 1,
        unitPrice: Number(d.unitPrice) || 2500000,
      })),
    }));
  }

  async getStockOutNotes() {
    const orders = await this.stockOutOrderRepo.find({
      relations: ['details', 'details.product', 'customer'],
    });

    return orders.map((order, idx) => ({
      id: order.id,
      noteNo: `PXK-${new Date().getFullYear()}-${String(idx + 1).padStart(4, '0')}`,
      receiverName: order.customer?.name || 'Người nhận hàng',
      destinationAddress: order.customer?.address || 'Địa chỉ giao hàng',
      exportWarehouse: 'Kho xuất hàng tổng',
      createdDate: order.expectedDate ? new Date(order.expectedDate).toISOString() : new Date().toISOString(),
      reason: order.description || 'Xuất kho bán hàng theo hóa đơn',
      status: order.status || 'COMPLETED',
      items: (order.details || []).map((d) => ({
        id: d.id,
        productCode: d.product?.internalSku || 'SKU-OUT',
        productName: d.product?.name || 'Hàng xuất kho',
        unit: d.product?.unit || 'Bộ',
        quantity: d.requiredQty || 1,
        unitPrice: Number(d.unitPrice) || 4500000,
      })),
    }));
  }

  async getTransferNotes() {
    const orders = await this.transferOrderRepo.find({
      order: { createdAt: 'DESC' },
    });

    return orders.map((order) => ({
      id: order.id,
      transferNo: order.transferNo,
      commandNo: `LDD-${order.transferNo}`,
      sourceWarehouse: order.sourceWarehouse,
      destinationWarehouse: order.destinationWarehouse,
      transporterName: order.createdBy || 'Cán bộ điều vận',
      createdDate: order.createdAt ? new Date(order.createdAt).toISOString() : new Date().toISOString(),
      note: order.note || 'Điều chuyển nội bộ',
      status: order.status,
      items: (order.items || []).map((item, idx) => ({
        id: item.id || String(idx + 1),
        productCode: item.productCode || 'SKU-TRF',
        productName: item.productName || 'Sản phẩm điều chuyển',
        unit: item.unit || 'Cái',
        quantityExported: Number(item.quantity) || 1,
        quantityImported: Number(item.quantity) || 1,
        price: 10000000,
      })),
    }));
  }

  async getStats() {
    const [salesCount, stockInCount, stockOutCount, transferCount] = await Promise.all([
      this.stockOutOrderRepo.count(),
      this.stockInOrderRepo.count(),
      this.stockOutOrderRepo.count(),
      this.transferOrderRepo.count(),
    ]);

    return {
      totalSalesInvoices: salesCount,
      totalStockInNotes: stockInCount,
      totalStockOutNotes: stockOutCount,
      totalTransferNotes: transferCount,
    };
  }
}
