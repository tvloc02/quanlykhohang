import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Package, 
  ShoppingCart, 
  User, 
  MapPin, 
  Lock, 
  ShoppingBag, 
  LogOut, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  EyeOff, 
  Plus, 
  Trash2, 
  ShieldCheck, 
  ArrowLeft,
  Calendar,
  Phone,
  Mail
} from 'lucide-react';

const API_BASE_URL = 'http://localhost:3000/api';

function getStoredUser() {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function ShopUserProfilePage() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const [user, setUser] = useState<any>(getStoredUser());
  const [activeTab, setActiveTab] = useState<'profile' | 'addresses' | 'password' | 'orders'>('profile');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Profile Form State
  const [profileForm, setProfileForm] = useState({
    fullName: user?.fullName || '',
    email: user?.email || '',
    phone: user?.phone || '',
    birthDate: user?.birthDate || '',
    gender: user?.gender || 'male',
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // Address State
  const [addresses, setAddresses] = useState<Array<{ id: string; name: string; phone: string; address: string; isDefault: boolean }>>([
    {
      id: 'default-1',
      name: user?.fullName || 'Khách hàng',
      phone: user?.phone || '0901234567',
      address: user?.address || 'Số 123 Đường Kho Hàng, Q. Cầu Giấy, Hà Nội',
      isDefault: true,
    }
  ]);
  const [newAddrOpen, setNewAddrOpen] = useState(false);
  const [newAddrForm, setNewAddrForm] = useState({ name: '', phone: '', address: '' });

  // Password Form State
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState({ current: false, new: false, confirm: false });
  const [savingPassword, setSavingPassword] = useState(false);

  // Orders State
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Cart quantity count
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      const savedCart = JSON.parse(localStorage.getItem('shop_cart') || '[]');
      setCartCount(savedCart.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0));
    } catch {
      setCartCount(0);
    }

    if (user?.id) {
      fetch(`${API_BASE_URL}/users/${user.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data) {
            setUser((prev: any) => ({ ...prev, ...data }));
            setProfileForm({
              fullName: data.fullName || '',
              email: data.email || '',
              phone: data.phone || '',
              birthDate: data.birthDate || '',
              gender: data.gender || 'male',
            });
            if (data.address) {
              setAddresses(prev => prev.map(a => a.isDefault ? { ...a, address: data.address, phone: data.phone || a.phone } : a));
            }
          }
        })
        .catch(err => console.error(err));
    }

    setLoadingOrders(true);
    fetch(`${API_BASE_URL}/outbounds`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (Array.isArray(data)) {
          setOrders(data);
        }
      })
      .catch(() => setOrders([]))
      .finally(() => setLoadingOrders(false));
  }, [token, navigate]);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    setSavingProfile(true);
    try {
      const res = await fetch(`${API_BASE_URL}/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(profileForm),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.message || 'Không thể cập nhật thông tin');
      }

      const updated = await res.json();
      const updatedUser = { ...user, ...updated, ...profileForm };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      showToast('success', 'Đã cập nhật thông tin cá nhân thành công!');
    } catch (err: any) {
      showToast('error', err.message || 'Lỗi khi lưu thông tin cá nhân');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddrForm.name || !newAddrForm.phone || !newAddrForm.address) {
      showToast('error', 'Vui lòng điền đầy đủ thông tin địa chỉ.');
      return;
    }

    const newAddr = {
      id: `addr-${Date.now()}`,
      name: newAddrForm.name,
      phone: newAddrForm.phone,
      address: newAddrForm.address,
      isDefault: addresses.length === 0,
    };

    setAddresses(prev => [...prev, newAddr]);
    setNewAddrForm({ name: '', phone: '', address: '' });
    setNewAddrOpen(false);
    showToast('success', 'Thêm địa chỉ giao hàng thành công!');
  };

  const handleDeleteAddress = (id: string) => {
    setAddresses(prev => prev.filter(a => a.id !== id));
    showToast('success', 'Đã xóa địa chỉ giao hàng.');
  };

  const handleSetDefaultAddress = (id: string) => {
    setAddresses(prev => prev.map(a => ({ ...a, isDefault: a.id === id })));
    showToast('success', 'Đã đặt địa chỉ mặc định thành công.');
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      showToast('error', 'Vui lòng nhập đầy đủ thông tin mật khẩu.');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showToast('error', 'Mật khẩu mới và xác nhận mật khẩu không khớp.');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      showToast('error', 'Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }

    setSavingPassword(true);
    try {
      const res = await fetch(`${API_BASE_URL}/profile/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Đổi mật khẩu thất bại. Kiểm tra lại mật khẩu cũ.');
      }

      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      showToast('success', 'Đổi mật khẩu thành công!');
    } catch (err: any) {
      showToast('error', err.message || 'Có lỗi xảy ra khi đổi mật khẩu');
    } finally {
      setSavingPassword(false);
    }
  };

  const isGoogleAuth = user?.authProvider === 'google' || user?.isGoogleAuth || false;
  const containerClass = "w-full mx-auto px-6 md:px-12 lg:px-24 xl:px-40";

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 tracking-normal antialiased">
      
      {/* NAVBAR HEADER */}
      <nav className="fixed w-full top-0 bg-white/90 backdrop-blur-md border-b border-slate-200 z-50 transition-all shadow-xs">
        <div className={`${containerClass} py-4 flex justify-between items-center`}>
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/shop')}>
            <div className="bg-cyan-600 text-white rounded-xl p-2.5 shadow-md">
              <Package size={22} strokeWidth={2} />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Smart<span className="text-cyan-600">WMS</span>
            </h1>
          </div>

          <div className="hidden md:flex gap-6 items-center">
            <button 
              onClick={() => navigate('/shop')} 
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-cyan-600 transition"
            >
              <ArrowLeft size={16} />
              Quay lại Cửa hàng
            </button>
            
            <div className="h-4 w-[1px] bg-slate-200 mx-1"></div>

            <button onClick={() => navigate('/cart')} className="relative p-2 text-slate-600 hover:text-cyan-600 transition-colors">
              <ShoppingCart size={20} />
              {cartCount > 0 && (
                <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs font-semibold rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>

            <div className="flex items-center gap-3 ml-2">
              <div className="w-8 h-8 rounded-full bg-cyan-100 border border-cyan-400 flex items-center justify-center font-bold text-cyan-800 text-sm">
                {(user?.fullName || user?.email || 'U')[0].toUpperCase()}
              </div>
              <span className="text-sm font-semibold text-slate-800">{user?.fullName || user?.email?.split('@')[0]}</span>
              <button 
                onClick={handleLogout} 
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
              >
                <LogOut size={15} />
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* TOAST NOTIFICATION */}
      {toast && (
        <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-[100] bg-white border shadow-xl rounded-2xl py-3 px-5 flex items-center gap-3 animate-bounce ${toast.type === 'error' ? 'border-red-200 text-red-600' : 'border-emerald-200 text-emerald-700'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
          <span className="font-semibold text-sm">{toast.message}</span>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <main className="pt-28 pb-20 lg:pt-36 lg:pb-32">
        <div className={containerClass}>
          
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900">Trang cá nhân của tôi</h2>
            <p className="text-slate-500 text-sm mt-1">Quản lý thông tin hồ sơ, sổ địa chỉ giao hàng và mật khẩu bảo mật của tài khoản.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            
            {/* LEFT TAB NAVIGATION SIDEBAR */}
            <div className="lg:col-span-1 space-y-2">
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-1 sticky top-28">
                <div className="flex items-center gap-3 p-3 mb-3 border-b border-slate-100 pb-4">
                  <div className="w-11 h-11 rounded-xl bg-cyan-100 text-cyan-800 font-bold text-lg flex items-center justify-center">
                    {(user?.fullName || user?.email || 'U')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-800 text-sm truncate">{user?.fullName || 'Tài khoản'}</p>
                    <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('profile')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                    activeTab === 'profile'
                      ? 'bg-cyan-600 text-white font-semibold shadow-md shadow-cyan-600/20'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <User size={18} />
                  <span>Thông tin cá nhân</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('addresses')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                    activeTab === 'addresses'
                      ? 'bg-cyan-600 text-white font-semibold shadow-md shadow-cyan-600/20'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <MapPin size={18} />
                  <span>Sổ địa chỉ nhận hàng</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('password')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                    activeTab === 'password'
                      ? 'bg-cyan-600 text-white font-semibold shadow-md shadow-cyan-600/20'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Lock size={18} />
                  <span>Đổi mật khẩu</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('orders')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                    activeTab === 'orders'
                      ? 'bg-cyan-600 text-white font-semibold shadow-md shadow-cyan-600/20'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <ShoppingBag size={18} />
                  <span>Đơn hàng của tôi</span>
                </button>
              </div>
            </div>

            {/* RIGHT CONTENT TAB PANEL */}
            <div className="lg:col-span-3">
              
              {/* TAB 1: THÔNG TIN CÁ NHÂN */}
              {activeTab === 'profile' && (
                <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs">
                  <div className="border-b border-slate-100 pb-4 mb-6">
                    <h3 className="text-lg font-bold text-slate-900">Hồ sơ thông tin cá nhân</h3>
                    <p className="text-sm text-slate-500 mt-1">Cập nhật thông tin chi tiết cá nhân của bạn để mua hàng nhanh chóng.</p>
                  </div>

                  <form onSubmit={handleSaveProfile} className="space-y-6">
                    <div className="flex items-center gap-6 pb-6 border-b border-slate-100">
                      <div className="w-16 h-16 rounded-2xl bg-cyan-600 text-white font-bold text-2xl flex items-center justify-center shadow-md">
                        {(profileForm.fullName || user?.email || 'U')[0].toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-base">{profileForm.fullName || 'Khách hàng'}</h4>
                        <p className="text-xs text-slate-500">{profileForm.email}</p>
                        <span className="inline-block mt-2 px-3 py-0.5 bg-cyan-50 text-cyan-700 text-xs font-semibold rounded-lg border border-cyan-200">
                          Tài khoản Khách hàng
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Họ và tên *</label>
                        <input
                          type="text"
                          value={profileForm.fullName}
                          onChange={e => setProfileForm(p => ({ ...p, fullName: e.target.value }))}
                          required
                          className="w-full h-11 rounded-xl border border-slate-300 px-4 text-sm font-normal text-slate-800 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition"
                          placeholder="Nhập họ và tên..."
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Địa chỉ Email (Cố định)</label>
                        <div className="relative">
                          <input
                            type="email"
                            value={profileForm.email}
                            disabled
                            className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 pl-10 text-sm font-normal text-slate-500 cursor-not-allowed"
                          />
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Số điện thoại *</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={profileForm.phone}
                            onChange={e => setProfileForm(p => ({ ...p, phone: e.target.value }))}
                            required
                            className="w-full h-11 rounded-xl border border-slate-300 px-4 pl-10 text-sm font-normal text-slate-800 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition"
                            placeholder="0987654321"
                          />
                          <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Ngày sinh</label>
                        <div className="relative">
                          <input
                            type="date"
                            value={profileForm.birthDate}
                            onChange={e => setProfileForm(p => ({ ...p, birthDate: e.target.value }))}
                            className="w-full h-11 rounded-xl border border-slate-300 px-4 pl-10 text-sm font-normal text-slate-800 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition"
                          />
                          <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Giới tính</label>
                      <div className="flex gap-6 pt-1">
                        <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700">
                          <input
                            type="radio"
                            name="gender"
                            value="male"
                            checked={profileForm.gender === 'male'}
                            onChange={e => setProfileForm(p => ({ ...p, gender: e.target.value }))}
                            className="w-4 h-4 text-cyan-600 focus:ring-cyan-500"
                          />
                          <span>Nam</span>
                        </label>
                        <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700">
                          <input
                            type="radio"
                            name="gender"
                            value="female"
                            checked={profileForm.gender === 'female'}
                            onChange={e => setProfileForm(p => ({ ...p, gender: e.target.value }))}
                            className="w-4 h-4 text-cyan-600 focus:ring-cyan-500"
                          />
                          <span>Nữ</span>
                        </label>
                        <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700">
                          <input
                            type="radio"
                            name="gender"
                            value="other"
                            checked={profileForm.gender === 'other'}
                            onChange={e => setProfileForm(p => ({ ...p, gender: e.target.value }))}
                            className="w-4 h-4 text-cyan-600 focus:ring-cyan-500"
                          />
                          <span>Khác</span>
                        </label>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex justify-end">
                      <button
                        type="submit"
                        disabled={savingProfile}
                        className="px-6 py-2.5 bg-cyan-600 text-white text-sm font-semibold rounded-xl shadow-md shadow-cyan-600/20 hover:bg-cyan-700 transition cursor-pointer disabled:opacity-60"
                      >
                        {savingProfile ? 'Đang lưu...' : 'Lưu thay đổi'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* TAB 2: SỔ ĐỊA CHỈ GIAO HÀNG */}
              {activeTab === 'addresses' && (
                <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Sổ địa chỉ nhận hàng</h3>
                      <p className="text-sm text-slate-500 mt-1">Quản lý danh sách địa chỉ nhận hàng của bạn.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNewAddrOpen(true)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-cyan-600 text-white text-sm font-semibold rounded-xl shadow-xs hover:bg-cyan-700 transition cursor-pointer"
                    >
                      <Plus size={16} />
                      Thêm địa chỉ mới
                    </button>
                  </div>

                  {addresses.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                      <MapPin className="mx-auto h-10 w-10 text-slate-400 mb-3" />
                      <p className="text-sm font-medium text-slate-600">Chưa có địa chỉ nào được lưu.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {addresses.map(addr => (
                        <div key={addr.id} className="p-5 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-3">
                              <span className="font-bold text-slate-800 text-sm">{addr.name}</span>
                              <span className="text-xs text-slate-500 font-medium">| {addr.phone}</span>
                              {addr.isDefault && (
                                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-md">
                                  Mặc định
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-slate-600 mt-1">{addr.address}</p>
                          </div>

                          <div className="flex items-center gap-3 self-end md:self-auto">
                            {!addr.isDefault && (
                              <button
                                type="button"
                                onClick={() => handleSetDefaultAddress(addr.id)}
                                className="text-xs font-semibold text-cyan-600 hover:text-cyan-700 transition"
                              >
                                Thiết lập mặc định
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteAddress(addr.id)}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                              title="Xóa địa chỉ"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* MODAL THÊM ĐỊA CHỈ MỚI */}
                  {newAddrOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs">
                      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4">
                        <h4 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">Thêm địa chỉ giao hàng mới</h4>
                        <form onSubmit={handleAddAddress} className="space-y-4">
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Họ tên người nhận *</label>
                            <input
                              type="text"
                              value={newAddrForm.name}
                              onChange={e => setNewAddrForm(p => ({ ...p, name: e.target.value }))}
                              required
                              className="w-full h-11 rounded-xl border border-slate-300 px-3 text-sm text-slate-800 outline-none focus:border-cyan-500"
                              placeholder="Nhập tên người nhận..."
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Số điện thoại *</label>
                            <input
                              type="text"
                              value={newAddrForm.phone}
                              onChange={e => setNewAddrForm(p => ({ ...p, phone: e.target.value }))}
                              required
                              className="w-full h-11 rounded-xl border border-slate-300 px-3 text-sm text-slate-800 outline-none focus:border-cyan-500"
                              placeholder="Nhập SĐT nhận hàng..."
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Địa chỉ chi tiết (Tỉnh/TP, Quận/Huyện, Phường/Xã, Số nhà) *</label>
                            <textarea
                              rows={3}
                              value={newAddrForm.address}
                              onChange={e => setNewAddrForm(p => ({ ...p, address: e.target.value }))}
                              required
                              className="w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-800 outline-none focus:border-cyan-500 resize-none"
                              placeholder="Ví dụ: Số 12, Ngõ 45, Đường Cầu Giấy, Hà Nội..."
                            />
                          </div>
                          <div className="flex justify-end gap-3 pt-2">
                            <button
                              type="button"
                              onClick={() => setNewAddrOpen(false)}
                              className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50"
                            >
                              Hủy
                            </button>
                            <button
                              type="submit"
                              className="px-5 py-2 rounded-xl bg-cyan-600 text-white text-sm font-semibold shadow-xs hover:bg-cyan-700"
                            >
                              Lưu địa chỉ
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: ĐỔI MẬT KHẨU */}
              {activeTab === 'password' && (
                <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs space-y-6">
                  <div className="border-b border-slate-100 pb-4">
                    <h3 className="text-lg font-bold text-slate-900">Bảo mật & Mật khẩu</h3>
                    <p className="text-sm text-slate-500 mt-1">Đổi mật khẩu định kỳ để bảo vệ tài khoản cá nhân của bạn.</p>
                  </div>

                  {isGoogleAuth ? (
                    <div className="p-5 rounded-xl bg-cyan-50 border border-cyan-200 flex items-start gap-4">
                      <ShieldCheck className="text-cyan-700 flex-shrink-0 mt-0.5" size={26} />
                      <div>
                        <h4 className="font-bold text-cyan-950 text-sm">Đăng nhập bằng Google (OAuth 2.0)</h4>
                        <p className="text-sm text-cyan-800 mt-1 leading-relaxed">
                          Tài khoản của bạn được liên kết an toàn qua Google Sign-In. Mật khẩu được quản lý trực tiếp bởi tài khoản Google của bạn nên không cần phải đặt hoặc thay đổi mật khẩu tại đây.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleSavePassword} className="space-y-5 max-w-xl">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Mật khẩu hiện tại *</label>
                        <div className="relative">
                          <input
                            type={showPassword.current ? 'text' : 'password'}
                            value={passwordForm.currentPassword}
                            onChange={e => setPasswordForm(p => ({ ...p, currentPassword: e.target.value }))}
                            required
                            className="w-full h-11 rounded-xl border border-slate-300 px-4 pr-12 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition"
                            placeholder="••••••••"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(p => ({ ...p, current: !p.current }))}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            {showPassword.current ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Mật khẩu mới *</label>
                        <div className="relative">
                          <input
                            type={showPassword.new ? 'text' : 'password'}
                            value={passwordForm.newPassword}
                            onChange={e => setPasswordForm(p => ({ ...p, newPassword: e.target.value }))}
                            required
                            className="w-full h-11 rounded-xl border border-slate-300 px-4 pr-12 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition"
                            placeholder="Tối thiểu 6 ký tự"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(p => ({ ...p, new: !p.new }))}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            {showPassword.new ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Xác nhận mật khẩu mới *</label>
                        <div className="relative">
                          <input
                            type={showPassword.confirm ? 'text' : 'password'}
                            value={passwordForm.confirmPassword}
                            onChange={e => setPasswordForm(p => ({ ...p, confirmPassword: e.target.value }))}
                            required
                            className="w-full h-11 rounded-xl border border-slate-300 px-4 pr-12 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition"
                            placeholder="Nhập lại mật khẩu mới..."
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(p => ({ ...p, confirm: !p.confirm }))}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            {showPassword.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-100 flex justify-end">
                        <button
                          type="submit"
                          disabled={savingPassword}
                          className="px-6 py-2.5 bg-cyan-600 text-white text-sm font-semibold rounded-xl shadow-md shadow-cyan-600/20 hover:bg-cyan-700 transition cursor-pointer disabled:opacity-60"
                        >
                          {savingPassword ? 'Đang cập nhật...' : 'Xác nhận đổi mật khẩu'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* TAB 4: ĐƠN HÀNG CỦA TÔI */}
              {activeTab === 'orders' && (
                <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs space-y-6">
                  <div className="border-b border-slate-100 pb-4">
                    <h3 className="text-lg font-bold text-slate-900">Lịch sử đơn hàng của tôi</h3>
                    <p className="text-sm text-slate-500 mt-1">Theo dõi các đơn hàng bạn đã mua trên SmartWMS.</p>
                  </div>

                  {loadingOrders ? (
                    <div className="flex justify-center items-center py-12">
                      <p className="text-sm font-medium text-slate-500">Đang tải lịch sử đơn hàng...</p>
                    </div>
                  ) : orders.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200">
                      <ShoppingBag className="mx-auto h-10 w-10 text-slate-400 mb-3" />
                      <p className="text-sm font-bold text-slate-700">Bạn chưa có đơn hàng nào.</p>
                      <button
                        onClick={() => navigate('/shop')}
                        className="mt-4 px-5 py-2.5 bg-cyan-600 text-white text-sm font-semibold rounded-xl hover:bg-cyan-700 transition"
                      >
                        Khám phá cửa hàng ngay
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {orders.map((order: any, idx: number) => (
                        <div key={order.id || idx} className="p-5 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                          <div>
                            <div className="flex items-center gap-3">
                              <span className="font-bold text-slate-900 text-sm">{order.orderNo || `SO-00${idx + 1}`}</span>
                              <span className="px-2.5 py-0.5 bg-cyan-100 text-cyan-800 text-xs font-semibold rounded-md">
                                {order.status === 'pending' ? 'Chờ xử lý' : order.status === 'APPROVED' ? 'Đã duyệt kho' : 'Gửi tới kho'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Ngày tạo: {order.createdAt ? new Date(order.createdAt).toLocaleDateString('vi-VN') : 'Mới tạo'}</p>
                            <p className="text-sm text-slate-700 mt-0.5">{order.description || 'Đơn mua hàng từ Shop'}</p>
                          </div>

                          <div className="text-right">
                            <span className="text-xs text-slate-500 font-medium block">Tổng tiền</span>
                            <span className="font-bold text-cyan-700 text-base">
                              {order.totalAmount ? `${Number(order.totalAmount).toLocaleString()}đ` : 'Đang tính toán'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-200 py-8">
        <div className={`${containerClass} flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-500`}>
          <p>&copy; 2026 SmartWMS. Mọi quyền được bảo lưu.</p>
          <div className="flex gap-6">
            <span onClick={() => navigate('/shop')} className="hover:text-cyan-600 cursor-pointer">Cửa hàng</span>
            <span onClick={() => navigate('/cart')} className="hover:text-cyan-600 cursor-pointer">Giỏ hàng</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
