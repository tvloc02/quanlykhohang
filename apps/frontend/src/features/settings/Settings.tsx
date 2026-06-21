import React from 'react';
import { Save, User, Lock, Bell } from 'lucide-react';
import Button from '../../shared/components/Button';

export default function Settings() {
  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cài đặt</h1>
      </div>

      {/* Profile Settings */}
      <div className="bg-white rounded-lg border border-gray-100 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-gray-100 flex items-center gap-3">
          <User size={20} className="text-primary" />
          <h2 className="text-lg font-semibold text-gray-900">Thông tin tài khoản</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Họ và tên
              </label>
              <input
                type="text"
                defaultValue="Dương Ngọc Anh"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Email
              </label>
              <input
                type="email"
                defaultValue="admin@example.com"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Số điện thoại
              </label>
              <input
                type="tel"
                defaultValue="0123456789"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Vị trí
              </label>
              <input
                type="text"
                defaultValue="Quản trị viên hệ thống"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          <Button className="flex items-center gap-2">
            <Save size={18} />
            Lưu thay đổi
          </Button>
        </div>
      </div>

      {/* Password Settings */}
      <div className="bg-white rounded-lg border border-gray-100 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-gray-100 flex items-center gap-3">
          <Lock size={20} className="text-primary" />
          <h2 className="text-lg font-semibold text-gray-900">Thay đổi mật khẩu</h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Mật khẩu hiện tại
            </label>
            <input
              type="password"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Mật khẩu mới
              </label>
              <input
                type="password"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Xác nhận mật khẩu
              </label>
              <input
                type="password"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          <Button className="flex items-center gap-2">
            <Save size={18} />
            Cập nhật mật khẩu
          </Button>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="bg-white rounded-lg border border-gray-100 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-gray-100 flex items-center gap-3">
          <Bell size={20} className="text-primary" />
          <h2 className="text-lg font-semibold text-gray-900">Thông báo</h2>
        </div>
        <div className="p-6 space-y-4">
          {[
            { label: 'Thông báo nhập hàng', desc: 'Nhận thông báo khi có phiếu nhập mới' },
            { label: 'Thông báo xuất hàng', desc: 'Nhận thông báo khi có đơn xuất mới' },
            { label: 'Cảnh báo tồn kho', desc: 'Nhận cảnh báo khi tồn kho dưới mức tối thiểu' },
            { label: 'Email tóm tắt', desc: 'Nhận email tóm tắt hàng ngày' },
          ].map((notification, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition">
              <div>
                <p className="font-medium text-gray-900">{notification.label}</p>
                <p className="text-sm text-gray-600">{notification.desc}</p>
              </div>
              <input type="checkbox" className="w-5 h-5 text-primary rounded" defaultChecked />
            </div>
          ))}
          <Button className="flex items-center gap-2 mt-4">
            <Save size={18} />
            Lưu cài đặt
          </Button>
        </div>
      </div>
    </div>
  );
}
