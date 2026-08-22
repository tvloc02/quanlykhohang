import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Package,
  TrendingUp,
  TrendingDown,
  Archive,
  FileText,
  FileCheck,
  Settings,
  Mail,
  Cpu,
  Home,
  Layers,
  Truck,
  Users,
  HeartHandshake,
  Box,
  ClipboardList,
  Warehouse,
  ChevronRight,
  ChevronLeft,
  Search,
  Menu,
  X,
  LogOut,
  Bell,
  ChevronDown,
  Sun,
  Moon,
  User as UserIcon,
  CheckCheck,
  Eye,
  Clock,
  AlertTriangle,
  Info,
  AlertCircle,
  ScanLine,
  ListChecks,
  AlertOctagon,
  Lock,
  Zap,
} from 'lucide-react';
import SyncStatusBanner from '../../features/offline-sync/components/SyncStatusBanner';
import Sidebar from './Sidebar';

// --- MAIN LAYOUT COMPONENT ---

interface LayoutProps {
  children?: React.ReactNode;
}

export default function MainLayout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const storedUser = React.useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}') as { email?: string; fullName?: string; role?: string };
    } catch {
      return {};
    }
  }, []);
  const userName = storedUser.fullName || 'Dương Ngọc Anh';
  const userEmail = storedUser.email || 'admin@smartwms.vn';
  const formatUserRoleDisplay = (role?: string) => {
    if (!role) return 'Quản trị viên';
    const lower = String(role).trim().toLowerCase();
    if (lower === 'admin' || lower === 'administrator') return 'Quản trị viên';
    if (lower === 'manager' || lower === 'warehouse_manager' || lower === 'quản lý kho') return 'Quản lý kho';
    if (lower === 'staff' || lower === 'inventory_staff' || lower === 'warehouse_staff' || lower === 'storekeeper') return 'Thủ kho';
    if (lower === 'inventory_checker' || lower === 'inventory-checker' || lower === 'nhân viên kiểm kê') return 'Nhân viên kiểm kê';
    if (lower === 'customer') return 'Khách hàng';
    if (lower === 'supplier') return 'Nhà cung cấp';
    return role;
  };
  const rawRole = storedUser.role || ((storedUser as any).roles && (storedUser as any).roles[0]?.name) || '';
  const userRole = formatUserRoleDisplay(rawRole);
  const userInitials = userName.trim().split(/\s+/).map((n) => n[0]).join('').slice(0, 3).toUpperCase() || 'WMS';

  // States cho Header Dropdowns
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [notificationDropdownOpen, setNotificationDropdownOpen] = useState(false);

  const [isDarkMode, setIsDarkMode] = useState(false);

  const DEFAULT_OPERATIONAL_NOTIFICATIONS = React.useMemo(() => [
    {
      id: 'op-1',
      title: 'Phiếu nhập kho mới PNK20260821-2054',
      message: 'Phiếu nhập kho PNK20260821-2054 vừa được tạo. Vui lòng duyệt trước khi nhập kho.',
      link: '/inbound/receipts',
      priority: 'high',
      type: 'inbound',
      isUnread: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'op-2',
      title: 'Phiếu xuất kho mới PXK20260821-0012',
      message: 'Phiếu xuất kho PXK20260821-0012 vừa được tạo. Vui lòng chuẩn bị đóng gói và xuất kho.',
      link: '/outbound/orders',
      priority: 'normal',
      type: 'outbound',
      isUnread: true,
      createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    },
    {
      id: 'op-3',
      title: 'Đơn mua hàng DH01082026-0002',
      message: 'Nhà cung cấp Công ty giặt may Hà Thành đã xác nhận đơn mua hàng DH01082026-0002.',
      link: '/inbound/purchase-orders',
      priority: 'normal',
      type: 'purchase',
      isUnread: true,
      createdAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    },
    {
      id: 'op-4',
      title: 'Đơn chuyển kho CK20260821-0005',
      message: 'Đơn chuyển kho nội bộ từ Kho tổng đến Kho Cầu Giấy đã hoàn tất vận chuyển.',
      link: '/delivery/transfer-requests',
      priority: 'normal',
      type: 'transfer',
      isUnread: false,
      createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    },
    {
      id: 'op-5',
      title: 'Cảnh báo tồn kho tối thiểu',
      message: 'Phát hiện 15 mặt hàng có số lượng tồn kho giảm xuống dưới ngưỡng tối thiểu.',
      link: '/reports/below-min-stock',
      priority: 'urgent',
      type: 'warning',
      isUnread: true,
      createdAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
    },
  ], []);

  const [notifications, setNotifications] = useState<any[]>(DEFAULT_OPERATIONAL_NOTIFICATIONS);
  const unreadCount = notifications.filter(n => n.isUnread).length;
  const [currentTime, setCurrentTime] = useState(() => new Date());

  const loadNotifications = React.useCallback(async () => {
    try {
      const response = await fetch('http://localhost:3000/api/notifications', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
      });
      if (response.ok) {
        const data = await response.json().catch(() => []);
        if (Array.isArray(data) && data.length > 0) {
          setNotifications(data);
          return;
        }
      }
    } catch {
      // Ignore transient errors.
    }
    setNotifications(DEFAULT_OPERATIONAL_NOTIFICATIONS);
  }, [DEFAULT_OPERATIONAL_NOTIFICATIONS]);

  // Lắng nghe sự kiện click ra ngoài để đóng các Dropdown
  useEffect(() => {
    const handleClickOutside = (event: any) => {
      if (!event.target.closest('.dropdown-container')) {
        setUserDropdownOpen(false);
        setNotificationDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    void loadNotifications();
    const timer = window.setInterval(() => {
      void loadNotifications();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [loadNotifications]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  };

  const formattedTime = currentTime.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const formattedDate = currentTime.toLocaleDateString('vi-VN', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-slate-900 font-sans">
      {/* Sidebar Component */}
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      {/* Main Content Area */}
      <div className={`${sidebarOpen ? 'ml-80' : 'ml-20'} flex-1 flex flex-col overflow-hidden lg:ml-0 transition-all duration-300`}>
        {/* Sync Status Banner */}
        <SyncStatusBanner />

        {/* Header */}
        <header
          className="relative bg-white dark:bg-slate-950 border-b-2 border-gray-200 dark:border-slate-800 flex items-center justify-between px-6 z-40 transition-all duration-300 h-20 box-border"
        >
          {/* Left Section: Toggle & Clock */}
          <div className="flex items-center gap-4 flex-shrink-0">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title={sidebarOpen ? "Đóng menu" : "Mở menu"}
              aria-label={sidebarOpen ? "Đóng menu" : "Mở menu"}
              className="h-[3.5rem] w-[3.5rem] flex items-center justify-center bg-white dark:bg-slate-900 border-2 border-gray-200 dark:border-slate-700 hover:bg-cyan-50 dark:hover:bg-slate-800 rounded-xl transition-all group lg:hidden"
            >
              {sidebarOpen ? (
                <X size={20} className="text-gray-600 dark:text-slate-300 group-hover:text-cyan-600" />
              ) : (
                <Menu size={20} className="text-gray-600 dark:text-slate-300 group-hover:text-cyan-600" />
              )}
            </button>

            {/* Clock Widget - Redesigned to modern Cyan Badge */}
            <div className="hidden sm:flex items-center gap-3 rounded-2xl border-2 border-cyan-500/40 bg-gradient-to-r from-cyan-50 via-white to-cyan-50/60 px-4 py-2 shadow-sm transition-all hover:border-cyan-500 dark:border-slate-700 dark:bg-slate-900">
              <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-600 text-white shadow-md shadow-cyan-600/20">
                <Clock className="h-4 w-4 text-cyan-100" />
                <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-300"></span>
                </span>
              </div>
              <div className="flex items-center gap-2.5 whitespace-nowrap">
                <span className="text-base font-black tracking-wider text-slate-900 dark:text-white font-mono">
                  {formattedTime}
                </span>
                <span className="rounded-lg bg-cyan-100/80 dark:bg-slate-800 px-2.5 py-1 text-xs font-extrabold text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-slate-700">
                  {formattedDate}
                </span>
              </div>
            </div>
          </div>

          {/* Middle Section: Pure Plain Text Unread Notifications Ticker (Chỉ chạy chữ, lọc thông báo chưa đọc, chữ to & chạy cực chậm) */}
          {notifications.filter((n) => n.isUnread).length > 0 && (
            <div className="hidden lg:flex items-center flex-1 max-w-[600px] xl:max-w-[880px] mx-4 overflow-hidden h-12 relative">
              <div className="animate-header-marquee flex items-center gap-16 text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                {notifications
                  .filter((n) => n.isUnread)
                  .map((notif, idx) => (
                    <span
                      key={notif.id || idx}
                      onClick={() => {
                        if (notif.link) navigate(notif.link);
                      }}
                      className="inline-flex items-center gap-2.5 cursor-pointer hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors shrink-0"
                      title="Bấm để xem chi tiết thông báo"
                    >
                      <span className="font-black text-cyan-700 dark:text-cyan-400 text-base sm:text-lg">{notif.title}:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-100 text-base sm:text-lg">{notif.message}</span>
                      <span className="text-cyan-400 dark:text-cyan-600 font-extrabold ml-6">✦</span>
                    </span>
                  ))}
              </div>
            </div>
          )}

          {/* Right Section: Cụm Dropdown */}
          <div className="flex items-center space-x-3 flex-shrink-0">

            {/* Notifications Dropdown */}
            <div className="relative dropdown-container">
              <div className="relative">
                {unreadCount > 0 && <div className="absolute inset-0 bg-gradient-to-r from-red-400 to-pink-500 rounded-xl blur-md opacity-50 animate-pulse"></div>}
                <button
                  onClick={() => {
                    setUserDropdownOpen(false);
                    setNotificationDropdownOpen(!notificationDropdownOpen);
                  }}
                  title="Thông báo"
                  aria-label="Thông báo"
                  className="relative h-[3.5rem] w-[3.5rem] rounded-xl bg-white dark:bg-slate-900 hover:bg-cyan-50 dark:hover:bg-slate-800 transition-colors border-2 border-gray-200 dark:border-slate-700 flex items-center justify-center"
                >
                  <Bell className="h-5 w-5 text-gray-600 dark:text-slate-300" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-6 w-6 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs rounded-full flex items-center justify-center font-bold shadow-lg">
                      {unreadCount}
                    </span>
                  )}
                </button>
              </div>

              {notificationDropdownOpen && (
                <div className="fixed left-3 right-3 top-[84px] sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[30rem] bg-white dark:bg-slate-950 rounded-xl shadow-2xl border-2 border-gray-200 dark:border-slate-700 z-50 max-h-[calc(100vh-96px)] sm:max-h-[36rem] overflow-hidden">
                  <div className="px-4 py-3 border-b-2 border-gray-200 dark:border-slate-700 bg-gradient-to-r from-cyan-50 to-cyan-100/50 dark:from-slate-900 dark:to-slate-900">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-slate-100">Thông báo</p>
                        {unreadCount > 0 && <p className="text-xs text-gray-600 dark:text-slate-400">{unreadCount} thông báo chưa đọc</p>}
                      </div>
                      <div className="flex items-center space-x-2">
                        {unreadCount > 0 && (
                          <button
                            onClick={async () => {
                              setNotifications(notifications.map((n) => ({ ...n, isUnread: false })));
                              try {
                                await fetch('http://localhost:3000/api/notifications/read-all', {
                                  method: 'POST',
                                  headers: {
                                    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
                                  },
                                });
                              } catch {
                                // Ignore background sync errors.
                              }
                            }}
                            className="text-xs font-medium text-cyan-600 dark:text-cyan-400"
                            title="Đánh dấu tất cả đã đọc"
                          >
                            <CheckCheck className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="max-h-[calc(100vh-220px)] sm:max-h-[28rem] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center flex flex-col items-center justify-center">
                        <Bell className="h-10 w-10 text-gray-300 dark:text-slate-600 mb-3" />
                        <p className="text-sm font-bold text-gray-600 dark:text-slate-400">Không có thông báo mới</p>
                        <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">Các thông báo của bạn sẽ xuất hiện ở đây</p>
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <button
                          key={notif.id || notif._id}
                          type="button"
                          onClick={async () => {
                            setNotifications((current) =>
                              current.map((item) => (item.id === notif.id || item._id === notif._id ? { ...item, isUnread: false } : item)),
                            );
                            try {
                              await fetch(`http://localhost:3000/api/notifications/${notif.id || notif._id}/read`, {
                                method: 'POST',
                                headers: {
                                  Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
                                },
                              });
                            } catch {
                              // Ignore background sync errors.
                            }
                            if (notif.link) {
                              navigate(notif.link);
                              setNotificationDropdownOpen(false);
                            }
                          }}
                          className={`w-full px-4 py-3 text-left hover:bg-cyan-50 dark:hover:bg-slate-800 cursor-pointer border-b-2 border-gray-100 dark:border-slate-800 transition-colors ${notif.isUnread ? 'bg-cyan-50/50 dark:bg-slate-800/50' : ''}`}
                        >
                          <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0 mt-1">
                              {notif.priority === 'urgent' ? <AlertCircle className="h-4 w-4 text-red-500" /> : notif.priority === 'high' ? <AlertTriangle className="h-4 w-4 text-orange-500" /> : <Info className="h-4 w-4 text-cyan-500" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between mb-1">
                                <p className={`text-sm font-bold ${notif.isUnread ? 'text-gray-900 dark:text-slate-100' : 'text-gray-700 dark:text-slate-300'}`}>{notif.title}</p>
                                {notif.isUnread && <div className="h-2 w-2 rounded-full bg-cyan-500 ml-2 mt-1"></div>}
                              </div>
                              <p className="text-xs mb-2 line-clamp-2 text-gray-600 dark:text-slate-400">{notif.message}</p>
                              <div className="flex items-center text-xs text-gray-500">
                                <Clock className="h-3 w-3 mr-1" /> {notif.createdAt ? new Date(notif.createdAt).toLocaleString('vi-VN') : 'Vừa xong'}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                  <div className="px-4 py-3 border-t-2 border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900">
                    <button onClick={() => setNotificationDropdownOpen(false)} className="w-full text-center text-sm font-bold text-cyan-600 dark:text-cyan-400">Xem tất cả thông báo</button>
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Dropdown */}
            <div className="relative dropdown-container">
              <button
                onClick={() => {
                  setNotificationDropdownOpen(false);
                  setUserDropdownOpen(!userDropdownOpen);
                }}
                className="flex items-center space-x-2 p-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-cyan-50 dark:hover:bg-slate-800 transition-colors border-2 border-gray-200 dark:border-slate-700 h-[3.5rem]"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md overflow-hidden bg-gradient-to-br from-cyan-400 to-cyan-600 text-white font-bold text-sm">
                  {userInitials}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-bold text-gray-900 dark:text-slate-100">{userName}</p>
                  <p className="text-xs text-gray-600 dark:text-slate-400">{userRole}</p>
                </div>
                <ChevronDown className="h-4 w-4 text-gray-500 dark:text-slate-400" />
              </button>

              {userDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-xl shadow-2xl py-2 z-50 border-2 border-gray-200 dark:border-slate-700">
                  <div className="px-4 pb-2 mb-2 border-b-2 border-gray-200 dark:border-slate-700">
                    <p className="text-sm font-bold text-gray-900 dark:text-slate-100 truncate">{userName}</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{userEmail}</p>
                  </div>

                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      navigate('/profile');
                    }}
                    className="flex items-center w-[calc(100%-1rem)] px-4 py-3 text-sm hover:bg-cyan-50 dark:hover:bg-slate-800 transition-colors rounded-lg mx-2 text-gray-900 dark:text-slate-100 font-semibold"
                  >
                    <UserIcon className="h-4 w-4 mr-3 text-gray-600 dark:text-slate-400" />
                    Thông tin tài khoản
                  </button>
                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      navigate('/settings');
                    }}
                    className="flex items-center w-[calc(100%-1rem)] px-4 py-3 text-sm hover:bg-cyan-50 dark:hover:bg-slate-800 transition-colors rounded-lg mx-2 text-gray-900 dark:text-slate-100 font-semibold"
                  >
                    <Settings className="h-4 w-4 mr-3 text-gray-600 dark:text-slate-400" />
                    Cài đặt hệ thống
                  </button>
                  <button onClick={() => setIsDarkMode(!isDarkMode)} className="flex items-center w-[calc(100%-1rem)] px-4 py-3 text-sm hover:bg-cyan-50 dark:hover:bg-slate-800 transition-colors rounded-lg mx-2 text-gray-900 dark:text-slate-100 font-semibold">
                    {isDarkMode ? <Moon className="h-4 w-4 mr-3 text-gray-600 dark:text-slate-400" /> : <Sun className="h-4 w-4 mr-3 text-gray-600 dark:text-slate-400" />}
                    {isDarkMode ? 'Giao diện: Tối' : 'Giao diện: Sáng'}
                  </button>

                  <div className="my-2 border-t-2 border-gray-200 dark:border-slate-700" />

                  <button onClick={handleLogout} className="flex items-center w-[calc(100%-1rem)] px-4 py-3 text-sm hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors rounded-lg mx-2 text-red-600 font-bold">
                    <LogOut className="h-4 w-4 mr-3" />
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main
          className="flex-1 overflow-y-auto p-6"
          style={{
            background: 'linear-gradient(180deg, #F8FAFC 0%, #F1F5F9 100%)',
          }}
        >
          {children || (
            <div className="flex items-center justify-center h-full text-gray-400">
              Nội dung trang web sẽ hiển thị ở đây
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
