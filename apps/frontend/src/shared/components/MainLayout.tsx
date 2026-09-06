import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
} from "lucide-react";
import SyncStatusBanner from "../../features/offline-sync/components/SyncStatusBanner";
import Sidebar from "./Sidebar";

interface LayoutProps {
  children?: React.ReactNode;
}

export default function MainLayout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = React.useState(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth >= 1024;
    }
    return true;
  });
  const location = useLocation();
  const navigate = useNavigate();

  // Auto-close sidebar on mobile when route changes
  React.useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, [location.pathname]);

  const storedUser = React.useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}") as {
        email?: string;
        fullName?: string;
        role?: string;
      };
    } catch {
      return {};
    }
  }, []);
  const userName = storedUser.fullName || "Dương Ngọc Anh";
  const userEmail = storedUser.email || "admin@smartwms.vn";
  const formatUserRoleDisplay = (role?: string) => {
    if (!role) return "Quản trị viên";
    const lower = String(role).trim().toLowerCase();
    if (lower === "admin" || lower === "administrator") return "Quản trị viên";
    if (
      lower === "manager" ||
      lower === "warehouse_manager" ||
      lower === "quản lý kho"
    )
      return "Quản lý kho";
    if (
      lower === "staff" ||
      lower === "inventory_staff" ||
      lower === "warehouse_staff" ||
      lower === "storekeeper"
    )
      return "Thủ kho";
    if (
      lower === "inventory_checker" ||
      lower === "inventory-checker" ||
      lower === "nhân viên kiểm kê"
    )
      return "Nhân viên kiểm kê";
    if (lower === "customer") return "Khách hàng";
    if (lower === "supplier") return "Nhà cung cấp";
    return role;
  };
  const rawRole =
    storedUser.role ||
    ((storedUser as any).roles && (storedUser as any).roles[0]?.name) ||
    "";
  const userRole = formatUserRoleDisplay(rawRole);
  const userInitials =
    userName
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .join("")
      .slice(0, 3)
      .toUpperCase() || "WMS";

  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [notificationDropdownOpen, setNotificationDropdownOpen] =
    useState(false);

  // Default to dark mode (isDarkMode: true) matching dem.cmcu.edu.vn sample
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme) return savedTheme === 'dark';
      return true; // Default to Dark Mode as requested
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const DEFAULT_OPERATIONAL_NOTIFICATIONS = React.useMemo(
    () => [
      {
        id: "op-1",
        title: "Phiếu nhập kho mới PNK20260821-2054",
        message:
          "Phiếu nhập kho PNK20260821-2054 vừa được tạo. Vui lòng duyệt trước khi nhập kho.",
        link: "/inbound/receipts",
        priority: "high",
        type: "inbound",
        isUnread: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: "op-2",
        title: "Phiếu xuất kho mới PXK20260821-0012",
        message:
          "Phiếu xuất kho PXK20260821-0012 vừa được tạo. Vui lòng chuẩn bị đóng gói và xuất kho.",
        link: "/outbound/orders",
        priority: "normal",
        type: "outbound",
        isUnread: true,
        createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
      },
      {
        id: "op-3",
        title: "Đơn mua hàng DH01082026-0002",
        message:
          "Nhà cung cấp Công ty giặt may Hà Thành đã xác nhận đơn mua hàng DH01082026-0002.",
        link: "/inbound/purchase-orders",
        priority: "normal",
        type: "purchase",
        isUnread: true,
        createdAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
      },
      {
        id: "op-4",
        title: "Đơn chuyển kho CK20260821-0005",
        message:
          "Đơn chuyển kho nội bộ từ Kho tổng đến Kho Cầu Giấy đã hoàn tất vận chuyển.",
        link: "/delivery/transfer-requests",
        priority: "normal",
        type: "transfer",
        isUnread: false,
        createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      },
      {
        id: "op-5",
        title: "Cảnh báo tồn kho tối thiểu",
        message:
          "Phát hiện 15 mặt hàng có số lượng tồn kho giảm xuống dưới ngưỡng tối thiểu.",
        link: "/reports/below-min-stock",
        priority: "urgent",
        type: "warning",
        isUnread: true,
        createdAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
      },
    ],
    [],
  );

  const [notifications, setNotifications] = useState<any[]>(
    DEFAULT_OPERATIONAL_NOTIFICATIONS,
  );
  const unreadCount = notifications.filter((n) => n.isUnread).length;
  const [currentTime, setCurrentTime] = useState(() => new Date());

  const loadNotifications = React.useCallback(async () => {
    try {
      const response = await fetch("/api/notifications", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
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

  useEffect(() => {
    const handleClickOutside = (event: any) => {
      if (!event.target.closest(".dropdown-container")) {
        setUserDropdownOpen(false);
        setNotificationDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  };

  const formattedTime = currentTime.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const formattedDate = currentTime.toLocaleDateString("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
<<<<<<< HEAD
    <div className="flex h-screen bg-gray-50 dark:bg-slate-900 font-sans overflow-hidden">
      {/* Mobile Backdrop Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 lg:hidden transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Component */}
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden w-full transition-all duration-300">
=======
    <div className="flex h-screen print:h-auto print:overflow-visible bg-slate-50 dark:bg-[#060913] print:bg-white font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">
      {/* Sidebar Component */}
      <div className="print:hidden">
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      </div>

      {/* Main Content Area */}
      <div className={`${sidebarOpen ? 'ml-80' : 'ml-20'} flex-1 flex flex-col overflow-hidden print:overflow-visible print:ml-0 lg:ml-0 transition-all duration-300`}>
>>>>>>> b02766de169a9e78aa5863c1ef47a3bc2c6fadc0
        {/* Sync Status Banner */}
        <div className="print:hidden">
          <SyncStatusBanner />
        </div>

<<<<<<< HEAD
        {/* Header */}
        <header className="relative bg-white dark:bg-slate-950 border-b-2 border-gray-200 dark:border-slate-800 flex items-center justify-between px-3 sm:px-6 z-40 transition-all duration-300 h-16 sm:h-20 box-border flex-shrink-0">
          {/* Left Section: Toggle, Brand & Clock */}
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
=======
        {/* Header matching dem.cmcu.edu.vn sample */}
        <header className="relative bg-white dark:bg-[#090d16] border-b-2 border-slate-200 dark:border-slate-800/80 flex items-center justify-between px-6 z-40 transition-all duration-300 h-20 box-border shadow-xs print:hidden">
          {/* Left Section: Toggle & Clock */}
          <div className="flex items-center gap-4 flex-shrink-0">
>>>>>>> b02766de169a9e78aa5863c1ef47a3bc2c6fadc0
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title={sidebarOpen ? "Đóng menu" : "Mở menu"}
              aria-label={sidebarOpen ? "Đóng menu" : "Mở menu"}
<<<<<<< HEAD
              className="h-10 w-10 sm:h-14 sm:w-14 flex items-center justify-center bg-white dark:bg-slate-900 border-2 border-gray-200 dark:border-slate-700 hover:bg-cyan-50 dark:hover:bg-slate-800 rounded-xl transition-all group lg:hidden"
            >
              {sidebarOpen ? (
                <X
                  size={20}
                  className="text-gray-600 dark:text-slate-300 group-hover:text-cyan-600"
                />
              ) : (
                <Menu
                  size={20}
                  className="text-gray-600 dark:text-slate-300 group-hover:text-cyan-600"
                />
              )}
            </button>

            {/* Mobile Brand Title */}
            <div className="flex items-center gap-2 lg:hidden">
              <img
                src="/logo.png"
                alt="Smart WMS"
                className="h-8 w-8 object-cover rounded-lg"
              />
              <span className="font-bold text-base text-gray-800 dark:text-white">
                Smart WMS
              </span>
            </div>

            {/* Clock Widget - Redesigned to modern Cyan Badge */}
            <div className="hidden md:flex items-center gap-3 rounded-2xl border-2 border-cyan-500/40 bg-gradient-to-r from-cyan-50 via-white to-cyan-50/60 px-4 py-2 shadow-sm transition-all hover:border-cyan-500 dark:border-slate-700 dark:bg-slate-900">
              <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-600 text-white shadow-md shadow-cyan-600/20">
                <Clock className="h-4 w-4 text-cyan-100" />
=======
              className="h-[3.5rem] w-[3.5rem] flex items-center justify-center bg-white dark:bg-[#0f172a] border-2 border-slate-200 dark:border-slate-800/80 hover:bg-cyan-50 dark:hover:bg-[#1a233a] rounded-xl transition-all group lg:hidden cursor-pointer"
            >
              {sidebarOpen ? (
                <X size={20} className="text-slate-600 dark:text-blue-200 group-hover:text-cyan-600 dark:group-hover:text-blue-400" />
              ) : (
                <Menu size={20} className="text-slate-600 dark:text-blue-200 group-hover:text-cyan-600 dark:group-hover:text-blue-400" />
              )}
            </button>

            {/* Clock Widget */}
            <div className="hidden sm:flex items-center gap-3 rounded-2xl border-2 border-cyan-500/40 dark:border-blue-700/80 bg-slate-100 dark:bg-[#0d1424] px-4 py-2 shadow-xs transition-all hover:border-cyan-500 dark:hover:border-blue-500">
              <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-600 dark:bg-blue-600 text-white shadow-md">
                <Clock className="h-4 w-4 text-white" />
>>>>>>> b02766de169a9e78aa5863c1ef47a3bc2c6fadc0
                <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 dark:bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-300 dark:bg-blue-300"></span>
                </span>
              </div>
              <div className="flex items-center gap-2.5 whitespace-nowrap">
                <span className="text-base font-black tracking-wider text-slate-900 dark:text-white font-mono">
                  {formattedTime}
                </span>
                <span className="rounded-lg bg-cyan-100 dark:bg-[#1a233a] px-2.5 py-1 text-xs font-extrabold text-cyan-900 dark:text-blue-200 border border-cyan-300 dark:border-blue-700">
                  {formattedDate}
                </span>
              </div>
            </div>
          </div>

<<<<<<< HEAD
          {/* Middle Section: Pure Plain Text Unread Notifications Ticker */}
          {notifications.filter((n) => n.isUnread).length > 0 && (
            <div className="hidden xl:flex items-center flex-1 max-w-[600px] xl:max-w-[880px] mx-4 overflow-hidden h-12 relative">
              <div className="animate-header-marquee flex items-center gap-16 text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
=======
          {/* Middle Section: Unread Notifications Ticker */}
          {notifications.filter((n) => n.isUnread).length > 0 && (
            <div className="hidden lg:flex items-center flex-1 max-w-[600px] xl:max-w-[880px] mx-4 overflow-hidden h-12 relative">
              <div className="animate-header-marquee flex items-center gap-16 text-sm font-bold text-slate-900 dark:text-slate-100">
>>>>>>> b02766de169a9e78aa5863c1ef47a3bc2c6fadc0
                {notifications
                  .filter((n) => n.isUnread)
                  .map((notif, idx) => (
                    <span
                      key={notif.id || idx}
                      onClick={() => {
                        if (notif.link) navigate(notif.link);
                      }}
                      className="inline-flex items-center gap-2.5 cursor-pointer hover:text-cyan-600 dark:hover:text-blue-400 transition-colors shrink-0"
                      title="Bấm để xem chi tiết thông báo"
                    >
<<<<<<< HEAD
                      <span className="font-black text-cyan-700 dark:text-cyan-400 text-base sm:text-lg">
                        {notif.title}:
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-100 text-base sm:text-lg">
                        {notif.message}
                      </span>
                      <span className="text-cyan-400 dark:text-cyan-600 font-extrabold ml-6">
                        ✦
                      </span>
=======
                      <span className="font-extrabold text-cyan-700 dark:text-blue-400 text-sm">{notif.title}:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{notif.message}</span>
                      <span className="text-cyan-400 dark:text-blue-400 font-extrabold ml-6">✦</span>
>>>>>>> b02766de169a9e78aa5863c1ef47a3bc2c6fadc0
                    </span>
                  ))}
              </div>
            </div>
          )}

<<<<<<< HEAD
          {/* Right Section: Cụm Dropdown */}
          <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
=======
          {/* Right Section: Controls & Profile */}
          <div className="flex items-center space-x-3 flex-shrink-0">

>>>>>>> b02766de169a9e78aa5863c1ef47a3bc2c6fadc0
            {/* Notifications Dropdown */}
            <div className="relative dropdown-container">
              <div className="relative">
                {unreadCount > 0 && (
                  <div className="absolute inset-0 bg-gradient-to-r from-red-400 to-pink-500 rounded-xl blur-md opacity-50 animate-pulse"></div>
                )}
                <button
                  onClick={() => {
                    setUserDropdownOpen(false);
                    setNotificationDropdownOpen(!notificationDropdownOpen);
                  }}
                  title="Thông báo"
                  aria-label="Thông báo"
<<<<<<< HEAD
                  className="relative h-10 w-10 sm:h-14 sm:w-14 rounded-xl bg-white dark:bg-slate-900 hover:bg-cyan-50 dark:hover:bg-slate-800 transition-colors border-2 border-gray-200 dark:border-slate-700 flex items-center justify-center"
=======
                  className="relative h-[3.5rem] w-[3.5rem] rounded-xl bg-white dark:bg-[#0f172a] hover:bg-cyan-50 dark:hover:bg-[#1a233a] transition-colors border-2 border-slate-200 dark:border-slate-800 flex items-center justify-center cursor-pointer"
>>>>>>> b02766de169a9e78aa5863c1ef47a3bc2c6fadc0
                >
                  <Bell className="h-5 w-5 text-slate-600 dark:text-indigo-200" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 w-5 sm:h-6 sm:w-6 bg-gradient-to-r from-red-500 to-pink-500 text-white text-[10px] sm:text-xs rounded-full flex items-center justify-center font-bold shadow-lg">
                      {unreadCount}
                    </span>
                  )}
                </button>
              </div>

              {notificationDropdownOpen && (
<<<<<<< HEAD
                <div className="fixed left-3 right-3 top-[70px] sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[30rem] bg-white dark:bg-slate-950 rounded-xl shadow-2xl border-2 border-gray-200 dark:border-slate-700 z-50 max-h-[calc(100vh-96px)] sm:max-h-[36rem] overflow-hidden">
                  <div className="px-4 py-3 border-b-2 border-gray-200 dark:border-slate-700 bg-gradient-to-r from-cyan-50 to-cyan-100/50 dark:from-slate-900 dark:to-slate-900">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-slate-100">
                          Thông báo
                        </p>
                        {unreadCount > 0 && (
                          <p className="text-xs text-gray-600 dark:text-slate-400">
                            {unreadCount} thông báo chưa đọc
                          </p>
                        )}
=======
                <div className="fixed left-3 right-3 top-[84px] sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[30rem] bg-white dark:bg-[#0f172a] rounded-xl shadow-2xl border-2 border-slate-200 dark:border-slate-800 z-50 max-h-[calc(100vh-96px)] sm:max-h-[36rem] overflow-hidden">
                  <div className="px-4 py-3 border-b-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090d16]">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Thông báo</p>
                        {unreadCount > 0 && <p className="text-xs text-slate-600 dark:text-indigo-300">{unreadCount} thông báo chưa đọc</p>}
>>>>>>> b02766de169a9e78aa5863c1ef47a3bc2c6fadc0
                      </div>
                      <div className="flex items-center space-x-2">
                        {unreadCount > 0 && (
                          <button
                            onClick={async () => {
                              setNotifications(
                                notifications.map((n) => ({
                                  ...n,
                                  isUnread: false,
                                })),
                              );
                              try {
                                await fetch("/api/notifications/read-all", {
                                  method: "POST",
                                  headers: {
                                    Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
                                  },
                                });
                              } catch {
                                // Ignore background sync errors.
                              }
                            }}
                            className="text-xs font-bold text-cyan-600 dark:text-indigo-400 cursor-pointer"
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
<<<<<<< HEAD
                        <Bell className="h-10 w-10 text-gray-300 dark:text-slate-600 mb-3" />
                        <p className="text-sm font-bold text-gray-600 dark:text-slate-400">
                          Không có thông báo mới
                        </p>
                        <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
                          Các thông báo của bạn sẽ xuất hiện ở đây
                        </p>
=======
                        <Bell className="h-10 w-10 text-slate-300 dark:text-indigo-800 mb-3" />
                        <p className="text-sm font-bold text-slate-600 dark:text-indigo-300">Không có thông báo mới</p>
                        <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">Các thông báo của bạn sẽ xuất hiện ở đây</p>
>>>>>>> b02766de169a9e78aa5863c1ef47a3bc2c6fadc0
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <button
                          key={notif.id || notif._id}
                          type="button"
                          onClick={async () => {
                            setNotifications((current) =>
                              current.map((item) =>
                                item.id === notif.id || item._id === notif._id
                                  ? { ...item, isUnread: false }
                                  : item,
                              ),
                            );
                            try {
                              await fetch(
                                `/api/notifications/${notif.id || notif._id}/read`,
                                {
                                  method: "POST",
                                  headers: {
                                    Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
                                  },
                                },
                              );
                            } catch {
                              // Ignore background sync errors.
                            }
                            if (notif.link) {
                              navigate(notif.link);
                              setNotificationDropdownOpen(false);
                            }
                          }}
<<<<<<< HEAD
                          className={`w-full px-4 py-3 text-left hover:bg-cyan-50 dark:hover:bg-slate-800 cursor-pointer border-b-2 border-gray-100 dark:border-slate-800 transition-colors ${notif.isUnread ? "bg-cyan-50/50 dark:bg-slate-800/50" : ""}`}
                        >
                          <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0 mt-1">
                              {notif.priority === "urgent" ? (
                                <AlertCircle className="h-4 w-4 text-red-500" />
                              ) : notif.priority === "high" ? (
                                <AlertTriangle className="h-4 w-4 text-orange-500" />
                              ) : (
                                <Info className="h-4 w-4 text-cyan-500" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between mb-1">
                                <p
                                  className={`text-sm font-bold ${notif.isUnread ? "text-gray-900 dark:text-slate-100" : "text-gray-700 dark:text-slate-300"}`}
                                >
                                  {notif.title}
                                </p>
                                {notif.isUnread && (
                                  <div className="h-2 w-2 rounded-full bg-cyan-500 ml-2 mt-1"></div>
                                )}
                              </div>
                              <p className="text-xs mb-2 line-clamp-2 text-gray-600 dark:text-slate-400">
                                {notif.message}
                              </p>
                              <div className="flex items-center text-xs text-gray-500">
                                <Clock className="h-3 w-3 mr-1" />{" "}
                                {notif.createdAt
                                  ? new Date(notif.createdAt).toLocaleString(
                                      "vi-VN",
                                    )
                                  : "Vừa xong"}
=======
                          className={`w-full px-4 py-3 text-left hover:bg-cyan-50 dark:hover:bg-[#1a233a] cursor-pointer border-b-2 border-slate-100 dark:border-slate-800/60 transition-colors ${notif.isUnread ? 'bg-cyan-50/50 dark:bg-[#131b2e]' : ''}`}
                        >
                          <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0 mt-1">
                              {notif.priority === 'urgent' ? <AlertCircle className="h-4 w-4 text-red-500" /> : notif.priority === 'high' ? <AlertTriangle className="h-4 w-4 text-orange-500" /> : <Info className="h-4 w-4 text-cyan-500 dark:text-indigo-400" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between mb-1">
                                <p className={`text-sm font-bold ${notif.isUnread ? 'text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300'}`}>{notif.title}</p>
                                {notif.isUnread && <div className="h-2 w-2 rounded-full bg-cyan-500 dark:bg-indigo-500 ml-2 mt-1"></div>}
                              </div>
                              <p className="text-xs mb-2 line-clamp-2 text-slate-600 dark:text-slate-400">{notif.message}</p>
                              <div className="flex items-center text-xs text-slate-500 dark:text-slate-500">
                                <Clock className="h-3 w-3 mr-1" /> {notif.createdAt ? new Date(notif.createdAt).toLocaleString('vi-VN') : 'Vừa xong'}
>>>>>>> b02766de169a9e78aa5863c1ef47a3bc2c6fadc0
                              </div>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
<<<<<<< HEAD
                  <div className="px-4 py-3 border-t-2 border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900">
                    <button
                      onClick={() => setNotificationDropdownOpen(false)}
                      className="w-full text-center text-sm font-bold text-cyan-600 dark:text-cyan-400"
                    >
                      Xem tất cả thông báo
                    </button>
=======
                  <div className="px-4 py-3 border-t-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090d16]">
                    <button onClick={() => setNotificationDropdownOpen(false)} className="w-full text-center text-xs font-bold text-cyan-600 dark:text-indigo-400 cursor-pointer">Xem tất cả thông báo</button>
>>>>>>> b02766de169a9e78aa5863c1ef47a3bc2c6fadc0
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
<<<<<<< HEAD
                className="flex items-center space-x-2 p-1.5 sm:p-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-cyan-50 dark:hover:bg-slate-800 transition-colors border-2 border-gray-200 dark:border-slate-700 h-10 sm:h-14"
              >
                <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shadow-md overflow-hidden bg-gradient-to-br from-cyan-400 to-cyan-600 text-white font-bold text-xs sm:text-sm">
                  {userInitials}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-bold text-gray-900 dark:text-slate-100">
                    {userName}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-slate-400">
                    {userRole}
                  </p>
=======
                className="flex items-center space-x-2 p-2 rounded-xl bg-white dark:bg-[#0f172a] hover:bg-cyan-50 dark:hover:bg-[#1a233a] transition-colors border-2 border-slate-200 dark:border-slate-800 h-[3.5rem] cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md overflow-hidden bg-gradient-to-br from-indigo-600 to-blue-600 text-white font-bold text-sm">
                  {userInitials}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-extrabold text-slate-900 dark:text-slate-100">{userName}</p>
                  <p className="text-xs font-bold text-slate-500 dark:text-indigo-300">{userRole}</p>
>>>>>>> b02766de169a9e78aa5863c1ef47a3bc2c6fadc0
                </div>
                <ChevronDown className="h-4 w-4 text-slate-500 dark:text-indigo-300" />
              </button>

              {userDropdownOpen && (
<<<<<<< HEAD
                <div className="fixed left-3 right-3 top-[70px] sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-64 bg-white dark:bg-slate-900 rounded-xl shadow-2xl py-2 z-50 border-2 border-gray-200 dark:border-slate-700">
                  <div className="px-4 pb-2 mb-2 border-b-2 border-gray-200 dark:border-slate-700">
                    <p className="text-sm font-bold text-gray-900 dark:text-slate-100 truncate">
                      {userName}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                      {userEmail}
                    </p>
=======
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-[#0f172a] rounded-xl shadow-2xl py-2 z-50 border-2 border-slate-200 dark:border-slate-800">
                  <div className="px-4 pb-2 mb-2 border-b-2 border-slate-200 dark:border-slate-800">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{userName}</p>
                    <p className="text-xs text-slate-500 dark:text-indigo-300 truncate">{userEmail}</p>
>>>>>>> b02766de169a9e78aa5863c1ef47a3bc2c6fadc0
                  </div>

                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      navigate("/profile");
                    }}
                    className="flex items-center w-[calc(100%-1rem)] px-4 py-3 text-xs hover:bg-cyan-50 dark:hover:bg-[#1a233a] transition-colors rounded-lg mx-2 text-slate-900 dark:text-slate-100 font-bold cursor-pointer"
                  >
                    <UserIcon className="h-4 w-4 mr-3 text-slate-600 dark:text-indigo-400" />
                    Thông tin tài khoản
                  </button>
                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      navigate("/settings");
                    }}
                    className="flex items-center w-[calc(100%-1rem)] px-4 py-3 text-xs hover:bg-cyan-50 dark:hover:bg-[#1a233a] transition-colors rounded-lg mx-2 text-slate-900 dark:text-slate-100 font-bold cursor-pointer"
                  >
                    <Settings className="h-4 w-4 mr-3 text-slate-600 dark:text-indigo-400" />
                    Cài đặt hệ thống
                  </button>
<<<<<<< HEAD
                  <button
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className="flex items-center w-[calc(100%-1rem)] px-4 py-3 text-sm hover:bg-cyan-50 dark:hover:bg-slate-800 transition-colors rounded-lg mx-2 text-gray-900 dark:text-slate-100 font-semibold"
                  >
                    {isDarkMode ? (
                      <Moon className="h-4 w-4 mr-3 text-gray-600 dark:text-slate-400" />
                    ) : (
                      <Sun className="h-4 w-4 mr-3 text-gray-600 dark:text-slate-400" />
                    )}
                    {isDarkMode ? "Giao diện: Tối" : "Giao diện: Sáng"}
=======
                  <button onClick={() => setIsDarkMode(!isDarkMode)} className="flex items-center w-[calc(100%-1rem)] px-4 py-3 text-xs hover:bg-cyan-50 dark:hover:bg-[#1a233a] transition-colors rounded-lg mx-2 text-slate-900 dark:text-slate-100 font-bold cursor-pointer">
                    {isDarkMode ? <Moon className="h-4 w-4 mr-3 text-indigo-400" /> : <Sun className="h-4 w-4 mr-3 text-amber-500" />}
                    {isDarkMode ? 'Giao diện: Tối' : 'Giao diện: Sáng'}
>>>>>>> b02766de169a9e78aa5863c1ef47a3bc2c6fadc0
                  </button>

                  <div className="my-2 border-t-2 border-slate-200 dark:border-slate-800" />

<<<<<<< HEAD
                  <button
                    onClick={handleLogout}
                    className="flex items-center w-[calc(100%-1rem)] px-4 py-3 text-sm hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors rounded-lg mx-2 text-red-600 font-bold"
                  >
=======
                  <button onClick={handleLogout} className="flex items-center w-[calc(100%-1rem)] px-4 py-3 text-xs hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors rounded-lg mx-2 text-rose-600 dark:text-rose-400 font-extrabold cursor-pointer">
>>>>>>> b02766de169a9e78aa5863c1ef47a3bc2c6fadc0
                    <LogOut className="h-4 w-4 mr-3" />
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
<<<<<<< HEAD
        <main
          className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 pb-6"
          style={{
            background: "linear-gradient(180deg, #F8FAFC 0%, #F1F5F9 100%)",
          }}
        >
=======
        <main className="flex-1 overflow-y-auto print:overflow-visible print:p-0 print:bg-white p-6 bg-slate-50 dark:bg-[#060913] transition-colors duration-300">
>>>>>>> b02766de169a9e78aa5863c1ef47a3bc2c6fadc0
          {children || (
            <div className="flex items-center justify-center h-full text-slate-400 dark:text-indigo-300/60 font-semibold text-xs">
              Nội dung trang web sẽ hiển thị ở đây
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
