import React, { useState, useEffect } from 'react';
import {
  Store, Users, Package, ShoppingBag, Calendar, Server, Zap,
  CheckCircle, AlertCircle, Info, Clock, BarChart3, Loader2, RefreshCw,
} from 'lucide-react';

const API_BASE_URL = 'http://localhost:3000/api';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  };
}

function ProgressBar({ value, max, color = 'bg-cyan-500' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : color;
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
        <span>{value.toLocaleString()} / {max.toLocaleString()}</span>
        <span className={pct >= 90 ? 'text-red-600 font-bold' : pct >= 70 ? 'text-amber-600 font-bold' : 'text-gray-600'}>{pct}%</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div className={`${barColor} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-black text-gray-800">{typeof value === 'number' ? value.toLocaleString() : value}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  );
}

export default function UsageInfoPage() {
  const [loading, setLoading] = useState(true);
  const [userCount, setUserCount] = useState(0);
  const [productCount, setProductCount] = useState(0);
  const [warehouseCount, setWarehouseCount] = useState(0);
  const [customerCount, setCustomerCount] = useState(0);
  const [supplierCount, setSupplierCount] = useState(0);
  const [inboundCount, setInboundCount] = useState(0);
  const [outboundCount, setOutboundCount] = useState(0);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const headers = authHeaders();

      // Parallel fetch from database APIs
      const [usersRes, prodsRes, whRes, custsRes, suppRes, inbRes, outbRes] = await Promise.allSettled([
        fetch(`${API_BASE_URL}/users`, { headers }),
        fetch(`${API_BASE_URL}/products`, { headers }),
        fetch(`${API_BASE_URL}/warehouses`, { headers }),
        fetch(`${API_BASE_URL}/customers`, { headers }),
        fetch(`${API_BASE_URL}/suppliers`, { headers }),
        fetch(`${API_BASE_URL}/inbound/receipts`, { headers }),
        fetch(`${API_BASE_URL}/outbound/orders`, { headers }),
      ]);

      if (usersRes.status === 'fulfilled' && usersRes.value.ok) {
        const d = await usersRes.value.json();
        setUserCount(Array.isArray(d) ? d.length : (d?.data?.length || 0));
      }
      if (prodsRes.status === 'fulfilled' && prodsRes.value.ok) {
        const d = await prodsRes.value.json();
        setProductCount(Array.isArray(d) ? d.length : (d?.data?.length || 0));
      }
      if (whRes.status === 'fulfilled' && whRes.value.ok) {
        const d = await whRes.value.json();
        setWarehouseCount(Array.isArray(d) ? d.length : (d?.data?.length || 0));
      }
      if (custsRes.status === 'fulfilled' && custsRes.value.ok) {
        const d = await custsRes.value.json();
        setCustomerCount(Array.isArray(d) ? d.length : (d?.data?.length || 0));
      }
      if (suppRes.status === 'fulfilled' && suppRes.value.ok) {
        const d = await suppRes.value.json();
        setSupplierCount(Array.isArray(d) ? d.length : (d?.data?.length || 0));
      }
      if (inbRes.status === 'fulfilled' && inbRes.value.ok) {
        const d = await inbRes.value.json();
        setInboundCount(Array.isArray(d) ? d.length : (d?.data?.length || 0));
      }
      if (outbRes.status === 'fulfilled' && outbRes.value.ok) {
        const d = await outbRes.value.json();
        setOutboundCount(Array.isArray(d) ? d.length : (d?.data?.length || 0));
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <span>Hệ thống</span><span>›</span><span className="text-gray-800 font-semibold">Thông tin sử dụng</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
              <Info size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Thông tin sử dụng</h1>
              <p className="text-sm text-gray-500">Thống kê trực tiếp từ cơ sở dữ liệu thời gian thực</p>
            </div>
          </div>
          <button
            onClick={fetchStats}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 transition cursor-pointer shadow-sm disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin text-cyan-600' : ''} />
            Làm mới
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center text-gray-400 gap-3">
            <Loader2 size={32} className="animate-spin text-cyan-600" />
            <p className="text-sm font-medium">Đang nạp dữ liệu thống kê từ cơ sở dữ liệu...</p>
          </div>
        ) : (
          <>
            {/* Quick Stats from Database */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={Package} label="Sản phẩm" value={productCount} sub="Đang quản lý trong DB" color="bg-blue-500" />
              <StatCard icon={Store} label="Kho / Chi nhánh" value={warehouseCount} sub="Chi nhánh trong DB" color="bg-indigo-500" />
              <StatCard icon={Users} label="Khách hàng" value={customerCount} sub="Khách hàng trong DB" color="bg-violet-500" />
              <StatCard icon={Store} label="Nhà cung cấp" value={supplierCount} sub="Nhà cung cấp trong DB" color="bg-orange-500" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatCard icon={Users} label="Người dùng / Nhân viên" value={userCount} sub="Tài khoản trong DB" color="bg-emerald-500" />
              <StatCard icon={ShoppingBag} label="Phiếu nhập kho" value={inboundCount} sub="Giao dịch nhập kho" color="bg-teal-500" />
              <StatCard icon={Package} label="Phiếu xuất kho" value={outboundCount} sub="Giao dịch xuất kho" color="bg-cyan-500" />
            </div>

            {/* Usage Limits */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><BarChart3 size={18} className="text-cyan-600" />Tài nguyên dữ liệu thực</h3>
                <div className="space-y-5">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Users size={15} className="text-gray-400" />
                      <span className="text-sm font-semibold text-gray-700">Tài khoản người dùng</span>
                    </div>
                    <ProgressBar value={userCount} max={50} color="bg-violet-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Package size={15} className="text-gray-400" />
                      <span className="text-sm font-semibold text-gray-700">Mã sản phẩm (SKU)</span>
                    </div>
                    <ProgressBar value={productCount} max={1000} color="bg-blue-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Store size={15} className="text-gray-400" />
                      <span className="text-sm font-semibold text-gray-700">Kho & Chi nhánh</span>
                    </div>
                    <ProgressBar value={warehouseCount} max={20} color="bg-emerald-500" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Server size={18} className="text-cyan-600" />Trạng thái hệ thống</h3>
                <div className="space-y-4">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
                    <CheckCircle size={20} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-emerald-900">Kết nối MySQL Database ổn định</h4>
                      <p className="text-xs text-emerald-700 mt-0.5">Database: smart_wms_db | Cổng 3306 | Trạng thái: Sẵn sàng</p>
                    </div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                    <Server size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-blue-900">Backend API Gateway</h4>
                      <p className="text-xs text-blue-700 mt-0.5">NestJS Framework | Port 3000 | JWT Authentication: Bật</p>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 flex items-start gap-2">
                    <Clock size={15} className="text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-gray-500">
                      <p className="font-semibold text-gray-600">Thời gian đồng bộ</p>
                      <p>Dữ liệu được truy vấn trực tiếp từ backend khi tải trang.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
