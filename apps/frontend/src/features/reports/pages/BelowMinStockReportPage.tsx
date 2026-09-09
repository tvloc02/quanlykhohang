import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  TrendingDown,
  Printer,
  FileSpreadsheet,
  RefreshCw,
  Search,
  Settings,
  Maximize2,
  Minimize2,
  SlidersHorizontal,
  Building2,
  Eye,
  X,
  AlertTriangle,
  ChevronDown,
  Check,
  Save,
  Filter,
} from 'lucide-react';
import { ReportPrintHeader } from '../components/ReportPrintHeader';
import { ReportPrintFooter } from '../components/ReportPrintFooter';

const fmt = (v: number) => {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(v || 0);
};

const getCategoryName = (cat: any): string => {
  if (!cat) return 'Mặc định';
  if (typeof cat === 'string') return cat;
  if (typeof cat === 'object') {
    return cat.name || cat.categoryName || cat.title || cat.code || 'Mặc định';
  }
  return String(cat);
};

const getProductStockInWarehouse = (product: any, whCode: string): number => {
  if (!product.stockBalances || !Array.isArray(product.stockBalances)) {
    return 0;
  }
  const targetCode = String(whCode || '').trim().toUpperCase();

  // 1. Check exact locationCode === whCode (e.g. 'KH006')
  const mainBalance = product.stockBalances.find((b: any) => {
    const loc = String(b.locationCode || '').trim().toUpperCase();
    return loc === targetCode;
  });

  if (mainBalance && mainBalance.totalPhysical !== undefined && Number(mainBalance.totalPhysical) > 0) {
    return Number(mainBalance.totalPhysical);
  }

  // 2. Check sub-locations / shelf bins (e.g. 'KH006-ZONE-A-R01-D7')
  const binBalances = product.stockBalances.filter((b: any) => {
    const loc = String(b.locationCode || '').trim().toUpperCase();
    return loc.startsWith(targetCode + '-') || loc.startsWith(targetCode + ' ');
  });

  if (binBalances.length > 0) {
    return binBalances.reduce((sum: number, b: any) => sum + Number(b.totalPhysical || b.available || 0), 0);
  }

  if (mainBalance && mainBalance.totalPhysical !== undefined) {
    return Number(mainBalance.totalPhysical);
  }

  return 0;
};

interface BelowMinStockItem {
  stt: number;
  productId: string;
  category: string;
  code: string;
  name: string;
  importPrice: number;
  minStock: number;
  actualStock: number;
  diff: number; // actualStock - minStock
}

interface BranchStockGroup {
  branchId: string;
  branchName: string;
  items: BelowMinStockItem[];
  totalActualStock: number;
  totalDiff: number;
}

interface TransactionDetail {
  stt: number;
  code: string;
  date: string;
  targetName: string;
  inQty: number;
  outQty: number;
  price: number;
  totalAmount: number;
  balance: number;
  note: string;
}

const API_BASE_URL = '/api';

function authHeaders() {
  const token = localStorage.getItem('token');
  return {
    Authorization: token ? `Bearer ${token}` : '',
    'Content-Type': 'application/json',
  };
}

