import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  Package,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  Clock,
  CalendarDays,
  Truck,
  Eye,
  Pencil,
  Trash2,
  FileText,
  X,
  Sparkles,
  Copy,
  Printer,
  FileSpreadsheet,
  Settings,
  Maximize2,
  Minimize2,
  ArrowLeft,
  Save,
  Check,
  Building2,
  MapPin,
  User,
  Calendar,
  Layers,
  Bot,
  Hash,
} from 'lucide-react';
import { deliveryApi, type TransferOrder, type TransferOrderItem } from '../api/deliveryApi';
import InternalShippingNoteModal from '../components/InternalShippingNoteModal';
import { SmartSlottingGridModal } from '../../warehouses/components/SmartSlottingGridModal';
import { getStoredWarehouses, mergeStoredWarehouses, saveStoredWarehouses, upsertWarehouseToApi, type WarehouseRecord } from '../../../shared/utils/warehouseAssignments';


type Toast = {
  type: 'success' | 'error';
  message: string;
};

type TimeFilter = 'this-month' | '7-days' | 'all';
type StatusFilter = 'all' | 'DRAFT' | 'PENDING' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';

const statusConfig: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Nháp', color: 'border-slate-200 bg-slate-50 text-slate-700' },
  PENDING: { label: 'Chờ xử lý', color: 'border-amber-300 bg-amber-50 text-amber-800 font-bold' },
  APPROVED: { label: 'Đang giao', color: 'border-blue-400 bg-blue-50 text-blue-800 font-bold' },
  IN_TRANSIT: { label: 'Đang giao', color: 'border-blue-400 bg-blue-50 text-blue-800 font-bold' },
  DELIVERED: { label: 'Đã nhận hàng', color: 'border-emerald-400 bg-emerald-50 text-emerald-800 font-bold' },
  COMPLETED: { label: 'Đã nhận hàng', color: 'border-emerald-400 bg-emerald-50 text-emerald-800 font-bold' },
  CANCELLED: { label: 'Đã hủy', color: 'border-red-300 bg-red-50 text-red-700 font-bold' },
};

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${hours}:${minutes} ${day}/${month}/${year}`;
}

function renderWarehouse(wh?: string, warehousesList: WarehouseRecord[] = []) {
  if (!wh) return '-';
  const found = warehousesList.find((w) => w.code === wh || w.id === wh || w.name === wh);
  if (found) {
    if (found.name && found.code && found.name !== found.code) {
      return `${found.name} (${found.code})`;
    }
    return found.name || found.code;
  }
  if (wh === 'KH006') return 'Kho Thanh Trì (KH006)';
  if (wh === 'KH002') return 'Kho Chi Nhánh HCM (KH002)';
  return wh;
}

function renderCreator(creator?: string | null) {
  if (!creator || creator === 'NPT_Staff') return 'System Administrator';
  return creator;
}

export default function TransferRequestsPage() {
  const navigate = useNavigate();
  const [toast, setToast] = useState<Toast | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('this-month');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [orders, setOrders] = useState<TransferOrder[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>(() => getStoredWarehouses());
  const [products, setProducts] = useState<any[]>([]);

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Dedicated Stock-In Receive View state (Modeled directly on CreateTransferOrderPage layout)
  const [receiveModalOrder, setReceiveModalOrder] = useState<TransferOrder | null>(null);
  const [receiveItems, setReceiveItems] = useState<any[]>([]);
  const [receiveSaving, setReceiveSaving] = useState(false);
  const [receiveDateVal, setReceiveDateVal] = useState<string>('');
  const [receiveNote, setReceiveNote] = useState<string>('');

  // Pick Bin Slotting Modal state
  const [slottingModalOpen, setSlottingModalOpen] = useState(false);
  const [activeSlottingRowId, setActiveSlottingRowId] = useState<string | null>(null);

  const [shippingNoteOrder, setShippingNoteOrder] = useState<TransferOrder | null>(null);
  const [isShippingNoteModalOpen, setIsShippingNoteModalOpen] = useState(false);

  // Fullscreen & Column Settings
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showColumnSettings, setShowColumnSettings] = useState(false);

  // Column Visibility Configuration
  const DEFAULT_COLUMN_VIS = {
    stt: true,
    transferNo: true,
    sourceWarehouse: true,
    destinationWarehouse: true,
    dispatchDate: true,
    receiveDate: true,
    driver: true,
    vehiclePlate: true,
    createdBy: true,
    totalItems: true,
    totalQuantity: true,
    createdAt: true,
    status: true,
  };
  const [columnVis, setColumnVis] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('transfer_requests_column_vis');
      return saved ? { ...DEFAULT_COLUMN_VIS, ...JSON.parse(saved) } : DEFAULT_COLUMN_VIS;
    } catch {
      return DEFAULT_COLUMN_VIS;
    }
  });

  useEffect(() => {
    localStorage.setItem('transfer_requests_column_vis', JSON.stringify(columnVis));
  }, [columnVis]);

  // Fullscreen toggle
  useEffect(() => {
    const handleFSChange = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFSChange);
    return () => document.removeEventListener('fullscreenchange', handleFSChange);
  }, []);

  const toggleBrowserFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullScreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullScreen(false);
    }
  };

  // Pagination
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  // Load warehouses & products
  useEffect(() => {
    async function loadAuxData() {
      try {
        const token = localStorage.getItem('token') || '';
        const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

        const [whRes, prodRes] = await Promise.all([
          fetch('/api/warehouses', { headers }).catch(() => null),
          fetch('/api/products', { headers }).catch(() => null),
        ]);

        if (whRes && whRes.ok) {
          const list = await whRes.json();
          const rawList = Array.isArray(list) ? list : list.data || [];
          setWarehouses(mergeStoredWarehouses(rawList, getStoredWarehouses()));
        }
        if (prodRes && prodRes.ok) {
          const plist = await prodRes.json();
          setProducts(Array.isArray(plist) ? plist : plist.data || []);
        }
      } catch (e) {
        console.error('Lỗi tải danh mục kho/sản phẩm:', e);
      }
    }
    loadAuxData();
  }, []);

  // Fetch real transfer orders from CSDL
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await deliveryApi.listTransferOrders();
      setOrders(Array.isArray(data) ? data : []);
    } catch (error: any) {
      setToast({ type: 'error', message: error.message || 'Không thể tải danh sách phiếu điều chuyển nhập kho' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Open Receive & Bin Slotting View mode (Inverted CreateTransferOrderPage for Stock-In)
  const openReceiveModal = (order: TransferOrder) => {
    setReceiveModalOrder(order);
    setReceiveDateVal(order.receiveDate ? new Date(order.receiveDate).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16));
    setReceiveNote(order.note || '');
    const destWhCode = (order.destinationWarehouse || '').trim().toUpperCase();
    const isCompleted = order.status === 'DELIVERED' || order.status === 'COMPLETED';

    const preparedItems = (order.items || []).map((it, idx) => {
      const rawBins = Array.isArray((it as any).assignedBins)
        ? (it as any).assignedBins
        : (it as any).locationBin
        ? String((it as any).locationBin).split(',').map((b: string) => b.trim()).filter(Boolean)
        : [];
      // If completed, keep assigned destination bins; if receiving, only keep bins already tagged for destination warehouse
      const destBins = isCompleted 
        ? rawBins 
        : rawBins.filter((b: string) => b.toUpperCase().startsWith(destWhCode));

      return {
        rowId: `rec-row-${it.id || idx}`,
        productId: it.id || '',
        productSku: it.productCode || '',
        productName: it.productName || '',
        unit: it.unit || 'Cái',
        qty: Number(it.quantity) || 1,
        receivedQty: Number(it.quantity) || 1,
        price: Number((it as any).price || 0),
        locationBin: destBins.join(', '),
        assignedBins: destBins,
        note: (it as any).note || '',
      };
    });
    setReceiveItems(preparedItems);
  };

  // Open AI Bin Slotting Modal for Destination Warehouse
  const openSlottingModalForRow = (rowId: string) => {
    setActiveSlottingRowId(rowId);
    setSlottingModalOpen(true);
  };

  const handleConfirmSlottingBins = (updatedRows: any[]) => {
    setReceiveItems(updatedRows);
  };

  // Confirm Stock-In Receive & Bin Slotting
  const handleConfirmReceive = async () => {
    if (!receiveModalOrder) return;
    if (!receiveItems || receiveItems.length === 0) {
      setToast({ type: 'error', message: 'Phiếu nhận hàng chuyển kho phải có ít nhất 1 hàng hóa!' });
      return;
    }
    const invalidQtyItem = receiveItems.find((it) => !Number(it.receivedQty) || Number(it.receivedQty) < 1);
    if (invalidQtyItem) {
      setToast({
        type: 'error',
        message: `Số lượng nhận của hàng hóa "${invalidQtyItem.productName || invalidQtyItem.productSku || 'sản phẩm'}" phải lớn hơn hoặc bằng 1!`,
      });
      return;
    }
    setReceiveSaving(true);
    try {
      const updatedItems: TransferOrderItem[] = receiveItems.map((it) => ({
        id: it.productId || it.rowId,
        productCode: it.productSku,
        productName: it.productName,
        unit: it.unit,
        quantity: Math.max(1, Number(it.receivedQty) || Number(it.qty) || 1),
        price: Number(it.price || 0),
        locationBin: it.locationBin ? String(it.locationBin).trim() : Array.isArray(it.assignedBins) && it.assignedBins.length > 0 ? it.assignedBins.join(', ') : undefined,
        assignedBins: Array.isArray(it.assignedBins) && it.assignedBins.length > 0 ? it.assignedBins : undefined,
        note: it.note ? String(it.note).trim() : undefined,
      }));

      await deliveryApi.updateTransferOrder(receiveModalOrder.id, {
        status: 'DELIVERED',
        receiveDate: receiveDateVal ? new Date(receiveDateVal).toISOString() : new Date().toISOString(),
        note: receiveNote || receiveModalOrder.note || undefined,
        items: updatedItems,
      });

      // Update destination warehouse customBins topology so shelves reflect the received products
      try {
        const destWhCode = (receiveModalOrder.destinationWarehouse || '').trim().toUpperCase();
        const fullWhList = getStoredWarehouses();
        const matchedWh = fullWhList.find((w) => w.code === destWhCode || w.id === destWhCode);
        if (matchedWh && matchedWh.subWarehouses) {
          let whChanged = false;
          const updatedSubs = matchedWh.subWarehouses.map((sub: any) => {
            const racks = (sub.racks || []).map((rk: any) => {
              const custom = { ...(rk.customBins || {}) };
              const rackCodeUpper = String(rk.rackCode || '').trim().toUpperCase();

              receiveItems.forEach((r) => {
                let assignedList: string[] = Array.isArray(r.assignedBins) ? r.assignedBins : [];
                if (assignedList.length === 0 && r.locationBin) {
                  assignedList = r.locationBin.split(',').map((s: string) => s.trim()).filter(Boolean);
                }

                assignedList.forEach((binStr: string) => {
                  const parts = binStr.split('-');
                  const shortBin = (parts[parts.length - 1] || binStr).split(' ')[0].trim().toUpperCase();
                  const targetRack = parts.length >= 2 ? parts[parts.length - 2].trim().toUpperCase() : '';

                  if (targetRack && targetRack !== rackCodeUpper && !binStr.toUpperCase().includes(rackCodeUpper)) {
                    return;
                  }

                  const pctMatch = binStr.match(/\((\d+(?:\.\d+)?)%\)/);
                  const binPct = pctMatch ? Math.min(100, Math.max(1, Number(pctMatch[1]))) : 100;

                  const qtyMatch = binStr.match(/\[(\d+(?:\.\d+)?)\s*(?:cái|sp)?\]/i);
                  const binQty = qtyMatch ? Number(qtyMatch[1]) : (Math.round((Number(r.receivedQty) || Number(r.qty) || 1) / Math.max(1, assignedList.length)));

                  const existingEntry = custom[shortBin] || custom[binStr];
                  let existingProds: Array<{ sku?: string; productName: string; qty: number; occupancyPct: number; unit?: string }> = [];
                  if (existingEntry && Array.isArray(existingEntry.products) && existingEntry.products.length > 0) {
                    existingProds = [...existingEntry.products];
                  } else if (existingEntry && existingEntry.productName && Number(existingEntry.totalPhysical || 0) > 0) {
                    existingProds = [{
                      sku: existingEntry.sku || '',
                      productName: existingEntry.productName,
                      qty: Number(existingEntry.totalPhysical || 0),
                      occupancyPct: Number(existingEntry.occupancyPct || 0),
                      unit: existingEntry.unit || 'cái',
                    }];
                  }

                  const curSku = (r.productSku || '').trim().toUpperCase();
                  const curName = (r.productName || '').trim().toLowerCase();
                  const matchProdIdx = existingProds.findIndex((p) => {
                    const pSku = (p.sku || '').trim().toUpperCase();
                    const pName = (p.productName || '').trim().toLowerCase();
                    return (curSku && pSku && curSku === pSku) || (curName && pName && curName === pName);
                  });

                  if (matchProdIdx >= 0) {
                    existingProds[matchProdIdx] = {
                      sku: r.productSku || existingProds[matchProdIdx].sku || '',
                      productName: r.productName || existingProds[matchProdIdx].productName,
                      qty: binQty,
                      occupancyPct: binPct,
                      unit: r.unit || existingProds[matchProdIdx].unit || 'cái',
                    };
                  } else {
                    existingProds.push({
                      sku: r.productSku || '',
                      productName: r.productName,
                      qty: binQty,
                      occupancyPct: binPct,
                      unit: r.unit || 'cái',
                    });
                  }

                  const totalShelfPct = Math.min(100, existingProds.reduce((sum, p) => sum + (Number(p.occupancyPct) || 0), 0));
                  const totalShelfQty = existingProds.reduce((sum, p) => sum + (Number(p.qty) || 0), 0);
                  const descNote = `Đã chứa: ${totalShelfPct}% (${existingProds.map((p) => `${p.productName}: ${p.qty} ${p.unit || 'cái'} [${p.occupancyPct}%]`).join(', ')})`;

                  const updatedEntry = {
                    binCode: shortBin,
                    length: 120,
                    width: 80,
                    height: 100,
                    maxWeight: 500,
                    occupancyPct: totalShelfPct,
                    totalPhysical: totalShelfQty,
                    products: existingProds,
                    notes: descNote,
                    productName: existingProds.map((p) => p.productName).join(', '),
                    sku: existingProds.map((p) => p.sku).filter(Boolean).join(', '),
                    unit: r.unit || 'cái',
                  };

                  custom[shortBin] = updatedEntry;
                  const fullComposite = `${destWhCode}-${sub.code || 'ZONE'}-${rk.rackCode}-${shortBin}`;
                  custom[fullComposite] = updatedEntry;
                  whChanged = true;
                });
              });

              return { ...rk, customBins: custom };
            });
            return { ...sub, racks };
          });

          if (whChanged) {
            const updatedWh: WarehouseRecord = { ...matchedWh, subWarehouses: updatedSubs };
            const nextList = fullWhList.map((w) => (w.id === updatedWh.id || w.code === updatedWh.code ? updatedWh : w));
            saveStoredWarehouses(nextList);
            upsertWarehouseToApi(updatedWh).catch((err) => console.error('Lỗi lưu CSDL kho đích:', err));
          }
        }
      } catch (err) {
        console.error('Lỗi cập nhật cấu hình kệ kho đích:', err);
      }

      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new Event('warehouse-goods-cleared'));

      setToast({ type: 'success', message: `Xác nhận nhập kho & phân bổ ô kệ thành công cho phiếu: ${receiveModalOrder.transferNo}` });
      setReceiveModalOrder(null);
      fetchOrders();
    } catch (e: any) {
      setToast({ type: 'error', message: e.message || 'Lỗi khi xác nhận nhập kho' });
    } finally {
      setReceiveSaving(false);
    }
  };

  // Handle Single Delete
  const handleDeleteOrder = async (order: TransferOrder) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa phiếu nhập chuyển kho ${order.transferNo}?`)) return;
    try {
      await deliveryApi.deleteTransferOrder(order.id);
      setToast({ type: 'success', message: `Đã xóa thành công phiếu: ${order.transferNo}` });
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(order.id);
        return next;
      });
      fetchOrders();
    } catch (e: any) {
      setToast({ type: 'error', message: e.message || 'Không thể xóa phiếu điều chuyển' });
    }
  };

  // Handle Selected Delete
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) {
      setToast({ type: 'error', message: 'Vui lòng chọn ít nhất 1 phiếu để xóa' });
      return;
    }
    if (!window.confirm(`Bạn có chắc chắn muốn xóa ${selectedIds.size} phiếu đã chọn?`)) return;

    try {
      for (const id of selectedIds) {
        await deliveryApi.deleteTransferOrder(id).catch(() => null);
      }
      setToast({ type: 'success', message: `Đã xóa thành công ${selectedIds.size} phiếu` });
      setSelectedIds(new Set());
      fetchOrders();
    } catch (e: any) {
      setToast({ type: 'error', message: e.message || 'Lỗi khi xóa các phiếu đã chọn' });
    }
  };

  // Handle Copy Selected
  const handleCopySelected = () => {
    if (selectedIds.size === 0) {
      setToast({ type: 'error', message: 'Vui lòng chọn 1 phiếu để sao chép' });
      return;
    }
    const firstId = Array.from(selectedIds)[0];
    const target = orders.find((o) => o.id === firstId);
    if (target) {
      navigate('/delivery/receive-transfer-order', { state: { copyFromOrder: target, mode: 'receive', fromRequests: true } });
      setToast({ type: 'success', message: `Đã sao chép thông tin phiếu: ${target.transferNo}` });
    }
  };

  // Export Excel / CSV
  const handleExportExcel = () => {
    const header = [
      'STT',
      'Số Phiếu',
      'Kho Chuyển',
      'Kho Nhận',
      'Ngày Chuyển',
      'Ngày Nhận',
      'Tài Xế',
      'SĐT Tài Xế',
      'Biển Số Xe',
      'Người Tạo',
      'Tổng Mặt Hàng',
      'Tổng Số Lượng',
      'Ngày Lập',
      'Trạng Thái',
    ];
    const rows = filteredOrders.map((o, idx) => [
      idx + 1,
      o.transferNo,
      renderWarehouse(o.sourceWarehouse, warehouses),
      renderWarehouse(o.destinationWarehouse, warehouses),
      formatDateTime(o.dispatchDate || o.scheduledDate || o.createdAt),
      formatDateTime(o.receiveDate || o.createdAt),
      o.driverName || '',
      o.driverPhone || '',
      o.vehiclePlate || '',
      renderCreator(o.createdBy),
      o.items?.length || o.itemCount || 0,
      o.totalQuantity || 0,
      formatDateTime(o.createdAt),
      statusConfig[o.status]?.label || o.status,
    ]);
    const csv = [header, ...rows].map((r) => r.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nhap_kho_chuyen_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setToast({ type: 'success', message: 'Đã xuất dữ liệu Excel/CSV thành công!' });
  };

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        (order.transferNo && order.transferNo.toLowerCase().includes(q)) ||
        (order.driverName && order.driverName.toLowerCase().includes(q)) ||
        (order.createdBy && order.createdBy.toLowerCase().includes(q)) ||
        (order.sourceWarehouse && order.sourceWarehouse.toLowerCase().includes(q)) ||
        (order.destinationWarehouse && order.destinationWarehouse.toLowerCase().includes(q));

      const matchesStatus =
        statusFilter === 'all' ||
        order.status === statusFilter ||
        (statusFilter === 'IN_TRANSIT' && order.status === 'APPROVED') ||
        (statusFilter === 'DELIVERED' && order.status === 'COMPLETED');
      return matchesSearch && matchesStatus;
    });
  }, [orders, search, statusFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, timeFilter]);

  // Bulk Checkbox handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredOrders.map((o) => o.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const isAllSelected = filteredOrders.length > 0 && selectedIds.size === filteredOrders.length;

  const totalItems = filteredOrders.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);
  const paginatedOrders = useMemo(() => {
    return filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  // Statistics
  const total = orders.length;
  const pendingCount = useMemo(() => orders.filter((o) => o.status === 'DRAFT' || o.status === 'PENDING').length, [orders]);
  const movingCount = useMemo(() => orders.filter((o) => o.status === 'IN_TRANSIT' || o.status === 'APPROVED').length, [orders]);
  const doneCount = useMemo(() => orders.filter((o) => o.status === 'DELIVERED' || o.status === 'COMPLETED').length, [orders]);

  const resetFilters = () => {
    setSearch('');
    setTimeFilter('this-month');
    setStatusFilter('all');
  };

  // ════════════════════════════════════════════════════════════════
  // 🏢 RENDER DEDICATED RECEIVE / STOCK-IN VIEW (Matching CreateStockInOrderPage Layout)
  // ════════════════════════════════════════════════════════════════
  if (receiveModalOrder) {
    const destWhName = renderWarehouse(receiveModalOrder.destinationWarehouse, warehouses);
    const sourceWhName = renderWarehouse(receiveModalOrder.sourceWarehouse, warehouses);

    const totalDispatchedQty = receiveItems.reduce((acc, it) => acc + (Number(it.qty) || 0), 0);
    const totalReceivedQty = receiveItems.reduce((acc, it) => acc + (Number(it.receivedQty) || 0), 0);

    return (
      <div className="space-y-3.5 pb-12 animate-[fadeIn_0.2s_ease-in-out]">
        {/* ═══ 1. TOP HEADER BAR ═══ */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-cyan-500/40 bg-white p-3.5 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-700 px-3 py-1.5 text-xs font-black uppercase text-white shadow-xs">
              <Package size={15} className="text-cyan-200" />
              <span>Nhập Kho Điều Chuyển Nội Bộ</span>
            </span>
            <div className="flex items-center gap-1.5 rounded-xl border-2 border-cyan-600/40 bg-cyan-50/80 px-3.5 py-1.5 text-xs font-extrabold text-cyan-900 shadow-2xs">
              <span className="font-mono text-sm font-black text-cyan-800">#{receiveModalOrder.transferNo}</span>
            </div>
            {receiveModalOrder.status && (
              <span className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-extrabold ${statusConfig[receiveModalOrder.status]?.color || 'border-blue-400 bg-blue-50 text-blue-800 font-bold'}`}>
                {statusConfig[receiveModalOrder.status]?.label || receiveModalOrder.status}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setShippingNoteOrder(receiveModalOrder);
                setIsShippingNoteModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border-2 border-cyan-600 bg-white px-3.5 py-1.5 text-xs font-bold text-cyan-700 hover:bg-cyan-50 transition shadow-xs cursor-pointer"
              title="In / Xem chứng từ điều chuyển"
            >
              <Printer size={15} className="text-cyan-700" />
              <span>In chứng từ</span>
            </button>

            <button
              type="button"
              onClick={() => setReceiveModalOrder(null)}
              className="inline-flex items-center gap-1.5 rounded-xl border-2 border-cyan-500 bg-white px-4 py-1.5 text-xs font-bold text-cyan-700 hover:bg-cyan-50 transition shadow-xs cursor-pointer ml-1"
            >
              <ArrowLeft size={16} />
              <span>Quay lại</span>
            </button>
          </div>
        </div>

        {/* ═══ 2. FULL-WIDTH TOP CONTROL BAR (Grid of Details) ═══ */}
        <div className="w-full rounded-2xl border-2 border-cyan-500/30 bg-white p-4 shadow-md flex-shrink-0 space-y-3">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 items-center">
            {/* Ngày nhận hàng */}
            <div>
              <label className="mb-1.5 flex items-center gap-1 text-xs font-black uppercase text-slate-700">
                <Calendar className="h-4 w-4 text-cyan-600" />
                <span>Ngày nhận hàng</span>
              </label>
              <input
                type="datetime-local"
                value={receiveDateVal}
                onChange={(e) => setReceiveDateVal(e.target.value)}
                className="h-10 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20 shadow-2xs"
              />
            </div>

            {/* Mã phiếu điều chuyển */}
            <div>
              <label className="mb-1.5 flex items-center gap-1 text-xs font-black uppercase text-slate-700">
                <Hash className="h-4 w-4 text-cyan-600" />
                <span>Mã phiếu chuyển</span>
              </label>
              <input
                type="text"
                disabled
                value={receiveModalOrder.transferNo}
                className="h-10 w-full rounded-xl border-2 border-slate-300 bg-slate-100 px-3 text-sm font-extrabold text-cyan-900 uppercase outline-none shadow-2xs cursor-not-allowed"
              />
            </div>

            {/* Kho chuyển (Nơi gửi) */}
            <div>
              <label className="mb-1.5 flex items-center gap-1 text-xs font-black uppercase text-slate-700">
                <Building2 className="h-4 w-4 text-cyan-600" />
                <span>Kho gửi (Nơi chuyển)</span>
              </label>
              <div className="h-10 w-full rounded-xl border-2 border-slate-300 bg-slate-100 px-3 text-xs sm:text-sm font-bold text-slate-700 flex items-center truncate shadow-2xs">
                <span className="truncate">{sourceWhName}</span>
              </div>
            </div>

            {/* Kho nhận (Nơi cất hàng) */}
            <div>
              <label className="mb-1.5 flex items-center gap-1 text-xs font-black uppercase text-cyan-800">
                <Building2 className="h-4 w-4 text-cyan-600" />
                <span>Kho nhận (Cất vào kệ)</span>
              </label>
              <div className="h-10 w-full rounded-xl border-2 border-cyan-500 bg-cyan-50/70 px-3 text-xs sm:text-sm font-black text-cyan-950 flex items-center truncate shadow-2xs">
                <span className="truncate">{destWhName}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ 3. MAIN 2-COLUMN LAYOUT (Table on Left, Payment/Action Sidebar on Right) ═══ */}
        <div className="flex flex-col lg:flex-row gap-3 items-start">
          {/* ── LEFT COLUMN: BẢNG HÀNG HÓA NHẬP KHO ── */}
          <div className="flex-1 min-w-0 flex flex-col w-full">
            <div className="flex flex-col rounded-xl border-2 border-slate-200 bg-white shadow-sm overflow-hidden min-h-0">
              {/* Table Header Controls */}
              <div className="px-3 py-2.5 border-b-2 border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2 flex-shrink-0">
                <div className="flex items-center gap-2 text-cyan-900 font-black text-xs sm:text-sm">
                  <Package className="h-4 w-4 text-cyan-600" />
                  <span>
                    THÔNG TIN HÀNG HÓA NHẬP CHUYỂN ({receiveItems.length} MẶT HÀNG - TỔNG SL: {totalReceivedQty})
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openSlottingModalForRow(receiveItems[0]?.rowId || '')}
                    className="inline-flex items-center gap-1.5 rounded-lg border-2 border-cyan-700 bg-cyan-50 px-3.5 py-1.5 text-xs font-extrabold text-cyan-800 shadow-2xs transition hover:bg-cyan-100 cursor-pointer"
                    title="Gợi ý tự động hoặc chọn ô kệ AI cho toàn bộ danh sách"
                  >
                    <Sparkles className="h-4 w-4 text-cyan-600" />
                    <span>Gợi ý ô kệ AI</span>
                  </button>
                </div>
              </div>

              {/* Grid Table */}
              <div className="overflow-x-auto overflow-y-auto custom-scrollbar flex-1 min-h-0 max-h-[calc(100vh-280px)]">
                <table className="w-full text-left border-collapse text-xs min-w-[1000px]">
                  <thead className="bg-slate-100 text-slate-700 font-black border-b-2 border-slate-200 uppercase text-xs sticky top-0 z-10">
                    <tr>
                      <th className="p-2.5 w-12 text-center bg-slate-100">STT</th>
                      <th className="p-2.5 min-w-[200px] text-center bg-slate-100">TÊN HÀNG HÓA / SKU</th>
                      <th className="p-2.5 w-20 text-center bg-slate-100">ĐVT</th>
                      <th className="p-2.5 w-24 text-center bg-slate-100">SL GỬI</th>
                      <th className="p-2.5 w-32 text-center bg-slate-100">SL THỰC NHẬN</th>
                      <th className="p-2.5 min-w-[280px] text-center bg-slate-100">VỊ TRÍ Ô KỆ NHẬP KHO ({receiveModalOrder.destinationWarehouse})</th>
                      <th className="p-2.5 min-w-[140px] text-center bg-slate-100">GHI CHÚ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {receiveItems.map((item, idx) => {
                      const assignedList = item.assignedBins || (item.locationBin ? String(item.locationBin).split(',').map((s: string) => s.trim()).filter(Boolean) : []);
                      const isEven = idx % 2 === 1;

                      return (
                        <tr key={item.rowId} className={`transition ${isEven ? 'bg-slate-50/70 hover:bg-cyan-50/50' : 'bg-white hover:bg-cyan-50/50'}`}>
                          <td className="p-2.5 text-center font-bold text-slate-600 border-r border-slate-200">
                            {idx + 1}
                          </td>
                          <td className="p-2.5 border-r border-slate-200">
                            <div className="font-extrabold text-slate-900 text-xs sm:text-sm">{item.productName || 'Sản phẩm điều chuyển'}</div>
                            <div className="text-[11px] font-mono font-bold text-cyan-700 mt-0.5">{item.productSku || '-'}</div>
                          </td>
                          <td className="p-2.5 text-center font-bold text-slate-700 border-r border-slate-200">
                            <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                              {item.unit || 'Cái'}
                            </span>
                          </td>
                          <td className="p-2.5 text-center font-black text-slate-800 font-mono text-sm border-r border-slate-200">
                            {Number(item.qty).toLocaleString('vi-VN')}
                          </td>
                          <td className="p-2.5 text-center border-r border-slate-200">
                            <input
                              type="number"
                              min={1}
                              value={item.receivedQty}
                              onChange={(e) => {
                                const val = Math.max(1, Number(e.target.value) || 1);
                                setReceiveItems((prev) =>
                                  prev.map((r) => (r.rowId === item.rowId ? { ...r, receivedQty: val } : r))
                                );
                              }}
                              className="h-9 w-24 rounded-xl border-2 border-cyan-600 bg-white px-2.5 text-center font-black text-cyan-900 outline-none transition focus:ring-2 focus:ring-cyan-500/20 shadow-2xs text-xs sm:text-sm mx-auto"
                            />
                          </td>
                          <td className="p-2.5 border-r border-slate-200">
                            <div className="flex flex-col items-center gap-1.5">
                              {assignedList.length > 0 ? (
                                <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-xs">
                                  {assignedList.map((bin: string) => (
                                    <span
                                      key={bin}
                                      className="inline-flex items-center gap-1 rounded-lg border border-cyan-400 bg-cyan-100/90 px-2.5 py-1 text-[11px] font-black text-cyan-950 shadow-2xs"
                                    >
                                      <MapPin className="h-3 w-3 text-cyan-700" />
                                      {bin}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-400 font-bold italic text-[11px]">Chưa phân bổ ô kệ</span>
                              )}

                              <button
                                type="button"
                                onClick={() => openSlottingModalForRow(item.rowId)}
                                className="inline-flex items-center gap-1.5 rounded-xl border-2 border-cyan-700 bg-white px-3.5 py-1.5 text-[11px] font-black text-cyan-800 shadow-2xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
                              >
                                <Sparkles className="h-3.5 w-3.5 text-cyan-600" />
                                <span>{assignedList.length > 0 ? 'Đổi vị trí ô kệ' : 'Chọn ô kệ nhập kho'}</span>
                              </button>
                            </div>
                          </td>
                          <td className="p-2.5">
                            <input
                              type="text"
                              value={item.note || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setReceiveItems((prev) =>
                                  prev.map((r) => (r.rowId === item.rowId ? { ...r, note: val } : r))
                                );
                              }}
                              placeholder="Ghi chú nhận..."
                              className="h-9 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-cyan-600"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Summary Footer bar */}
              <div className="border-t-2 border-slate-200 bg-slate-50 px-4 py-3 flex items-center justify-between text-xs font-bold text-slate-700">
                <div className="flex items-center gap-6">
                  <span>Số mặt hàng: <b className="text-slate-900 font-black">{receiveItems.length}</b></span>
                  <span>Tổng SL gửi: <b className="text-slate-900 font-black font-mono">{totalDispatchedQty.toLocaleString('vi-VN')}</b></span>
                  <span>Tổng SL thực nhận: <b className="text-cyan-800 font-black font-mono text-sm">{totalReceivedQty.toLocaleString('vi-VN')}</b></span>
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN: SIDEBAR THÔNG TIN ĐIỀU CHUYỂN & HÀNH ĐỘNG ── */}
          <div className="w-full lg:w-80 xl:w-96 flex-shrink-0 space-y-3">
            <div className="rounded-xl border-2 border-slate-200 bg-white p-4 shadow-sm space-y-3.5">
              <h3 className="text-xs font-black uppercase text-cyan-900 flex items-center gap-1.5 border-b border-slate-200 pb-2.5">
                <Building2 className="h-4 w-4 text-cyan-600" />
                <span>THÔNG TIN NHẬP CHUYỂN NỘI BỘ</span>
              </h3>

              {/* Thông tin kho gửi & nhận */}
              <div className="space-y-2 text-xs">
                <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/80">
                  <span className="text-slate-500 font-semibold block text-[11px]">Kho gửi (Nơi xuất):</span>
                  <span className="font-extrabold text-slate-900 block text-xs">{sourceWhName}</span>
                </div>

                <div className="p-2.5 rounded-xl border-2 border-cyan-400/80 bg-cyan-50/70">
                  <span className="text-cyan-800 font-extrabold block text-[11px]">Kho nhận (Nơi cất hàng):</span>
                  <span className="font-black text-cyan-950 block text-xs">{destWhName}</span>
                </div>

                <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/80 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-semibold text-[11px]">Tài xế:</span>
                    <span className="font-extrabold text-slate-900">{receiveModalOrder.driverName || 'Chưa chỉ định'}</span>
                  </div>
                  {receiveModalOrder.driverPhone && (
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-semibold text-[11px]">SĐT tài xế:</span>
                      <span className="font-bold text-slate-700">{receiveModalOrder.driverPhone}</span>
                    </div>
                  )}
                  {receiveModalOrder.vehiclePlate && (
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-semibold text-[11px]">Biển số xe:</span>
                      <span className="font-black text-slate-900">{receiveModalOrder.vehiclePlate}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Thống kê số lượng */}
              <div className="border-t border-slate-200 pt-3 space-y-1.5 text-xs">
                <div className="flex items-center justify-between font-semibold text-slate-700">
                  <span>Số mặt hàng:</span>
                  <span className="font-black text-slate-900">{receiveItems.length}</span>
                </div>
                <div className="flex items-center justify-between font-semibold text-slate-700">
                  <span>Tổng SL xuất gửi:</span>
                  <span className="font-black text-slate-900 font-mono">{totalDispatchedQty.toLocaleString('vi-VN')}</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-300/80 pt-2">
                  <span className="text-xs font-black uppercase text-cyan-900">TỔNG SL THỰC NHẬN:</span>
                  <span className="text-base font-black text-cyan-700 font-mono">{totalReceivedQty.toLocaleString('vi-VN')}</span>
                </div>
              </div>

              {/* Ghi chú chung phiếu */}
              <div className="border-t border-slate-200 pt-3">
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Ghi chú phiếu nhận:</label>
                <textarea
                  rows={2}
                  value={receiveNote}
                  onChange={(e) => setReceiveNote(e.target.value)}
                  placeholder="Nhập ghi chú nhận kho nội bộ..."
                  className="w-full rounded-xl border border-slate-300 p-2 text-xs font-medium text-slate-800 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20"
                />
              </div>

              {/* Large Prominent Action Buttons */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleConfirmReceive}
                  disabled={receiveSaving}
                  className="w-full h-12 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-wide shadow-md transition active:scale-95 cursor-pointer disabled:opacity-50 text-xs sm:text-sm"
                >
                  <CheckCircle2 className="h-5 w-5" />
                  <span>{receiveSaving ? 'ĐANG LƯU...' : 'XÁC NHẬN NHẬP KHO & LƯU Ô KỆ'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShippingNoteOrder(receiveModalOrder);
                    setIsShippingNoteModalOpen(true);
                  }}
                  className="w-full h-11 flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-600 bg-white hover:bg-cyan-50 text-cyan-800 font-extrabold shadow-xs transition active:scale-95 cursor-pointer text-xs"
                >
                  <Printer size={16} className="text-cyan-700" />
                  <span>IN CHỨNG TỪ ĐIỀU CHUYỂN</span>
                </button>

                <button
                  type="button"
                  onClick={() => setReceiveModalOrder(null)}
                  className="w-full h-11 flex items-center justify-center gap-2 rounded-xl border-2 border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold transition active:scale-95 cursor-pointer text-xs"
                >
                  <ArrowLeft size={16} />
                  <span>HỦY / QUAY LẠI DANH SÁCH</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* AI Smart Slotting Grid Modal for Destination Warehouse */}
        <SmartSlottingGridModal
          isOpen={slottingModalOpen}
          onClose={() => setSlottingModalOpen(false)}
          mode="INBOUND"
          warehouseCode={receiveModalOrder.destinationWarehouse || 'KH002'}
          items={receiveItems}
          targetRowId={activeSlottingRowId}
          products={products}
          onConfirmAll={handleConfirmSlottingBins}
        />

        {/* Internal Shipping Note Modal for Printing Voucher */}
        <InternalShippingNoteModal
          open={isShippingNoteModalOpen}
          onClose={() => {
            setIsShippingNoteModalOpen(false);
            setShippingNoteOrder(null);
          }}
          initialData={
            (shippingNoteOrder || receiveModalOrder)
              ? {
                  commandNo: (shippingNoteOrder || receiveModalOrder)!.transferNo,
                  sourceAddress: renderWarehouse((shippingNoteOrder || receiveModalOrder)!.sourceWarehouse, warehouses),
                  receiverName: renderCreator((shippingNoteOrder || receiveModalOrder)!.createdBy),
                  destinationAddress: renderWarehouse((shippingNoteOrder || receiveModalOrder)!.destinationWarehouse, warehouses),
                  transporterName: (shippingNoteOrder || receiveModalOrder)!.driverName || 'Chưa phân công',
                  vehicle: (shippingNoteOrder || receiveModalOrder)!.vehiclePlate || 'Chưa cập nhật',
                  items: ((shippingNoteOrder || receiveModalOrder)!.items || []).map((item, idx) => ({
                    id: item.id || String(idx + 1),
                    productName: item.productName || 'Sản phẩm điều chuyển',
                    productCode: item.productCode || 'SKU---',
                    unit: item.unit || 'Cái',
                    quantityExported: item.quantity || 1,
                    quantityImported: item.quantity || 1,
                    price: Number((item as any).price || 0),
                  })),
                }
              : undefined
          }
          setToast={setToast}
        />
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════
  // 🏢 RENDER MAIN TRANSFER REQUESTS LIST PAGE
  // ════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6">
      {/* Header Banner & Action Buttons Bar (Exact match with Image 2) */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2.5 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-4 py-2 text-white shadow-md">
            <Package className="h-5 w-5 text-cyan-100" />
            <h1 className="text-lg font-bold tracking-tight text-white">Quản Lý Nhập Kho Nội Bộ</h1>
          </div>
        </div>

        {/* Toolbar Buttons Bar (Copy, Xóa, In báo cáo, Export Excel, Hiển thị, Maximize) */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 1. Copy */}
          <button
            type="button"
            onClick={handleCopySelected}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-4 py-2 text-xs sm:text-sm font-extrabold text-cyan-700 shadow-2xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
          >
            <Copy className="h-4 w-4 text-cyan-700" />
            Copy {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
          </button>

          {/* 3. Xóa */}
          <button
            type="button"
            onClick={handleDeleteSelected}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-4 py-2 text-xs sm:text-sm font-extrabold text-cyan-700 shadow-2xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
          >
            <Trash2 className="h-4 w-4 text-cyan-700" />
            Xóa {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
          </button>

          {/* 4. In báo cáo */}
          <button
            type="button"
            onClick={() => {
              if (orders.length > 0) {
                setShippingNoteOrder(orders[0]);
                setIsShippingNoteModalOpen(true);
              } else {
                setToast({ type: 'error', message: 'Không có phiếu để in' });
              }
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-4 py-2 text-xs sm:text-sm font-extrabold text-cyan-700 shadow-2xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
          >
            <Printer className="h-4 w-4 text-cyan-700" />
            In báo cáo
          </button>

          {/* 5. Export Excel */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-4 py-2 text-xs sm:text-sm font-extrabold text-cyan-700 shadow-2xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4 text-cyan-700" />
            Export Excel
          </button>

          {/* 6. Hiển thị */}
          <button
            type="button"
            onClick={() => setShowColumnSettings(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-4 py-2 text-xs sm:text-sm font-extrabold text-cyan-700 shadow-2xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
            title="Cấu hình hiển thị cột"
          >
            <Settings className="h-4 w-4 text-cyan-700" />
            Hiển thị
          </button>

          {/* 7. Maximize */}
          <button
            type="button"
            onClick={toggleBrowserFullscreen}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-700 bg-white text-cyan-700 shadow-2xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
            title="Toàn màn hình"
          >
            {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* 4 Summary Stat Boxes */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-4">
        <div className="flex h-14 sm:h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-2 sm:px-4 shadow-sm transition hover:bg-cyan-50 text-center">
          <p className="text-xs sm:text-base md:text-lg font-black text-cyan-700 uppercase truncate">{total} TỔNG PHIẾU</p>
        </div>
        <div className="flex h-14 sm:h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-2 sm:px-4 shadow-sm transition hover:bg-cyan-50 text-center">
          <p className="text-xs sm:text-base md:text-lg font-black text-cyan-700 uppercase truncate">{pendingCount} CHỜ XỬ LÝ</p>
        </div>
        <div className="flex h-14 sm:h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-2 sm:px-4 shadow-sm transition hover:bg-cyan-50 text-center">
          <p className="text-xs sm:text-base md:text-lg font-black text-cyan-700 uppercase truncate">{movingCount} ĐANG GIAO</p>
        </div>
        <div className="flex h-14 sm:h-[72px] items-center justify-center rounded-xl border-2 border-cyan-500 bg-white px-2 sm:px-4 shadow-sm transition hover:bg-cyan-50 text-center">
          <p className="text-xs sm:text-base md:text-lg font-black text-cyan-700 uppercase truncate">{doneCount} HOÀN THÀNH</p>
        </div>
      </div>

      {/* Filter & Search Panel */}
      <div className="rounded-2xl border-2 border-slate-200 bg-white p-3 sm:p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Search input (h-12) */}
          <div className="relative w-full sm:min-w-[260px] flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-cyan-600" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 sm:h-12 w-full rounded-xl border-2 border-cyan-600/40 bg-white pl-11 pr-4 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 shadow-2xs"
              placeholder="Tìm theo số phiếu, kho chuyển/nhận, tài xế, SĐT, biển số xe, diễn giải..."
            />
          </div>

          {/* Date & Status Filters Container */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Time Filter Box (h-12) */}
            <div className="inline-flex h-12 items-center gap-2 rounded-xl border-2 border-cyan-600/30 bg-slate-50/80 px-3.5 shadow-2xs">
              <CalendarDays className="h-4.5 w-4.5 text-cyan-600 shrink-0" />
              <span className="text-xs font-extrabold uppercase text-cyan-950 tracking-wide whitespace-nowrap">Thời gian:</span>
              <select
                value={timeFilter}
                onChange={(event) => setTimeFilter(event.target.value as TimeFilter)}
                className="h-9 rounded-lg border-2 border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20 cursor-pointer"
              >
                <option value="this-month">Tháng này</option>
                <option value="7-days">7 ngày gần đây</option>
                <option value="all">Tất cả</option>
              </select>
            </div>

            {/* Status Filter Box (h-12) */}
            <div className="inline-flex h-12 items-center gap-2 rounded-xl border-2 border-cyan-600/30 bg-slate-50/80 px-3.5 shadow-2xs">
              <Filter className="h-4 w-4 text-cyan-600 shrink-0" />
              <span className="text-xs font-extrabold uppercase text-cyan-950 tracking-wide whitespace-nowrap">Trạng thái:</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                className="h-9 rounded-lg border-2 border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-500/20 cursor-pointer"
              >
                <option value="all">Tất cả</option>
                <option value="PENDING">Chờ xử lý</option>
                <option value="IN_TRANSIT">Đang vận chuyển</option>
                <option value="DELIVERED">Hoàn thành</option>
                <option value="CANCELLED">Đã hủy</option>
              </select>
            </div>

            {/* Reset Filter Button (h-12) */}
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex h-12 w-12 items-center justify-center rounded-xl border-2 border-cyan-700 bg-white text-cyan-700 shadow-2xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
              title="Đặt lại bộ lọc"
            >
              <RefreshCw className={`h-4.5 w-4.5 text-cyan-700 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Transfer Orders Table with horizontal scroll support */}
      <div className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full min-w-[1750px] border-collapse text-left">
            <thead className="bg-cyan-50 sticky top-0 z-20 shadow-sm">
              <tr className="border-b-2 border-slate-200 text-slate-800 font-extrabold uppercase text-xs sm:text-sm tracking-wider whitespace-nowrap">
                <th className="w-12 min-w-[50px] border-r border-slate-200 px-2 py-4 text-center whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="h-4.5 w-4.5 rounded border-slate-300 accent-cyan-600 focus:ring-cyan-500 cursor-pointer"
                  />
                </th>
                {columnVis.stt && <th className="w-14 min-w-[60px] border-r border-slate-200 px-3 py-4 text-center whitespace-nowrap">STT</th>}
                {columnVis.transferNo && <th className="min-w-[190px] border-r border-slate-200 px-4 py-4 text-center whitespace-nowrap">Số phiếu</th>}
                {columnVis.sourceWarehouse && <th className="min-w-[200px] border-r border-slate-200 px-3 py-4 text-center whitespace-nowrap">Kho chuyển</th>}
                {columnVis.destinationWarehouse && <th className="min-w-[200px] border-r border-slate-200 px-3 py-4 text-center whitespace-nowrap">Kho nhận</th>}
                {columnVis.dispatchDate && <th className="min-w-[170px] border-r border-slate-200 px-3 py-4 text-center whitespace-nowrap">Ngày chuyển</th>}
                {columnVis.receiveDate && <th className="min-w-[170px] border-r border-slate-200 px-3 py-4 text-center whitespace-nowrap">Ngày nhận</th>}
                {columnVis.driver && <th className="min-w-[200px] border-r border-slate-200 px-3 py-4 text-center whitespace-nowrap">Tài xế & SĐT</th>}
                {columnVis.vehiclePlate && <th className="min-w-[130px] border-r border-slate-200 px-3 py-4 text-center whitespace-nowrap">Biển số xe</th>}
                {columnVis.createdBy && <th className="min-w-[170px] border-r border-slate-200 px-3 py-4 text-center whitespace-nowrap">Người tạo phiếu</th>}
                {columnVis.totalItems && <th className="min-w-[130px] border-r border-slate-200 px-3 py-4 text-center whitespace-nowrap">Tổng mặt hàng</th>}
                {columnVis.totalQuantity && <th className="min-w-[130px] border-r border-slate-200 px-3 py-4 text-center whitespace-nowrap">Tổng số lượng</th>}
                {columnVis.createdAt && <th className="min-w-[170px] border-r border-slate-200 px-3 py-4 text-center whitespace-nowrap">Ngày lập</th>}
                {columnVis.status && <th className="min-w-[150px] border-r border-slate-200 px-3 py-4 text-center whitespace-nowrap">Trạng thái</th>}
                <th className="sticky right-0 top-0 z-30 w-44 min-w-[160px] bg-cyan-100 px-3 py-4 text-center shadow-[-4px_0_12px_rgba(0,0,0,0.05)] border-l border-slate-200 text-cyan-950 font-black whitespace-nowrap">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white font-medium">
              {paginatedOrders.length > 0 ? (
                paginatedOrders.map((order, index) => {
                  const isPendingReceive = order.status === 'DRAFT' || order.status === 'PENDING' || order.status === 'IN_TRANSIT' || order.status === 'APPROVED';
                  const totalItemsCount = order.items?.length || order.itemCount || 0;
                  const totalQuantityCount = order.totalQuantity || (order.items || []).reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
                  const isChecked = selectedIds.has(order.id);

                  return (
                    <tr key={order.id} className="group border-b border-slate-200 transition hover:bg-cyan-50/60">
                      <td className="border-r border-slate-200 px-2 py-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => handleSelectOne(order.id, e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                        />
                      </td>
                      {columnVis.stt && (
                        <td className="border-r border-slate-200 px-3 py-3.5 text-center text-sm font-medium text-slate-700">
                          {startIndex + index}
                        </td>
                      )}
                      {columnVis.transferNo && (
                        <td className="border-r border-slate-200 px-4 py-3.5 text-center text-sm font-extrabold text-cyan-700 whitespace-nowrap">
                          {order.transferNo}
                        </td>
                      )}
                      {columnVis.sourceWarehouse && (
                        <td className="border-r border-slate-200 px-4 py-3.5 text-sm font-bold text-slate-800">
                          {renderWarehouse(order.sourceWarehouse, warehouses)}
                        </td>
                      )}
                      {columnVis.destinationWarehouse && (
                        <td className="border-r border-slate-200 px-4 py-3.5 text-sm font-bold text-cyan-800">
                          {renderWarehouse(order.destinationWarehouse, warehouses)}
                        </td>
                      )}
                      {columnVis.dispatchDate && (
                        <td className="border-r border-slate-200 px-3 py-3.5 text-center text-xs font-bold text-slate-700">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-slate-400" />
                            {formatDateTime(order.dispatchDate)}
                          </span>
                        </td>
                      )}
                      {columnVis.receiveDate && (
                        <td className="border-r border-slate-200 px-3 py-3.5 text-center text-xs font-bold text-slate-700">
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                            {formatDateTime(order.receiveDate)}
                          </span>
                        </td>
                      )}
                      {columnVis.driver && (
                        <td className="border-r border-slate-200 px-4 py-3.5 text-center text-xs font-semibold text-slate-800">
                          {order.driverName ? (
                            <div>
                              <p className="font-extrabold text-slate-900">{order.driverName}</p>
                              {order.driverPhone && <p className="text-[11px] text-slate-500">{order.driverPhone}</p>}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Chưa chỉ định</span>
                          )}
                        </td>
                      )}
                      {columnVis.vehiclePlate && (
                        <td className="border-r border-slate-200 px-3 py-3.5 text-center text-xs font-black text-slate-800">
                          {order.vehiclePlate || <span className="text-slate-400 font-normal italic">-</span>}
                        </td>
                      )}
                      {columnVis.createdBy && (
                        <td className="border-r border-slate-200 px-3 py-3.5 text-center text-sm font-semibold text-slate-700">
                          {renderCreator(order.createdBy)}
                        </td>
                      )}
                      {columnVis.totalItems && (
                        <td className="border-r border-slate-200 px-3 py-3.5 text-center text-sm font-extrabold text-slate-900">
                          {totalItemsCount}
                        </td>
                      )}
                      {columnVis.totalQuantity && (
                        <td className="border-r border-slate-200 px-3 py-3.5 text-center text-sm font-extrabold text-cyan-800 font-mono">
                          {totalQuantityCount.toLocaleString('vi-VN')}
                        </td>
                      )}
                      {columnVis.createdAt && (
                        <td className="border-r border-slate-200 px-3 py-3.5 text-center text-sm font-semibold text-slate-700">
                          {formatDateTime(order.createdAt)}
                        </td>
                      )}
                      {columnVis.status && (
                        <td className="border-r border-slate-200 px-3 py-3.5 text-center align-middle">
                          <span className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-extrabold whitespace-nowrap ${statusConfig[order.status]?.color || 'border-slate-200 bg-slate-50 text-slate-700'}`}>
                            {statusConfig[order.status]?.label || order.status}
                          </span>
                        </td>
                      )}
                      <td className="sticky right-0 z-10 w-44 min-w-[160px] bg-white group-hover:bg-cyan-50/90 px-3 py-3.5 text-center shadow-[-4px_0_12px_rgba(0,0,0,0.05)] border-l border-slate-200">
                        {/* Action buttons matching exact design & user request */}
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Nút Đã nhận hàng -> Nhận hàng & Phân bổ ô kệ kho nhận */}
                          {isPendingReceive && (
                            <button
                              type="button"
                              onClick={() => openReceiveModal(order)}
                              className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-emerald-600 bg-emerald-50 text-emerald-700 shadow-2xs transition hover:bg-emerald-600 hover:text-white cursor-pointer active:scale-95"
                              title="Đã nhận hàng & Chọn ô kệ nhập kho"
                            >
                              <CheckCircle2 className="h-4.5 w-4.5" strokeWidth={2.5} />
                            </button>
                          )}

                          {/* Nút Xem / Sửa phiếu / Xếp ô kệ */}
                          {(order.status as string) === 'DELIVERED' || (order.status as string) === 'COMPLETED' || (order.status as string) === 'RECEIVED' ? (
                            <button
                              type="button"
                              onClick={() => openReceiveModal(order)}
                              className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-700 bg-white text-cyan-700 shadow-2xs transition hover:bg-cyan-50 cursor-pointer"
                              title="Xem chi tiết phân bổ ô kệ (Chỉ xem)"
                            >
                              <Eye className="h-4 w-4 text-cyan-700" strokeWidth={2.2} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => navigate('/delivery/receive-transfer-order', { state: { editOrderData: order, mode: 'receive', fromRequests: true } })}
                              className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-700 bg-white text-cyan-700 shadow-2xs transition hover:bg-cyan-50 cursor-pointer"
                              title="Xếp vào ô kệ kho nhận"
                            >
                              <Pencil className="h-4 w-4 text-cyan-700" strokeWidth={2.2} />
                            </button>
                          )}

                          {/* Nút In / Xem chứng từ */}
                          <button
                            type="button"
                            onClick={() => {
                              setShippingNoteOrder(order);
                              setIsShippingNoteModalOpen(true);
                            }}
                            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-cyan-700 bg-white text-cyan-700 shadow-2xs transition hover:bg-cyan-50 cursor-pointer"
                            title="In / Xem chứng từ"
                          >
                            <FileText className="h-4 w-4 text-cyan-700" strokeWidth={2.2} />
                          </button>

                          {/* Nút Xóa phiếu */}
                          <button
                            type="button"
                            onClick={() => handleDeleteOrder(order)}
                            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-red-600 bg-white text-red-600 shadow-2xs transition hover:bg-red-50 cursor-pointer"
                            title="Xóa phiếu"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" strokeWidth={2.2} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={15} className="py-12 text-center text-slate-500 font-semibold text-sm">
                    Chưa có phiếu nhập kho nội bộ. Dữ liệu sẽ tự động đồng bộ khi có phiếu xuất kho nội bộ.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Section */}
        <div className="flex flex-col items-center justify-between border-t-2 border-slate-200 bg-white px-6 py-4 sm:flex-row">
          <div className="text-sm font-semibold text-slate-700">
            Hiển thị:
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="mx-2 h-9 rounded-lg border-2 border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-800 outline-none transition focus:border-cyan-600 cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
            dòng/trang
            <span className="ml-3 font-medium text-slate-500">
              Hiển thị <b className="font-extrabold text-slate-900">{startIndex}</b> - <b className="font-extrabold text-slate-900">{endIndex}</b> trên tổng <b className="font-extrabold text-slate-900">{totalItems}</b> phiếu nhập
            </span>
          </div>

          <div className="mt-4 flex items-center gap-2 sm:mt-0">
            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-sm font-extrabold text-slate-600 transition hover:bg-cyan-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              «
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-sm font-extrabold text-slate-600 transition hover:bg-cyan-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              ‹
            </button>
            <span className="px-3 text-sm font-extrabold text-slate-800">
              Trang {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-sm font-extrabold text-slate-600 transition hover:bg-cyan-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              ›
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages || totalPages === 0}
              className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-sm font-extrabold text-slate-600 transition hover:bg-cyan-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              »
            </button>
          </div>
        </div>
      </div>

      {/* Column Settings Modal (Hiển thị) */}
      {showColumnSettings &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border-2 border-cyan-500">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h3 className="text-base font-black text-slate-900 uppercase flex items-center gap-2">
                  <Settings className="h-5 w-5 text-cyan-600" />
                  Cấu hình Cột Hiển Thị
                </h3>
                <button
                  type="button"
                  onClick={() => setShowColumnSettings(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 max-h-[60vh] overflow-y-auto space-y-2 text-xs font-bold text-slate-700">
                {[
                  { key: 'stt', label: 'Số Thứ Tự (STT)' },
                  { key: 'transferNo', label: 'Số Phiếu' },
                  { key: 'sourceWarehouse', label: 'Kho Chuyển' },
                  { key: 'destinationWarehouse', label: 'Kho Nhận' },
                  { key: 'dispatchDate', label: 'Ngày Chuyển' },
                  { key: 'receiveDate', label: 'Ngày Nhận' },
                  { key: 'driver', label: 'Tài Xế & SĐT' },
                  { key: 'vehiclePlate', label: 'Biển Số Xe' },
                  { key: 'createdBy', label: 'Người Tạo Phiếu' },
                  { key: 'totalItems', label: 'Tổng Mặt Hàng' },
                  { key: 'totalQuantity', label: 'Tổng Số Lượng' },
                  { key: 'createdAt', label: 'Ngày Lập' },
                  { key: 'status', label: 'Trạng Thái' },
                ].map((col) => (
                  <label key={col.key} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 hover:bg-cyan-50/50 cursor-pointer">
                    <span className="text-slate-800">{col.label}</span>
                    <input
                      type="checkbox"
                      checked={columnVis[col.key] ?? true}
                      onChange={(e) => setColumnVis((prev) => ({ ...prev, [col.key]: e.target.checked }))}
                      className="h-4.5 w-4.5 rounded border-slate-300 accent-cyan-600 focus:ring-cyan-500 cursor-pointer"
                    />
                  </label>
                ))}
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowColumnSettings(false)}
                  className="rounded-xl border-2 border-cyan-600 bg-cyan-600 px-5 py-2 text-xs font-black text-white hover:bg-cyan-700 cursor-pointer"
                >
                  XÁC NHẬN & ĐÓNG
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Internal Shipping Note Modal for printing */}
      <InternalShippingNoteModal
        open={isShippingNoteModalOpen}
        onClose={() => {
          setIsShippingNoteModalOpen(false);
          setShippingNoteOrder(null);
        }}
        initialData={
          shippingNoteOrder
            ? {
                commandNo: shippingNoteOrder.transferNo,
                sourceAddress: renderWarehouse(shippingNoteOrder.sourceWarehouse, warehouses),
                receiverName: renderCreator(shippingNoteOrder.createdBy),
                destinationAddress: renderWarehouse(shippingNoteOrder.destinationWarehouse, warehouses),
                transporterName: shippingNoteOrder.driverName || 'Chưa phân công',
                vehicle: shippingNoteOrder.vehiclePlate || 'Chưa cập nhật',
                items: (shippingNoteOrder.items || []).map((item, idx) => ({
                  id: item.id || String(idx + 1),
                  productName: item.productName || 'Sản phẩm điều chuyển',
                  productCode: item.productCode || 'SKU---',
                  unit: item.unit || 'Cái',
                  quantityExported: item.quantity || 1,
                  quantityImported: item.quantity || 1,
                  price: Number((item as any).price || 0),
                })),
              }
            : undefined
        }
        setToast={setToast}
      />

      {/* Global Toast */}
      {toast && (
        <div
          className={`fixed right-6 top-24 z-[999999] flex items-center gap-3 rounded-xl border bg-white px-4 py-3 shadow-2xl ${
            toast.type === 'error' ? 'border-red-200 text-red-600' : 'border-emerald-200 text-emerald-600'
          }`}
        >
          <p className="text-sm font-bold">{toast.message}</p>
          <button type="button" onClick={() => setToast(null)} className="rounded-lg p-1 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
