import React, { useState, useEffect } from 'react';
import { Package, Search, ShoppingCart, Truck, CheckCircle2, User, LogOut, ArrowRight, X, LayoutGrid } from 'lucide-react';
import { customerApi } from '../api/customerApi';
import { useNavigate } from 'react-router-dom';

type StockItem = {
  id: string;
  internalSku: string;
  name: string;
  unit: string;
  category: string;
  available: number;
};

type OrderDetail = {
  id: string;
  requiredQty: number;
  product: { id: string; internalSku: string; name: string; unit: string } | null;
};

type Order = {
  id: string;
  orderNo: string;
  status: string;
  expectedDate: string;
  createdAt: string;
  details: OrderDetail[];
};

const Button = ({ children, variant = 'primary', size = 'md', className = '', onClick, disabled }: any) => {
  const baseStyle = "inline-flex items-center justify-center font-bold rounded-xl transition-all duration-200 active:scale-95";
  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-5 py-2.5 text-sm",
    lg: "px-8 py-4 text-base"
  };
  const variants = {
    primary: "bg-cyan-600 text-white hover:bg-cyan-700 shadow-lg shadow-cyan-600/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none",
    ghost: "text-slate-700 hover:bg-slate-100 disabled:opacity-50",
    white: "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 shadow-sm disabled:opacity-50",
    emerald: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
  };
  return (
    <button disabled={disabled} onClick={onClick} className={`${baseStyle} ${sizes[size as keyof typeof sizes] || sizes.md} ${variants[variant as keyof typeof variants] || variants.primary} ${className}`}>
      {children}
    </button>
  );
};

