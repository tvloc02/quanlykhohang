import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Package, ShoppingCart, User, LogOut, CheckCircle2, MapPin, Truck, ShieldCheck, CreditCard } from 'lucide-react';

const Button = ({ children, variant = 'primary', size = 'md', className = '', onClick, disabled }: any) => {
    const baseStyle = "inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";
    const sizes = {
        sm: "px-3 py-1.5 text-sm",
        md: "px-5 py-2.5",
        lg: "px-8 py-4 text-lg"
    };
    const variants = {
        primary: "bg-cyan-600 text-white hover:bg-cyan-700 shadow-lg shadow-cyan-600/30",
        ghost: "text-slate-700 hover:bg-slate-100",
        white: "bg-white text-cyan-700 hover:bg-slate-50 shadow-md",
        outline: "border-2 border-slate-200 text-slate-700 hover:border-cyan-600 hover:text-cyan-600",
    };
    return (
        <button onClick={onClick} disabled={disabled} className={`${baseStyle} ${sizes[size as keyof typeof sizes] || sizes.md} ${variants[variant as keyof typeof variants] || variants.primary} ${className}`}>
            {children}
        </button>
    );
};

interface Product {
  id: string;
  sku: string;
  name: string;
  price?: number;
  stock?: number;
  images?: string[];
}

