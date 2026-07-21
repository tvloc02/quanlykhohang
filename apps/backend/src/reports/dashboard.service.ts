import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StockBalance } from '../inventory/entities/stock-balance.entity';
import { Product } from '../entities/product.entity';
import { Category } from '../entities/category.entity';
import { InboundReceipt } from '../inbound/entities/inbound-receipt.entity';
import { OutboundOrder } from '../outbound/entities/outbound-order.entity';
import { PickingTask } from '../outbound/entities/picking-task.entity';
import { Customer } from '../entities/customer.entity';
import { Supplier } from '../entities/supplier.entity';
import { Role } from '../entities/role.entity';
import { User } from '../entities/user.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(StockBalance) private stockRepo: Repository<StockBalance>,
    @InjectRepository(Product) private productRepo: Repository<Product>,
    @InjectRepository(Category) private categoryRepo: Repository<Category>,
    @InjectRepository(InboundReceipt) private inboundRepo: Repository<InboundReceipt>,
    @InjectRepository(OutboundOrder) private outboundRepo: Repository<OutboundOrder>,
    @InjectRepository(PickingTask) private pickingTaskRepo: Repository<PickingTask>,
    @InjectRepository(Customer) private customerRepo: Repository<Customer>,
    @InjectRepository(Supplier) private supplierRepo: Repository<Supplier>,
    @InjectRepository(Role) private roleRepo: Repository<Role>,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  async getDashboardOverview() {
    const [
      totalUsers,
      totalRoles,
      totalProducts,
      totalCategories,
      totalSuppliers,
      totalCustomers,
      stockTotals,
      totalLocations,
      lowStockItems,
      totalInboundReceipts,
      inboundStatusRows,
      totalOutboundOrders,
      outboundStatusRows,
      openPickingTasks,
      barcodeMappedProducts,
    ] = await Promise.all([
      this.userRepo.count(),
      this.roleRepo.count(),
      this.productRepo.count(),
      this.categoryRepo.count(),
      this.supplierRepo.count(),
      this.customerRepo.count(),
      this.stockRepo
        .createQueryBuilder('balance')
        .select('COALESCE(SUM(balance.totalPhysical), 0)', 'totalPhysical')
        .addSelect('COALESCE(SUM(balance.allocated), 0)', 'allocated')
        .addSelect('COALESCE(SUM(balance.available), 0)', 'available')
        .getRawOne(),
      this.stockRepo
        .createQueryBuilder('balance')
        .select('COUNT(DISTINCT balance.locationCode)', 'count')
        .getRawOne(),
      this.getLowStockCount(),
      this.inboundRepo.count(),
      this.getStatusCounts(this.inboundRepo, 'receipt'),
      this.outboundRepo.count(),
      this.getStatusCounts(this.outboundRepo, 'outboundOrder'),
      this.pickingTaskRepo
        .createQueryBuilder('task')
        .where('task.status != :completed', { completed: 'COMPLETED' })
        .getCount(),
      this.productRepo
        .createQueryBuilder('product')
        .where('product.supplierBarcode IS NOT NULL')
        .andWhere("product.supplierBarcode != ''")
        .getCount(),
    ]);

    const inboundByStatus = this.toStatusMap(inboundStatusRows);
    const outboundByStatus = this.toStatusMap(outboundStatusRows);

    return {
      generatedAt: new Date().toISOString(),
      accessControl: {
        users: totalUsers,
        roles: totalRoles,
      },
      partners: {
        suppliers: totalSuppliers,
        customers: totalCustomers,
      },
      catalog: {
        products: totalProducts,
        categories: totalCategories,
        barcodeMappedProducts,
      },
      inventory: {
        totalPhysical: Number(stockTotals?.totalPhysical || 0),
        allocated: Number(stockTotals?.allocated || 0),
        available: Number(stockTotals?.available || 0),
        locations: Number(totalLocations?.count || 0),
        lowStockItems,
      },
      inbound: {
        totalReceipts: totalInboundReceipts,
        byStatus: inboundByStatus,
        openReceipts: this.sumStatuses(inboundByStatus, ['CREATED', 'PARTIALLY_RECEIVED']),
        completedReceipts: this.sumStatuses(inboundByStatus, ['RECEIVED', 'APPROVED']),
      },
      outbound: {
        totalOrders: totalOutboundOrders,
        byStatus: outboundByStatus,
        openOrders: this.sumStatuses(outboundByStatus, ['CREATED', 'PENDING', 'PICKING', 'PICKED', 'READY_TO_SHIP']),
        completedOrders: this.sumStatuses(outboundByStatus, ['CONFIRMED', 'SHIPPED', 'COMPLETED']),
        openPickingTasks,
      },
    };
  }

  private async getStatusCounts<T extends { status?: string }>(repo: Repository<T>, alias: string) {
    return repo
      .createQueryBuilder(alias)
      .select(`${alias}.status`, 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy(`${alias}.status`)
      .getRawMany<{ status: string | null; count: string }>();
  }

  private toStatusMap(rows: { status: string | null; count: string }[]) {
    return rows.reduce<Record<string, number>>((result, row) => {
      result[row.status || 'UNKNOWN'] = Number(row.count || 0);
      return result;
    }, {});
  }

  private sumStatuses(statusMap: Record<string, number>, statuses: string[]) {
    return statuses.reduce((total, status) => total + (statusMap[status] || 0), 0);
  }

  private async getLowStockCount() {
    return this.stockRepo
      .createQueryBuilder('balance')
      .innerJoin('balance.product', 'product')
      .where('balance.available < COALESCE(product.minimumStock, 0)')
      .getCount();
  }

  async getStockReport(locationCode?: string) {
    const qb = this.stockRepo.createQueryBuilder('balance')
      .leftJoinAndSelect('balance.product', 'product');

    if (locationCode) {
      qb.where('balance.locationCode = :locationCode', { locationCode });
    }

    const balances = await qb.getMany();
    return balances.map((balance) => ({
      id: balance.id,
      product: {
        id: balance.product.id,
        name: balance.product.name,
        internalSku: balance.product.internalSku,
      },
      locationCode: balance.locationCode,
      totalPhysical: balance.totalPhysical,
      allocated: balance.allocated,
      available: balance.available,
      lowStock: balance.available < (balance.product.minimumStock || 0),
    }));
  }

  async getLowStockReport() {
    const balances = await this.stockRepo.find({ relations: ['product'] });
    return balances.filter((balance) => balance.available < (balance.product.minimumStock || 0)).map((balance) => ({
      id: balance.id,
      product: {
        id: balance.product.id,
        name: balance.product.name,
        internalSku: balance.product.internalSku,
      },
      locationCode: balance.locationCode,
      totalPhysical: balance.totalPhysical,
      allocated: balance.allocated,
      available: balance.available,
      minimumStock: balance.product.minimumStock,
    }));
  }

  async getInboundHistory(startDate?: string, endDate?: string) {
    const qb = this.inboundRepo.createQueryBuilder('receipt')
      .leftJoinAndSelect('receipt.details', 'detail')
      .leftJoinAndSelect('detail.product', 'product')
      .leftJoinAndSelect('receipt.supplier', 'supplier');

    if (startDate) {
      qb.andWhere('receipt.expectedDate >= :startDate', { startDate });
    }
    if (endDate) {
      qb.andWhere('receipt.expectedDate <= :endDate', { endDate });
    }

    const receipts = await qb.orderBy('receipt.expectedDate', 'DESC').getMany();
    return receipts.map((receipt) => ({
      id: receipt.id,
      supplier: receipt.supplier ? { id: receipt.supplier.id, name: receipt.supplier.name } : null,
      expectedDate: receipt.expectedDate,
      status: receipt.status,
      details: receipt.details.map((detail) => ({
        id: detail.id,
        product: { id: detail.product.id, name: detail.product.name, internalSku: detail.product.internalSku },
        expectedQty: detail.expectedQty,
        receivedQty: detail.receivedQty,
      })),
    }));
  }

  async getOutboundHistory(startDate?: string, endDate?: string) {
    const qb = this.outboundRepo.createQueryBuilder('order')
      .leftJoinAndSelect('order.details', 'detail')
      .leftJoinAndSelect('detail.product', 'product')
      .leftJoinAndSelect('order.customer', 'customer');

    if (startDate) {
      qb.andWhere('order.expectedDate >= :startDate', { startDate });
    }
    if (endDate) {
      qb.andWhere('order.expectedDate <= :endDate', { endDate });
    }

    const orders = await qb.orderBy('order.expectedDate', 'DESC').getMany();
    return orders.map((order) => ({
      id: order.id,
      customer: order.customer ? { id: order.customer.id, name: order.customer.name } : null,
      expectedDate: order.expectedDate,
      status: order.status,
      details: order.details.map((detail) => ({
        id: detail.id,
        product: { id: detail.product.id, name: detail.product.name, internalSku: detail.product.internalSku },
        requiredQty: detail.requiredQty,
        pickedQty: detail.pickedQty,
      })),
    }));
  }

  /**
   * US 6.3 – Trend xuất nhập tồn kho theo tuần/tháng
   * Trả về mảng { label, inbound, outbound, available } để vẽ biểu đồ
   */
  async getStockTrend(period: 'week' | 'month' = 'week') {
    const points = period === 'week' ? 8 : 6;
    const unitDays = period === 'week' ? 7 : 30;
    const result: Array<{ label: string; inbound: number; outbound: number; available: number }> = [];

    for (let i = points - 1; i >= 0; i--) {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() - i * unitDays);
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - unitDays);

      const label = period === 'week'
        ? `T${String(endDate.getDate()).padStart(2, '0')}/${String(endDate.getMonth() + 1).padStart(2, '0')}`
        : `${endDate.toLocaleString('vi-VN', { month: 'short' })} ${endDate.getFullYear()}`;

      const [inboundAgg, outboundAgg, availableAgg] = await Promise.all([
        this.inboundRepo.createQueryBuilder('r')
          .innerJoin('r.details', 'd')
          .select('COALESCE(SUM(d.receivedQty), 0)', 'total')
          .where('r.orderDate BETWEEN :s AND :e', { s: startDate.toISOString(), e: endDate.toISOString() })
          .getRawOne<{ total: string }>(),
        this.outboundRepo.createQueryBuilder('o')
          .innerJoin('o.details', 'd')
          .select('COALESCE(SUM(d.pickedQty), 0)', 'total')
          .where('o.expectedDate BETWEEN :s AND :e', { s: startDate.toISOString(), e: endDate.toISOString() })
          .getRawOne<{ total: string }>(),
        this.stockRepo.createQueryBuilder('b')
          .select('COALESCE(SUM(b.available), 0)', 'total')
          .getRawOne<{ total: string }>(),
      ]);

      result.push({
        label,
        inbound: Number(inboundAgg?.total || 0),
        outbound: Number(outboundAgg?.total || 0),
        available: Number(availableAgg?.total || 0),
      });
    }

    return result;
  }

  /**
   * US 6.4 – Cảnh báo tồn kho thấp
   * Trả về danh sách sản phẩm đang có available < minimumStock
   */
  async getLowStockAlerts() {
    const balances = await this.stockRepo.createQueryBuilder('balance')
      .innerJoinAndSelect('balance.product', 'product')
      .where('balance.available < COALESCE(product.minimumStock, 0)')
      .orderBy('balance.available', 'ASC')
      .getMany();

    return balances.map((b) => ({
      id: b.id,
      locationCode: b.locationCode,
      available: b.available,
      allocated: b.allocated,
      product: {
        id: b.product.id,
        name: b.product.name,
        internalSku: b.product.internalSku,
        minimumStock: b.product.minimumStock,
        unit: b.product.unit,
      },
      severity: b.available === 0 ? 'critical' : b.available < (b.product.minimumStock || 0) * 0.5 ? 'high' : 'medium',
    }));
  }
}
