import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  X,
  Bot,
  Send,
  Layers,
  CheckCircle2,
  AlertCircle,
  Package,
  Lock,
  ShieldAlert,
} from 'lucide-react';

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000/api';

function authHeaders() {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export interface SlottingItemRow {
  rowId: string;
  productId?: string;
  productSku?: string;
  productName?: string;
  unit?: string;
  qty?: number;
  warehouseCode?: string;
  assignedBins?: string[];
  locationBin?: string;
  note?: string;
}

export interface SmartSlottingGridModalProps<T extends SlottingItemRow = SlottingItemRow> {
  isOpen: boolean;
  onClose: () => void;
  mode: 'INBOUND' | 'OUTBOUND_TRANSFER';
  warehouseCode: string;
  items: T[];
  targetRowId?: string | null;
  products?: any[];
  onConfirmAll: (updatedRows: T[]) => void;
}

export interface BinCell {
  binCode: string;
  cellCode: string;
  bayCode: string;
  maxWeight: number;
  freeVol: number;
  isOccupied?: boolean;
  stockQty?: number;
  productId?: string;
  productSku?: string;
  productName?: string;
}

export interface ShelfFloor {
  floorId: string;
  floorName: string;
  floorDesc: string;
  cells: BinCell[];
}

export interface RackStructure {
  rackId: string;
  rackName: string;
  dimensions: string;
  spec: string;
  zoneName: string;
  floors: ShelfFloor[];
}

export interface AiChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  time: string;
}

const normalizeBinKey = (code: string): string => {
  if (!code) return '';
  const upper = code.trim().toUpperCase();
  const match = upper.match(/R\d+[-_]S\d+[-_]C\d+/);
  if (match) return match[0];
  return upper;
};

