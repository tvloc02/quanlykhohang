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

const menuItems: MenuItem[] = [
  // 1. Trang chủ
  {
    id: 'pos',
    icon: Home,
    label: 'Trang chủ',
    path: '/dashboard',
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
      { id: 'outbound-disposal', icon: FileX, label: 'Xuất hủy', path: '/outbound/disposal' },
    ],
  },
  // 3. Thu chi
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
      { id: 'currency', icon: DollarSign, label: 'Ngoại tệ', path: '/currencies' },
      { id: 'bank-accounts', icon: Landmark, label: 'Tài khoản Ngân hàng|Ví TM', path: '/bank-accounts' },
    ],
  },
  // 9. Hệ thống
  {
    id: 'he-thong',
    icon: Settings,
    label: 'Hệ thống',
    path: '/system-menu',
    children: [
      { id: 'settings', icon: Settings, label: 'Cấu hình hệ thống', path: '/settings' },
      { id: 'personnel', icon: Users, label: 'Nhân viên', path: '/personnel' },
      { id: 'permission-groups', icon: ShieldCheck, label: 'Nhóm người dùng', path: '/personnel/permission-groups' },
      { id: 'evat-config', icon: FileEdit, label: 'Hóa đơn & VAT', path: '/vat/management' },
      { id: 'print-templates', icon: Printer, label: 'Mẫu in Chứng từ', path: '/documents' },
      { id: 'audit-log', icon: History, label: 'Nhật ký Hoạt động', path: '/audit-log' },
    ],
  },
];

function isRouteActive(currentPath: string, targetPath: string) {
  if (targetPath === '/dashboard') {
    return currentPath === '/dashboard' || currentPath === '/';
  }
  if (currentPath === targetPath) {
    return true;
  }
  // Prevent prefix collision between /personnel and /personnel/permission-groups
  if (targetPath === '/personnel') {
    return currentPath === '/personnel';
  }
  if (currentPath.startsWith(targetPath + '/')) {
    return true;
  }
  return false;
}