export default function CustomerPortalPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'stock' | 'order' | 'tracking'>('dashboard');
  const [profile, setProfile] = useState<any>(null);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Cart state
  const [cart, setCart] = useState<{product: StockItem, qty: number}[]>([]);
  const [toast, setToast] = useState<{type: 'success' | 'error', message: string} | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const loadData = async () => {
    setLoading(true);
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    
    try {
      const [profileData, stockData, ordersData] = await Promise.all([
        customerApi.getProfile(token),
        customerApi.getStockAvailability(token),
        customerApi.getOrders(token)
      ]);
      
      setProfile(profileData);
      setStockItems(stockData);
      setOrders(ordersData);
    } catch (err) {
      console.error(err);
      if (err instanceof Error && err.message.includes('401')) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const addToCart = (item: StockItem) => {
    const existing = cart.find(c => c.product.id === item.id);
    if (existing) {
      setCart(cart.map(c => c.product.id === item.id ? { ...c, qty: c.qty + 1 } : c));
    } else {
      setCart([...cart, { product: item, qty: 1 }]);
    }
    showToast('success', `Đã thêm ${item.name} vào giỏ hàng`);
  };

  const updateCartQty = (productId: string, qty: number) => {
    if (qty <= 0) {
      setCart(cart.filter(c => c.product.id !== productId));
    } else {
      setCart(cart.map(c => c.product.id === productId ? { ...c, qty } : c));
    }
  };

  const submitOrder = async () => {
    if (cart.length === 0) return;
    
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const orderData = {
        expectedDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // +7 days default
        details: cart.map(c => ({
          productId: c.product.id,
          requiredQty: c.qty
        }))
      };
      
      await customerApi.createOrder(token, orderData);
      showToast('success', 'Đã gửi yêu cầu đặt hàng thành công');
      setCart([]);
      setActiveTab('tracking');
      loadData(); // Refresh orders
    } catch (err) {
      showToast('error', 'Lỗi khi gửi đơn hàng');
    }
  };

  const filteredStock = stockItems.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.internalSku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const map: Record<string, {label: string, color: string}> = {
      pending: { label: 'Chờ xử lý', color: 'bg-amber-50 text-amber-700 border-amber-100' },
      picking: { label: 'Đang soạn hàng', color: 'bg-blue-50 text-blue-700 border-blue-100' },
      shipped: { label: 'Đã xuất kho', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' }
    };
    const mapped = map[status] || { label: status, color: 'bg-slate-50 text-slate-600 border-slate-200' };
    return <span className={`px-2.5 py-1 rounded-xl text-xs font-bold border ${mapped.color}`}>{mapped.label}</span>;
  };

  const containerClass = "w-full mx-auto px-4 md:px-12 lg:px-24 xl:px-32 max-w-7xl";

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-slate-50 text-slate-600 font-sans gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-cyan-600"></div>
        <p className="font-bold text-sm">Đang tải thông tin Customer Portal...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50 font-sans text-slate-800 selection:bg-cyan-200 selection:text-cyan-900 relative">
      {/* Custom micro animations styles */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-slideInRight {
          animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Decorative Grid & Blur Shapes */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808006_1px,transparent_1px),linear-gradient(to_bottom,#80808006_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>
      <div className="absolute top-0 right-1/4 w-[600px] h-[300px] opacity-20 bg-cyan-300 rounded-[100%] blur-[100px] mix-blend-multiply pointer-events-none"></div>
      <div className="absolute bottom-0 left-1/4 w-[600px] h-[300px] opacity-10 bg-indigo-300 rounded-[100%] blur-[100px] mix-blend-multiply pointer-events-none"></div>

      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border font-bold text-sm bg-white animate-slideInRight border-slate-100 text-slate-800">
          <div className={`p-1.5 rounded-lg ${toast.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
            <CheckCircle2 className="h-4.5 w-4.5" />
          </div>
          {toast.message}
        </div>
      )}

      {/* Header / Navbar */}
      <header className="shrink-0 sticky top-0 bg-white/85 backdrop-blur-md border-b border-slate-200/80 z-40 transition-all">
        <div className="w-full mx-auto px-4 md:px-12 lg:px-24 xl:px-32 py-4 flex justify-between items-center max-w-7xl">
          {/* Logo brand */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="bg-cyan-600 text-white rounded-xl p-2.5 shadow-lg shadow-cyan-600/30">
              <Package size={20} strokeWidth={2.5} />
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-black tracking-tight text-slate-900 leading-none">
                Smart<span className="text-cyan-600">WMS</span>
              </h1>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Customer Portal</span>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-2xl border border-slate-200/50">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all duration-200 ${
                activeTab === 'dashboard'
                  ? 'bg-white text-cyan-600 shadow-sm border border-slate-200/50'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid size={14} /> Tổng quan
            </button>
            <button
              onClick={() => setActiveTab('stock')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all duration-200 ${
                activeTab === 'stock'
                  ? 'bg-white text-cyan-600 shadow-sm border border-slate-200/50'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Search size={14} /> Tra cứu tồn kho
            </button>
            <button
              onClick={() => setActiveTab('order')}
              className={`relative flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all duration-200 ${
                activeTab === 'order'
                  ? 'bg-white text-cyan-600 shadow-sm border border-slate-200/50'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShoppingCart size={14} /> Đặt hàng
              {cart.length > 0 && (
                <span className="absolute -top-1.5 -right-1 h-4.5 w-4.5 rounded-full bg-cyan-600 text-[9px] text-white flex items-center justify-center font-black ring-2 ring-white animate-pulse">
                  {cart.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('tracking')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all duration-200 ${
                activeTab === 'tracking'
                  ? 'bg-white text-cyan-600 shadow-sm border border-slate-200/50'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Truck size={14} /> Theo dõi đơn
            </button>
          </div>

          {/* User profile & Logout */}
          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-2.5 text-right">
              <div>
                <p className="text-xs font-black text-slate-800 leading-tight">{profile?.name || 'Khách hàng'}</p>
                <p className="text-[10px] font-bold text-slate-400">
                  {profile?.type === 'B2B' ? 'Doanh nghiệp' : 'Cá nhân'} • {profile?.customerCode}
                </p>
              </div>
              <div className="h-8.5 w-8.5 rounded-xl bg-cyan-50 border border-cyan-100 flex items-center justify-center text-cyan-600 font-black text-sm">
                {profile?.name?.charAt(0) || <User size={14} />}
              </div>
            </div>

            <div className="h-5 w-[1px] bg-slate-200 hidden lg:block"></div>

            <Button onClick={handleLogout} variant="white" size="sm" className="px-3.5 py-2 font-bold text-xs">
              <LogOut size={13} className="mr-1.5" /> Đăng xuất
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto py-8 z-10">
        <div className={containerClass}>
          
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-fadeIn">
              {/* Welcome banner */}
              <div className="relative rounded-3xl bg-gradient-to-r from-slate-900 to-cyan-950 p-8 md:p-12 overflow-hidden shadow-xl text-white">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:24px_24px]"></div>
                <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500 rounded-full blur-[100px] opacity-20 -translate-y-1/2 translate-x-1/2"></div>
                <div className="relative z-10 max-w-2xl space-y-4">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-500/10 text-cyan-400 font-bold text-xs border border-cyan-500/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                    SmartWMS Portal v2.0
                  </span>
                  <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-tight">
                    Xin chào, <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-sky-200">{profile?.name || 'Khách hàng'}</span>!
                  </h2>
                  <p className="text-slate-300 text-sm md:text-base font-light leading-relaxed">
                    Chào mừng bạn quay lại hệ thống quản lý kho của chúng tôi. Bạn có thể tự do kiểm tra số lượng tồn kho khả dụng thực tế, tạo yêu cầu đặt hàng và theo dõi tiến trình giao dịch theo thời gian thực.
                  </p>
                </div>
              </div>

              {/* Grid action metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  {
                    label: 'Sản phẩm trong giỏ',
                    value: cart.length,
                    sub: 'Đơn hàng sẽ giữ tồn kho tạm thời ngay sau khi gửi.',
                    icon: ShoppingCart,
                    color: 'cyan',
                    actionText: 'Kiểm tra giỏ hàng',
                    action: () => setActiveTab('order'),
                    badgeColor: 'bg-cyan-50 border-cyan-100 text-cyan-700'
                  },
                  {
                    label: 'Mặt hàng khả dụng',
                    value: stockItems.length,
                    sub: 'Mã SKU sẵn sàng bán được cập nhật tự động.',
                    icon: Search,
                    color: 'emerald',
                    actionText: 'Tra cứu tồn kho',
                    action: () => setActiveTab('stock'),
                    badgeColor: 'bg-emerald-50 border-emerald-100 text-emerald-700'
                  },
                  {
                    label: 'Đơn hàng đã gửi',
                    value: orders.length,
                    sub: `${orders.filter(o => o.status === 'pending').length} đơn hàng đang ở trạng thái chờ tiếp nhận.`,
                    icon: Truck,
                    color: 'indigo',
                    actionText: 'Xem lịch sử đơn',
                    action: () => setActiveTab('tracking'),
                    badgeColor: 'bg-indigo-50 border-indigo-100 text-indigo-700'
                  }
                ].map((card, idx) => {
                  const Icon = card.icon;
                  return (
                    <div key={idx} className="group relative rounded-3xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-6">
                          <span className={`inline-flex rounded-2xl p-3 shadow-md ${
                            card.color === 'cyan' ? 'bg-cyan-50 text-cyan-600 shadow-cyan-600/10' :
                            card.color === 'emerald' ? 'bg-emerald-50 text-emerald-600 shadow-emerald-600/10' :
                            'bg-indigo-50 text-indigo-600 shadow-indigo-600/10'
                          }`}>
                            <Icon size={22} />
                          </span>
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${card.badgeColor}`}>
                            {card.label}
                          </span>
                        </div>
                        <h3 className="text-3xl font-black text-slate-800">{card.value}</h3>
                        <p className="mt-2.5 text-xs font-semibold text-slate-400 leading-normal">{card.sub}</p>
                      </div>
                      <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-black cursor-pointer" onClick={card.action}>
                        <span className={`
                          ${card.color === 'cyan' ? 'text-cyan-600 group-hover:text-cyan-700' :
                            card.color === 'emerald' ? 'text-emerald-600 group-hover:text-emerald-700' :
                            'text-indigo-600 group-hover:text-indigo-700'}
                        `}>
                          {card.actionText}
                        </span>
                        <ArrowRight size={13} className={`transform group-hover:translate-x-1 transition-transform ${
                          card.color === 'cyan' ? 'text-cyan-600' :
                          card.color === 'emerald' ? 'text-emerald-600' :
                          'text-indigo-600'
                        }`} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Instructions section */}
              <div className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
                <h3 className="text-base font-extrabold text-slate-900 mb-6 flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-cyan-600" /> Hướng dẫn đặt hàng & nhận sản phẩm
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { step: '01', title: 'Kiểm tra tồn kho khả dụng', desc: 'Chọn mục "Tra cứu tồn kho" để tìm kiếm sản phẩm chính xác và thêm vào giỏ hàng.' },
                    { step: '02', title: 'Xác nhận yêu cầu xuất kho', desc: 'Vào mục "Đặt hàng" điều chỉnh số lượng và bấm xác nhận để hệ thống lưu giữ chỗ.' },
                    { step: '03', title: 'Theo dõi tiến độ đơn hàng', desc: 'Theo dõi trạng thái xử lý thực tế (Soạn hàng, Đóng gói, Xuất kho) tại mục "Theo dõi đơn".' }
                  ].map((item, idx) => (
                    <div key={idx} className="relative space-y-2.5 p-5 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className="text-3xl font-black text-cyan-600/10 absolute right-4 top-4 font-mono">{item.step}</span>
                      <h4 className="font-extrabold text-slate-850 text-sm">{item.title}</h4>
                      <p className="text-xs text-slate-500 leading-relaxed font-semibold">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Stock Lookup Tab */}
          {activeTab === 'stock' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Title & Filter Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                    <Search className="text-cyan-500 animate-pulse" /> Tra cứu tồn kho khả dụng
                  </h2>
                  <p className="text-xs font-bold text-slate-400 mt-1">
                    Cung cấp số lượng hàng thực tế sẵn sàng giao từ kho SmartWMS.
                  </p>
                </div>

                <div className="relative w-full md:w-96">
                  <input 
                    type="text" 
                    placeholder="Tìm kiếm theo mã SKU hoặc tên sản phẩm..." 
                    className="w-full rounded-xl border-2 border-slate-200 py-2.5 pl-10 pr-10 font-bold text-xs transition-all focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500 focus:outline-none"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600">
                      <X size={15} />
                    </button>
                  )}
                </div>
              </div>

              {/* Table wrapper */}
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-slate-800 font-extrabold sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4 uppercase tracking-wider">Mã SKU</th>
                        <th className="px-6 py-4 uppercase tracking-wider">Tên sản phẩm</th>
                        <th className="px-6 py-4 uppercase tracking-wider">Danh mục</th>
                        <th className="px-6 py-4 uppercase tracking-wider text-center">ĐVT</th>
                        <th className="px-6 py-4 uppercase tracking-wider text-right">Khả dụng (Available)</th>
                        <th className="px-6 py-4 uppercase tracking-wider text-center">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredStock.map(item => {
                        const inCart = cart.find(c => c.product.id === item.id);
                        return (
                          <tr key={item.id} className="hover:bg-slate-50/40 transition-colors">
                            <td className="px-6 py-4 font-mono font-bold text-slate-900">{item.internalSku}</td>
                            <td className="px-6 py-4 font-extrabold text-slate-850 text-sm">{item.name}</td>
                            <td className="px-6 py-4 text-[10px] font-bold">
                              <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg">
                                {item.category || 'Mặc định'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center font-bold text-slate-500">{item.unit || '-'}</td>
                            <td className="px-6 py-4 text-right">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full font-bold ${
                                item.available > 10 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                item.available > 0 ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                                'bg-red-50 text-red-700 border border-red-100'
                              }`}>
                                {item.available}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <Button 
                                disabled={item.available <= 0}
                                onClick={() => addToCart(item)}
                                variant={inCart ? 'white' : 'primary'}
                                size="sm"
                                className="px-3.5 py-2 font-bold text-xs"
                              >
                                {inCart ? `Đã thêm (${inCart.qty})` : 'Thêm vào giỏ'}
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredStock.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-16 text-center">
                            <div className="flex flex-col items-center justify-center space-y-3">
                              <div className="bg-slate-100 p-4 rounded-full text-slate-400">
                                <Search size={28} />
                              </div>
                              <p className="text-slate-550 font-black">Không có kết quả tìm kiếm phù hợp</p>
                              <p className="text-[10px] text-slate-400 font-semibold">Thử nhập từ khóa hoặc mã SKU khác.</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Cart & Order Tab */}
          {activeTab === 'order' && (
            <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn">
              <div className="pb-4 border-b border-slate-200">
                <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                  <ShoppingCart className="text-cyan-600" /> Giỏ hàng yêu cầu của bạn
                </h2>
                <p className="text-xs font-bold text-slate-400 mt-1">
                  Kiểm tra chi tiết số lượng sản phẩm trước khi xác nhận gửi đơn.
                </p>
              </div>

              {cart.length === 0 ? (
                <div className="rounded-3xl border border-slate-200 bg-white p-16 text-center space-y-6 shadow-sm">
                  <div className="mx-auto h-16 w-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center text-slate-300">
                    <ShoppingCart size={28} />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-lg font-bold text-slate-700">Giỏ hàng của bạn hiện đang trống</h3>
                    <p className="text-slate-450 text-xs font-semibold max-w-xs mx-auto">
                      Vui lòng xem qua danh sách mặt hàng tồn kho khả dụng để thêm sản phẩm.
                    </p>
                  </div>
                  <Button onClick={() => setActiveTab('stock')} variant="primary" className="px-6 shadow-cyan-600/20">
                    Tra cứu tồn kho khả dụng
                  </Button>
                </div>
              ) : (
                <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
                  {/* Header info */}
                  <div className="p-6 border-b border-slate-100 bg-slate-50/60 flex justify-between items-center">
                    <h3 className="text-xs font-black text-slate-750 uppercase tracking-wider">Chi tiết các mặt hàng ({cart.length})</h3>
                    <button onClick={() => setCart([])} className="text-xs font-bold text-red-500 hover:text-red-700 hover:underline">
                      Hủy toàn bộ giỏ hàng
                    </button>
                  </div>
                  
                  {/* List of items */}
                  <div className="p-6 divide-y divide-slate-100">
                    {cart.map((item, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between py-4 first:pt-0 last:pb-0 gap-4">
                        <div className="space-y-1">
                          <p className="font-extrabold text-slate-900 text-sm">{item.product.name}</p>
                          <p className="text-xs font-bold text-slate-400">
                            Mã SKU: <span className="font-mono text-slate-600">{item.product.internalSku}</span> • Sẵn sàng trong kho: <span className="text-slate-650 font-extrabold">{item.product.available} {item.product.unit}</span>
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-4 self-end sm:self-center">
                          {/* Quantity inputs */}
                          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                            <button 
                              onClick={() => updateCartQty(item.product.id, item.qty - 1)} 
                              className="px-3.5 py-2 bg-white hover:bg-slate-50 font-black text-slate-600 text-xs border-r border-slate-200 transition-colors"
                            >
                              -
                            </button>
                            <span className="px-4 font-black w-14 text-center text-xs text-slate-700 bg-slate-55">{item.qty}</span>
                            <button 
                              onClick={() => updateCartQty(item.product.id, Math.min(item.qty + 1, item.product.available))} 
                              disabled={item.qty >= item.product.available}
                              className="px-3.5 py-2 bg-white hover:bg-slate-50 font-black text-slate-600 text-xs border-l border-slate-200 transition-colors disabled:opacity-50"
                            >
                              +
                            </button>
                          </div>
                          
                          {/* Remove button */}
                          <button 
                            onClick={() => updateCartQty(item.product.id, 0)} 
                            className="p-2 text-red-400 hover:text-red-650 hover:bg-red-50 rounded-xl transition-all"
                            title="Xóa khỏi giỏ"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Submit CTA */}
                  <div className="p-6 border-t border-slate-100 bg-slate-50/80 flex flex-col sm:flex-row gap-4 items-center justify-between">
                    <div className="text-slate-400 font-bold text-xs">
                      * Đơn đặt sẽ được chuyển tiếp ngay tới bộ phận soạn hàng của kho.
                    </div>
                    <Button 
                      onClick={submitOrder}
                      variant="emerald"
                      className="w-full sm:w-auto px-6 py-3 font-extrabold text-xs flex items-center justify-center gap-2 shadow-emerald-600/10"
                    >
                      Gửi yêu cầu xuất kho <ArrowRight size={14} />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tracking Orders Tab */}
          {activeTab === 'tracking' && (
            <div className="max-w-5xl mx-auto space-y-6 animate-fadeIn">
              <div className="pb-4 border-b border-slate-200">
                <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                  <Truck className="text-indigo-500" /> Theo dõi trạng thái đơn hàng
                </h2>
                <p className="text-xs font-bold text-slate-400 mt-1">
                  Kiểm tra tiến trình đóng gói và vận chuyển đơn hàng trực tiếp từ hệ thống.
                </p>
              </div>

              {orders.length === 0 ? (
                <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-slate-450 font-bold">
                  Không tìm thấy lịch sử đơn hàng nào đã tạo trong hệ thống.
                </div>
              ) : (
                <div className="space-y-6">
                  {orders.map(order => (
                    <div key={order.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden">
                      
                      {/* Tracking Header */}
                      <div className="bg-slate-50/70 px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <h3 className="font-extrabold text-slate-900 text-sm">
                            {order.orderNo || `Đơn hàng #${order.id}`}
                          </h3>
                          <p className="text-[10px] text-slate-400 font-bold mt-1">
                            Khởi tạo lúc: {new Date(order.createdAt).toLocaleDateString('vi-VN')} {new Date(order.createdAt).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 self-start sm:self-center">
                          <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest bg-white border border-slate-200 px-2 py-0.5 rounded-lg">
                            TRẠNG THÁI
                          </span>
                          {getStatusBadge(order.status)}
                        </div>
                      </div>
                      
                      {/* Tracking Body */}
                      <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* Products checklist */}
                        <div className="lg:col-span-7 space-y-4">
                          <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Mặt hàng yêu cầu</p>
                          <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto pr-2">
                            {order.details.map(d => (
                              <div key={d.id} className="flex justify-between items-center py-2.5 first:pt-0 last:pb-0">
                                <div>
                                  <p className="text-xs font-black text-slate-800">{d.product?.name || 'Sản phẩm không xác định'}</p>
                                  <p className="text-[9px] font-bold text-slate-450">SKU: {d.product?.internalSku || '-'}</p>
                                </div>
                                <span className="text-xs font-black text-slate-800 whitespace-nowrap bg-slate-50 border border-slate-150 px-2.5 py-1 rounded-lg">
                                  x {d.requiredQty} {d.product?.unit || 'cái'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Progress timeline column */}
                        <div className="lg:col-span-5 bg-slate-50/60 border border-slate-100 p-5 rounded-2xl">
                          <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-4">Nhật ký xử lý đơn</p>
                          <div className="relative pl-6 space-y-5">
                            {/* Vertical Line */}
                            <div className="absolute left-2.5 top-2.5 bottom-2.5 w-0.5 border-l-2 border-dashed border-slate-200"></div>
                            
                            {/* Process step 1 */}
                            <div className="relative z-10 flex items-start gap-3">
                              <div className="w-5 h-5 rounded-full flex items-center justify-center bg-cyan-600 text-white shadow-sm ring-4 ring-cyan-100/50">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </div>
                              <div>
                                <p className="text-xs font-black text-slate-900 leading-none">Đã tiếp nhận yêu cầu</p>
                                <p className="text-[9px] text-slate-450 font-bold mt-1">Hệ thống WMS đã lập phiếu xuất.</p>
                              </div>
                            </div>
                            
                            {/* Process step 2 */}
                            <div className="relative z-10 flex items-start gap-3">
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                                ['picking', 'shipped'].includes(order.status) 
                                  ? 'bg-cyan-600 text-white shadow-sm ring-4 ring-cyan-100/50' 
                                  : 'bg-slate-200 text-slate-400'
                              }`}>
                                {['picking', 'shipped'].includes(order.status) ? (
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                ) : (
                                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full"></span>
                                )}
                              </div>
                              <div>
                                <p className={`text-xs font-black leading-none ${
                                  ['picking', 'shipped'].includes(order.status) ? 'text-slate-900' : 'text-slate-400'
                                }`}>
                                  Đang soạn hàng (Picking)
                                </p>
                                <p className="text-[9px] text-slate-450 font-bold mt-1">Đang phân bổ nhân viên đóng gói.</p>
                              </div>
                            </div>
                            
                            {/* Process step 3 */}
                            <div className="relative z-10 flex items-start gap-3">
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                                order.status === 'shipped' 
                                  ? 'bg-cyan-600 text-white shadow-sm ring-4 ring-cyan-100/50' 
                                  : 'bg-slate-200 text-slate-400'
                              }`}>
                                {order.status === 'shipped' ? (
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                ) : (
                                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full"></span>
                                )}
                              </div>
                              <div>
                                <p className={`text-xs font-black leading-none ${
                                  order.status === 'shipped' ? 'text-slate-900' : 'text-slate-400'
                                }`}>
                                  Đã xuất kho bàn giao
                                </p>
                                <p className="text-[9px] text-slate-450 font-bold mt-1">Hoàn tất bàn giao vận tải.</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </main>

      {/* Mobile Sticky Tab Footer */}
      <nav className="md:hidden shrink-0 border-t border-slate-200 bg-white/95 backdrop-blur-md sticky bottom-0 z-40">
        <div className="flex justify-around py-3 px-2">
          <button 
            onClick={() => setActiveTab('dashboard')} 
            className={`flex flex-col items-center gap-1.5 transition-colors duration-200 ${
              activeTab === 'dashboard' ? 'text-cyan-600 font-bold' : 'text-slate-450'
            }`}
          >
            <LayoutGrid className="h-5 w-5" />
            <span className="text-[9px] font-bold">Tổng quan</span>
          </button>
          <button 
            onClick={() => setActiveTab('stock')} 
            className={`flex flex-col items-center gap-1.5 transition-colors duration-200 ${
              activeTab === 'stock' ? 'text-cyan-600 font-bold' : 'text-slate-450'
            }`}
          >
            <Search className="h-5 w-5" />
            <span className="text-[9px] font-bold">Tồn kho</span>
          </button>
          <button 
            onClick={() => setActiveTab('order')} 
            className={`relative flex flex-col items-center gap-1.5 transition-colors duration-200 ${
              activeTab === 'order' ? 'text-cyan-600 font-bold' : 'text-slate-450'
            }`}
          >
            <ShoppingCart className="h-5 w-5" />
            {cart.length > 0 && (
              <span className="absolute -top-1.5 right-1 h-4.5 w-4.5 rounded-full bg-cyan-600 text-[9px] text-white flex items-center justify-center font-bold ring-2 ring-white">
                {cart.length}
              </span>
            )}
            <span className="text-[9px] font-bold">Lên đơn</span>
          </button>
          <button 
            onClick={() => setActiveTab('tracking')} 
            className={`flex flex-col items-center gap-1.5 transition-colors duration-200 ${
              activeTab === 'tracking' ? 'text-cyan-600 font-bold' : 'text-slate-450'
            }`}
          >
            <Truck className="h-5 w-5" />
            <span className="text-[9px] font-bold">Theo dõi</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
