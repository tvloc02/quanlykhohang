import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Download,
  ArrowLeftRight,
  PieChart,
  BookOpen,
  PhoneCall,
  Bike,
  Edit3,
  HelpCircle,
  BookMarked,
} from 'lucide-react';
import { readStoredPermissionGroups } from '../../features/personnel/PermissionGroupsPage';
import { usePermissions } from '../hooks/usePermissions';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

type MenuItem = {
  id: string;
  icon: any;
  label: string;
  path: string;
  badge?: null | string;
  isSpecialButton?: boolean;
  allowedRoles?: string[];
  children?: Array<{
    id: string;
    icon: any;
    label: string;
    path: string;
    allowedRoles?: string[];
  }>;
};

// Cấu trúc danh mục menu xếp chuẩn theo Ảnh Mẫu:
// POS - Bán lẻ (Trang chủ), Nhập - Xuất, Thu chi, Báo cáo Tổng hợp, Báo cáo Phân tích, Sổ sách kế toán, Danh mục, CSKH, Hệ thống, Shipper, VAT Điện tử, Ghi đơn Thị trường, Trợ giúp, Hướng dẫn sử dụng
const menuItems: MenuItem[] = [
  // 1. Trang chủ (Nút Vàng Nổi Bật)
  {
    id: 'pos',
    icon: Home,
    label: 'Trang chủ',
    path: '/dashboard',
    isSpecialButton: true,
    allowedRoles: ['admin', 'manager', 'staff'],
  },
  // 2. Nhập - Xuất
  {
    id: 'nhap-xuat',
    icon: FileCheck,
    label: 'Nhập - Xuất',
    path: '/nhap-xuat',
    allowedRoles: ['admin', 'manager', 'staff'],
    children: [
      { id: 'outbound-orders', icon: TrendingUp, label: 'Xuất bán', path: '/outbound/orders' },
      { id: 'outbound-retail', icon: Receipt, label: 'Xuất bán lẻ', path: '/outbound/retail' },
      { id: 'inbound-stock-in-orders', icon: TrendingDown, label: 'Nhập hàng', path: '/inbound/stock-in-orders' },
      { id: 'inbound-return-requests', icon: CornerUpRight, label: 'Xuất trả Nhà cung cấp', path: '/inbound/return-requests' },
      { id: 'inbound-return-customers', icon: CornerDownLeft, label: 'Nhập hàng Khách trả lại', path: '/inbound/return-customers' },
      { id: 'delivery-transfer-orders', icon: Send, label: 'Xuất kho nội bộ', path: '/delivery/transfer-orders' },
      { id: 'delivery-transfer-requests', icon: Repeat, label: 'Nhập kho nội bộ', path: '/delivery/transfer-requests' },
      { id: 'inventory-initial-stock', icon: PlusCircle, label: 'Nhập hàng tồn đầu kỳ', path: '/inventory/initial-stock' },
      { id: 'inventory-stocktake', icon: FileCheck, label: 'Kiểm kho', path: '/inventory/stocktake' },
      { id: 'outbound-sales-orders', icon: ShoppingCart, label: 'Đơn đặt hàng', path: '/outbound/sales-orders' },
      { id: 'inbound-purchase-orders', icon: PackageCheck, label: 'Đơn đặt hàng NCC', path: '/inbound/purchase-orders' },
      { id: 'documents-quotes', icon: FileText, label: 'Báo giá', path: '/documents/quotes' },
      { id: 'outbound-disposal', icon: FileX, label: 'Xuất hủy', path: '/outbound/disposal' },
      { id: 'inbound-assembly', icon: LinkIcon, label: 'Tạo bộ/Combo', path: '/inbound/assembly' },
    ],
  },
  // 3. Thu chi (Viết phiếu thu, Thu tiền từ Phiếu xuất, Viết phiếu chi)
  {
    id: 'thu-chi',
    icon: ArrowLeftRight,
    label: 'Thu chi',
    path: '/finance/receipts',
    allowedRoles: ['admin', 'manager', 'staff'],
    children: [
      { id: 'finance-receipts', icon: DollarSign, label: 'Viết phiếu thu', path: '/finance/receipts' },
      { id: 'finance-receipt-from-bill', icon: Repeat, label: 'Thu tiền từ Phiếu xuất', path: '/finance/receipt-from-bill' },
      { id: 'finance-payment-vouchers', icon: Wallet, label: 'Viết phiếu chi', path: '/finance/payment-vouchers' },
    ],
  },
  // 4. Báo cáo Tổng hợp
  {
    id: 'bao-cao-tong-hop',
    icon: BarChart3,
    label: 'Báo cáo Tổng hợp',
    path: '/reports-summary',
    allowedRoles: ['admin', 'manager', 'staff'],
    children: [
      { id: 'report-sales', icon: BarChart3, label: 'Báo cáo Bán hàng', path: '/reports/sales' },
      { id: 'report-revenue', icon: TrendingUp, label: 'Báo cáo Doanh thu', path: '/reports/revenue' },
      { id: 'report-cashflow', icon: DollarSign, label: 'Báo cáo Thu chi', path: '/reports/cashflow' },
      { id: 'report-inventory', icon: Package, label: 'Hàng tồn', path: '/reports/inventory' },
      { id: 'report-inventory-base-unit', icon: LayoutGrid, label: 'Hàng tồn Theo đơn vị gốc', path: '/reports/inventory-base-unit' },
      { id: 'report-inventory-summary', icon: Layers, label: 'Hàng tồn Tổng hợp', path: '/reports/inventory-summary' },
      { id: 'report-customer-debt', icon: FileText, label: 'Công nợ Khách hàng', path: '/reports/customer-debt' },
      { id: 'report-supplier-debt', icon: FileText, label: 'Công nợ Nhà cung cấp', path: '/reports/supplier-debt' },
      { id: 'report-fund-balance', icon: Wallet, label: 'Tồn quỹ', path: '/reports/fund-balance' },
      { id: 'report-cashbook', icon: Landmark, label: 'Sao kê - Sổ quỹ', path: '/reports/cashbook' },
      { id: 'report-stock-card', icon: Database, label: 'Thẻ kho', path: '/reports/stock-card' },
      { id: 'report-sales-detail', icon: Receipt, label: 'Chi tiết hàng bán ra', path: '/reports/sales-detail' },
      { id: 'report-sales-by-staff', icon: Users, label: 'Hàng bán ra theo Nhân viên', path: '/reports/sales-by-staff' },
      { id: 'report-business-summary', icon: BarChart3, label: 'Tổng hợp Kinh doanh', path: '/reports/business-summary' },
      { id: 'report-below-min-stock', icon: TrendingDown, label: 'Hàng tồn dưới định mức', path: '/reports/below-min-stock' },
      { id: 'report-revenue-huu', icon: BarChart3, label: 'Báo cáo doanh thu - Huu', path: '/reports/revenue-huu' },
    ],
  },
  // 5. Báo cáo Phân tích
  {
    id: 'bao-cao-phan-tich',
    icon: PieChart,
    label: 'Báo cáo Phân tích',
    path: '/reports/bill-profit',
    allowedRoles: ['admin', 'manager', 'staff'],
    children: [
      { id: 'report-bill-profit', icon: Receipt, label: 'Lợi nhuận theo Hóa đơn', path: '/reports/bill-profit' },
      { id: 'report-category-profit', icon: LayoutGrid, label: 'Lợi nhuận theo Nhóm hàng', path: '/reports/category-profit' },
      { id: 'report-customer-profit', icon: Users, label: 'Lợi nhuận theo Khách hàng', path: '/reports/customer-profit' },
    ],
  },
  // 6. Sổ sách kế toán
  {
    id: 'so-sach-ke-toan',
    icon: BookOpen,
    label: 'Sổ sách kế toán',
    path: '/reports/cashbook',
    allowedRoles: ['admin', 'manager', 'staff'],
    children: [
      { id: 'accounting-cashbook', icon: Landmark, label: 'Sổ quỹ tiền mặt', path: '/reports/cashbook' },
      { id: 'accounting-sales-journal', icon: Receipt, label: 'Nhật ký bán hàng', path: '/reports/sales-detail' },
    ],
  },
  // 7. Danh mục
  {
    id: 'danh-muc',
    icon: AlignLeft,
    label: 'Danh mục',
    path: '/categories-menu',
    allowedRoles: ['admin', 'manager', 'staff'],
    children: [
      { id: 'products-main', icon: LayoutGrid, label: 'Hàng hóa', path: '/products/main' },
      { id: 'categories', icon: FolderTree, label: 'Nhóm hàng', path: '/categories' },
      { id: 'customers', icon: UserPlus, label: 'Khách hàng', path: '/customers' },
      { id: 'suppliers', icon: Contact, label: 'Nhà cung cấp', path: '/suppliers' },
      { id: 'warehouses', icon: Store, label: 'Kho hàng', path: '/warehouses' },
      { id: 'units', icon: Scale, label: 'Đơn vị quy đổi', path: '/units' },
      { id: 'currency', icon: DollarSign, label: 'Ngoại tệ', path: '/settings' },
      { id: 'bank-accounts', icon: Landmark, label: 'Tài khoản Ngân hàng|Ví TM', path: '/settings' },
      { id: 'receipt-expense-types', icon: Terminal, label: 'Nội dung thu chi', path: '/reports' },
      { id: 'customer-groups', icon: Users, label: 'Nhóm KH/NCC', path: '/customers' },
      { id: 'price-lists', icon: Tag, label: 'Bảng giá', path: '/products/main' },
    ],
  },
  // 8. Chăm sóc Khách hàng
  {
    id: 'cham-soc-khach-hang',
    icon: PhoneCall,
    label: 'Chăm sóc Khách hàng',
    path: '/customers',
    allowedRoles: ['admin', 'manager', 'staff'],
    children: [
      { id: 'cskh-customers', icon: UserPlus, label: 'Danh sách Khách hàng', path: '/customers' },
      { id: 'cskh-suppliers', icon: Contact, label: 'Nhà cung cấp', path: '/suppliers' },
    ],
  },
  // 9. Hệ thống
  {
    id: 'he-thong',
    icon: Settings,
    label: 'Hệ thống',
    path: '/system-menu',
    allowedRoles: ['admin', 'manager', 'staff'],
    children: [
      { id: 'logout', icon: LogOut, label: 'Đăng xuất', path: '/login' },
      { id: 'change-password', icon: Lock, label: 'Đổi mật khẩu', path: '/profile' },
      { id: 'personnel', icon: User, label: 'Người dùng / Nhân viên', path: '/personnel', allowedRoles: ['admin'] },
      { id: 'permission-groups', icon: ShieldCheck, label: 'Nhóm quyền', path: '/personnel/permission-groups', allowedRoles: ['admin'] },
      { id: 'sys-info', icon: Info, label: 'Thông tin sử dụng', path: '/system/usage-info' },
      { id: 'audit-log', icon: History, label: 'Lịch sử thao tác', path: '/audit-log', allowedRoles: ['admin'] },
      { id: 'deposit', icon: Wallet, label: 'Nạp tiền', path: '/system/usage-info' },
      { id: 'print-barcode', icon: ScanLine, label: 'In Barcode + QRCode', path: '/scanner' },
      { id: 'print-template-edit', icon: FileEdit, label: 'Chỉnh sửa mẫu in', path: '/documents' },
      { id: 'print-templates', icon: Printer, label: 'Chỉnh mẫu in', path: '/documents' },
      { id: 'data-maintenance', icon: Database, label: 'Bảo trì Dữ liệu', path: '/sync-conflicts', allowedRoles: ['admin', 'manager'] },
      { id: 'sys-config', icon: Settings, label: 'Cấu hình hệ thống', path: '/settings', allowedRoles: ['admin'] },
      { id: 'zalo-config', icon: MessageCircle, label: 'Cấu hình Zalo OA', path: '/settings' },
      { id: 'evat-config', icon: Receipt, label: 'Cấu hình e-VAT', path: '/vat/config' },
      { id: 'data-transfer', icon: Database, label: 'Kết chuyển dữ liệu', path: '/settings' },
      { id: 'data-transfer-view', icon: Download, label: 'Xem dữ liệu đã Kết chuyển', path: '/settings' },
    ],
  },
  // 10. Shipper
  {
    id: 'shipper',
    icon: Bike,
    label: 'Shipper',
    path: '/delivery/shippers',
    allowedRoles: ['admin', 'manager', 'staff'],
    children: [
      { id: 'shipper-delivery', icon: Truck, label: 'Quản lý Giao hàng', path: '/delivery/transfer-orders' },
      { id: 'shipper-list', icon: Bike, label: 'Danh sách Shipper / Tài xế', path: '/delivery/shippers' },
    ],
  },
  // 11. VAT Điện tử
  {
    id: 'vat-dien-tu',
    icon: Receipt,
    label: 'VAT Điện tử',
    path: '/vat/management',
    allowedRoles: ['admin', 'manager', 'staff'],
    children: [
      { id: 'vat-management', icon: Repeat, label: 'Quản lý VAT Điện tử', path: '/vat/management' },
      { id: 'vat-config', icon: Settings, label: 'Thiết lập thông tin VAT', path: '/vat/config' },
    ],
  },
  // 12. Ghi đơn Thị trường
  {
    id: 'ghi-don-thi-truong',
    icon: Edit3,
    label: 'Ghi đơn Thị trường',
    path: '/outbound/sales-orders',
    allowedRoles: ['admin', 'manager', 'staff'],
  },
  // 13. Trợ giúp
  {
    id: 'tro-giup',
    icon: HelpCircle,
    label: 'Trợ giúp',
    path: '/settings',
    allowedRoles: ['admin', 'manager', 'staff'],
    children: [
      { id: 'help-support', icon: Info, label: 'Hỗ trợ hệ thống', path: '/settings' },
    ],
  },
  // 14. Hướng dẫn sử dụng
  {
    id: 'huong-dan-su-dung',
    icon: BookMarked,
    label: 'Hướng dẫn sử dụng',
    path: '/settings',
    allowedRoles: ['admin', 'manager', 'staff'],
  },
];

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
}

