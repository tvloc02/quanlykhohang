import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Package,
  TrendingUp,
  TrendingDown,
  Archive,
  FileText,
  Settings,
  Mail,
  Cpu,
  Home,
  Layers,
  Truck,
  Users,
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
} from 'lucide-react';

// --- SIDEBAR COMPONENT ---

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

const menuItems = [
  { icon: Home, label: 'Trang chủ', path: '/dashboard', badge: null },
  { icon: Layers, label: 'Danh mục', path: '/categories', badge: null },
  { icon: Package, label: 'Sản phẩm', path: '/products', badge: null },
  { icon: BarChart3, label: 'Báo cáo', path: '/reports', badge: null },
  { icon: ScanLine, label: 'Quét mã vạch', path: '/scanner', badge: null },
  { 
    icon: TrendingDown, 
    label: 'Nhập kho', 
    path: '/inbound', 
    badge: null,
    children: [
      { icon: FileText, label: 'Đơn mua hàng', path: '/inbound/purchase-orders' },
      { icon: ClipboardList, label: 'Đề nghị nhập kho hàng trả lại', path: '/inbound/return-requests' },
      { icon: FileText, label: 'Lệnh nhập kho', path: '/inbound/stock-in-orders' },
      { icon: Package, label: 'Nhập kho', path: '/inbound/stock-in' },
    ]
  },
  { icon: Package, label: 'Lắp ráp', path: '/inbound/assembly', badge: null },
  {
    icon: TrendingUp,
    label: 'Xuất kho',
    path: '/outbound',
    badge: null,
    children: [
      { icon: FileText, label: 'Đơn đặt hàng', path: '/outbound/orders' },
      { icon: ClipboardList, label: 'Phân công công việc', path: '/outbound/task-assign' },
      { icon: CheckCheck, label: 'Lệnh xuất kho', path: '/outbound/approve' },
      { icon: Package, label: 'Phiếu xuất kho', path: '/outbound/shipping-notes' },
    ],
  },
  { icon: Truck, label: 'Luân chuyển', path: '/delivery', badge: null },
  { icon: Warehouse, label: 'Tồn kho', path: '/inventory', badge: null },
  { icon: ClipboardList, label: 'Kiểm kê', path: '/stocktake', badge: null },
  { icon: Warehouse, label: 'Kho hàng', path: '/warehouses', badge: null },
  { icon: Users, label: 'Nhân sự', path: '/personnel', badge: null },
  { icon: Truck, label: 'Nhà cung cấp', path: '/suppliers', badge: null },
  {
    icon: Settings,
    label: 'Cài đặt',
    path: '/settings',
    badge: null,
    children: [
      { icon: Mail, label: 'Cấu hình mail', path: '/settings/mail' },
      { icon: Cpu, label: 'Cấu hình AI', path: '/settings/ai' },
    ],
  },
  { icon: FileText, label: 'Nhật ký hoạt động', path: '/audit-log', badge: null, allowedRoles: ['admin', 'manager'] },
];

function getStoredUserRole() {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}')?.role as string | undefined;
  } catch {
    return undefined;
  }
}

