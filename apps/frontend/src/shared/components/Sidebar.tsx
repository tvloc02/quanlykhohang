import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileCheck,
  FileText,
  Home,
  Layers,
  Package,
  Search,
  Settings,
  TrendingDown,
  TrendingUp,
  Truck,
  Users,
  Warehouse,
  ScanLine,
  Receipt,
  CornerUpRight,
  CornerDownLeft,
  Send,
  Repeat,
  PlusCircle,
  ShoppingCart,
  PackageCheck,
  FileX,
  Link as LinkIcon,
  Cpu,
  Zap,
  ShoppingBag,
  AlignLeft,
  LayoutGrid,
  FolderTree,
  UserPlus,
  Contact,
  MapPin,
  Scale,
  DollarSign,
  Landmark,
  Terminal,
  Tag,
  LogOut,
  Lock,
  User,
  ShieldCheck,
  Info,
  Store,
  History,
  Wallet,
  FileEdit,
  Printer,
  Database,
  MessageCircle,
  Download
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

type MenuItem = {
  icon: any;
  label: string;
  path: string;
  badge?: null | string;
  allowedRoles?: string[];
  children?: Array<{
    icon: any;
    label: string;
    path: string;
    allowedRoles?: string[];
  }>;
};

// Cấu trúc danh mục menu: POS - Bán lẻ, Nhập - Xuất, Danh mục, Hệ thống & các tiện ích còn lại
const menuItems: MenuItem[] = [
  // 1. Nút POS - Bán lẻ
  {
    icon: ShoppingBag,
    label: 'POS - Bán lẻ',
    path: '/shop',
    allowedRoles: ['admin', 'manager', 'staff'],
  },
  // 2. Khối Nhập - Xuất (14 mục con)
  {
    icon: FileCheck,
    label: 'Nhập - Xuất',
    path: '/nhap-xuat',
    allowedRoles: ['admin', 'manager', 'staff'],
    children: [
      { icon: TrendingUp, label: 'Xuất bán', path: '/outbound/orders' },
      { icon: Receipt, label: 'Xuất bán lẻ', path: '/outbound/retail' },
      { icon: TrendingDown, label: 'Nhập hàng', path: '/inbound/stock-in-orders' },
      { icon: CornerUpRight, label: 'Xuất trả Nhà cung cấp', path: '/inbound/return-requests' },
      { icon: CornerDownLeft, label: 'Nhập hàng Khách trả lại', path: '/inbound/return-customers' },
      { icon: Send, label: 'Xuất chuyển Chi nhánh', path: '/delivery/create-transfer-order' },
      { icon: Repeat, label: 'Nhập chuyển Chi nhánh', path: '/delivery/transfer-requests' },
      { icon: PlusCircle, label: 'Nhập hàng tồn đầu kỳ', path: '/inventory/initial-stock' },
      { icon: FileCheck, label: 'Kiểm kho', path: '/inventory/stocktake' },
      { icon: ShoppingCart, label: 'Đơn đặt hàng', path: '/outbound/sales-orders' },
      { icon: PackageCheck, label: 'Đơn đặt hàng NCC', path: '/inbound/purchase-orders' },
      { icon: FileText, label: 'Báo giá', path: '/documents/quotes' },
      { icon: FileX, label: 'Xuất hủy', path: '/outbound/disposal' },
      { icon: LinkIcon, label: 'Tạo bộ/Combo', path: '/inbound/assembly' },
    ],
  },
  // 3. Khối Danh mục (Theo mẫu)
  {
    icon: AlignLeft,
    label: 'Danh mục',
    path: '/categories-menu',
    allowedRoles: ['admin', 'manager', 'staff'],
    children: [
      { icon: LayoutGrid, label: 'Hàng hóa', path: '/products/main' },
      { icon: FolderTree, label: 'Nhóm hàng', path: '/categories' },
      { icon: UserPlus, label: 'Khách hàng', path: '/customers' },
      { icon: Contact, label: 'Nhà cung cấp', path: '/suppliers' },
      { icon: MapPin, label: 'Khu vực', path: '/warehouses' },
      { icon: Scale, label: 'Đơn vị quy đổi', path: '/products/main' },
      { icon: DollarSign, label: 'Ngoại tệ', path: '/settings' },
      { icon: Landmark, label: 'Tài khoản Ngân hàng|Ví TM', path: '/settings' },
      { icon: Terminal, label: 'Nội dung thu chi', path: '/reports' },
      { icon: Users, label: 'Nhóm KH/NCC', path: '/customers' },
      { icon: Tag, label: 'Bảng giá', path: '/products/main' },
    ],
  },
  // 4. Khối Hệ thống (Theo mẫu)
  {
    icon: Settings,
    label: 'Hệ thống',
    path: '/system-menu',
    allowedRoles: ['admin', 'manager', 'staff'],
    children: [
      { icon: LogOut, label: 'Đăng xuất', path: '/login' },
      { icon: Lock, label: 'Đổi mật khẩu', path: '/profile' },
      { icon: User, label: 'Người dùng / Nhân viên', path: '/personnel', allowedRoles: ['admin'] },
      { icon: ShieldCheck, label: 'Nhóm quyền', path: '/personnel/teams', allowedRoles: ['admin'] },
      { icon: Info, label: 'Thông tin sử dụng', path: '/settings' },
      { icon: Store, label: 'Chi nhánh', path: '/warehouses' },
      { icon: History, label: 'Lịch sử thao tác', path: '/audit-log', allowedRoles: ['admin'] },
      { icon: Wallet, label: 'Nạp tiền', path: '/settings' },
      { icon: ScanLine, label: 'In Barcode + QRCode', path: '/scanner' },
      { icon: FileEdit, label: 'Chỉnh sửa mẫu in', path: '/documents' },
      { icon: Printer, label: 'Chỉnh mẫu in', path: '/documents' },
      { icon: Database, label: 'Bảo trì Dữ liệu', path: '/sync-conflicts', allowedRoles: ['admin', 'manager'] },
      { icon: Settings, label: 'Cấu hình hệ thống', path: '/settings', allowedRoles: ['admin'] },
      { icon: MessageCircle, label: 'Cấu hình Zalo OA', path: '/settings' },
      { icon: Receipt, label: 'Cấu hình e-VAT', path: '/settings' },
      { icon: Database, label: 'Kết chuyển dữ liệu', path: '/settings' },
      { icon: Download, label: 'Xem dữ liệu đã Kết chuyển', path: '/settings' },
    ],
  },
  // 5. Trang chủ & Các tiện ích quản lý kho bổ sung
  { icon: Home, label: 'Trang chủ', path: '/dashboard' },
  {
    icon: FileCheck,
    label: 'Chứng từ',
    path: '/documents',
    allowedRoles: ['admin', 'manager', 'staff'],
    children: [
      { icon: FileText, label: 'Hóa đơn bán hàng', path: '/documents/sales-invoice' },
      { icon: TrendingDown, label: 'Phiếu nhập kho', path: '/documents/stock-in-note' },
      { icon: TrendingUp, label: 'Phiếu xuất kho', path: '/documents/stock-out-note' },
      { icon: Truck, label: 'Phiếu điều chuyển', path: '/documents/transfer-note' },
    ],
  },
  {
    icon: Warehouse,
    label: 'Tồn kho',
    path: '/inventory',
    allowedRoles: ['admin', 'manager', 'staff'],
    children: [
      { icon: Layers, label: 'Sơ đồ 2D & Heatmap', path: '/inventory/visualizer' },
      { icon: Cpu, label: 'Gợi ý cất hàng (Smart Slotting)', path: '/inventory/smart-slotting' },
      { icon: Warehouse, label: 'Bảng tồn kho tổng hợp', path: '/inventory' },
    ],
  },
  {
    icon: Package,
    label: 'Sản xuất & Phân phối',
    path: '/inbound/production',
    allowedRoles: ['admin', 'manager', 'staff'],
    children: [
      { icon: Package, label: 'Sản xuất', path: '/inbound/production' },
      { icon: Truck, label: 'Phân phối', path: '/inbound/distribution' },
    ],
  },
  { icon: BarChart3, label: 'Báo cáo', path: '/reports', allowedRoles: ['admin', 'manager', 'staff'] },
  { icon: ScanLine, label: 'Quét mã vạch', path: '/scanner', allowedRoles: ['admin', 'manager', 'staff'] },
  { icon: Zap, label: 'Giám sát ERP Sync', path: '/erp-status', allowedRoles: ['admin', 'manager'] },
];