export default function CartCheckoutPage() {
  const navigate = useNavigate();
  const [cart, setCart] = useState<{product: Product, quantity: number}[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [toast, setToast] = useState<{type: 'success' | 'error', message: string} | null>(null);

  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const token = localStorage.getItem('token');

  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({
    fullName: user?.fullName || '',
    phone: user?.phone || '',
    address: user?.address || ''
  });
  const [updatingAddress, setUpdatingAddress] = useState(false);

  useEffect(() => {
    const savedCart = localStorage.getItem('shop_cart');
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (e) {
        console.error("Failed to parse cart", e);
      }
    }
    setLoading(false);
  }, []);

  const updateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    const newCart = cart.map(item => item.product.id === productId ? { ...item, quantity: newQuantity } : item);
    setCart(newCart);
    localStorage.setItem('shop_cart', JSON.stringify(newCart));
  };

  const removeItem = (productId: string) => {
    const newCart = cart.filter(item => item.product.id !== productId);
    setCart(newCart);
    localStorage.setItem('shop_cart', JSON.stringify(newCart));
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    
    if (!token) {
      setToast({ type: 'error', message: 'Vui lòng đăng nhập để thanh toán.' });
      setTimeout(() => navigate('/login'), 2000);
      return;
    }

    setIsCheckingOut(true);
    try {
      const payload = {
        orderNo: `SO-${Date.now().toString().slice(-6)}`,
        customer: user?.fullName || user?.email?.split('@')[0] || 'Khách vãng lai',
        dueDate: new Date().toISOString().split('T')[0],
        status: 'pending',
        items: cart.length,
        description: 'Đơn đặt hàng từ trang Bán hàng (Shop)',
        details: cart.map(item => ({
          productId: item.product.id,
          requiredQty: item.quantity,
          unitPrice: item.product.price || 0,
        }))
      };

      const response = await fetch('http://localhost:3000/api/outbounds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Lỗi đặt hàng. Vui lòng thử lại.');
      }

      setCart([]);
      localStorage.removeItem('shop_cart');
      setToast({ type: 'success', message: 'Thanh toán thành công! Đơn hàng đã được gửi tới kho.' });
      setTimeout(() => navigate('/shop'), 3000);
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Lỗi hệ thống.' });
      setIsCheckingOut(false);
    }
  };

  const handleLogout = () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/');
  };

  const handleUpdateAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    setUpdatingAddress(true);
    try {
      const res = await fetch(`http://localhost:3000/api/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(profileForm),
      });
      if (!res.ok) throw new Error('Không thể cập nhật thông tin');
      
      const updatedUser = await res.json();
      localStorage.setItem('user', JSON.stringify({ ...user, ...updatedUser }));
      setToast({ type: 'success', message: 'Cập nhật thông tin thành công!' });
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Lỗi hệ thống' });
      setUpdatingAddress(false);
    }
  };

  const cartSubtotal = cart.reduce((total, item) => total + ((item.product.price || 0) * item.quantity), 0);
  const shippingFee = cart.length > 0 ? 30000 : 0;
  const cartTotal = cartSubtotal + shippingFee;

  const containerClass = "w-full mx-auto px-6 md:px-12 lg:px-24 xl:px-40";

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 selection:bg-cyan-200 selection:text-cyan-900">
      {/* Navigation */}
      <nav className="fixed w-full top-0 bg-white/90 backdrop-blur-md border-b border-slate-100 z-50 transition-all">
          <div className={`${containerClass} py-4 flex justify-between items-center`}>
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/shop')}>
                  <div className="bg-cyan-600 text-white rounded-lg p-2 shadow-md">
                      <Package size={24} strokeWidth={2.5} />
                  </div>
                  <h1 className="text-2xl font-black tracking-tight text-slate-900">
                      Smart<span className="text-cyan-600">WMS</span>
                  </h1>
              </div>
              <div className="hidden md:flex gap-6 items-center">
                  <span onClick={() => navigate('/shop')} className="text-sm font-medium text-slate-600 hover:text-cyan-600 cursor-pointer transition">Quay lại Cửa hàng</span>
                  <div className="h-4 w-[1px] bg-slate-200 mx-2"></div>
                  
                  {user ? (
                      <div className="flex items-center gap-4 ml-2">
                          <div 
                            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity" 
                            onClick={() => {
                              setProfileForm({
                                fullName: user.fullName || '',
                                phone: user.phone || '',
                                address: user.address || ''
                              });
                              setAddressModalOpen(true);
                            }}
                            title="Bấm để cập nhật thông tin cá nhân"
                          >
                              <div className="w-8 h-8 rounded-full bg-cyan-100 flex items-center justify-center text-cyan-700">
                                  <User size={16} />
                              </div>
                              <span className="text-sm font-semibold text-slate-800 hover:text-cyan-600 transition-colors">{user.fullName || user.email?.split('@')[0]}</span>
                          </div>
                          <Button onClick={handleLogout} variant="ghost" size="sm" className="text-slate-600 hover:text-red-600 hover:bg-red-50">
                              Đăng xuất
                          </Button>
                      </div>
                  ) : (
                      <>
                          <Button onClick={() => navigate('/login')} variant="ghost" className="text-slate-700 ml-2">
                              Đăng nhập
                          </Button>
                          <Button onClick={() => navigate('/signup')} variant="primary" className="shadow-cyan-600/20">
                              Đăng ký
                          </Button>
                      </>
                  )}
              </div>
          </div>
      </nav>

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-white border border-slate-100 shadow-xl shadow-cyan-900/10 rounded-xl py-3 px-4 flex items-center gap-3 animate-bounce ${toast.type === 'error' ? 'text-red-600' : 'text-cyan-600'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={18} /> : null}
          <span className="font-semibold text-slate-700">{toast.message}</span>
        </div>
      )}

      {/* Main Content */}
      <main className="pt-28 pb-20 lg:pt-36 lg:pb-32">
        <div className={containerClass}>
          <div className="mb-8">
            <h2 className="text-3xl font-black text-slate-900 mb-2">Thanh toán & Đặt hàng</h2>
            <p className="text-slate-600">Xem lại giỏ hàng và điền thông tin để hoàn tất đặt hàng.</p>
          </div>

          {!loading && cart.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center justify-center text-center">
              <ShoppingCart size={64} strokeWidth={1} className="text-slate-300 mb-6" />
              <h3 className="text-xl font-bold text-slate-800 mb-2">Giỏ hàng trống</h3>
              <p className="text-slate-500 mb-8 max-w-md">Bạn chưa chọn sản phẩm nào vào giỏ hàng. Hãy quay lại cửa hàng để khám phá nhé.</p>
              <Button onClick={() => navigate('/shop')} variant="primary" size="lg">Tiếp tục mua sắm</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column: Cart Items & Info */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-2xl border border-slate-200 p-6">
                  <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <ShoppingCart className="text-cyan-600" size={20} /> Danh sách sản phẩm ({cart.reduce((s,i) => s + i.quantity, 0)})
                  </h3>
                  
                  <div className="space-y-6">
                    {cart.map((item, index) => (
                      <div key={item.product.id} className={`flex items-start gap-4 pb-6 ${index !== cart.length - 1 ? 'border-b border-slate-100' : ''}`}>
                        <div className="w-24 h-24 rounded-xl bg-slate-100 overflow-hidden relative flex-shrink-0">
                          {item.product.images?.[0] ? (
                            <img src={item.product.images[0]} alt={item.product.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400">
                              <Package size={32} />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-slate-800 truncate mb-1">{item.product.name}</h4>
                          <p className="text-sm text-slate-500 mb-2">SKU: {item.product.sku}</p>
                          <div className="font-black text-cyan-600 mb-3">{item.product.price?.toLocaleString()}đ</div>
                          
                          <div className="flex items-center gap-4">
                            <div className="flex items-center rounded-lg border border-slate-200">
                              <button onClick={() => updateQuantity(item.product.id, item.quantity - 1)} className="px-3 py-1 text-slate-600 hover:bg-slate-50 rounded-l-lg transition">-</button>
                              <span className="px-4 py-1 font-semibold text-slate-800 border-x border-slate-200 min-w-[3rem] text-center">{item.quantity}</span>
                              <button onClick={() => updateQuantity(item.product.id, item.quantity + 1)} className="px-3 py-1 text-slate-600 hover:bg-slate-50 rounded-r-lg transition">+</button>
                            </div>
                            <button onClick={() => removeItem(item.product.id)} className="text-sm font-medium text-red-500 hover:text-red-600 transition">Xóa bỏ</button>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-black text-slate-800">{((item.product.price || 0) * item.quantity).toLocaleString()}đ</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-6">
                  <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <MapPin className="text-cyan-600" size={20} /> Thông tin giao hàng
                  </h3>
                  {user ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Họ và tên</label>
                        <input type="text" readOnly value={user.fullName || 'Khách hàng'} className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-slate-700 font-medium outline-none" />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Số điện thoại</label>
                        <input type="text" readOnly value={user.phone || 'Chưa cập nhật'} className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-slate-700 font-medium outline-none" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Địa chỉ giao hàng</label>
                        <input type="text" readOnly value={user.address || 'Chưa cập nhật'} className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-slate-700 font-medium outline-none" />
                        {!user.address && <p className="text-xs text-amber-600 mt-2">* Vui lòng cập nhật địa chỉ trong trang cá nhân.</p>}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 bg-slate-50 rounded-xl border border-slate-200">
                      <p className="text-slate-600 mb-4">Bạn cần đăng nhập để hoàn tất thông tin giao hàng.</p>
                      <Button onClick={() => navigate('/login')} variant="white">Đăng nhập ngay</Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Order Summary */}
              <div className="space-y-6">
                <div className="bg-white rounded-2xl border border-slate-200 p-6 sticky top-28 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-800 mb-6">Tổng quan đơn hàng</h3>
                  
                  <div className="space-y-4 mb-6">
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Tạm tính</span>
                      <span className="font-semibold text-slate-800">{cartSubtotal.toLocaleString()}đ</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Phí vận chuyển</span>
                      <span className="font-semibold text-slate-800">{shippingFee.toLocaleString()}đ</span>
                    </div>
                    <div className="border-t border-slate-100 pt-4 flex justify-between items-center">
                      <span className="font-black text-slate-800 text-lg">Tổng cộng</span>
                      <span className="font-black text-cyan-600 text-2xl">{cartTotal.toLocaleString()}đ</span>
                    </div>
                  </div>

                  <div className="bg-cyan-50 rounded-xl p-4 mb-6 text-sm text-cyan-800 flex gap-3">
                    <Truck className="flex-shrink-0" size={20} />
                    <span>Dự kiến giao hàng trong 2-3 ngày làm việc đối với khu vực nội thành.</span>
                  </div>

                  <Button onClick={handleCheckout} disabled={isCheckingOut || !user} className="w-full mb-4" size="lg">
                    {isCheckingOut ? 'Đang xử lý...' : 'Xác nhận đặt hàng'}
                  </Button>

                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                      <ShieldCheck size={16} className="text-emerald-500" />
                      <span>Thanh toán an toàn, bảo mật</span>
                    </div>
                    <div className="flex justify-center gap-2">
                      <div className="w-10 h-6 bg-slate-100 rounded border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-400">COD</div>
                      <div className="w-10 h-6 bg-slate-100 rounded border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-400"><CreditCard size={14}/></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 pt-12 pb-10">
          <div className={containerClass}>
              <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-slate-500">
                  <div className="flex items-center gap-2">
                      <Package size={18} className="text-cyan-600" />
                      <span className="font-bold text-slate-800">SmartWMS</span>
                  </div>
                  <p>&copy; 2026 SmartWMS. Mọi quyền được bảo lưu.</p>
              </div>
          </div>
      </footer>

      {/* Address Modal */}
      {addressModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm transition-all">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="border-b-2 border-slate-100 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">Cập nhật thông tin cá nhân</h2>
              <button type="button" onClick={() => setAddressModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <span className="sr-only">Đóng</span>
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleUpdateAddress} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Họ và tên</label>
                <input
                  type="text"
                  value={profileForm.fullName}
                  onChange={e => setProfileForm(prev => ({...prev, fullName: e.target.value}))}
                  className="w-full h-12 rounded-xl border-2 border-slate-200 px-4 text-slate-700 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                  placeholder="Nhập họ và tên..."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Số điện thoại</label>
                <input
                  type="text"
                  value={profileForm.phone}
                  onChange={e => setProfileForm(prev => ({...prev, phone: e.target.value}))}
                  className="w-full h-12 rounded-xl border-2 border-slate-200 px-4 text-slate-700 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                  placeholder="Nhập số điện thoại..."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Địa chỉ giao hàng</label>
                <textarea
                  value={profileForm.address}
                  onChange={e => setProfileForm(prev => ({...prev, address: e.target.value}))}
                  className="w-full h-24 rounded-xl border-2 border-slate-200 p-4 text-slate-700 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                  placeholder="Nhập địa chỉ của bạn..."
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="ghost" onClick={() => setAddressModalOpen(false)} type="button">Hủy</Button>
                <Button type="submit" disabled={updatingAddress}>
                  {updatingAddress ? 'Đang lưu...' : 'Lưu thông tin'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