function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const storedUserRole = getStoredUserRole();

  const filteredMenuItems = menuItems.filter((item) => {
    const roleAllowed = !item.allowedRoles || item.allowedRoles.includes(storedUserRole || '');
    return roleAllowed && item.label.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const toggleExpanded = (path: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  return (
    <aside
      className={`${
        isOpen ? 'w-80' : 'w-20'
      } fixed lg:relative z-40 bg-white dark:bg-slate-950 shadow-2xl transform transition-all duration-300 ease-in-out border-r-2 border-gray-200 dark:border-slate-800 flex flex-col h-screen`}
      style={{
        background: 'linear-gradient(180deg, #FFFFFF 0%, #F9FAFB 100%)'
      }}
    >
      {/* Header & Logo */}
      <div className="p-4 border-b-2 bg-white dark:bg-slate-950 flex-shrink-0 border-gray-200 dark:border-slate-800 flex justify-center lg:justify-start">
        <div className={`flex items-center gap-3 w-full ${!isOpen ? 'justify-center' : ''}`}>
          <div className="p-2 rounded-xl bg-cyan-50 dark:bg-slate-900 flex-shrink-0">
            <Box className="h-6 w-6 text-cyan-600" />
          </div>
          {isOpen && (
            <div className="flex-1 overflow-hidden">
              <h1 className="font-bold text-lg text-gray-800 dark:text-white truncate">Smart WMS</h1>
              <p className="text-gray-500 dark:text-slate-400 text-xs font-medium truncate">Hệ thống quản lý kho</p>
            </div>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-4 py-4 flex-shrink-0">
        {isOpen ? (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-cyan-500" />
            <input
              type="text"
              placeholder="Tìm kiếm menu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 text-sm border-2 border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 dark:bg-slate-900 dark:text-white transition-all bg-gray-50"
            />
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="p-2 rounded-xl bg-cyan-50 dark:bg-slate-900 cursor-pointer" onClick={onToggle} title="Mở rộng để tìm kiếm">
              <Search className="h-5 w-5 text-cyan-600" />
            </div>
          </div>
        )}
      </div>

      {/* Main Menu */}
      <nav 
        className="flex-1 px-3 space-y-2 overflow-y-auto pb-4"
        style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#d5d8db #F1F5F9'
        }}
      >
        {filteredMenuItems.length === 0 && isOpen && (
            <div className="text-center py-4 text-sm text-gray-500 dark:text-slate-400">
                Không tìm thấy kết quả.
            </div>
        )}

        {filteredMenuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          const hasChildren = item.children && item.children.length > 0;
          const isExpanded = expandedItems.has(item.path);
          const isChildActive = hasChildren && item.children?.some(child => location.pathname === child.path);

          if (hasChildren) {
            return (
              <div key={item.path}>
                <div
                  onClick={() => toggleExpanded(item.path)}
                  className={`w-full flex items-center ${isOpen ? 'px-4' : 'justify-center'} py-3.5 text-sm font-bold rounded-xl transition-all duration-200 group cursor-pointer ${
                    isActive || isChildActive
                      ? 'text-white'
                      : 'hover:bg-cyan-50 dark:hover:bg-black/40 text-gray-600 dark:text-slate-300'
                  }`}
                  style={isActive || isChildActive ? {
                      background: 'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)',
                      boxShadow: '0 4px 16px rgba(6, 182, 212, 0.4)'
                  } : {}}
                  title={!isOpen ? item.label : ''}
                >
                  <Icon 
                    className={`h-5 w-5 ${isOpen ? 'mr-3' : ''} flex-shrink-0 ${
                      isActive || isChildActive ? 'text-white' : 'text-cyan-600'
                    }`} 
                  />
                  {isOpen && (
                    <span className="flex-1 text-left truncate">{item.label}</span>
                  )}
                  {isOpen && (
                    <ChevronDown 
                      className={`h-4 w-4 ml-2 transition-transform duration-200 ${
                        isExpanded ? 'rotate-180' : ''
                      }`} 
                    />
                  )}
                </div>
                
                {isExpanded && isOpen && (
                  <div className="ml-4 mt-1 space-y-1">
                    {item.children?.map((child) => {
                      const ChildIcon = child.icon;
                      const isChildActiveState = location.pathname === child.path;
                      
                      return (
                        <Link
                          key={child.path}
                          to={child.path}
                          className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 group ${
                            isChildActiveState
                              ? 'text-white'
                              : 'hover:bg-cyan-50 dark:hover:bg-black/40 text-gray-600 dark:text-slate-300'
                          }`}
                          style={isChildActiveState ? {
                              background: 'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)',
                              boxShadow: '0 4px 16px rgba(6, 182, 212, 0.4)'
                          } : {}}
                        >
                          <ChildIcon 
                            className={`h-4 w-4 mr-3 flex-shrink-0 ${
                              isChildActiveState ? 'text-white' : 'text-cyan-600'
                            }`} 
                          />
                          <span className="flex-1 text-left truncate">{child.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`w-full flex items-center ${isOpen ? 'px-4' : 'justify-center'} py-3.5 text-sm font-bold rounded-xl transition-all duration-200 group ${
                isActive
                  ? 'text-white'
                  : 'hover:bg-cyan-50 dark:hover:bg-black/40 text-gray-600 dark:text-slate-300'
              }`}
              style={isActive ? {
                  background: 'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)',
                  boxShadow: '0 4px 16px rgba(6, 182, 212, 0.4)'
              } : {}}
              title={!isOpen ? item.label : ''}
            >
              <Icon 
                className={`h-5 w-5 ${isOpen ? 'mr-3' : ''} flex-shrink-0 ${
                  isActive ? 'text-white' : 'text-cyan-600'
                }`} 
              />
              {isOpen && (
                <span className="flex-1 text-left truncate">{item.label}</span>
              )}
              {isOpen && item.badge && (
                <span className="bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
        
      </nav>

      {/* Toggle Button Area */}
      <div className="p-4 border-t-2 bg-white dark:bg-slate-950 flex-shrink-0 border-gray-200 dark:border-slate-800">
        <button
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
  const userRole = storedUser.role === 'admin' ? 'Quản trị viên' : storedUser.role || 'Quản trị viên';

  // States cho Header Dropdowns
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [notificationDropdownOpen, setNotificationDropdownOpen] = useState(false);
  
  const [isDarkMode, setIsDarkMode] = useState(false);
  // Khởi tạo mảng thông báo rỗng (chờ ghép API thật)
  const [notifications, setNotifications] = useState<any[]>([]);
  const unreadCount = notifications.filter(n => n.isUnread).length;
  const [currentTime, setCurrentTime] = useState(() => new Date());

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

  const handleLogout = () => {
    localStorage.removeItem('token');
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
        
        {/* Header */}
        <header 
            className="relative bg-white dark:bg-slate-950 border-b-2 border-gray-200 dark:border-slate-800 flex items-center justify-between px-6 z-10 transition-all duration-300 shadow-sm"
            style={{ height: '80px' }}
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

            <div className="hidden sm:flex items-center gap-3 rounded-xl border-2 border-gray-200 bg-gray-50 px-4 h-[3.5rem] dark:border-slate-700 dark:bg-slate-900">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-50 text-cyan-600 dark:bg-slate-800">
                <Clock className="h-5 w-5" />
              </div>
              <div className="flex items-center gap-2 whitespace-nowrap">
                <span className="text-sm font-black text-slate-800 dark:text-slate-100">{formattedTime}</span>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{formattedDate}</span>
              </div>
            </div>
          </div>

          {/* Center Section: Search Bar (Flex Flow with dynamic sizing, preventing overlaps) */}
          <div className="hidden md:flex flex-1 justify-center max-w-md lg:max-w-lg xl:max-w-2xl mx-auto px-4">
            <div className="w-full flex items-center rounded-xl border-2 border-gray-200 bg-gray-50 px-5 h-[3.5rem] transition-all focus-within:border-cyan-500 focus-within:ring-4 focus-within:ring-cyan-500/10 dark:border-slate-700 dark:bg-slate-900">
              <Search size={18} className="mr-3 text-gray-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Tìm kiếm trong hệ thống..."
                className="w-full border-none bg-transparent text-sm font-medium text-gray-700 outline-none placeholder-gray-400 dark:text-white"
              />
            </div>
          </div>

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
                <div className="fixed left-3 right-3 top-[84px] sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[30rem] bg-white dark:bg-slate-900 rounded-xl shadow-2xl border-2 border-gray-200 dark:border-slate-700 z-50 max-h-[calc(100vh-96px)] sm:max-h-[36rem] overflow-hidden">
                  <div className="px-4 py-3 border-b-2 border-gray-200 dark:border-slate-700 bg-gradient-to-r from-cyan-50 to-cyan-100/50 dark:from-slate-900 dark:to-slate-900">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-slate-100">Thông báo</p>
                        {unreadCount > 0 && <p className="text-xs text-gray-600 dark:text-slate-400">{unreadCount} thông báo chưa đọc</p>}
                      </div>
                      <div className="flex items-center space-x-2">
                        {unreadCount > 0 && (
                          <button onClick={() => setNotifications(notifications.map(n => ({...n, isUnread: false})))} className="text-xs font-medium text-cyan-600 dark:text-cyan-400" title="Đánh dấu tất cả đã đọc">
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
                        <div key={notif._id} className={`px-4 py-3 hover:bg-cyan-50 dark:hover:bg-slate-800 cursor-pointer border-b-2 border-gray-100 dark:border-slate-800 transition-colors ${notif.isUnread ? 'bg-cyan-50/50 dark:bg-slate-800/50' : ''}`}>
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
                                <Clock className="h-3 w-3 mr-1" /> Vừa xong
                              </div>
                            </div>
                          </div>
                        </div>
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
                  DNA
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