function getStoredRole() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return (user.role || (user.roles && user.roles[0]?.name) || 'staff').toLowerCase();
  } catch {
    return 'staff';
  }
}

export default function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const userRole = getStoredRole();

  // Khởi tạo mục mở rộng ban đầu theo trang hiện tại
  const [expandedItems, setExpandedItems] = useState<Set<string>>(() => {
    const initialPath = location.pathname;
    const activeParent = menuItems.find((item) => item.children?.some((c) => initialPath === c.path));
    return new Set([activeParent ? activeParent.path : '/nhap-xuat']);
  });

  const isRoleAllowed = (allowedRoles?: string[]) => {
    if (!allowedRoles || allowedRoles.length === 0) return true;
    if (userRole === 'admin') return true;
    return allowedRoles.includes(userRole);
  };

  // Mở duy nhất 1 mục danh mục lớn tại một thời điểm - khi mở mục mới thì mục cũ thu gọn nhẹ nhàng từ dưới lên
  const toggleExpanded = (path: string) => {
    setExpandedItems((prev) => {
      const next = new Set<string>();
      if (!prev.has(path)) {
        next.add(path);
      }
      return next;
    });
  };

  const filteredMenuItems = menuItems
    .filter((item) => {
      if (!isRoleAllowed(item.allowedRoles)) return false;
      const matchParent = item.label.toLowerCase().includes(searchQuery.toLowerCase());
      const matchChild = item.children?.some((c) => c.label.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchParent || Boolean(matchChild);
    })
    .map((item) => {
      if (item.children) {
        return {
          ...item,
          children: item.children.filter((child) => isRoleAllowed(child.allowedRoles)),
        };
      }
      return item;
    });

  const renderItem = (item: MenuItem) => {
    const Icon = item.icon;
    const isParentActive = location.pathname.startsWith(item.path);
    const hasChildren = Boolean(item.children && item.children.length > 0);
    const isChildActive = hasChildren && item.children?.some((c) => location.pathname === c.path);
    const isExpanded = expandedItems.has(item.path);

    if (hasChildren) {
      return (
        <div key={item.path} className="space-y-1">
          <div
            onClick={() => toggleExpanded(item.path)}
            className={`w-full flex items-center ${isOpen ? 'px-3.5' : 'justify-center'} py-3 text-sm font-bold rounded-xl transition-all duration-200 cursor-pointer group ${
              isParentActive || isChildActive || isExpanded
                ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-l-4 border-cyan-500'
                : 'hover:bg-cyan-50 dark:hover:bg-slate-900 text-gray-800 dark:text-slate-200'
            }`}
            title={!isOpen ? item.label : ''}
          >
            <Icon className={`h-5 w-5 ${isOpen ? 'mr-3' : ''} flex-shrink-0 text-cyan-600 dark:text-cyan-400`} />
            {isOpen && (
              <>
                <span className="flex-1 text-left truncate">{item.label}</span>
                <ChevronDown
                  className={`h-4 w-4 text-cyan-600 transition-transform duration-300 ${
                    isExpanded ? 'transform rotate-180' : ''
                  }`}
                />
              </>
            )}
          </div>

          {/* Children Accordion - Hiệu ứng trượt thu gọn/mở rộng từ từ mượt mà */}
          {hasChildren && isOpen && (
            <div
              className={`transition-all duration-300 ease-in-out overflow-hidden ${
                isExpanded
                  ? 'max-h-[600px] opacity-100 my-1 pointer-events-auto'
                  : 'max-h-0 opacity-0 my-0 pointer-events-none'
              }`}
            >
              <div className="pl-2.5 ml-4 space-y-1 border-l border-cyan-200 dark:border-slate-800 py-0.5">
                {item.children!.map((child) => {
                  const ChildIcon = child.icon;
                  const isChildActiveState = location.pathname === child.path;
                  return (
                    <Link
                      key={child.path}
                      to={child.path}
                      onClick={() => {
                        if (child.label === 'Đăng xuất' || child.path === '/login') {
                          localStorage.removeItem('token');
                          localStorage.removeItem('user');
                        }
                      }}
                      className={`w-full flex items-center px-3 py-2 text-[13px] font-semibold rounded-lg transition-all duration-200 ${
                        isChildActiveState
                          ? 'bg-cyan-600 text-white shadow-sm font-semibold'
                          : 'text-gray-700 dark:text-slate-200 hover:bg-cyan-50 hover:text-cyan-700 dark:hover:bg-slate-900 dark:hover:text-cyan-300'
                      }`}
                    >
                      <ChildIcon
                        className={`h-4 w-4 mr-2.5 flex-shrink-0 ${
                          isChildActiveState ? 'text-white' : 'text-cyan-500/80 dark:text-cyan-400/70'
                        }`}
                      />
                      <span className="truncate">{child.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      );
    }

    const isActive = location.pathname === item.path;

    return (
      <Link
        key={item.path}
        to={item.path}
        className={`w-full flex items-center ${isOpen ? 'px-3.5' : 'justify-center'} py-3 text-sm font-bold rounded-xl transition-all duration-200 group ${
          isActive
            ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white shadow-md'
            : 'hover:bg-cyan-50 dark:hover:bg-slate-900 text-gray-800 dark:text-slate-200'
        }`}
        title={!isOpen ? item.label : ''}
      >
        <Icon
          className={`h-5 w-5 ${isOpen ? 'mr-3' : ''} flex-shrink-0 ${
            isActive ? 'text-white' : 'text-cyan-600 dark:text-cyan-400'
          }`}
        />
        {isOpen && <span className="flex-1 text-left truncate">{item.label}</span>}
      </Link>
    );
  };

  return (
    <aside
      className={`${
        isOpen ? 'w-80' : 'w-20'
      } fixed lg:relative z-40 bg-white dark:bg-slate-950 shadow-2xl transform transition-all duration-300 ease-in-out border-r-2 border-gray-200 dark:border-slate-800 flex flex-col h-screen`}
      style={{
        background: 'linear-gradient(180deg, #FFFFFF 0%, #F9FAFB 100%)',
      }}
    >
      <div className="p-4 border-b-2 bg-white dark:bg-slate-950 flex-shrink-0 border-gray-200 dark:border-slate-800 flex justify-center lg:justify-start">
        <div className={`flex items-center gap-3 w-full ${!isOpen ? 'justify-center' : ''}`}>
          <img src="/logo.png" alt="Smart WMS" className="h-11 w-11 object-cover rounded-xl shadow-sm flex-shrink-0" />
          {isOpen && (
            <div className="flex-1 overflow-hidden">
              <h1 className="font-bold text-lg text-gray-800 dark:text-white truncate">Smart WMS</h1>
              <p className="text-gray-500 dark:text-slate-400 text-xs font-medium truncate">
                Hệ thống quản lý kho
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-4 flex-shrink-0">
        {isOpen ? (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-cyan-500" />
            <input
              type="text"
              placeholder="Tìm kiếm menu..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full pl-9 pr-3 py-2.5 text-sm border-2 border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 dark:bg-slate-900 dark:text-white transition-all bg-gray-50"
            />
          </div>
        ) : (
          <div className="flex justify-center">
            <button
              type="button"
              className="p-2 rounded-xl bg-cyan-50 dark:bg-slate-900 cursor-pointer"
              onClick={onToggle}
              title="Mở rộng để tìm kiếm"
            >
              <Search className="h-5 w-5 text-cyan-600" />
            </button>
          </div>
        )}
      </div>

      <nav
        className="flex-1 px-3 space-y-2 overflow-y-auto pb-4"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#d5d8db #F1F5F9',
        }}
      >
        {filteredMenuItems.length === 0 && isOpen && (
          <div className="text-center py-4 text-sm text-gray-500 dark:text-slate-400">
            Không tìm thấy kết quả.
          </div>
        )}

        {filteredMenuItems.map(renderItem)}
      </nav>

      <div className="p-4 border-t-2 bg-white dark:bg-slate-950 flex-shrink-0 border-gray-200 dark:border-slate-800">
        <button
          type="button"
          onClick={onToggle}
          className={`w-full flex items-center justify-center px-4 py-3 rounded-xl transition-all duration-200 font-bold text-sm ${
            !isOpen
              ? 'bg-cyan-50 dark:bg-slate-900'
              : 'bg-gradient-to-r from-cyan-50 to-cyan-100/50 dark:from-slate-900 dark:to-slate-900'
          } hover:shadow-md text-cyan-600 dark:text-cyan-400`}
          title={!isOpen ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
        >
          {!isOpen ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <>
              <ChevronLeft className="h-5 w-5 mr-2" />
              Thu gọn
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