export default function BelowMinStockReportPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('ALL');
  const [filterBelowOnly, setFilterBelowOnly] = useState<boolean>(false);

  // Custom Warehouse Dropdown State
  const [isWarehouseDropdownOpen, setIsWarehouseDropdownOpen] = useState(false);
  const warehouseDropdownRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [warehouses, setWarehouses] = useState<{ id: string; name: string; code: string }[]>([]);
  const [branchGroups, setBranchGroups] = useState<BranchStockGroup[]>([]);

  // Close custom warehouse dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (warehouseDropdownRef.current && !warehouseDropdownRef.current.contains(event.target as Node)) {
        setIsWarehouseDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fullscreen state
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Column settings modal
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [columnVis, setColumnVis] = useState({
    stt: true,
    category: true,
    code: true,
    name: true,
    importPrice: true,
    minStock: true,
    actualStock: true,
    diff: true,
    actions: true,
  });

  // Editing minimum stock threshold state
  const [defaultMinStock, setDefaultMinStock] = useState<number>(() => {
    const saved = localStorage.getItem('report_below_min_stock_threshold');
    if (saved !== null && !isNaN(Number(saved))) {
      return Math.max(0, Number(saved));
    }
    return 10;
  });
  const [editingMinStock, setEditingMinStock] = useState<Record<string, number>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Product detail popup modal state
  const [selectedItemForModal, setSelectedItemForModal] = useState<{
    item: BelowMinStockItem;
    branchName: string;
    details: TransactionDetail[];
    loadingDetails: boolean;
  } | null>(null);

  const toggleBrowserFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullScreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullScreen(false);
    }
  };

  useEffect(() => {
    const handleFSChange = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFSChange);
    return () => document.removeEventListener('fullscreenchange', handleFSChange);
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Fetch Warehouses from Real API
      let whList: { id: string; name: string; code: string }[] = [];
      try {
        const whRes = await fetch(`${API_BASE_URL}/warehouses`, { headers: authHeaders() });
        if (whRes.ok) {
          const data = await whRes.json();
          if (Array.isArray(data) && data.length > 0) {
            whList = data.map((w: any) => ({
              id: String(w.id || w.code),
              name: String(w.name || w.warehouseName || w.code),
              code: String(w.code || w.id),
            }));
          }
        }
      } catch {}

      if (whList.length === 0) {
        whList = [
          { id: 'KH006', name: 'Kho Thanh Trì', code: 'KH006' },
          { id: 'KH001', name: 'Kho Hà Đông', code: 'KH001' },
          { id: 'KH002', name: 'Kho Chi Nhánh HCM', code: 'KH002' },
          { id: 'KH007', name: 'Kho Nghệ An', code: 'KH007' },
        ];
      }
      whList.sort((a, b) => a.code.localeCompare(b.code));
      setWarehouses(whList);

      // 2. Fetch Products from Real API
      let productsList: any[] = [];
      try {
        const pRes = await fetch(`${API_BASE_URL}/products`, { headers: authHeaders() });
        if (pRes.ok) {
          const pData = await pRes.json();
          if (Array.isArray(pData)) productsList = pData;
        }
      } catch {}

      // Retrieve default minimum stock threshold (e.g. 10)
      const defaultThreshold = (() => {
        const saved = localStorage.getItem('report_below_min_stock_threshold');
        return saved !== null && !isNaN(Number(saved)) ? Math.max(0, Number(saved)) : 10;
      })();

      // 3.1. Build Group: TỔNG HỢP TOÀN BỘ KHO HÀNG (TẤT CẢ CHI NHÁNH)
      let allStt = 1;
      let allTotalAct = 0;
      let allTotalDiff = 0;

      const allItems: BelowMinStockItem[] = productsList.map((p) => {
        const pCode = String(p.internalSku || p.sku || p.code || p.id);
        const pName = String(p.name || '');
        const catName = getCategoryName(p.category || p.categoryName);
        const importPrice = Number(p.importPrice || p.costPrice || p.price || 0);

        const storedMin = localStorage.getItem(`product_min_stock_${p.id}`);
        let minStock = defaultThreshold;
        if (storedMin !== null && !isNaN(Number(storedMin))) {
          minStock = Number(storedMin);
        } else if (p.minimumStock !== undefined && p.minimumStock !== null && Number(p.minimumStock) > 0) {
          minStock = Number(p.minimumStock);
        } else {
          minStock = defaultThreshold;
        }

        // Thực tồn toàn hệ thống: lấy p.totalStock
        let actualStock = Number(p.totalStock !== undefined ? p.totalStock : (p.stock || 0));
        if (actualStock < 0) actualStock = 0;

        const diff = Math.max(0, minStock - actualStock);
        allTotalAct += actualStock;
        allTotalDiff += diff;

        return {
          stt: allStt++,
          productId: String(p.id || pCode),
          category: catName,
          code: pCode,
          name: pName,
          importPrice,
          minStock,
          actualStock,
          diff,
        };
      });

      const allGroup: BranchStockGroup = {
        branchId: 'ALL',
        branchName: 'TỔNG HỢP TOÀN BỘ KHO HÀNG (TẤT CẢ CHI NHÁNH)',
        items: allItems,
        totalActualStock: allTotalAct,
        totalDiff: allTotalDiff,
      };

      // 3.2. Build Groups: TỪNG CHI NHÁNH KHO CỤ THỂ
      const warehouseGroups: BranchStockGroup[] = whList.map((wh) => {
        let whStt = 1;
        let whTotalAct = 0;
        let whTotalDiff = 0;

        const items: BelowMinStockItem[] = productsList.map((p) => {
          const pCode = String(p.internalSku || p.sku || p.code || p.id);
          const pName = String(p.name || '');
          const catName = getCategoryName(p.category || p.categoryName);
          const importPrice = Number(p.importPrice || p.costPrice || p.price || 0);

          const storedMin = localStorage.getItem(`product_min_stock_${p.id}`);
          let minStock = defaultThreshold;
          if (storedMin !== null && !isNaN(Number(storedMin))) {
            minStock = Number(storedMin);
          } else if (p.minimumStock !== undefined && p.minimumStock !== null && Number(p.minimumStock) > 0) {
            minStock = Number(p.minimumStock);
          } else {
            minStock = defaultThreshold;
          }

          // Thực tồn tại kho này
          let actualStock = getProductStockInWarehouse(p, wh.code);
          if (actualStock < 0) actualStock = 0;

          const diff = Math.max(0, minStock - actualStock);
          whTotalAct += actualStock;
          whTotalDiff += diff;

          return {
            stt: whStt++,
            productId: String(p.id || pCode),
            category: catName,
            code: pCode,
            name: pName,
            importPrice,
            minStock,
            actualStock,
            diff,
          };
        });

        return {
          branchId: wh.code,
          branchName: `${wh.name} (${wh.code})`,
          items,
          totalActualStock: whTotalAct,
          totalDiff: whTotalDiff,
        };
      });

      setBranchGroups([allGroup, ...warehouseGroups]);
    } catch (err: any) {
      setError(err?.message || 'Không thể tải báo cáo từ hệ thống API');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Lưu định mức tồn cho một sản phẩm vào Database & LocalStorage
  const handleSaveMinStock = async (productId: string, newMin: number, productName: string) => {
    setSavingId(productId);
    try {
      await fetch(`${API_BASE_URL}/products/${productId}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ minimumStock: newMin }),
      });

      localStorage.setItem(`product_min_stock_${productId}`, String(newMin));

      setBranchGroups((prevGroups) =>
        prevGroups.map((g) => {
          const updatedItems = g.items.map((it) => {
            if (it.productId === productId) {
              const actual = it.actualStock;
              const diff = Math.max(0, newMin - actual);
              return {
                ...it,
                minStock: newMin,
                diff,
              };
            }
            return it;
          });
          return {
            ...g,
            items: updatedItems,
            totalActualStock: updatedItems.reduce((s, i) => s + i.actualStock, 0),
            totalDiff: updatedItems.reduce((s, i) => s + i.diff, 0),
          };
        })
      );

      setEditingMinStock((prev) => {
        const next = { ...prev };
        delete next[productId];
        return next;
      });

      setSaveToast(`Đã lưu định mức tồn "${productName}": ${newMin}`);
      setTimeout(() => setSaveToast(null), 3000);
    } catch (err) {
      console.error('Lỗi khi lưu định mức:', err);
      localStorage.setItem(`product_min_stock_${productId}`, String(newMin));
      setSaveToast(`Đã lưu định mức tồn vào bộ nhớ máy`);
      setTimeout(() => setSaveToast(null), 3000);
    } finally {
      setSavingId(null);
    }
  };

  // Lưu tất cả định mức đã chỉnh sửa
  const handleSaveAllMinStock = async () => {
    const entries = Object.entries(editingMinStock);
    if (entries.length === 0) return;
    setSavingId('ALL');
    for (const [pId, val] of entries) {
      try {
        await fetch(`${API_BASE_URL}/products/${pId}`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify({ minimumStock: val }),
        });
      } catch {}
      localStorage.setItem(`product_min_stock_${pId}`, String(val));
    }

    setBranchGroups((prevGroups) =>
      prevGroups.map((g) => {
        const updatedItems = g.items.map((it) => {
          if (editingMinStock[it.productId] !== undefined) {
            const newMin = editingMinStock[it.productId];
            return {
              ...it,
              minStock: newMin,
              diff: Math.max(0, newMin - it.actualStock),
            };
          }
          return it;
        });
        return {
          ...g,
          items: updatedItems,
          totalActualStock: updatedItems.reduce((s, i) => s + i.actualStock, 0),
          totalDiff: updatedItems.reduce((s, i) => s + i.diff, 0),
        };
      })
    );

    setEditingMinStock({});
    setSavingId(null);
    setSaveToast(`Đã lưu định mức tồn cho ${entries.length} sản phẩm thành công!`);
    setTimeout(() => setSaveToast(null), 3000);
  };

  // Cập nhật định mức tồn mặc định khi người dùng thay đổi số lượng ở bộ lọc
  const handleDefaultMinStockChange = (newVal: number) => {
    setDefaultMinStock(newVal);
    localStorage.setItem('report_below_min_stock_threshold', String(newVal));

    // Cập nhật ngay lập tức các sản phẩm chưa có định mức riêng biệt
    setBranchGroups((prevGroups) =>
      prevGroups.map((g) => {
        const updatedItems = g.items.map((it) => {
          const hasIndividual = localStorage.getItem(`product_min_stock_${it.productId}`);
          if (!hasIndividual) {
            const diff = Math.max(0, newVal - it.actualStock);
            return {
              ...it,
              minStock: newVal,
              diff,
            };
          }
          return it;
        });
        return {
          ...g,
          items: updatedItems,
          totalActualStock: updatedItems.reduce((s, i) => s + i.actualStock, 0),
          totalDiff: updatedItems.reduce((s, i) => s + i.diff, 0),
        };
      })
    );
  };

  // Lưu định mức mặc định và hiển thị toast
  const handleSaveDefaultMinStock = () => {
    localStorage.setItem('report_below_min_stock_threshold', String(defaultMinStock));
    setSaveToast(`Đã lưu định mức tồn: ${defaultMinStock} sản phẩm`);
    setTimeout(() => setSaveToast(null), 3000);
  };

  // Áp dụng định mức này cho tất cả sản phẩm vào CSDL
  const handleApplyDefaultToAll = async () => {
    setSavingId('APPLY_ALL');
    let count = 0;
    for (const g of branchGroups) {
      for (const it of g.items) {
        try {
          await fetch(`${API_BASE_URL}/products/${it.productId}`, {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({ minimumStock: defaultMinStock }),
          });
        } catch {}
        localStorage.setItem(`product_min_stock_${it.productId}`, String(defaultMinStock));
        count++;
      }
    }

    setBranchGroups((prevGroups) =>
      prevGroups.map((g) => {
        const updatedItems = g.items.map((it) => ({
          ...it,
          minStock: defaultMinStock,
          diff: Math.max(0, defaultMinStock - it.actualStock),
        }));
        return {
          ...g,
          items: updatedItems,
          totalActualStock: updatedItems.reduce((s, i) => s + i.actualStock, 0),
          totalDiff: updatedItems.reduce((s, i) => s + i.diff, 0),
        };
      })
    );

    setEditingMinStock({});
    setSavingId(null);
    setSaveToast(`Đã áp dụng định mức ${defaultMinStock} cho tất cả ${count} sản phẩm vào CSDL!`);
    setTimeout(() => setSaveToast(null), 3500);
  };

  // Filtered branch groups
  const filteredGroups = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return branchGroups
      .filter((g) => (selectedWarehouse === 'ALL' ? g.branchId === 'ALL' : (g.branchId === selectedWarehouse || g.branchName.includes(selectedWarehouse))))
      .map((g) => {
        const filteredItems = g.items.filter((item) => {
          const matchTerm =
            !term ||
            item.name.toLowerCase().includes(term) ||
            item.code.toLowerCase().includes(term) ||
            item.category.toLowerCase().includes(term);

          const matchBelow = !filterBelowOnly || (item.minStock > 0 && item.actualStock < item.minStock);

          return matchTerm && matchBelow;
        });

        const totalAct = filteredItems.reduce((sum, i) => sum + i.actualStock, 0);
        const totalD = filteredItems.reduce((sum, i) => sum + i.diff, 0);

        return {
          ...g,
          items: filteredItems,
          totalActualStock: totalAct,
          totalDiff: totalD,
        };
      });
  }, [branchGroups, selectedWarehouse, searchTerm, filterBelowOnly]);

  // Open detail modal and fetch real movement history from API
  const handleOpenDetailModal = async (item: BelowMinStockItem, branchName: string) => {
    setSelectedItemForModal({
      item,
      branchName,
      details: [],
      loadingDetails: true,
    });

    try {
      const historyRes = await fetch(`${API_BASE_URL}/products/${item.productId}/stock-in-history`, {
        headers: authHeaders(),
      }).catch(() => null);

      let historyData: any[] = [];
      if (historyRes && historyRes.ok) {
        historyData = await historyRes.json();
      }

      let runningBal = 0;
      let logs: TransactionDetail[] = [
        {
          stt: 1,
          code: 'Tồn đầu',
          date: '',
          targetName: 'Khách lẻ',
          inQty: 0,
          outQty: 0,
          price: 0,
          totalAmount: 0,
          balance: 0,
          note: 'Khởi tạo tồn kho ban đầu',
        },
      ];

      if (Array.isArray(historyData) && historyData.length > 0) {
        historyData.forEach((h, idx) => {
          const inQty = Number(h.quantity || h.qty || 0);
          const price = Number(h.importPrice || h.unitPrice || item.importPrice || 0);
          runningBal += inQty;

          logs.push({
            stt: idx + 2,
            code: String(h.orderCode || h.code || `PN_${idx + 1}`),
            date: h.createdAt ? new Date(h.createdAt).toLocaleString('vi-VN') : '',
            targetName: String(h.supplierName || h.source || 'Nhập kho'),
            inQty,
            outQty: 0,
            price,
            totalAmount: Math.round(inQty * price),
            balance: runningBal,
            note: String(h.note || 'Nhập kho hàng hóa'),
          });
        });
      }

      logs.push({
        stt: logs.length + 1,
        code: 'Tồn cuối',
        date: new Date().toLocaleString('vi-VN'),
        targetName: 'Hệ thống',
        inQty: 0,
        outQty: 0,
        price: 0,
        totalAmount: 0,
        balance: item.actualStock,
        note: 'Tồn thực tế hiện tại',
      });

      setSelectedItemForModal({
        item,
        branchName,
        details: logs,
        loadingDetails: false,
      });
    } catch {
      setSelectedItemForModal((prev) => (prev ? { ...prev, loadingDetails: false } : null));
    }
  };

  const handleExportExcel = () => {
    const rows: any[] = [];

    filteredGroups.forEach((g) => {
      rows.push([`=== Chi nhánh: ${g.branchName} ===`, '', '', '', '', '', '', '']);
      g.items.forEach((it) => {
        rows.push([
          it.stt,
          `"${it.category.replace(/"/g, '""')}"`,
          `"${it.code.replace(/"/g, '""')}"`,
          `"${it.name.replace(/"/g, '""')}"`,
          fmt(it.importPrice),
          it.minStock,
          it.actualStock,
          it.diff > 0 ? `Thiếu ${it.diff}` : '0',
        ]);
      });
      rows.push(['Tổng:', '', '', '', '', '', g.totalActualStock, g.totalDiff > 0 ? `Thiếu ${g.totalDiff}` : '0']);
    });

    const headers = ['STT', 'Nhóm hàng hóa', 'Mã', 'Tên hàng hóa', 'Giá nhập', 'Định mức tồn', 'Thực tồn', 'Lệch'];
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Bao_Cao_Hang_Ton_Duoi_Dinh_Muc.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const hasUnsavedChanges = Object.keys(editingMinStock).length > 0;

  return (
    <>
      {/* ─── HEADER BÁO CÁO KHI IN ─── */}
      <ReportPrintHeader
        title="BÁO CÁO HÀNG TỒN DƯỚI ĐỊNH MỨC"
        subtitle={`Ngày lập: ${new Date().toLocaleDateString('vi-VN')}`}
        subInfo={`Kho hàng: ${selectedWarehouse === 'ALL' ? 'Tất cả chi nhánh' : warehouses.find((w) => w.id === selectedWarehouse)?.name || selectedWarehouse}`}
      />

      <div className={`space-y-4 pb-12 animate-in fade-in duration-200 ${isFullScreen ? 'fixed inset-0 z-[9000] bg-white overflow-y-auto p-6' : ''}`}>
        {/* ═══ TOP HEADER SECTION matching Gold Revenue Standard ═══ */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2.5 rounded-2xl bg-cyan-600 px-5 py-2.5 text-white shadow-md">
              <TrendingDown className="h-5 w-5" />
              <h1 className="text-xl font-extrabold tracking-tight uppercase">BÁO CÁO HÀNG TỒN DƯỚI ĐỊNH MỨC</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {hasUnsavedChanges && (
              <button
                type="button"
                onClick={handleSaveAllMinStock}
                disabled={savingId === 'ALL'}
                className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-emerald-600 bg-emerald-600 px-5 py-2.5 text-sm font-extrabold text-white shadow-md transition hover:bg-emerald-700 active:scale-95 cursor-pointer animate-pulse"
                title="Lưu tất cả các định mức tồn vừa chỉnh sửa vào CSDL"
              >
                {savingId === 'ALL' ? (
                  <RefreshCw className="h-4.5 w-4.5 animate-spin" />
                ) : (
                  <Save className="h-4.5 w-4.5" />
                )}
                <span>Lưu thay đổi ({Object.keys(editingMinStock).length})</span>
              </button>
            )}

            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-5 py-2.5 text-sm font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-4.5 w-4.5 text-cyan-700 ${loading ? 'animate-spin' : ''}`} />
              Làm mới
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-5 py-2.5 text-sm font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
            >
              <Printer className="h-4.5 w-4.5 text-cyan-700" />
              In báo cáo
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-5 py-2.5 text-sm font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
            >
              <FileSpreadsheet className="h-4.5 w-4.5 text-cyan-700" />
              Export Excel
            </button>

            <button
              type="button"
              onClick={() => setShowColumnSettings(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-700 bg-white px-5 py-2.5 text-sm font-extrabold text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
              title="Cấu hình hiển thị cột"
            >
              <Settings className="h-4.5 w-4.5 text-cyan-700" />
              <span>Hiển thị</span>
            </button>

            <button
              type="button"
              onClick={toggleBrowserFullscreen}
              className="inline-flex items-center justify-center h-10 w-10 rounded-xl border-2 border-cyan-700 bg-white text-cyan-700 shadow-xs transition hover:bg-cyan-50 active:scale-95 cursor-pointer"
              title="Toàn màn hình"
            >
              {isFullScreen ? <Minimize2 className="h-4.5 w-4.5 text-cyan-700" /> : <Maximize2 className="h-4.5 w-4.5 text-cyan-700" />}
            </button>
          </div>
        </div>

        {/* ═══ FILTER & SEARCH PANEL ═══ */}
        <div className="rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm space-y-3 print:hidden">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1 min-w-[260px]">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-11 pr-4 text-xs sm:text-sm font-bold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 shadow-2xs placeholder:text-slate-400"
                placeholder="Tìm kiếm theo mã, tên sản phẩm, nhóm..."
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Filter Kho hàng (Custom Styled Popover Dropdown) */}
              <div ref={warehouseDropdownRef} className="relative inline-block">
                <button
                  type="button"
                  onClick={() => setIsWarehouseDropdownOpen(!isWarehouseDropdownOpen)}
                  className="inline-flex h-12 items-center gap-2.5 rounded-xl border-2 border-cyan-600/40 bg-slate-50 px-4 py-2 shadow-2xs transition hover:bg-slate-100 hover:border-cyan-600 active:scale-95 cursor-pointer"
                >
                  <Building2 className="h-5 w-5 text-cyan-600 shrink-0" />
                  <span className="text-xs sm:text-sm font-extrabold uppercase text-cyan-950 tracking-wide">KHO HÀNG:</span>
                  <div className="flex items-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-3.5 py-1.5 text-xs sm:text-sm font-bold text-slate-800 shadow-2xs hover:border-cyan-600 min-w-[220px] justify-between">
                    <span className="truncate max-w-[190px]">
                      {selectedWarehouse === 'ALL'
                        ? 'Tất cả chi nhánh (Tổng kho)'
                        : warehouses.find((w) => w.code === selectedWarehouse || w.id === selectedWarehouse)?.name
                        ? `${warehouses.find((w) => w.code === selectedWarehouse || w.id === selectedWarehouse)!.name} (${warehouses.find((w) => w.code === selectedWarehouse || w.id === selectedWarehouse)!.code})`
                        : selectedWarehouse}
                    </span>
                    <ChevronDown className={`h-4 w-4 text-cyan-600 transition-transform duration-200 ${isWarehouseDropdownOpen ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {/* Custom Styled Menu với Bo góc tròn Rounded-2xl và Đổ bóng mượt */}
                {isWarehouseDropdownOpen && (
                  <div className="absolute top-full left-0 mt-2 w-full min-w-[280px] rounded-2xl border-2 border-cyan-500 bg-white p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedWarehouse('ALL');
                        setIsWarehouseDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-between cursor-pointer mb-1 ${
                        selectedWarehouse === 'ALL'
                          ? 'bg-cyan-600 text-white font-extrabold shadow-sm'
                          : 'text-slate-700 hover:bg-cyan-50 hover:text-cyan-800'
                      }`}
                    >
                      <span>Tất cả chi nhánh (Tổng kho)</span>
                      {selectedWarehouse === 'ALL' && <Check className="h-4 w-4 text-white shrink-0" />}
                    </button>
                    {warehouses.map((w) => {
                      const isSelected = selectedWarehouse === w.code || selectedWarehouse === w.id;
                      return (
                        <button
                          key={w.code}
                          type="button"
                          onClick={() => {
                            setSelectedWarehouse(w.code);
                            setIsWarehouseDropdownOpen(false);
                          }}
                          className={`w-full text-left px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-between cursor-pointer mb-1 last:mb-0 ${
                            isSelected
                              ? 'bg-cyan-600 text-white font-extrabold shadow-sm'
                              : 'text-slate-700 hover:bg-cyan-50 hover:text-cyan-800'
                          }`}
                        >
                          <span className="truncate">{w.name} ({w.code})</span>
                          {isSelected && <Check className="h-4 w-4 text-white shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Filter Định mức tồn & Chỉ xem hàng dưới định mức */}
              <div
                className={`inline-flex items-center rounded-xl border-2 transition shadow-2xs overflow-hidden ${
                  filterBelowOnly
                    ? 'border-rose-500 bg-rose-50/90 ring-2 ring-rose-400/20'
                    : 'border-slate-300 bg-white hover:border-slate-400'
                }`}
              >
                {/* Nút bật / tắt lọc */}
                <button
                  type="button"
                  onClick={() => setFilterBelowOnly(!filterBelowOnly)}
                  className={`inline-flex h-12 items-center gap-2 px-4 text-xs sm:text-sm font-extrabold transition cursor-pointer ${
                    filterBelowOnly ? 'text-rose-700 font-black' : 'text-slate-700 hover:text-cyan-700'
                  }`}
                  title={filterBelowOnly ? 'Đang lọc hàng dưới định mức (Bấm để xem tất cả)' : 'Bấm để lọc chỉ xem hàng dưới định mức'}
                >
                  <AlertTriangle className={`h-5 w-5 ${filterBelowOnly ? 'text-rose-600 animate-pulse' : 'text-slate-400'}`} />
                  <span>Chỉ xem hàng dưới định mức</span>
                </button>

                {/* Ô nhập số lượng định mức tồn (Thực tồn < [ X ]) */}
                <div className="flex h-12 items-center gap-1.5 border-l-2 border-slate-200 bg-slate-50/90 px-3 py-1">
                  <span className="text-xs font-black uppercase text-slate-700 whitespace-nowrap">
                    (Thực tồn &lt;
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={defaultMinStock}
                    onChange={(e) => {
                      const val = Math.max(0, parseInt(e.target.value) || 0);
                      handleDefaultMinStockChange(val);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSaveDefaultMinStock();
                      }
                    }}
                    className="h-8 w-16 sm:w-20 rounded-lg border-2 border-cyan-600 bg-white px-2 text-center text-xs sm:text-sm font-black text-cyan-900 outline-none transition focus:border-cyan-700 focus:ring-2 focus:ring-cyan-500/20 shadow-2xs"
                    title="Nhập số lượng định mức tồn và nhấn Lưu hoặc Enter"
                  />
                  <span className="text-xs font-black uppercase text-slate-700">)</span>

                  {/* Nút Lưu */}
                  <button
                    type="button"
                    onClick={handleSaveDefaultMinStock}
                    className="inline-flex h-8 items-center gap-1 rounded-lg bg-cyan-700 px-2.5 text-xs font-extrabold text-white shadow-xs hover:bg-cyan-800 transition active:scale-95 cursor-pointer ml-1"
                    title="Lưu định mức này vĩnh viễn (nếu không thay đổi sẽ luôn hiển thị số này)"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>Lưu</span>
                  </button>

                  {/* Nút Áp dụng cho tất cả */}
                  <button
                    type="button"
                    onClick={handleApplyDefaultToAll}
                    disabled={savingId === 'APPLY_ALL'}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-cyan-600 bg-white px-2.5 text-xs font-extrabold text-cyan-700 shadow-xs hover:bg-cyan-50 transition active:scale-95 cursor-pointer ml-1 disabled:opacity-50"
                    title="Lưu và áp dụng định mức này cho tất cả sản phẩm vào CSDL"
                  >
                    {savingId === 'APPLY_ALL' ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    <span className="hidden sm:inline">Áp dụng tất cả</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border-2 border-rose-300 bg-rose-50 p-4 text-xs font-extrabold text-rose-700">
            {error}
          </div>
        )}

        {/* ═══ DATA TABLE - FIXED NON-WRAPPING HEADERS & BALANCED SIZING ═══ */}
        <div className="overflow-hidden rounded-2xl border-2 border-slate-300 bg-white shadow-sm">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full min-w-[1050px] border-collapse text-left text-xs sm:text-sm">
              <thead className="bg-cyan-600 text-white font-extrabold uppercase border-b-2 border-cyan-700 sticky top-0 z-20 shadow-xs">
                <tr className="font-extrabold uppercase text-xs sm:text-sm tracking-wider text-white whitespace-nowrap">
                  {columnVis.stt && <th className="w-14 border-r border-cyan-500/50 px-3 py-3 text-center whitespace-nowrap">TT</th>}
                  {columnVis.category && <th className="w-44 border-r border-cyan-500/50 px-4 py-3 text-center whitespace-nowrap">NHÓM HÀNG HÓA</th>}
                  {columnVis.code && <th className="w-36 border-r border-cyan-500/50 px-4 py-3 text-center whitespace-nowrap">MÃ</th>}
                  {columnVis.name && <th className="min-w-[260px] border-r border-cyan-500/50 px-4 py-3 text-center whitespace-nowrap">TÊN HÀNG HÓA</th>}
                  {columnVis.importPrice && <th className="w-36 border-r border-cyan-500/50 px-4 py-3 text-center whitespace-nowrap">GIÁ NHẬP</th>}
                  {columnVis.minStock && <th className="w-44 border-r border-cyan-500/50 px-4 py-3 text-center whitespace-nowrap">ĐỊNH MỨC TỒN</th>}
                  {columnVis.actualStock && <th className="w-32 border-r border-cyan-500/50 px-4 py-3 text-center whitespace-nowrap">THỰC TỒN</th>}
                  {columnVis.diff && <th className="w-36 border-r border-cyan-500/50 px-4 py-3 text-center whitespace-nowrap">LỆCH</th>}
                  {columnVis.actions && <th className="w-24 px-4 py-3 text-center whitespace-nowrap print:hidden">THAO TÁC</th>}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 bg-white text-xs sm:text-sm font-medium text-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 font-bold text-sm">
                      <RefreshCw size={20} className="animate-spin inline-block mr-2 text-cyan-600" />
                      Đang tải báo cáo hàng tồn từ CSDL...
                    </td>
                  </tr>
                ) : filteredGroups.length > 0 ? (
                  filteredGroups.map((g) => (
                    <React.Fragment key={g.branchId}>
                      {/* LEVEL 1: KHO HÀNG / CHI NHÁNH HEADER */}
                      <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                        <td colSpan={9} className="py-2.5 px-4 text-left font-black text-sm uppercase tracking-wide text-slate-900 bg-slate-100">
                          {g.branchName}
                        </td>
                      </tr>

                      {/* PRODUCT ROWS */}
                      {g.items.map((item) => {
                        const currentVal = editingMinStock[item.productId] !== undefined ? editingMinStock[item.productId] : item.minStock;
                        const isModified = editingMinStock[item.productId] !== undefined && editingMinStock[item.productId] !== item.minStock;
                        const isSavingThis = savingId === item.productId || savingId === 'ALL';

                        return (
                          <tr key={g.branchId + '_' + item.stt} className="hover:bg-slate-50 transition">
                            {columnVis.stt && <td className="py-2.5 px-3 text-center border-r border-slate-200 font-bold text-slate-600">{item.stt}</td>}
                            {columnVis.category && <td className="py-2.5 px-4 text-center border-r border-slate-200 font-semibold text-slate-700">{item.category}</td>}
                            {columnVis.code && <td className="py-2.5 px-4 text-center border-r border-slate-200 font-bold text-cyan-800">{item.code}</td>}
                            {columnVis.name && <td className="py-2.5 px-4 border-r border-slate-200 font-semibold text-slate-900">{item.name}</td>}
                            {columnVis.importPrice && <td className="py-2.5 px-4 text-right border-r border-slate-200 font-bold text-slate-800">{fmt(item.importPrice)}</td>}
                            {columnVis.minStock && (
                              <td className="py-2 px-3 text-right border-r border-slate-200">
                                <div className="flex items-center justify-end gap-1.5 print:hidden">
                                  <input
                                    type="number"
                                    min="0"
                                    value={currentVal}
                                    onChange={(e) => {
                                      const val = Math.max(0, parseInt(e.target.value) || 0);
                                      setEditingMinStock((prev) => ({ ...prev, [item.productId]: val }));
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        handleSaveMinStock(item.productId, currentVal, item.name);
                                      }
                                    }}
                                    className={`w-20 rounded-lg border px-2 py-1 text-right text-xs sm:text-sm font-bold transition outline-none focus:ring-2 focus:ring-cyan-500 ${
                                      isModified
                                        ? 'border-amber-500 bg-amber-50/70 text-amber-950 font-black ring-2 ring-amber-400/30'
                                        : 'border-slate-300 bg-white text-slate-800 hover:border-slate-400'
                                    }`}
                                    title="Nhập định mức tồn tối thiểu rồi nhấn Enter hoặc nút Lưu"
                                  />
                                  {isModified && (
                                    <button
                                      type="button"
                                      onClick={() => handleSaveMinStock(item.productId, currentVal, item.name)}
                                      disabled={isSavingThis}
                                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-xs hover:bg-emerald-700 active:scale-95 transition cursor-pointer disabled:opacity-50"
                                      title="Lưu định mức mới vào hệ thống"
                                    >
                                      {isSavingThis ? (
                                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                                      )}
                                    </button>
                                  )}
                                </div>
                                <span className="hidden print:inline font-bold text-slate-800">
                                  {item.minStock}
                                </span>
                              </td>
                            )}
                            {columnVis.actualStock && (
                              <td className="py-2.5 px-4 text-right border-r border-slate-200 font-extrabold text-slate-900">
                                {fmt(item.actualStock)}
                              </td>
                            )}
                            {columnVis.diff && (
                              <td className="py-2.5 px-4 text-right border-r border-slate-200">
                                {item.diff > 0 ? (
                                  <span className="inline-flex items-center gap-1 font-extrabold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200">
                                    Thiếu {fmt(item.diff)}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                    Đủ
                                  </span>
                                )}
                              </td>
                            )}
                            {columnVis.actions && (
                              <td className="py-2.5 px-3 text-center print:hidden">
                                <button
                                  type="button"
                                  onClick={() => handleOpenDetailModal(item, g.branchName)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl border-2 border-cyan-500 bg-white text-cyan-600 shadow-sm transition hover:bg-cyan-50 hover:text-cyan-700 active:scale-95 cursor-pointer"
                                  title="Xem báo cáo chi tiết"
                                >
                                  <Eye size={16} strokeWidth={2.5} />
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}

                      {/* BRANCH SUMMARY ROW */}
                      <tr className="bg-slate-200/90 font-black text-slate-900 border-t-2 border-b-2 border-slate-400">
                        <td colSpan={6} className="py-3 px-4 text-right font-black text-xs sm:text-sm uppercase tracking-wide text-slate-900">
                          Tổng:
                        </td>
                        {columnVis.actualStock && <td className="py-3 px-4 text-right font-black text-slate-950 text-xs sm:text-sm">{fmt(g.totalActualStock)}</td>}
                        {columnVis.diff && (
                          <td className="py-3 px-4 text-right font-black text-xs sm:text-sm">
                            {g.totalDiff > 0 ? (
                              <span className="font-extrabold text-rose-700">Thiếu {fmt(g.totalDiff)}</span>
                            ) : (
                              <span className="font-bold text-emerald-700">Đủ</span>
                            )}
                          </td>
                        )}
                        {columnVis.actions && <td className="py-3 px-4 print:hidden"></td>}
                      </tr>
                    </React.Fragment>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 font-bold text-sm">
                      Không tìm thấy sản phẩm tồn kho trong CSDL
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <ReportPrintFooter />
        </div>
      </div>

      {/* ═══ SAVE TOAST NOTIFICATION ═══ */}
      {saveToast && (
        <div className="fixed bottom-6 right-6 z-[100000] flex items-center gap-2.5 rounded-2xl border-2 border-emerald-500 bg-slate-900/95 text-white px-5 py-3.5 shadow-2xl text-xs sm:text-sm font-extrabold backdrop-blur-md animate-in fade-in slide-in-from-bottom-5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white shrink-0">
            <Check className="h-4 w-4 stroke-[3]" />
          </div>
          <span>{saveToast}</span>
        </div>
      )}

      {/* ═══ DETAIL POPUP MODAL (PORTALIZED OVERLAY 100% COVERAGE & FULL WIDTH) ═══ */}
      {selectedItemForModal && createPortal(
        <div
          onClick={() => setSelectedItemForModal(null)}
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/60 p-2 sm:p-4 backdrop-blur-sm animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[98vw] 2xl:max-w-[1700px] rounded-2xl border-2 border-cyan-600 bg-white shadow-2xl overflow-hidden flex flex-col max-h-[96vh]"
          >
            {/* Modal Header: Cyan Tươi Sáng */}
            <div className="flex items-center justify-between border-b-2 border-cyan-700 bg-cyan-600 px-6 py-4 text-white">
              <h3 className="font-extrabold text-white text-base sm:text-lg uppercase tracking-wide flex flex-wrap items-center gap-2">
                <span>BÁO CÁO TỒN CHI TIẾT SẢN PHẨM:</span>
                <span className="text-amber-200 underline underline-offset-4 decoration-cyan-300 font-black">{selectedItemForModal.item.name}</span>
                <span className="text-cyan-100 font-semibold">- CHI NHÁNH:</span>
                <span className="text-white font-bold">{selectedItemForModal.branchName}</span>
              </h3>
              <button
                type="button"
                onClick={() => setSelectedItemForModal(null)}
                className="rounded-lg p-1.5 text-white/80 hover:bg-cyan-700 hover:text-white transition cursor-pointer"
              >
                <X className="h-5.5 w-5.5" />
              </button>
            </div>

            {/* Modal Body Table */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/50">
              <div className="overflow-hidden rounded-xl border-2 border-cyan-600 shadow-xs bg-white">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-cyan-600 text-white font-extrabold uppercase border-b-2 border-cyan-700">
                    <tr className="whitespace-nowrap">
                      <th className="w-14 border-r border-cyan-500/50 px-3 py-3 text-center">TT</th>
                      <th className="w-36 border-r border-cyan-500/50 px-3.5 py-3 text-center">Mã phiếu</th>
                      <th className="w-40 border-r border-cyan-500/50 px-3.5 py-3 text-center">Ngày</th>
                      <th className="min-w-[160px] border-r border-cyan-500/50 px-3.5 py-3">Khách hàng</th>
                      <th className="w-24 border-r border-cyan-500/50 px-3.5 py-3 text-right">SL Nhập</th>
                      <th className="w-24 border-r border-cyan-500/50 px-3.5 py-3 text-right">SL Xuất</th>
                      <th className="w-28 border-r border-cyan-500/50 px-3.5 py-3 text-right">Giá</th>
                      <th className="w-32 border-r border-cyan-500/50 px-3.5 py-3 text-right">T.tiền</th>
                      <th className="w-24 border-r border-cyan-500/50 px-3.5 py-3 text-right font-black">Tồn</th>
                      <th className="min-w-[180px] px-3.5 py-3">Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white font-medium text-slate-800">
                    {selectedItemForModal.loadingDetails ? (
                      <tr>
                        <td colSpan={10} className="py-12 text-center text-slate-400 font-bold">
                          <RefreshCw size={20} className="animate-spin inline-block mr-2 text-cyan-600" />
                          Đang tải lịch sử giao dịch từ CSDL API...
                        </td>
                      </tr>
                    ) : selectedItemForModal.details.length > 0 ? (
                      selectedItemForModal.details.map((d) => (
                        <tr key={d.stt} className="hover:bg-cyan-50/40 transition">
                          <td className="py-2.5 px-3 text-center border-r border-slate-200 font-bold text-slate-600">{d.stt}</td>
                          <td className="py-2.5 px-3.5 text-center border-r border-slate-200 font-bold text-cyan-800">{d.code}</td>
                          <td className="py-2.5 px-3.5 text-center border-r border-slate-200 text-slate-600">{d.date}</td>
                          <td className="py-2.5 px-3.5 border-r border-slate-200 font-semibold">{d.targetName}</td>
                          <td className="py-2.5 px-3.5 text-right border-r border-slate-200 font-bold text-emerald-700">{d.inQty !== 0 ? fmt(d.inQty) : ''}</td>
                          <td className="py-2.5 px-3.5 text-right border-r border-slate-200 font-bold text-rose-700">{d.outQty !== 0 ? fmt(d.outQty) : ''}</td>
                          <td className="py-2.5 px-3.5 text-right border-r border-slate-200 font-semibold">{d.price !== 0 ? fmt(d.price) : ''}</td>
                          <td className="py-2.5 px-3.5 text-right border-r border-slate-200 font-bold">{d.totalAmount !== 0 ? fmt(d.totalAmount) : ''}</td>
                          <td className="py-2.5 px-3.5 text-right border-r border-slate-200 font-extrabold text-slate-900">{fmt(d.balance)}</td>
                          <td className="py-2.5 px-3.5 text-slate-600 font-medium">{d.note}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={10} className="py-12 text-center text-slate-400 font-bold">
                          Chưa có lịch sử giao dịch ghi nhận cho sản phẩm này
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center gap-3 border-t-2 border-slate-200 bg-slate-100 px-6 py-3.5">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-xs hover:bg-emerald-700 transition active:scale-95 cursor-pointer"
              >
                <Printer className="h-4 w-4" /> Print
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-xs hover:bg-cyan-700 transition active:scale-95 cursor-pointer"
              >
                <FileSpreadsheet className="h-4 w-4" /> Excel
              </button>
              <button
                type="button"
                onClick={() => setSelectedItemForModal(null)}
                className="ml-auto inline-flex items-center justify-center gap-2 rounded-xl bg-slate-700 px-6 py-2.5 text-xs font-extrabold text-white shadow-xs hover:bg-slate-800 transition active:scale-95 cursor-pointer"
              >
                <X className="h-4 w-4" /> Đóng
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ═══ COLUMN VISIBILITY MODAL ═══ */}
      {showColumnSettings && (
        <div
          onClick={() => setShowColumnSettings(false)}
          className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border-2 border-cyan-500 bg-white p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-extrabold text-cyan-900 text-sm flex items-center gap-2 uppercase">
                <SlidersHorizontal size={16} /> Cấu hình hiển thị cột
              </h3>
              <button
                type="button"
                onClick={() => setShowColumnSettings(false)}
                className="text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2 text-xs font-bold text-slate-700">
              {Object.entries({
                stt: 'STT',
                category: 'NHÓM HÀNG HÓA',
                code: 'MÃ',
                name: 'TÊN HÀNG HÓA',
                importPrice: 'GIÁ NHẬP',
                minStock: 'ĐỊNH MỨC TỒN',
                actualStock: 'THỰC TỒN',
                diff: 'LỆCH',
                actions: 'THAO TÁC',
              }).map(([key, label]) => (
                <label key={key} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                  <span>{label}</span>
                  <input
                    type="checkbox"
                    checked={(columnVis as any)[key]}
                    onChange={(e) => setColumnVis((prev) => ({ ...prev, [key]: e.target.checked }))}
                    className="h-4 w-4 rounded accent-cyan-600 cursor-pointer"
                  />
                </label>
              ))}
            </div>
            <div className="pt-2 text-right">
              <button
                type="button"
                onClick={() => setShowColumnSettings(false)}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-extrabold text-xs transition cursor-pointer"
              >
                Hoàn tất
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