export function SmartSlottingGridModal<T extends SlottingItemRow = SlottingItemRow>({
  isOpen,
  onClose,
  mode,
  warehouseCode,
  items,
  targetRowId,
  products = [],
  onConfirmAll,
}: SmartSlottingGridModalProps<T>) {
  const [activeRowId, setActiveRowId] = useState<string>('');
  const [activeRackId, setActiveRackId] = useState<string>('R01');
  const [selectedBinsMap, setSelectedBinsMap] = useState<Record<string, string[]>>({});
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [inputMsg, setInputMsg] = useState('');
  const [dbOccupiedBinsMap, setDbOccupiedBinsMap] = useState<Map<string, number>>(new Map());
  const [binProductsMap, setBinProductsMap] = useState<
    Map<string, { productId: string; sku: string; productName: string; qty: number }>
  >(new Map());
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  // Auto-hide warning message after 4s
  useEffect(() => {
    if (!warningMessage) return;
    const timer = setTimeout(() => setWarningMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [warningMessage]);

  // Fetch real occupied bin codes & product balance mapping directly from CSDL
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    async function loadOccupied() {
      try {
        const occMap = new Map<string, number>();
        const prodMap = new Map<string, { productId: string; sku: string; productName: string; qty: number }>();
        const headers = authHeaders();

        const balRes = await fetch(`${API_BASE_URL}/inventory/balances`, { headers }).catch(() => null);
        if (balRes && balRes.ok) {
          const balances: any[] = await balRes.json();
          balances.forEach((b) => {
            const lc = String(b.locationCode || '').trim();
            const physical = Number(b.totalPhysical || b.available || 0);
            if (
              lc &&
              physical > 0 &&
              (lc.includes('-S0') ||
                lc.includes('-R0') ||
                lc.includes('-C') ||
                lc.includes('-ZA') ||
                lc.includes('-ZB') ||
                lc.includes('-ZC') ||
                lc.toUpperCase().startsWith('ZONE-'))
            ) {
              const pItem = (products || []).find(
                (p) => String(p.id) === String(b.productId) || String(p.id) === String(b.product?.id)
              );
              const pId = String(pItem?.id || b.productId || b.product?.id || '');
              const pName = pItem?.name || b.productName || b.product?.name || 'Hàng hóa';
              const pSku = pItem?.internalSku || (pItem as any)?.sku || b.productSku || b.product?.sku || '';

              occMap.set(lc, physical);
              prodMap.set(lc, { productId: pId, sku: pSku, productName: pName, qty: physical });

              const norm = normalizeBinKey(lc);
              if (norm) {
                occMap.set(norm, physical);
                prodMap.set(norm, { productId: pId, sku: pSku, productName: pName, qty: physical });
              }
            }
          });
        }

        if (isMounted) {
          setDbOccupiedBinsMap(occMap);
          setBinProductsMap(prodMap);
        }
      } catch (err) {
        console.error('Lỗi tải dữ liệu ô kệ CSDL:', err);
      }
    }
    loadOccupied();
    return () => {
      isMounted = false;
    };
  }, [isOpen, products]);

  // Generate Rack Topology dynamically for the warehouse
  const racksTopology: RackStructure[] = useMemo(() => {
    const whPrefix = warehouseCode ? warehouseCode.toUpperCase() : 'KHO';

    const createFloorCells = (zonePrefix: string, rackId: string, floorId: string, cellsCount = 10): BinCell[] => {
      return Array.from({ length: cellsCount }).map((_, idx) => {
        const cellNum = (idx + 1).toString().padStart(2, '0');
        const binCode = `${zonePrefix}-${rackId}-${floorId}-C${cellNum}`;
        const normCode = normalizeBinKey(binCode);

        let isOccupied = false;
        let stockQty = 0;
        let productId = '';
        let productSku = '';
        let productName = '';

        if (dbOccupiedBinsMap.has(binCode)) {
          isOccupied = true;
          stockQty = dbOccupiedBinsMap.get(binCode) || 0;
          const info = binProductsMap.get(binCode);
          if (info) {
            productId = info.productId;
            productSku = info.sku;
            productName = info.productName;
          }
        } else if (normCode && dbOccupiedBinsMap.has(normCode)) {
          isOccupied = true;
          stockQty = dbOccupiedBinsMap.get(normCode) || 0;
          const info = binProductsMap.get(normCode);
          if (info) {
            productId = info.productId;
            productSku = info.sku;
            productName = info.productName;
          }
        } else {
          for (const [key, val] of dbOccupiedBinsMap.entries()) {
            if (key.includes(binCode) || binCode.includes(key) || (normCode && key.includes(normCode))) {
              isOccupied = true;
              stockQty = val;
              const info = binProductsMap.get(key);
              if (info) {
                productId = info.productId;
                productSku = info.sku;
                productName = info.productName;
              }
              break;
            }
          }
        }

        return {
          binCode,
          cellCode: `Ô C${cellNum}`,
          bayCode: `Khoang B${cellNum}`,
          maxWeight: 500,
          freeVol: 450,
          isOccupied,
          stockQty,
          productId,
          productSku,
          productName,
        };
      });
    };

    return [
      {
        rackId: 'R01',
        rackName: `Dãy Kệ R01 (${whPrefix})`,
        dimensions: '18m Dài × 1.2m Rộng',
        spec: '4 Tầng × 10 Ô',
        zoneName: `Khu A - Kho ${whPrefix}`,
        floors: [
          { floorId: 'S04', floorName: 'Tầng S04', floorDesc: 'Mâm kệ tầng 4', cells: createFloorCells(`${whPrefix}-ZA`, 'R01', 'S04') },
          { floorId: 'S03', floorName: 'Tầng S03', floorDesc: 'Mâm kệ tầng 3', cells: createFloorCells(`${whPrefix}-ZA`, 'R01', 'S03') },
          { floorId: 'S02', floorName: 'Tầng S02', floorDesc: 'Mâm kệ tầng 2', cells: createFloorCells(`${whPrefix}-ZA`, 'R01', 'S02') },
          { floorId: 'S01', floorName: 'Tầng S01', floorDesc: 'Mâm kệ tầng 1 (Trệt)', cells: createFloorCells(`${whPrefix}-ZA`, 'R01', 'S01') },
        ],
      },
      {
        rackId: 'R02',
        rackName: `Dãy Kệ R02 (${whPrefix})`,
        dimensions: '18m Dài × 1.2m Rộng',
        spec: '4 Tầng × 10 Ô',
        zoneName: `Khu B - Kho ${whPrefix}`,
        floors: [
          { floorId: 'S04', floorName: 'Tầng S04', floorDesc: 'Mâm kệ tầng 4', cells: createFloorCells(`${whPrefix}-ZB`, 'R02', 'S04') },
          { floorId: 'S03', floorName: 'Tầng S03', floorDesc: 'Mâm kệ tầng 3', cells: createFloorCells(`${whPrefix}-ZB`, 'R02', 'S03') },
          { floorId: 'S02', floorName: 'Tầng S02', floorDesc: 'Mâm kệ tầng 2', cells: createFloorCells(`${whPrefix}-ZB`, 'R02', 'S02') },
          { floorId: 'S01', floorName: 'Tầng S01', floorDesc: 'Mâm kệ tầng 1 (Trệt)', cells: createFloorCells(`${whPrefix}-ZB`, 'R02', 'S01') },
        ],
      },
      {
        rackId: 'R03',
        rackName: `Dãy Kệ R03 (${whPrefix} - Kệ Lạnh)`,
        dimensions: '18m Dài × 1.2m Rộng',
        spec: '4 Tầng × 10 Ô',
        zoneName: `Khu C - Kho Lạnh -18°C`,
        floors: [
          { floorId: 'S04', floorName: 'Tầng S04', floorDesc: 'Mâm kệ tầng 4', cells: createFloorCells(`${whPrefix}-ZC`, 'R03', 'S04') },
          { floorId: 'S03', floorName: 'Tầng S03', floorDesc: 'Mâm kệ tầng 3', cells: createFloorCells(`${whPrefix}-ZC`, 'R03', 'S03') },
          { floorId: 'S02', floorName: 'Tầng S02', floorDesc: 'Mâm kệ tầng 2', cells: createFloorCells(`${whPrefix}-ZC`, 'R03', 'S02') },
          { floorId: 'S01', floorName: 'Tầng S01', floorDesc: 'Mâm kệ tầng 1 (Trệt)', cells: createFloorCells(`${whPrefix}-ZC`, 'R03', 'S01') },
        ],
      },
    ];
  }, [warehouseCode, dbOccupiedBinsMap, binProductsMap]);

  // Active item & rack initialization
  useEffect(() => {
    if (!isOpen || !items || items.length === 0) return;

    const initialTargetId = targetRowId && items.some((i) => i.rowId === targetRowId)
      ? targetRowId
      : items[0].rowId;

    setActiveRowId(initialTargetId);

    const initialMap: Record<string, string[]> = {};
    const usedBinsSet = new Set<string>();

    // 1. Preserve existing assigned bins from order rows
    items.forEach((item) => {
      let validBins = (item.assignedBins || []).filter(
        (b) => b && (b.includes('-S0') || b.includes('-R0') || b.includes('-C'))
      );
      if (validBins.length === 0 && item.locationBin) {
        validBins = item.locationBin
          .split(',')
          .map((s) => s.trim())
          .filter((b) => b && (b.includes('-S0') || b.includes('-R0') || b.includes('-C')));
      }
      if (validBins.length > 0) {
        initialMap[item.rowId] = [...validBins];
        validBins.forEach((b) => usedBinsSet.add(b));
      }
    });

    // Flatten all topology cells
    const allCellsList: BinCell[] = [];
    racksTopology.forEach((rk) => {
      rk.floors.forEach((fl) => {
        fl.cells.forEach((cl) => {
          allCellsList.push(cl);
        });
      });
    });

    // 2. Auto-assign remaining items sequentially according to MODE
    items.forEach((item) => {
      const shouldAutoAssign = targetRowId ? item.rowId === targetRowId : true;
      if (!initialMap[item.rowId] && shouldAutoAssign) {
        const requiredCount = Math.max(1, Math.ceil((item.qty || 1) / 100));
        const preselected: string[] = [];

        if (mode === 'OUTBOUND_TRANSFER') {
          // OUTBOUND/TRANSFER: ONLY pick cells that contain THIS SPECIFIC PRODUCT
          for (const cell of allCellsList) {
            if (preselected.length >= requiredCount) break;
            if (usedBinsSet.has(cell.binCode)) continue;

            const isMatch =
              cell.isOccupied &&
              ((item.productId && String(cell.productId) === String(item.productId)) ||
                (item.productSku && cell.productSku && cell.productSku.toLowerCase() === item.productSku.toLowerCase()) ||
                (item.productName && cell.productName && cell.productName.toLowerCase() === item.productName.toLowerCase()));

            if (isMatch) {
              preselected.push(cell.binCode);
              usedBinsSet.add(cell.binCode);
            }
          }
        } else {
          // INBOUND: Pick empty cells or cells having same product
          for (const cell of allCellsList) {
            if (preselected.length >= requiredCount) break;
            if (!usedBinsSet.has(cell.binCode) && !cell.isOccupied) {
              preselected.push(cell.binCode);
              usedBinsSet.add(cell.binCode);
            }
          }
        }

        if (preselected.length > 0) {
          initialMap[item.rowId] = preselected;
        }
      }
    });

    setSelectedBinsMap(initialMap);

    // Auto-switch rack view to the first selected rack
    const activeItemBins = initialMap[initialTargetId] || [];
    if (activeItemBins.length > 0) {
      const firstBin = activeItemBins[0];
      const matchRack = racksTopology.find((rk) => firstBin.includes(rk.rackId));
      if (matchRack) {
        setActiveRackId(matchRack.rackId);
      }
    }

    const activeItem = items.find((i) => i.rowId === initialTargetId) || items[0];
    const itemQty = activeItem?.qty || 0;
    const totalBinsNeeded = Math.max(1, Math.ceil(itemQty / 100));
    const itemSelectedBins = initialMap[initialTargetId] || [];
    const firstBinName = itemSelectedBins[0] || `${warehouseCode.toUpperCase()}-ZA-R01-S04-C01`;

    const now = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const isOutbound = mode === 'OUTBOUND_TRANSFER';

    setMessages([
      {
        id: 'msg-1',
        sender: 'ai',
        text: isOutbound
          ? `🤖 CHỈ DẪN XUẤT CHUYỂN KHO AI SMART WMS\n\n📦 Mặt hàng: ${activeItem?.productName || 'Hàng hóa'} (Tổng xuất: ${itemQty.toLocaleString('vi-VN')} ${activeItem?.unit || 'Cái'})\n\n🔒 QUY TẮC AN TOÀN XUẤT KHO:\n• Bạn CHỈ ĐƯỢC PHÉP CHỌN các ô kệ ĐANG LƯU TRỮ đúng mặt hàng "${activeItem?.productName || 'này'}".\n• Các ô kệ trống hoặc chứa hàng khác sẽ tự động KHÓA để tránh xuất nhầm hàng.\n\n💡 Chỉ dẫn vị trí Ô Lấy hàng CSDL:\n• Cần chọn: ${totalBinsNeeded} Ô chứa.\n• Ô gợi ý xuất: ${firstBinName}.`
          : `🤖 CHỈ DẪN NHẬP KHO AI SMART WMS\n\n📦 Mặt hàng: ${activeItem?.productName || 'Hàng hóa'} (Tổng nhập: ${itemQty.toLocaleString('vi-VN')} ${activeItem?.unit || 'Cái'})\n\n💡 AI gợi ý vị trí cất hàng vào các ô kệ trống đảm bảo di chuyển ngắn nhất.`,
        time: now,
      },
    ]);
  }, [isOpen, items, targetRowId, racksTopology, warehouseCode, mode]);

  if (!isOpen) return null;

  const currentItem = items.find((i) => i.rowId === activeRowId) || items[0];
  const requiredCount = currentItem ? Math.max(1, Math.ceil((currentItem.qty || 1) / 100)) : 1;
  const currentSelectedBins = selectedBinsMap[currentItem?.rowId || ''] || [];
  const currentRack = racksTopology.find((r) => r.rackId === activeRackId) || racksTopology[0];

  const isBinMatchingActiveItem = (cell: BinCell): boolean => {
    if (!currentItem) return false;
    if (!cell.isOccupied) return false;

    if (currentItem.productId && cell.productId && String(cell.productId) === String(currentItem.productId)) {
      return true;
    }
    if (
      currentItem.productSku &&
      cell.productSku &&
      cell.productSku.toLowerCase() === currentItem.productSku.toLowerCase()
    ) {
      return true;
    }
    if (
      currentItem.productName &&
      cell.productName &&
      cell.productName.toLowerCase() === currentItem.productName.toLowerCase()
    ) {
      return true;
    }
    return false;
  };

  const toggleBinSelection = (cell: BinCell) => {
    if (!activeRowId || !currentItem) return;

    const isOutbound = mode === 'OUTBOUND_TRANSFER';

    if (isOutbound) {
      const isMatch = isBinMatchingActiveItem(cell);
      if (!isMatch) {
        const msg = cell.isOccupied
          ? `⚠️ KHÔNG THỂ CHỌN: Ô ${cell.cellCode} đang chứa mặt hàng "${cell.productName || 'khác'}". Vui lòng chọn ô có chứa "${currentItem.productName}".`
          : `⚠️ KHÔNG THỂ CHỌN: Ô ${cell.cellCode} đang TRỐNG. Không thể xuất hàng từ ô không có hàng!`;
        setWarningMessage(msg);
        return;
      }
    }

    const binCode = cell.binCode;
    setSelectedBinsMap((prev) => {
      const currentList = prev[activeRowId] || [];
      if (currentList.includes(binCode)) {
        return { ...prev, [activeRowId]: currentList.filter((b) => b !== binCode) };
      } else {
        return { ...prev, [activeRowId]: [...currentList, binCode] };
      }
    });
  };

  const handleConfirmSelections = () => {
    const updatedRows = items.map((r) => {
      const chosenBins = selectedBinsMap[r.rowId] || [];
      if (chosenBins.length > 0) {
        const cleanNote = (r.note || '').replace(/\[Vị trí Ô:\s*[^\]]+\]/g, '').trim();
        return {
          ...r,
          assignedBins: chosenBins,
          locationBin: chosenBins.join(', '),
          note: cleanNote ? `${cleanNote} [Vị trí Ô: ${chosenBins.join(', ')}]` : `[Vị trí Ô: ${chosenBins.join(', ')}]`,
        };
      } else {
        return r;
      }
    });
    onConfirmAll(updatedRows);
    onClose();
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMsg.trim()) return;

    const userText = inputMsg.trim();
    const now = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    setMessages((prev) => [...prev, { id: `user-${Date.now()}`, sender: 'user', text: userText, time: now }]);
    setInputMsg('');

    setTimeout(() => {
      let aiReply = '';
      const lower = userText.toLowerCase();
      if (lower.includes('đủ') || lower.includes('mấy ô') || lower.includes('số lượng') || lower.includes('sức chứa')) {
        aiReply = `📦 Mặt hàng ${currentItem?.productName} (${currentItem?.qty?.toLocaleString('vi-VN')} ${currentItem?.unit}):\n• Cần dùng: ${requiredCount} Ô chứa (Đã chọn ${currentSelectedBins.length}/${requiredCount} ô).`;
      } else if (lower.includes('kho lạnh') || lower.includes('nhiệt độ')) {
        aiReply = `❄️ Bạn hãy chuyển sang tab "Dãy Kệ R03 (Kệ Lạnh)" phía trên sơ đồ để tích chọn ô hàng lạnh -18°C.`;
      } else {
        aiReply = `🤖 Bạn chỉ có thể chọn các ô kệ tô màu xanh lá (đang chứa đúng mặt hàng ${currentItem?.productName}) trên sơ đồ 2D bên phải.`;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: 'ai',
          text: aiReply,
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-1.5 sm:p-3 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border-2 border-cyan-500 w-full max-w-[98vw] max-w-[1650px] h-[95vh] flex flex-col overflow-hidden">
        {/* Modal Header - Master Cyan Theme */}
        <div className="bg-cyan-700 text-white px-6 py-3.5 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-cyan-800 border border-cyan-500/50 flex items-center justify-center text-cyan-200 shadow-inner">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-black uppercase tracking-wide flex items-center gap-2">
                Trợ lý AI Chỉ dẫn Vị trí & Sơ đồ Ô Kệ Kho (Smart WMS Slotting Grid)
              </h3>
              <p className="text-xs text-cyan-100 font-medium">
                {mode === 'OUTBOUND_TRANSFER'
                  ? 'Tự động khóa các ô không hợp lệ • CHỈ CHO PHÉP TICK chọn các Ô KỆ ĐANG LƯU ĐÚNG HÀNG HÓA để xuất chuyển'
                  : 'Tự động tính toán sức chứa ô/kệ • Click chọn các Ô TRỐNG trên sơ đồ 2D kệ kho để nhập cất hàng'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-2xl bg-cyan-800/60 hover:bg-cyan-600 text-cyan-100 flex items-center justify-center transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Warning Alert Banner if illegal bin clicked */}
        {warningMessage && (
          <div className="bg-rose-500 text-white px-6 py-2 flex items-center justify-between text-xs font-bold shadow-inner animate-in slide-in-from-top duration-150">
            <span className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              {warningMessage}
            </span>
            <button type="button" onClick={() => setWarningMessage(null)} className="text-rose-100 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-0 flex-1 overflow-hidden bg-slate-50">
          {/* Left Column: AI Interactive Chat */}
          <div className="md:col-span-4 border-r border-cyan-200 bg-cyan-50/30 flex flex-col h-full">
            <div className="p-3 bg-white border-b border-cyan-100 flex items-center justify-between text-xs font-black text-cyan-900 shadow-2xs">
              <span className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-cyan-600" /> Trợ lý AI Hỏi Đáp Slotting
              </span>
              <span className="bg-cyan-100 text-cyan-900 text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase border border-cyan-300">
                Online
              </span>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 p-3 overflow-y-auto space-y-3 text-xs">
              {messages.map((m) => (
                <div key={m.id} className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-1.5 mb-1 text-[10px] text-slate-400 font-bold">
                    <span>{m.sender === 'user' ? 'Thủ kho' : 'AI Assistant'}</span>
                    <span>•</span>
                    <span>{m.time}</span>
                  </div>
                  <div
                    className={`max-w-[95%] p-3 rounded-2xl shadow-xs leading-relaxed whitespace-pre-wrap ${
                      m.sender === 'user'
                        ? 'bg-cyan-600 text-white rounded-br-none font-medium'
                        : 'bg-white text-slate-800 border border-cyan-200 rounded-bl-none font-normal shadow-2xs'
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Prompts */}
            <div className="px-3 py-2 bg-white border-t border-cyan-100 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setInputMsg('Mặt hàng này cần mấy ô kệ và sức chứa như thế nào?')}
                className="text-[10px] bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 text-cyan-900 px-2.5 py-1 rounded-lg font-bold transition cursor-pointer"
              >
                📦 Cần mấy ô & sức chứa?
              </button>
              <button
                type="button"
                onClick={() => setInputMsg('Chuyển sang Kho Lạnh -18°C?')}
                className="text-[10px] bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 text-cyan-900 px-2.5 py-1 rounded-lg font-bold transition cursor-pointer"
              >
                ❄️ Chọn Kệ Lạnh R03?
              </button>
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-cyan-200 flex items-center gap-2">
              <input
                type="text"
                value={inputMsg}
                onChange={(e) => setInputMsg(e.target.value)}
                placeholder="Hỏi AI về vị trí ô, sức chứa..."
                className="flex-1 h-9 px-3 text-xs border border-slate-300 rounded-xl outline-none focus:border-cyan-600 bg-white font-medium text-slate-800"
              />
              <button
                type="submit"
                className="h-9 px-3.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl flex items-center justify-center transition cursor-pointer shadow-sm active:scale-95"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>

          {/* Right Column: Interactive Visual Rack Topology Grid */}
          <div className="md:col-span-8 p-4 flex flex-col h-full overflow-hidden bg-white">
            {/* 1. Item Switcher Bar */}
            <div className="mb-3 bg-cyan-50/80 p-2.5 rounded-2xl border border-cyan-200 flex items-center justify-between">
              <div className="flex items-center gap-2 overflow-x-auto">
                <span className="text-xs font-black uppercase text-cyan-950 flex items-center gap-1.5 shrink-0">
                  <Layers className="h-4 w-4 text-cyan-600" /> Đơn hàng:
                </span>
                {items.map((it, idx) => {
                  const isActive = it.rowId === activeRowId;
                  const countReq = Math.max(1, Math.ceil((it.qty || 1) / 100));
                  const selectedCount = (selectedBinsMap[it.rowId] || []).length;
                  return (
                    <button
                      key={it.rowId}
                      type="button"
                      onClick={() => setActiveRowId(it.rowId)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                        isActive
                          ? 'bg-cyan-600 text-white shadow-sm'
                          : 'bg-white hover:bg-cyan-100 text-slate-700 border border-cyan-200'
                      }`}
                    >
                      <span>
                        #{idx + 1} {it.productName || `Mặt hàng ${idx + 1}`}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-md font-black ${
                          isActive ? 'bg-cyan-800 text-white' : 'bg-cyan-100 text-cyan-900'
                        }`}
                      >
                        {selectedCount}/{countReq} Ô
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Status Indicator */}
              <div className="shrink-0">
                {currentSelectedBins.length >= requiredCount ? (
                  <span className="bg-cyan-100 text-cyan-900 text-[11px] font-black px-2.5 py-1 rounded-xl border border-cyan-300 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-cyan-700" /> Đã chọn đủ {currentSelectedBins.length} ô
                  </span>
                ) : (
                  <span className="bg-amber-100 text-amber-900 text-[11px] font-black px-2.5 py-1 rounded-xl border border-amber-300 flex items-center gap-1 animate-pulse">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-600" /> Thiếu {requiredCount - currentSelectedBins.length} ô
                  </span>
                )}
              </div>
            </div>

            {/* 2. Rack Selection Tabs */}
            <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Chọn Dãy Kệ:</span>
                {racksTopology.map((rk) => (
                  <button
                    key={rk.rackId}
                    type="button"
                    onClick={() => setActiveRackId(rk.rackId)}
                    className={`px-3 py-1 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                      activeRackId === rk.rackId ? 'bg-cyan-700 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {rk.rackName}
                  </button>
                ))}
              </div>

              <div className="text-[11px] font-bold text-cyan-900 bg-cyan-100/70 px-2.5 py-0.5 rounded-lg border border-cyan-200">
                {currentRack.zoneName}
              </div>
            </div>

            {/* 3. Main Visual Rack Topology Card */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              <div className="bg-white rounded-2xl border-2 border-cyan-200 p-4 shadow-sm">
                {/* Rack Topology Header Banner */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
                  <div className="flex items-center gap-3">
                    <span className="bg-cyan-700 text-white font-black text-xs font-mono px-3 py-1 rounded-xl shadow-xs">
                      {currentRack.rackId}
                    </span>
                    <h4 className="text-sm font-black text-slate-900 tracking-wide">
                      {currentRack.rackName} <span className="text-xs font-bold text-slate-500">({currentRack.dimensions})</span>
                    </h4>
                  </div>
                  <span className="bg-cyan-50 border border-cyan-200 text-cyan-900 text-[11px] font-bold px-3 py-1 rounded-full">
                    {currentRack.spec}
                  </span>
                </div>

                {/* Floors List & Bins Matrix */}
                <div className="space-y-4">
                  {currentRack.floors.map((floor) => (
                    <div key={floor.floorId} className="bg-cyan-50/30 rounded-2xl border border-cyan-200 p-3">
                      {/* Floor Header */}
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="bg-cyan-700 text-white text-[11px] font-black px-2.5 py-0.5 rounded-lg shadow-2xs">
                            {floor.floorName}
                          </span>
                          <span className="text-xs font-bold text-slate-600">({floor.floorDesc})</span>
                        </div>
                        <span className="text-[11px] font-bold text-cyan-900">10 Ô / Hộc chứa hàng (Chứa tối đa 1,000 SP/Tầng)</span>
                      </div>

                      {/* Interactive 2D Cells Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                        {floor.cells.map((cell) => {
                          const isSelected = currentSelectedBins.includes(cell.binCode);
                          const isMatchingProduct = isBinMatchingActiveItem(cell);
                          const isOutbound = mode === 'OUTBOUND_TRANSFER';

                          let cellStyle = 'bg-white hover:bg-cyan-50 text-slate-800 border-slate-200 hover:border-cyan-400 shadow-2xs';

                          if (isSelected) {
                            cellStyle = 'bg-cyan-600 text-white border-2 border-cyan-700 shadow-md scale-102 font-bold';
                          } else if (isOutbound) {
                            if (isMatchingProduct) {
                              cellStyle =
                                'bg-emerald-100/90 border-2 border-emerald-500 text-emerald-950 font-black shadow-xs hover:border-emerald-600 hover:scale-102 cursor-pointer';
                            } else if (cell.isOccupied) {
                              cellStyle = 'bg-slate-100 border-slate-300 text-slate-400 opacity-60 cursor-not-allowed';
                            } else {
                              cellStyle = 'bg-slate-50 border-slate-200 text-slate-400 opacity-40 cursor-not-allowed';
                            }
                          } else if (cell.isOccupied) {
                            cellStyle = 'bg-amber-100/90 border-2 border-amber-400 text-amber-950 font-black shadow-xs';
                          }

                          return (
                            <div
                              key={cell.binCode}
                              onClick={() => toggleBinSelection(cell)}
                              className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between ${cellStyle}`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span
                                  className={`text-xs font-black ${
                                    isSelected ? 'text-white' : isMatchingProduct ? 'text-emerald-950' : 'text-slate-900'
                                  }`}
                                >
                                  {cell.cellCode}
                                </span>
                                {isSelected ? (
                                  <span className="bg-white text-cyan-900 text-[9px] font-black px-1.5 py-0.2 rounded-md shadow-2xs">
                                    ✓ Đã chọn
                                  </span>
                                ) : isOutbound && isMatchingProduct ? (
                                  <span className="bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded-md shadow-2xs truncate max-w-[130px]" title={`${cell.productName} (${cell.stockQty})`}>
                                    ✓ Hàng sẵn có ({cell.stockQty?.toLocaleString('vi-VN')})
                                  </span>
                                ) : cell.isOccupied ? (
                                  <span className="bg-slate-400 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-md truncate max-w-[130px]" title={`${cell.productName} (${cell.stockQty})`}>
                                    🔒 {cell.productName} ({cell.stockQty?.toLocaleString('vi-VN')})
                                  </span>
                                ) : null}
                              </div>

                              <span
                                className={`text-[10px] font-bold block mb-1.5 ${
                                  isSelected
                                    ? 'text-cyan-100'
                                    : isMatchingProduct
                                    ? 'text-emerald-900'
                                    : 'text-slate-500'
                                }`}
                              >
                                {cell.bayCode} ({cell.binCode.split('-').pop()})
                              </span>

                              <div className="flex items-center justify-between pt-1 border-t border-black/10">
                                <span
                                  className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                                    isSelected
                                      ? 'bg-cyan-800 text-white'
                                      : isMatchingProduct
                                      ? 'bg-emerald-200 text-emerald-950'
                                      : 'bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  {cell.maxWeight}kg
                                </span>
                                <span
                                  className={`text-[9px] font-bold ${
                                    isSelected ? 'text-cyan-100' : isMatchingProduct ? 'text-emerald-900' : 'text-slate-500'
                                  }`}
                                >
                                  {cell.freeVol}m³
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer Summary & Action Buttons */}
            <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
              <div className="text-xs font-bold text-slate-700 flex items-center gap-2">
                <span className="text-slate-500">Các Ô đang chọn xuất:</span>
                <span className="text-cyan-900 font-black bg-cyan-100 px-2.5 py-1 rounded-lg border border-cyan-300">
                  {currentSelectedBins.length > 0 ? currentSelectedBins.join(', ') : 'Chưa chọn ô nào'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition cursor-pointer"
                >
                  Đóng (Hủy bỏ)
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSelections}
                  className="px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-xs font-black text-white uppercase tracking-wide shadow-md transition cursor-pointer active:scale-95 flex items-center gap-2"
                >
                  <Sparkles className="h-4 w-4 text-cyan-100" />
                  Xác Nhận Vị Trí Ô Kệ
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