export default function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [userRole, setUserRole] = useState<string>('');

  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      setUserRole(user.role || (user.roles && user.roles[0]?.name) || 'staff');
    } catch {
      setUserRole('staff');
    }
  }, []);

  const { isAdmin, canViewMenu } = usePermissions();

  const isMenuAllowed = useCallback(
    (item: { id: string; allowedRoles?: string[] }) => {
      if (isAdmin) return true;
      return canViewMenu(item.id);
    },
    [isAdmin, canViewMenu]
  );

  const [expandedItems, setExpandedItems] = useState<Set<string>>(() => {
    const initialPath = location.pathname;
    const activeParent = menuItems.find((item) => item.children?.some((c) => isRouteActive(initialPath, c.path)));
    return new Set([activeParent ? activeParent.path : '/nhap-xuat']);
  });

  useEffect(() => {
    const activeParent = menuItems.find((item) =>
      item.children?.some((c) => isRouteActive(location.pathname, c.path))
    );
    if (activeParent) {
      setExpandedItems((prev) => {
        if (!prev.has(activeParent.path)) {
          return new Set([...Array.from(prev), activeParent.path]);
        }
        return prev;
      });
    }
  }, [location.pathname]);

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
    const isParentActive = isRouteActive(location.pathname, item.path);
    const hasChildren = Boolean(item.children && item.children.length > 0);
    const isChildActive = hasChildren && item.children?.some((c) => isRouteActive(location.pathname, c.path));
    const isExpanded = expandedItems.has(item.path);

    if (hasChildren) {
      return (
        <div key={item.path} className="space-y-1">
          <div
            onClick={() => toggleExpanded(item.path)}
            className={`w-full flex items-center ${isOpen ? 'px-3.5' : 'justify-center'} py-3 text-sm font-bold rounded-xl transition-all duration-200 cursor-pointer group ${
              isParentActive || isChildActive || isExpanded
                ? 'bg-cyan-500/10 dark:bg-[#131b2e] text-cyan-700 dark:text-blue-300 border border-transparent dark:border-blue-800/60'
                : 'hover:bg-cyan-50 dark:hover:bg-[#0f172a] text-slate-800 dark:text-slate-200'
            }`}
            title={!isOpen ? item.label : ''}
          >
            <Icon className={`h-5 w-5 ${isOpen ? 'mr-3' : ''} flex-shrink-0 text-cyan-600 dark:text-blue-400`} />
            {isOpen && (
              <>
                <span className="flex-1 text-left truncate">{item.label}</span>
                <ChevronDown
                  className={`h-4 w-4 text-cyan-600 dark:text-blue-400 transition-transform duration-300 ${
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
              <div className="pl-2.5 ml-4 space-y-1 py-0.5 border-l-2 border-slate-100 dark:border-slate-800">
                {item.children!.map((child) => {
                  const ChildIcon = child.icon;
                  const isChildActiveState = isRouteActive(location.pathname, child.path);
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
                          ? 'bg-gradient-to-r from-cyan-600 to-cyan-500 dark:from-cyan-700 dark:to-cyan-800 text-white shadow-md font-extrabold'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-cyan-50 hover:text-cyan-700 dark:hover:bg-[#131b2e] dark:hover:text-cyan-200'
                      }`}
                    >
                      <ChildIcon
                        className={`h-4 w-4 mr-2.5 flex-shrink-0 ${
                          isChildActiveState ? 'text-white' : 'text-cyan-500/80 dark:text-cyan-400'
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

    const isActive = isRouteActive(location.pathname, item.path);

    return (
      <Link
        key={item.path + item.id}
        to={item.path}
        className={`w-full flex items-center ${isOpen ? 'px-3.5' : 'justify-center'} py-3 text-sm font-bold rounded-xl transition-all duration-200 group ${
          isActive
            ? 'bg-gradient-to-r from-cyan-600 to-cyan-500 dark:from-cyan-700 dark:to-cyan-800 text-white shadow-md font-black'
            : 'hover:bg-cyan-50 dark:hover:bg-[#0f172a] text-slate-800 dark:text-slate-200'
        }`}
        title={!isOpen ? item.label : ''}
      >
        <Icon
          className={`h-5 w-5 ${isOpen ? 'mr-3' : ''} flex-shrink-0 ${
            isActive ? 'text-white' : 'text-cyan-600 dark:text-blue-400'
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
      } fixed lg:relative z-40 bg-white dark:bg-[#090d16] transform transition-all duration-300 ease-in-out border-r-2 border-slate-200 dark:border-slate-800/80 flex flex-col h-screen`}
    >
      <div className="h-20 p-4 border-b-2 bg-white dark:bg-[#090d16] flex-shrink-0 border-slate-200 dark:border-slate-800/80 flex justify-center lg:justify-start box-border">
        <div className={`flex items-center gap-3 w-full ${!isOpen ? 'justify-center' : ''}`}>
          <img src="/logo.png" alt="Smart WMS" className="h-11 w-11 object-cover rounded-xl shadow-sm flex-shrink-0" />
          {isOpen && (
            <div className="flex-1 overflow-hidden">
              <h1 className="font-extrabold text-lg text-slate-900 dark:text-slate-100 truncate">Smart WMS</h1>
              <p className="text-slate-500 dark:text-blue-300 text-xs font-semibold truncate">
                Hệ thống quản lý kho
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-4 flex-shrink-0">
        {isOpen ? (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-cyan-500 dark:text-blue-400" />
            <input
              type="text"
              placeholder="Tìm kiếm menu..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full pl-9 pr-3 py-2.5 text-xs font-semibold border-2 border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-cyan-500 dark:focus:border-blue-500 focus:ring-4 focus:ring-cyan-500/10 dark:bg-[#060913] dark:text-slate-100 transition-all bg-slate-50"
            />
          </div>
        ) : (
          <div className="flex justify-center">
            <button
              type="button"
              className="p-2 rounded-xl bg-cyan-50 dark:bg-[#0f172a] cursor-pointer"
              onClick={onToggle}
              title="Mở rộng để tìm kiếm"
            >
              <Search className="h-5 w-5 text-cyan-600 dark:text-blue-400" />
            </button>
          </div>
        )}
      </div>

      <nav className="flex-1 px-3 space-y-2 overflow-y-auto pb-4 custom-scrollbar">
        {filteredMenuItems.length === 0 && isOpen && (
          <div className="text-center py-4 text-xs font-semibold text-slate-500 dark:text-blue-300/70">
            Không tìm thấy kết quả.
          </div>
        )}

        {filteredMenuItems.map(renderItem)}
      </nav>

      <div className="p-4 border-t-2 bg-white dark:bg-[#090d16] flex-shrink-0 border-slate-200 dark:border-slate-800/80">
        <button
          type="button"
          onClick={onToggle}
          className={`w-full flex items-center justify-center px-4 py-3 rounded-xl transition-all duration-200 font-bold text-xs ${
            !isOpen
              ? 'bg-cyan-50 dark:bg-[#0f172a]'
              : 'bg-slate-100 dark:bg-[#060913]'
          } hover:shadow-md text-cyan-600 dark:text-blue-400 cursor-pointer`}
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
