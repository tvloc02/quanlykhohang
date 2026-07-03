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
      pending: { label: 'Chờ xử lý', color: 'bg-yellow-100 text-yellow-800' },
      picking: { label: 'Đang nhặt hàng', color: 'bg-blue-100 text-blue-800' },
      shipped: { label: 'Đã xuất kho', color: 'bg-green-100 text-green-800' }
    };
    const mapped = map[status] || { label: status, color: 'bg-gray-100 text-gray-800' };
    return <span className={`px-2 py-1 rounded-full text-xs font-semibold ${mapped.color}`}>{mapped.label}</span>;
  };

  if (loading) return <div className="flex items-center justify-center h-screen text-slate-500 font-bold">Đang tải Customer Portal...</div>;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50 font-sans">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border font-bold text-sm bg-white ${toast.type === 'success' ? 'border-emerald-200 text-emerald-600' : 'border-red-200 text-red-600'}`}>
          <CheckCircle2 className="h-5 w-5" />
          {toast.message}
        </div>
      )}

      {/* Header */}
      <header className="shrink-0 border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-100 text-cyan-600">
              <User className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">{profile?.name || 'Khách hàng'}</h1>
              <p className="text-sm font-semibold text-slate-500">
                {profile?.type === 'B2B' ? 'Khách hàng Doanh nghiệp' : 'Khách hàng Cá nhân'} • {profile?.customerCode}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={() => setActiveTab('dashboard')} className={`hidden md:flex items-center gap-2 px-4 py-2 rounded-xl border-2 font-bold text-sm transition-all ${activeTab === 'dashboard' ? 'bg-cyan-50 border-cyan-200 text-cyan-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
               <LayoutGrid className="h-4 w-4" /> Tổng quan
             </button>
             <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-slate-200 font-bold text-sm text-slate-600 hover:bg-slate-50 transition-all">
              <LogOut className="h-4 w-4" /> Đăng xuất
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
        
        {activeTab === 'dashboard' && (
          <div className="max-w-6xl mx-auto space-y-6">
            <h2 className="text-2xl font-black text-slate-800 mb-6">Xin chào, {profile?.name}!</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              <div 
                onClick={() => setActiveTab('stock')}
                className="group cursor-pointer rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-cyan-400 hover:shadow-md"
              >
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 group-hover:bg-cyan-600 group-hover:text-white transition-colors">
                  <Search className="h-7 w-7" />
                </div>
                <h3 className="text-lg font-bold text-slate-800">Tra cứu tồn kho</h3>
                <p className="mt-2 text-sm text-slate-500 font-medium">Kiểm tra số lượng hàng hóa thực tế có sẵn trong kho hệ thống.</p>
                <div className="mt-4 flex items-center text-sm font-bold text-cyan-600">
                  Khám phá <ArrowRight className="ml-1 h-4 w-4" />
                </div>
              </div>

              <div 
                onClick={() => setActiveTab('order')}
                className="group cursor-pointer rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-emerald-400 hover:shadow-md"
              >
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <ShoppingCart className="h-7 w-7" />
                </div>
                <h3 className="text-lg font-bold text-slate-800">Đặt hàng</h3>
                <p className="mt-2 text-sm text-slate-500 font-medium">Lên đơn xuất kho, hệ thống sẽ giữ hàng ngay khi đơn được gửi.</p>
                <div className="mt-4 flex items-center text-sm font-bold text-emerald-600">
                  Tạo đơn ngay <ArrowRight className="ml-1 h-4 w-4" />
                </div>
              </div>

              <div 
                onClick={() => setActiveTab('tracking')}
                className="group cursor-pointer rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-indigo-400 hover:shadow-md"
              >
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <Truck className="h-7 w-7" />
                </div>
                <h3 className="text-lg font-bold text-slate-800">Theo dõi đơn hàng</h3>
                <p className="mt-2 text-sm text-slate-500 font-medium">Xem tiến độ xử lý: Đã tiếp nhận, Đang nhặt hàng, Đã xuất kho.</p>
                <div className="mt-4 flex items-center text-sm font-bold text-indigo-600">
                  Xem chi tiết <ArrowRight className="ml-1 h-4 w-4" />
                </div>
              </div>

            </div>
          </div>
        )}

        {activeTab === 'stock' && (
          <div className="max-w-6xl mx-auto flex flex-col h-full">
            <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                <Search className="text-cyan-500" /> Tra cứu tồn kho
              </h2>
              <div className="relative w-full md:w-96">
                <input 
                  type="text" 
                  placeholder="Tìm kiếm sản phẩm..." 
                  className="w-full rounded-xl border-2 border-slate-200 py-2.5 pl-10 pr-4 font-medium focus:border-cyan-500 focus:outline-none"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
              </div>
            </div>

            <div className="flex-1 overflow-auto rounded-2xl border-2 border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-slate-800 font-bold sticky top-0 border-b-2 border-slate-200">
                  <tr>
                    <th className="px-6 py-4">Mã SP</th>
                    <th className="px-6 py-4">Tên sản phẩm</th>
                    <th className="px-6 py-4">Danh mục</th>
                    <th className="px-6 py-4 text-center">ĐVT</th>
                    <th className="px-6 py-4 text-right">Sẵn sàng bán (Available)</th>
                    <th className="px-6 py-4 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStock.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-bold text-slate-900">{item.internalSku}</td>
                      <td className="px-6 py-4 font-semibold">{item.name}</td>
                      <td className="px-6 py-4">{item.category || '-'}</td>
                      <td className="px-6 py-4 text-center">{item.unit || '-'}</td>
                      <td className="px-6 py-4 text-right">
                        <span className={`inline-block px-3 py-1 rounded-full font-bold ${item.available > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {item.available}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                         <button 
                          disabled={item.available <= 0}
                          onClick={() => addToCart(item)}
                          className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-bold text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Thêm vào giỏ
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredStock.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-slate-500 font-semibold">
                        Không tìm thấy sản phẩm nào.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'order' && (
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-2">
              <ShoppingCart className="text-emerald-500" /> Giỏ hàng & Lên đơn
            </h2>

            {cart.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
                <ShoppingCart className="mx-auto h-12 w-12 text-slate-300 mb-4" />
                <h3 className="text-lg font-bold text-slate-600">Giỏ hàng rỗng</h3>
                <p className="mt-2 text-slate-500 mb-6">Hãy tra cứu tồn kho và thêm sản phẩm vào giỏ hàng để lên đơn.</p>
                <button onClick={() => setActiveTab('stock')} className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-xl transition-colors">
                  Đến Tra cứu tồn kho
                </button>
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-200">
                  <h3 className="text-lg font-bold text-slate-800">Chi tiết sản phẩm</h3>
                </div>
                <div className="p-6 space-y-4">
                  {cart.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50">
                      <div>
                        <p className="font-bold text-slate-900">{item.product.name}</p>
                        <p className="text-xs font-semibold text-slate-500">Mã: {item.product.internalSku} • Tồn khả dụng: {item.product.available}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden">
                           <button onClick={() => updateCartQty(item.product.id, item.qty - 1)} className="px-3 py-1 bg-slate-50 hover:bg-slate-100 font-bold text-slate-600">-</button>
                           <span className="px-4 font-bold w-12 text-center text-sm">{item.qty}</span>
                           <button 
                             onClick={() => updateCartQty(item.product.id, Math.min(item.qty + 1, item.product.available))} 
                             disabled={item.qty >= item.product.available}
                             className="px-3 py-1 bg-slate-50 hover:bg-slate-100 font-bold text-slate-600 disabled:opacity-50"
                           >
                             +
                           </button>
                        </div>
                        <button onClick={() => updateCartQty(item.product.id, 0)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-6 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                   <div className="text-sm font-bold text-slate-600">Tổng cộng: {cart.length} sản phẩm</div>
                   <button 
                     onClick={submitOrder}
                     className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-emerald-200 flex items-center gap-2"
                   >
                     Gửi yêu cầu xuất kho <ArrowRight className="h-4 w-4" />
                   </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'tracking' && (
          <div className="max-w-5xl mx-auto h-full flex flex-col">
            <h2 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-2">
              <Truck className="text-indigo-500" /> Theo dõi đơn hàng
            </h2>

            <div className="flex-1 overflow-auto rounded-2xl border-2 border-slate-200 bg-white shadow-sm p-6">
              {orders.length === 0 ? (
                <div className="text-center text-slate-500 font-medium py-12">Chưa có đơn hàng nào.</div>
              ) : (
                <div className="space-y-6">
                  {orders.map(order => (
                    <div key={order.id} className="border-2 border-slate-100 rounded-xl p-5 hover:border-slate-200 transition-colors">
                       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-100">
                          <div>
                            <h3 className="font-bold text-slate-900 text-lg">{order.orderNo || `Đơn hàng #${order.id}`}</h3>
                            <p className="text-sm text-slate-500 font-medium mt-1">Ngày tạo: {new Date(order.createdAt).toLocaleDateString('vi-VN')}</p>
                          </div>
                          <div>{getStatusBadge(order.status)}</div>
                       </div>
                       
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                             <p className="text-xs font-bold text-slate-500 uppercase mb-2">Chi tiết sản phẩm</p>
                             <ul className="space-y-2">
                               {order.details.map(d => (
                                 <li key={d.id} className="text-sm text-slate-700 font-medium flex justify-between">
                                   <span className="truncate pr-4">{d.product?.name || 'Sản phẩm không xác định'}</span>
                                   <span className="font-bold whitespace-nowrap">x {d.requiredQty} {d.product?.unit}</span>
                                 </li>
                               ))}
                             </ul>
                          </div>
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                             <p className="text-xs font-bold text-slate-500 uppercase mb-3">Tiến độ xử lý</p>
                             <div className="relative pl-6 space-y-4">
                               <div className="absolute left-2.5 top-2 bottom-2 w-0.5 bg-slate-200"></div>
                               
                               <div className="relative z-10 flex items-center gap-3">
                                  <div className="w-5 h-5 rounded-full flex items-center justify-center bg-cyan-500 text-white"><CheckCircle2 className="w-3 h-3" /></div>
                                  <p className="text-sm font-bold text-slate-900">Đã tiếp nhận yêu cầu</p>
                               </div>
                               
                               <div className="relative z-10 flex items-center gap-3">
                                  <div className={`w-5 h-5 rounded-full flex items-center justify-center ${['picking', 'shipped'].includes(order.status) ? 'bg-cyan-500 text-white' : 'bg-slate-200'}`}>
                                    {['picking', 'shipped'].includes(order.status) && <CheckCircle2 className="w-3 h-3" />}
                                  </div>
                                  <p className={`text-sm font-bold ${['picking', 'shipped'].includes(order.status) ? 'text-slate-900' : 'text-slate-400'}`}>Đang nhặt hàng (Picking)</p>
                               </div>
                               
                               <div className="relative z-10 flex items-center gap-3">
                                  <div className={`w-5 h-5 rounded-full flex items-center justify-center ${order.status === 'shipped' ? 'bg-cyan-500 text-white' : 'bg-slate-200'}`}>
                                    {order.status === 'shipped' && <CheckCircle2 className="w-3 h-3" />}
                                  </div>
                                  <p className={`text-sm font-bold ${order.status === 'shipped' ? 'text-slate-900' : 'text-slate-400'}`}>Đã xuất kho</p>
                               </div>
                             </div>
                          </div>
                       </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </main>

      {/* Footer Navigation (Mobile) */}
      <nav className="md:hidden shrink-0 border-t border-slate-200 bg-white">
        <div className="flex justify-around p-3">
          <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center gap-1 ${activeTab === 'dashboard' ? 'text-cyan-600' : 'text-slate-400'}`}>
            <LayoutGrid className="h-5 w-5" />
            <span className="text-[10px] font-bold">Tổng quan</span>
          </button>
          <button onClick={() => setActiveTab('stock')} className={`flex flex-col items-center gap-1 ${activeTab === 'stock' ? 'text-cyan-600' : 'text-slate-400'}`}>
            <Search className="h-5 w-5" />
            <span className="text-[10px] font-bold">Tồn kho</span>
          </button>
          <button onClick={() => setActiveTab('order')} className={`relative flex flex-col items-center gap-1 ${activeTab === 'order' ? 'text-emerald-600' : 'text-slate-400'}`}>
            <ShoppingCart className="h-5 w-5" />
            {cart.length > 0 && <span className="absolute -top-1 right-2 h-4 w-4 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center">{cart.length}</span>}
            <span className="text-[10px] font-bold">Lên đơn</span>
          </button>
          <button onClick={() => setActiveTab('tracking')} className={`flex flex-col items-center gap-1 ${activeTab === 'tracking' ? 'text-indigo-600' : 'text-slate-400'}`}>
            <Truck className="h-5 w-5" />
            <span className="text-[10px] font-bold">Theo dõi</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