function getStoredRole(user: any) {
  return (user.role || (user.roles && user.roles[0]?.name) || 'admin').toLowerCase();
}

export default function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [permissionTick, setPermissionTick] = useState(0);

  useEffect(() => {
    const handlePermissionsChange = () => {
      setTimeout(() => setPermissionTick((prev) => prev + 1), 0);
    };

    window.addEventListener('storage', handlePermissionsChange);
    window.addEventListener('permissions-updated', handlePermissionsChange);

    return () => {
      window.removeEventListener('storage', handlePermissionsChange);
      window.removeEventListener('permissions-updated', handlePermissionsChange);
    };
  }, []);

  const { isAdmin, userActiveGroups, canViewMenu } = usePermissions();

  const isMenuAllowed = useCallback(
    (item: { id: string; allowedRoles?: string[] }) => {
      if (isAdmin) return true;
      return canViewMenu(item.id);
    },
    [isAdmin, canViewMenu]
  );

  const [expandedItems, setExpandedItems] = useState<Set<string>>(() => {
    const initialPath = location.pathname;
    const activeParent = menuItems.find((item) => item.children?.some((c) => initialPath === c.path));
    return new Set([activeParent ? activeParent.path : '/nhap-xuat']);
  });

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
      if (item.children && item.children.length > 0) {
        const allowedChildren = item.children.filter((child) => isMenuAllowed(child));
        if (allowedChildren.length === 0) return false;
      } else {
        if (!isMenuAllowed(item)) return false;
      }

      const query = searchQuery.trim().toLowerCase();
      if (!query) return true;
      const matchParent = item.label.toLowerCase().includes(query);
      const matchChild = item.children?.some(
        (c) => isMenuAllowed(c) && c.label.toLowerCase().includes(query)
      );
      return matchParent || Boolean(matchChild);
    })
    .map((item) => {
      if (item.children) {
        return {
          ...item,
          children: item.children.filter((child) => {
            if (!isMenuAllowed(child)) return false;
            const query = searchQuery.trim().toLowerCase();
            if (!query) return true;
            return child.label.toLowerCase().includes(query);
          }),
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

    // SPECIAL BUTTON FOR TRANG CHỦ
    if (item.isSpecialButton) {
      const isActive = location.pathname === item.path;
      return (
        <Link
          key={item.path + item.id}
          to={item.path}
          className={`w-full flex items-center ${
            isOpen ? 'px-4 py-3' : 'justify-center p-3'
          } text-sm font-black rounded-xl transition-all duration-200 ${
            isActive
              ? 'bg-gradient-to-r from-cyan-600 to-cyan-700 text-white border-2 border-cyan-500 shadow-md shadow-cyan-600/20'
              : 'bg-cyan-50/90 hover:bg-cyan-100 text-cyan-900 border-2 border-cyan-300/80 shadow-xs'
          } mb-2 cursor-pointer`}
          title={!isOpen ? item.label : ''}
        >
          <Icon className={`h-5 w-5 ${isOpen ? 'mr-3' : ''} flex-shrink-0 ${isActive ? 'text-white' : 'text-cyan-700'}`} />
          {isOpen && <span className="flex-1 text-left truncate font-black tracking-wide">{item.label}</span>}
        </Link>
      );
    }

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

          {/* Children Accordion */}
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
                      key={child.path + child.id}
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
        key={item.path + item.id}
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
