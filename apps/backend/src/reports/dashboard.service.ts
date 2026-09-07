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
import { Warehouse } from '../entities/warehouse.entity';
import { calculateAggregatedStock } from '../products/products.service';

function parseSafeDate(dateStr?: string): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const s = dateStr.trim();
  if (!s) return null;

  if (s.includes('/')) {
    const parts = s.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
    }
  }

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

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
    @InjectRepository(Warehouse) private warehouseRepo: Repository<Warehouse>,
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
    const qb = this.stockRepo.createQueryBuilder('balance').leftJoinAndSelect('balance.product', 'product');

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

  /**
   * BÁO CÁO BÁN HÀNG (REAL DATABASE QUERY)
   */
  /**
   * BÁO CÁO BÁN HÀNG (REAL DATABASE QUERY)
   */
  async getSalesReport(startDate?: string, endDate?: string, groupBy: string = 'day') {
    const qb = this.outboundRepo.createQueryBuilder('o')
      .leftJoin('o.details', 'd')
      .where('(o.orderType IS NULL OR o.orderType != :disposalType)', { disposalType: 'disposal' })
      .andWhere('(o.orderNo IS NULL OR o.orderNo NOT LIKE :xhPrefix)', { xhPrefix: 'XH%' })
      .select('DATE(o.createdAt)', 'date')
      .addSelect('COUNT(DISTINCT o.id)', 'salesOrderCount')
      .addSelect('COALESCE(SUM(CAST(d.totalLineAmount AS DECIMAL(14,2))), 0)', 'revenue')
      .groupBy('DATE(o.createdAt)')
      .orderBy('DATE(o.createdAt)', 'DESC');

    const sDate = parseSafeDate(startDate);
    const eDate = parseSafeDate(endDate);
    if (sDate) {
      qb.andWhere('o.createdAt >= :sDate', { sDate });
    }
    if (eDate) {
      const endOfDay = new Date(eDate);
      endOfDay.setHours(23, 59, 59, 999);
      qb.andWhere('o.createdAt <= :eDate', { eDate: endOfDay });
    }

    const rows = await qb.getRawMany().catch(() => []);
    return rows.map((r, idx) => ({
      id: String(idx + 1),
      dateOrName: r.date ? new Date(r.date).toLocaleDateString('vi-VN') : 'Hôm nay',
      salesOrderCount: Number(r.salesOrderCount || 0),
      revenue: Number(r.revenue || 0),
      discount: 0,
      returnOrderCount: 0,
      returnAmount: 0,
      netRevenue: Number(r.revenue || 0),
    }));
  }

  /**
   * BÁO CÁO DOANH THU (REAL DATABASE QUERY FOR ALL WAREHOUSES)
   */
  async getRevenueReport(startDate?: string, endDate?: string, branch?: string) {
    const rawWarehouses = await this.warehouseRepo.find().catch(() => []);
    const allWarehouses = rawWarehouses.filter((w) => w.status !== 'inactive');

    const qb = this.outboundRepo.createQueryBuilder('o')
      .leftJoin('o.details', 'd')
      .leftJoin('o.customer', 'c')
      .leftJoin('warehouses', 'w', 'w.code = d.warehouseCode')
      .where('(o.orderType IS NULL OR o.orderType != :disposalType)', { disposalType: 'disposal' })
      .andWhere('(o.orderNo IS NULL OR o.orderNo NOT LIKE :xhPrefix)', { xhPrefix: 'XH%' })
      .select("COALESCE(w.name, d.warehouseCode, 'Kho không xác định')", 'groupName')
      .addSelect("COALESCE(w.code, d.warehouseCode, '')", 'groupCode')
      .addSelect("COALESCE(c.name, 'Khách hàng')", 'staffName')
      .addSelect('COALESCE(SUM(CAST(d.totalLineAmount AS DECIMAL(14,2))), 0)', 'revenue')
      .groupBy("COALESCE(w.name, d.warehouseCode, 'Kho không xác định')")
      .addGroupBy("COALESCE(w.code, d.warehouseCode, '')")
      .addGroupBy("COALESCE(c.name, 'Khách hàng')");

    const sDate = parseSafeDate(startDate);
    const eDate = parseSafeDate(endDate);
    if (sDate) {
      qb.andWhere('o.createdAt >= :sDate', { sDate });
    }
    if (eDate) {
      const endOfDay = new Date(eDate);
      endOfDay.setHours(23, 59, 59, 999);
      qb.andWhere('o.createdAt <= :eDate', { eDate: endOfDay });
    }

    const rows = await qb.getRawMany().catch(() => []);
    const groupsMap = new Map<string, any[]>();

    allWarehouses.forEach((wh) => {
      const gName = wh.name || `Kho ${wh.code}`;
      const gCode = wh.code || '';
      const groupKey = `${gName}::${gCode}`;
      if (!groupsMap.has(groupKey)) {
        groupsMap.set(groupKey, []);
      }
    });

    rows.forEach((r, idx) => {
      const gName = r.groupName || 'Kho không xác định';
      const gCode = r.groupCode || '';
      let groupKey = `${gName}::${gCode}`;

      if (!groupsMap.has(groupKey) && gCode) {
        const foundKey = Array.from(groupsMap.keys()).find((k) => k.endsWith(`::${gCode}`));
        if (foundKey) groupKey = foundKey;
      }

      if (!groupsMap.has(groupKey)) groupsMap.set(groupKey, []);
      groupsMap.get(groupKey)?.push({
        id: String(idx + 1),
        staffName: r.staffName,
        revenue: Number(r.revenue || 0),
        returnAmount: 0,
        netRevenue: Number(r.revenue || 0),
        cashReceived: Number(r.revenue || 0),
      });
    });

    return Array.from(groupsMap.entries()).map(([groupKey, items]) => {
      const [groupName, groupCode = ''] = groupKey.split('::');
      if (items.length === 0) {
        items.push({
          id: `empty_${groupCode || groupName}`,
          staffName: `Kho ${groupName} (Chưa phát sinh xuất hàng)`,
          revenue: 0,
          returnAmount: 0,
          netRevenue: 0,
          cashReceived: 0,
        });
      }
      return { groupName, groupCode, items };
    });
  }

  async getCashflowReport(startDate?: string, endDate?: string, branch?: string) {
    const sDate = parseSafeDate(startDate);
    const eDate = parseSafeDate(endDate);

    const inboundQb = this.inboundRepo.createQueryBuilder('i')
      .select('COALESCE(SUM(CAST(i.totalAmount AS DECIMAL(15,2))), 0)', 'total');
    const outboundQb = this.outboundRepo.createQueryBuilder('o')
      .leftJoin('o.details', 'd')
      .where('(o.orderType IS NULL OR o.orderType != :disposalType)', { disposalType: 'disposal' })
      .andWhere('(o.orderNo IS NULL OR o.orderNo NOT LIKE :xhPrefix)', { xhPrefix: 'XH%' })
      .select('COALESCE(SUM(CAST(d.totalLineAmount AS DECIMAL(14,2))), 0)', 'total');

    if (sDate) {
      inboundQb.andWhere('i.createdAt >= :sDate', { sDate });
      outboundQb.andWhere('o.createdAt >= :sDate', { sDate });
    }
    if (eDate) {
      const endOfDay = new Date(eDate);
      endOfDay.setHours(23, 59, 59, 999);
      inboundQb.andWhere('i.createdAt <= :eDate', { eDate: endOfDay });
      outboundQb.andWhere('o.createdAt <= :eDate', { eDate: endOfDay });
    }

    const [inboundTotal, outboundTotal] = await Promise.all([
      inboundQb.getRawOne<{ total: string }>().catch(() => ({ total: '0' })),
      outboundQb.getRawOne<{ total: string }>().catch(() => ({ total: '0' })),
    ]);

    const income = Number(outboundTotal?.total || 0);
    const expense = Number(inboundTotal?.total || 0);
    const balance = income - expense;

    return [
      {
        groupName: 'Tổng quan thu chi hệ thống',
        items: [
          { id: '1', title: 'Tồn quỹ đầu kỳ', income: 0, expense: 0, balance: 0 },
          { id: '2', title: 'Tổng doanh thu bán hàng (Thu)', income, expense: 0, balance: income },
          { id: '3', title: 'Tổng chi phí nhập hàng (Chi)', income: 0, expense, balance: -expense },
          { id: '4', title: 'Tồn quỹ cuối kỳ', income, expense, balance },
        ],
      },
    ];
  }

  /**
   * BÁO CÁO HÀNG TỒN KHO & HÀNG TỒN THEO ĐƠN VỊ GỐC (MATCHES PRODUCTS CATALOG STOCK EXACTLY & SAFE DATES)
   */
  async getInventorySummaryReport(startDate?: string, endDate?: string, categoryId?: string, groupBy: string = 'category') {
    try {
      const products = await this.productRepo.find({
        relations: ['category', 'supplier'],
      });

      const stockBalances = await this.stockRepo.find({
        relations: ['product'],
      }).catch(() => []);

      const sDate = parseSafeDate(startDate);
      const eDate = parseSafeDate(endDate);

      let inbounds: InboundReceipt[] = [];
      try {
        const inboundQb = this.inboundRepo.createQueryBuilder('i')
          .leftJoinAndSelect('i.details', 'd')
          .leftJoinAndSelect('d.product', 'p');
        if (sDate) {
          inboundQb.andWhere('(i.createdAt >= :sDate OR i.orderDate >= :sDate)', { sDate });
        }
        if (eDate) {
          const endOfDay = new Date(eDate);
          endOfDay.setHours(23, 59, 59, 999);
          inboundQb.andWhere('(i.createdAt <= :eDate OR i.orderDate <= :eDate)', { eDate: endOfDay });
        }
        inbounds = await inboundQb.getMany();
      } catch (err) {
        inbounds = [];
      }

      let outbounds: OutboundOrder[] = [];
      try {
        const outboundQb = this.outboundRepo.createQueryBuilder('o')
          .leftJoinAndSelect('o.details', 'd')
          .leftJoinAndSelect('d.product', 'p');
        if (sDate) {
          outboundQb.andWhere('(o.createdAt >= :sDate OR o.orderDate >= :sDate)', { sDate });
        }
        if (eDate) {
          const endOfDay = new Date(eDate);
          endOfDay.setHours(23, 59, 59, 999);
          outboundQb.andWhere('(o.createdAt <= :eDate OR o.orderDate <= :eDate)', { eDate: endOfDay });
        }
        outbounds = await outboundQb.getMany();
      } catch (err) {
        outbounds = [];
      }

      const groupsMap = new Map<string, any[]>();

      products.forEach((p) => {
        if (categoryId && categoryId !== 'all' && p.category?.id !== categoryId && p.category?.name !== categoryId) {
          return;
        }

        const pId = String(p.id);
        const sku = String(p.internalSku || (p as any).code || '').trim();

        const pBalances = stockBalances.filter((b) => b.product && String(b.product.id) === pId);
        let finalStock = Number((p as any).stock || 0);
        if (pBalances.length > 0) {
          try {
            const { totalStock, availableStock } = calculateAggregatedStock(pBalances);
            finalStock = availableStock > 0 ? availableStock : (totalStock > 0 ? totalStock : finalStock);
          } catch (err) {
            // Fallback
          }
        }

        let importQty = 0;
        inbounds.forEach((i) => {
          (i.details || []).forEach((d) => {
            if (String(d.product?.id) === pId || (d.product && String(d.product.internalSku) === sku)) {
              importQty += Number(d.receivedQty || d.expectedQty || 0);
            }
          });
        });

        let exportQty = 0;
        outbounds.forEach((o) => {
          (o.details || []).forEach((d) => {
            if (String(d.product?.id) === pId || (d.productSku && d.productSku === sku)) {
              exportQty += Number(d.pickedQty || d.requiredQty || 0);
            }
          });
        });

        const initialStock = Math.max(0, finalStock - importQty + exportQty);
        const unitPrice = Number(p.price || 0);
        const totalValue = finalStock * unitPrice;
        const unit = p.unit || 'Cái';

        let groupName = 'Mặc định';
        if (groupBy === 'base_unit') {
          groupName = `ĐƠN VỊ TÍNH: ${unit.toUpperCase()}`;
        } else {
          groupName = `NHÓM HÀNG: ${(p.category?.name || 'MẶC ĐỊNH').toUpperCase()}`;
        }

        if (!groupsMap.has(groupName)) {
          groupsMap.set(groupName, []);
        }

        groupsMap.get(groupName)?.push({
          id: pId,
          sku: p.internalSku || `SKU-${p.id}`,
          name: p.name,
          unit,
          initialStock,
          importQty,
          exportQty,
          finalStock,
          unitPrice,
          totalValue,
          pendingExportQty: 0,
          pendingOrderQty: 0,
        });
      });

      if (groupsMap.size === 0) {
        const defaultGroup = groupBy === 'base_unit' ? 'ĐƠN VỊ TÍNH: CÁI' : 'NHÓM HÀNG: MẶC ĐỊNH';
        groupsMap.set(defaultGroup, []);
      }

      return Array.from(groupsMap.entries()).map(([groupName, items]) => ({
        groupName,
        items,
      }));
    } catch (err: any) {
      console.error('Error in getInventorySummaryReport:', err);
      return [];
    }
  }

  /** BÁO CÁO CÔNG NỢ KHÁCH HÀNG */
  async getCustomerDebtReport(startDate?: string, endDate?: string) {
    const customers = await this.customerRepo.find();
    const outbounds = await this.outboundRepo.find({ relations: ['customer'] });

    const sDate = parseSafeDate(startDate);
    const eDate = parseSafeDate(endDate);

    // Chỉ tính toán các đơn xuất bán thực tế, loại bỏ hoàn toàn đơn xuất hủy (disposal) và chuyển kho nội bộ
    const validSalesOrders = outbounds.filter((o) => {
      const orderType = (o.orderType || '').toLowerCase();
      const orderNo = (o.orderNo || '').toUpperCase();
      const status = (o.status || '').toLowerCase();

      // Loại bỏ đơn xuất hủy
      if (orderType === 'disposal' || orderNo.startsWith('XH') || status.includes('xuất hủy')) {
        return false;
      }
      // Loại bỏ đơn chuyển kho nội bộ
      if (orderType === 'transfer-out' || orderNo.startsWith('XCK')) {
        return false;
      }

      // Lọc theo khoảng ngày nếu có
      if (sDate || eDate) {
        const orderDateVal = o.orderDate || o.createdAt;
        if (orderDateVal) {
          const d = new Date(orderDateVal);
          if (sDate && d < sDate) return false;
          if (eDate) {
            const endOfDay = new Date(eDate);
            endOfDay.setHours(23, 59, 59, 999);
            if (d > endOfDay) return false;
          }
        }
      }

      return true;
    });

    // Lọc bỏ các bản ghi khách hàng rác phát sinh do xuất hủy tạo nhầm (chứa từ khóa hết hạn, tiêu hủy, hư hỏng)
    const validCustomers = customers.filter((c) => {
      const cName = (c.name || '').toLowerCase();
      if (cName.includes('hết hạn') || cName.includes('tiêu hủy') || cName.includes('hư hỏng') || cName.includes('xuất hủy')) {
        return false;
      }
      return true;
    });

    return validCustomers.map((c, idx) => {
      const custOrders = validSalesOrders.filter(
        (o) => o.customer?.id === c.id || (o.customerName && o.customerName.trim().toLowerCase() === c.name.trim().toLowerCase())
      );
      const totalRevenue = custOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
      const paid = custOrders.reduce((sum, o) => sum + Number(o.amountPaid || o.totalAmount || 0), 0);
      const debt = Math.max(0, totalRevenue - paid);

      return {
        id: String(c.id || idx + 1),
        code: c.customerCode || `KH-${c.id}`,
        name: c.name,
        phone: c.phone || '-',
        address: c.address || '-',
        totalOrders: custOrders.length,
        totalRevenue,
        paidAmount: paid,
        debtAmount: debt,
      };
    });
  }

  /** BÁO CÁO CÔNG NỢ NHÀ CUNG CẤP */
  async getSupplierDebtReport(startDate?: string, endDate?: string) {
    const suppliers = await this.supplierRepo.find();
    const inbounds = await this.inboundRepo.find({ relations: ['supplier'] });

    return suppliers.map((s, idx) => {
      const suppInbounds = inbounds.filter(i => i.supplier?.id === s.id || i.supplierName === s.name);
      const totalAmount = suppInbounds.reduce((sum, i) => sum + Number(i.totalAmount || 0), 0);
      const paid = totalAmount;
      const debt = 0;

      return {
        id: String(s.id || idx + 1),
        code: s.supplierCode || `NCC-${s.id}`,
        name: s.name,
        phone: s.phone || '-',
        address: s.address || '-',
        totalReceipts: suppInbounds.length,
        totalAmount,
        paidAmount: paid,
        debtAmount: debt,
      };
    });
  }

  /** BÁO CÁO TỒN QUỸ */
  async getFundBalanceReport(startDate?: string, endDate?: string) {
    const [inboundRes, outboundRes] = await Promise.all([
      this.inboundRepo.find().catch(() => []),
      this.outboundRepo.find().catch(() => []),
    ]);

    const totalIncome = outboundRes.reduce((sum, o) => sum + Number(o.amountPaid || o.totalAmount || 0), 0);
    const totalExpense = inboundRes.reduce((sum, i) => sum + Number(i.totalAmount || 0), 0);
    const balance = totalIncome - totalExpense;

    return {
      openingBalance: 0,
      totalIncome,
      totalExpense,
      closingBalance: balance,
      cashBalance: Math.round(balance * 0.4),
      bankBalance: Math.round(balance * 0.6),
    };
  }

  /** BÁO CÁO SAO KÊ - SỔ QUỸ */
  async getCashbookReport(startDate?: string, endDate?: string) {
    const [inboundRes, outboundRes] = await Promise.all([
      this.inboundRepo.find().catch(() => []),
      this.outboundRepo.find().catch(() => []),
    ]);

    const logs: any[] = [];

    outboundRes.forEach((o) => {
      const orderType = (o.orderType || '').toLowerCase();
      const orderNo = (o.orderNo || '').toUpperCase();
      // Loại trừ đơn xuất hủy vì xuất hủy không thu tiền bán hàng
      if (orderType === 'disposal' || orderNo.startsWith('XH')) {
        return;
      }

      const amt = Number(o.amountPaid || o.totalAmount || 0);
      if (amt > 0) {
        logs.push({
          id: `in-${o.id}`,
          date: new Date((o as any).createdAt || o.orderDate || Date.now()).toISOString(),
          type: 'THU',
          code: o.orderNo || `XBH-${o.id}`,
          partner: o.customerName || 'Khách bán lẻ',
          description: `Thu tiền xuất bán hàng đơn ${o.orderNo || o.id}`,
          amount: amt,
        });
      }
    });

    inboundRes.forEach((i) => {
      const amt = Number(i.totalAmount || 0);
      if (amt > 0) {
        logs.push({
          id: `out-${i.id}`,
          date: new Date((i as any).createdAt || i.orderDate || Date.now()).toISOString(),
          type: 'CHI',
          code: i.poNumber || `PNK-${i.id}`,
          partner: i.supplierName || 'Nhà cung cấp',
          description: `Chi tiền nhập hàng theo phiếu ${i.poNumber || i.id}`,
          amount: amt,
        });
      }
    });

    logs.sort((a, b) => (a.date > b.date ? -1 : 1));
    return logs;
  }

  /** BÁO CÁO THẺ KHO */
  async getStockCardReport(startDate?: string, endDate?: string) {
    try {
      const products = await this.productRepo.find();
      const stockBalances = await this.stockRepo.find({ relations: ['product'] }).catch(() => []);
      const inbounds = await this.inboundRepo.find({ relations: ['details', 'details.product'] }).catch(() => []);
      const outbounds = await this.outboundRepo.find({ relations: ['details', 'details.product'] }).catch(() => []);

      return products.map((p, idx) => {
        const pId = String(p.id);
        const sku = String(p.internalSku || (p as any).code || '').trim();

        const pBalances = stockBalances.filter(b => b.product && String(b.product.id) === pId);
        let finalStock = Number((p as any).stock || 0);
        if (pBalances.length > 0) {
          try {
            const { totalStock, availableStock } = calculateAggregatedStock(pBalances);
            finalStock = availableStock > 0 ? availableStock : (totalStock > 0 ? totalStock : finalStock);
          } catch (err) {
            // Fallback
          }
        }

        let importQty = 0;
        inbounds.forEach((i) => {
          (i.details || []).forEach((d) => {
            if (String(d.product?.id) === pId || (d.product && String(d.product.internalSku) === sku)) {
              importQty += Number(d.receivedQty || d.expectedQty || 0);
            }
          });
        });

        let exportQty = 0;
        outbounds.forEach((o) => {
          (o.details || []).forEach((d) => {
            if (String(d.product?.id) === pId || (d.productSku && d.productSku === sku)) {
              exportQty += Number(d.pickedQty || d.requiredQty || 0);
            }
          });
        });

        const initialStock = Math.max(0, finalStock - importQty + exportQty);

        return {
          id: String(p.id || idx + 1),
          productSku: p.internalSku || `SKU-${p.id}`,
          productName: p.name,
          unit: p.unit || 'Cái',
          initialStock,
          importQty,
          exportQty,
          finalStock,
        };
      });
    } catch (err) {
      console.error('Error in getStockCardReport:', err);
      return [];
    }
  }

  /** BÁO CÁO CHI TIẾT HÀNG BÁN RA */
  async getSalesDetailReport(startDate?: string, endDate?: string) {
    const outbounds = await this.outboundRepo.find({ relations: ['details', 'details.product'] }).catch(() => []);

    const rows: any[] = [];
    let counter = 1;

    outbounds.forEach((o) => {
      const orderType = (o.orderType || '').toLowerCase();
      const orderNo = (o.orderNo || '').toUpperCase();
      // Loại trừ đơn xuất hủy vì xuất hủy không phải hàng bán ra
      if (orderType === 'disposal' || orderNo.startsWith('XH')) {
        return;
      }

      const details = o.details || [];
      details.forEach((d) => {
        const qty = Number(d.requiredQty || d.pickedQty || 1);
        const price = Number(d.unitPrice || 0);
        const revenue = Number(d.totalLineAmount || qty * price);

        rows.push({
          id: String(counter++),
          orderNo: o.orderNo || `XBH-${o.id}`,
          date: o.orderDate ? new Date(o.orderDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          customerName: o.customerName || 'Khách bán lẻ',
          productSku: d.productSku || d.product?.internalSku || 'SKU',
          productName: d.productName || d.product?.name || 'Sản phẩm',
          unit: d.unit || d.product?.unit || 'Cái',
          qty,
          price,
          totalAmount: revenue,
        });
      });
    });

    return rows;
  }

  /** BÁO CÁO HÀNG BÁN RA THEO NHÂN VIÊN */
  async getSalesByStaffReport(startDate?: string, endDate?: string) {
    const outbounds = await this.outboundRepo.find().catch(() => []);
    const staffMap = new Map<string, { orders: number; revenue: number; discount: number }>();

    outbounds.forEach((o) => {
      const orderType = (o.orderType || '').toLowerCase();
      const orderNo = (o.orderNo || '').toUpperCase();
      // Loại trừ đơn xuất hủy khỏi doanh số nhân viên
      if (orderType === 'disposal' || orderNo.startsWith('XH')) {
        return;
      }

      const staff = o.employeeName || 'Quản trị viên hệ thống';
      const rev = Number(o.totalAmount || 0);
      const disc = Number(o.discount || 0);

      const current = staffMap.get(staff) || { orders: 0, revenue: 0, discount: 0 };
      staffMap.set(staff, {
        orders: current.orders + 1,
        revenue: current.revenue + rev,
        discount: current.discount + disc,
      });
    });

    return Array.from(staffMap.entries()).map(([staffName, stat], idx) => ({
      id: String(idx + 1),
      staffName,
      salesOrderCount: stat.orders,
      revenue: stat.revenue,
      discount: stat.discount,
      netRevenue: stat.revenue - stat.discount,
    }));
  }
}
