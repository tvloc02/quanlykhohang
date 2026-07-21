import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, ShoppingCart, Star, Search, User, LogOut, X, CheckCircle2 } from 'lucide-react';

const Button = ({ children, variant = 'primary', size = 'md', className = '', onClick }: any) => {
    const baseStyle = "inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 active:scale-95";
    const sizes = {
        sm: "px-3 py-1.5 text-sm",
        md: "px-5 py-2.5",
        lg: "px-8 py-4 text-lg"
    };
    const variants = {
        primary: "bg-cyan-600 text-white hover:bg-cyan-700 shadow-lg shadow-cyan-600/30",
        ghost: "text-slate-700 hover:bg-slate-100",
        white: "bg-white text-cyan-700 hover:bg-slate-50 shadow-md",
    };
    return (
        <button onClick={onClick} className={`${baseStyle} ${sizes[size as keyof typeof sizes] || sizes.md} ${variants[variant as keyof typeof variants] || variants.primary} ${className}`}>
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
  isVisible?: boolean;
}

export default function Shop() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<{product: Product, quantity: number}[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [toast, setToast] = useState<{type: 'success' | 'error', message: string} | null>(null);

  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
<<<<<<< HEAD
  const user = (token && userStr) ? JSON.parse(userStr) : null;
=======
  const user = userStr ? JSON.parse(userStr) : null;
  const token = localStorage.getItem('token');

  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({
    fullName: user?.fullName || '',
    phone: user?.phone || '',
    address: user?.address || ''
  });
  const [updatingAddress, setUpdatingAddress] = useState(false);
>>>>>>> 106e73923c2c22fc40123e756592163c017845ff

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

  const handleAddToCart = (product: Product) => {
    let newCart: any;
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        newCart = prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      } else {
        newCart = [...prev, { product, quantity: 1 }];
      }
      localStorage.setItem('shop_cart', JSON.stringify(newCart));
      return newCart;
    });
    setToast({ type: 'success', message: `Đã thêm ${product.name} vào giỏ hàng!` });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const savedCart = localStorage.getItem('shop_cart');
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (e) {
        console.error("Failed to parse cart", e);
      }
    }
  }, []);

  // Lấy cấu hình bán hàng (Mock)
  const storeConfig = {
    bannerUrl: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=2070&auto=format&fit=crop',
    bannerTitle: 'Khám phá sản phẩm của chúng tôi',
    bannerSubtitle: 'Chất lượng hàng đầu - Giá cả cạnh tranh',
    showCategories: true,
  };

  useEffect(() => {
    // Fetch danh sách sản phẩm từ kho (mẫu)
    fetch('http://localhost:3000/api/products')
      .then(res => res.json())
      .then(data => {
        setProducts(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filteredProducts = products.filter(p => 
    p.isVisible && 
    (p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.sku.toLowerCase().includes(search.toLowerCase()))
  );

  const containerClass = "w-full mx-auto px-6 md:px-12 lg:px-24 xl:px-40";

  return (
    <div className="min-h-screen bg-white font-sans text-slate-800 selection:bg-cyan-200 selection:text-cyan-900">
      
      {/* Navigation (Same as Home.tsx) */}
      <nav className="fixed w-full top-0 bg-white/90 backdrop-blur-md border-b border-slate-100 z-50 transition-all">
          <div className={`${containerClass} py-4 flex justify-between items-center`}>
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
                  <div className="bg-cyan-600 text-white rounded-lg p-2 shadow-md">
                      <Package size={24} strokeWidth={2.5} />
                  </div>
                  <h1 className="text-2xl font-black tracking-tight text-slate-900">
                      Smart<span className="text-cyan-600">WMS</span>
                  </h1>
              </div>
              <div className="hidden md:flex gap-6 items-center">
                  <span onClick={() => navigate('/shop')} className="text-sm font-bold text-cyan-600 cursor-pointer">Bán hàng</span>
                  <a href="#" className="text-sm font-medium text-slate-600 hover:text-cyan-600 transition">Giải pháp</a>
                  <a href="#" className="text-sm font-medium text-slate-600 hover:text-cyan-600 transition">Tính năng</a>
                  <a href="#" className="text-sm font-medium text-slate-600 hover:text-cyan-600 transition">Tài liệu API</a>
                  <div className="h-4 w-[1px] bg-slate-200 mx-2"></div>
                  
                  <div className="relative">
                    <button onClick={() => navigate('/cart')} className="relative p-2 text-slate-600 hover:text-cyan-600 transition-colors">
                      <ShoppingCart size={22} />
                      {cart.length > 0 && (
                        <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                          {cart.reduce((sum, item) => sum + item.quantity, 0)}
                        </span>
                      )}
                    </button>
                  </div>

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
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-white border border-slate-100 shadow-xl shadow-cyan-900/10 rounded-xl py-3 px-4 flex items-center gap-3 animate-bounce">
          {toast.type === 'success' ? (
            <div className="w-8 h-8 rounded-full bg-cyan-100 flex items-center justify-center text-cyan-600">
              <CheckCircle2 size={18} />
            </div>
          ) : null}
          <span className="font-semibold text-slate-700">{toast.message}</span>
        </div>
      )}

      {/* Main Content */}
      <main className="pt-24 pb-20 lg:pt-32 lg:pb-32 bg-slate-50 min-h-[80vh]">
        <div className={containerClass}>
          
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-3xl font-black text-slate-900">{storeConfig.bannerTitle}</h2>
              <p className="text-slate-600">{storeConfig.bannerSubtitle}</p>
            </div>
            <div className="w-full md:w-auto relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Tìm kiếm sản phẩm..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full md:w-72 pl-10 pr-4 py-2 bg-white border border-slate-200 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 rounded-xl transition-all outline-none"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
              <Package className="mx-auto h-12 w-12 text-slate-300 mb-4" />
              <p className="text-lg font-medium text-slate-600">Không tìm thấy sản phẩm nào.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredProducts.map((product) => (
                <div key={product.id} className="bg-white rounded-2xl overflow-hidden border border-slate-200 hover:shadow-xl hover:shadow-cyan-900/5 transition-all duration-300 group cursor-pointer">
                  <div className="aspect-square bg-slate-100 relative overflow-hidden">
                    {product.images?.[0] ? (
                      <img src={product.images[0]} alt={product.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-slate-400 group-hover:scale-110 transition-transform duration-500">
                        <Package size={64} strokeWidth={1} />
                      </div>
                    )}
                    <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg text-xs font-bold text-slate-700 shadow-sm">
                      {product.sku}
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-slate-800 line-clamp-2 leading-tight group-hover:text-cyan-600 transition-colors">
                        {product.name}
                      </h4>
                    </div>
                    <div className="flex items-center gap-1 mb-4">
                      {[1,2,3,4,5].map(i => <Star key={i} size={14} className="fill-amber-400 text-amber-400" />)}
                      <span className="text-xs text-slate-500 ml-1">(12)</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-lg font-black text-cyan-600">{product.price ? product.price.toLocaleString() + 'đ' : 'Liên hệ'}</span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleAddToCart(product); }}
                        className="h-9 w-9 rounded-full bg-cyan-50 flex items-center justify-center text-cyan-600 hover:bg-cyan-600 hover:text-white transition-all shadow-sm"
                      >
                        <ShoppingCart size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer (Same as Home.tsx) */}
      <footer className="bg-white border-t border-slate-200 pt-20 pb-10">
          <div className={containerClass}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 mb-16">
                  <div className="lg:col-span-2">
                      <div className="flex items-center gap-3 mb-6">
                          <div className="bg-cyan-600 text-white rounded-lg p-2">
                              <Package size={24} />
                          </div>
                          <h4 className="text-2xl font-black text-slate-900">SmartWMS</h4>
                      </div>
                      <p className="text-slate-500 mb-6 max-w-sm leading-relaxed text-sm">
                          Nền tảng quản lý kho hàng doanh nghiệp chuyên biệt. Tối ưu vận hành, kiểm soát chặt chẽ rủi ro bằng công nghệ lõi mạnh mẽ.
                      </p>
                  </div>

                  <div>
                      <h4 className="text-sm font-bold text-slate-900 mb-6 uppercase tracking-wider">Sản phẩm</h4>
                      <ul className="space-y-3 text-sm text-slate-500">
                          <li><a href="#" className="hover:text-cyan-600 transition-colors">Tính năng cốt lõi</a></li>
                          <li><a href="#" className="hover:text-cyan-600 transition-colors">Kiến trúc hệ thống</a></li>
                          <li><a href="#" className="hover:text-cyan-600 transition-colors">Tài liệu API</a></li>
                          <li><a href="#" className="hover:text-cyan-600 transition-colors">Bảo mật (Security)</a></li>
                      </ul>
                  </div>

                  <div>
                      <h4 className="text-sm font-bold text-slate-900 mb-6 uppercase tracking-wider">Công ty</h4>
                      <ul className="space-y-3 text-sm text-slate-500">
                          <li><a href="#" className="hover:text-cyan-600 transition-colors">Về chúng tôi</a></li>
                          <li><a href="#" className="hover:text-cyan-600 transition-colors">Khách hàng</a></li>
                          <li><a href="#" className="hover:text-cyan-600 transition-colors">Blog kỹ thuật</a></li>
                          <li><a href="#" className="hover:text-cyan-600 transition-colors">Liên hệ</a></li>
                      </ul>
                  </div>

                  <div>
                      <h4 className="text-sm font-bold text-slate-900 mb-6 uppercase tracking-wider">Pháp lý</h4>
                      <ul className="space-y-3 text-sm text-slate-500">
                          <li><a href="#" className="hover:text-cyan-600 transition-colors">Điều khoản dịch vụ</a></li>
                          <li><a href="#" className="hover:text-cyan-600 transition-colors">Chính sách bảo mật</a></li>
                          <li><a href="#" className="hover:text-cyan-600 transition-colors">SLA</a></li>
                      </ul>
                  </div>
              </div>

              <div className="border-t border-slate-200 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-slate-400">
                  <p>&copy; 2026 SmartWMS Technologies. All rights reserved.</p>
                  <div className="flex gap-6">
                      <a href="#" className="hover:text-slate-900 transition-colors">Twitter</a>
                      <a href="#" className="hover:text-slate-900 transition-colors">LinkedIn</a>
                      <a href="#" className="hover:text-slate-900 transition-colors">GitHub</a>
                  </div>
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
