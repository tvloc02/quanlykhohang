import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  BarChart3,
  Box,
  ChevronLeft,
  ChevronRight,
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
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

const menuItems = [
  { icon: Home, label: 'Trang chủ', path: '/dashboard', badge: null },
  { icon: Layers, label: 'Danh mục', path: '/categories', badge: null },
  { icon: Package, label: 'Sản phẩm', path: '/products', badge: null },
  { icon: BarChart3, label: 'Báo cáo', path: '/reports', badge: null },
  { icon: TrendingDown, label: 'Nhập kho', path: '/inbound', badge: null },
  { icon: TrendingUp, label: 'Xuất kho', path: '/outbound', badge: null },
  { icon: Truck, label: 'Luân chuyển', path: '/delivery', badge: null },
  { icon: Warehouse, label: 'Tồn kho', path: '/inventory', badge: null },
  { icon: Warehouse, label: 'Kho hàng', path: '/warehouses', badge: null },
  { icon: Users, label: 'Nhân sự', path: '/personnel', badge: null },
  { icon: Truck, label: 'Nhà cung cấp', path: '/suppliers', badge: null },
  { icon: FileText, label: 'Nhật ký hoạt động', path: '/audit-log', badge: null },
  { icon: Settings, label: 'Cài đặt', path: '/settings', badge: null },
];

function getStoredRole() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.role?.toLowerCase() || 'staff';
  } catch {
    return 'staff';
  }
}

export default function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const userRole = getStoredRole();

  const allowedMenuItems = menuItems.filter((item) => {
    // Admin: Chỉ Trang chủ, Nhân sự, Nhật ký hoạt động, Cài đặt
    if (userRole === 'admin') {
      return ['/dashboard', '/personnel', '/audit-log', '/settings'].includes(item.path);
    }
    // Manager & Staff: Tất cả NGOẠI TRỪ Nhân sự, Nhật ký hoạt động, Cài đặt
    return !['/personnel', '/audit-log', '/settings'].includes(item.path);
  });

  const filteredMenuItems = allowedMenuItems.filter((item) =>
    item.label.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const renderItem = (item: (typeof menuItems)[number]) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.path;

    return (
      <Link
        key={item.path}
        to={item.path}
        className={`w-full flex items-center px-4 py-3.5 text-sm font-bold rounded-xl transition-all duration-200 group ${
          isActive
            ? 'text-white'
            : 'hover:bg-cyan-50 dark:hover:bg-black/40 text-gray-600 dark:text-slate-300'
        }`}
        style={
          isActive
            ? {
                background: 'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)',
                boxShadow: '0 4px 16px rgba(6, 182, 212, 0.4)',
              }
            : {}
        }
        title={!isOpen ? item.label : ''}
      >
        <Icon
          className={`h-5 w-5 ${isOpen ? 'mr-3' : ''} flex-shrink-0 ${
            isActive ? 'text-white' : 'text-cyan-600'
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
          <div className="p-2 rounded-xl bg-cyan-50 dark:bg-slate-900 flex-shrink-0">
            <Box className="h-6 w-6 text-cyan-600" />
          </div>
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
