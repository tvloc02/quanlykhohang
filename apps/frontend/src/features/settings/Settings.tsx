import React from 'react';
import { Save, Mail, Cpu } from 'lucide-react';
import { Outlet } from 'react-router-dom';
import Button from '../../shared/components/Button';

function MailSettings() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cấu hình mail</h1>
        <p className="mt-2 text-sm text-gray-600">Thiết lập thông tin máy chủ email và đường dẫn gửi mail.</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-100 overflow-hidden shadow-sm">
        <div className="p-6 space-y-4">
          {[
            { label: 'Máy chủ SMTP', placeholder: 'smtp.example.com' },
            { label: 'Cổng SMTP', placeholder: '587' },
            { label: 'Tên đăng nhập', placeholder: 'user@example.com' },
            { label: 'Mật khẩu', placeholder: '••••••••' },
            { label: 'Email người gửi', placeholder: 'no-reply@example.com' },
            { label: 'Bật TLS/SSL', placeholder: '' },
          ].map((field, idx) => (
            <div key={idx}>
              <label className="block text-sm font-medium text-gray-900 mb-2">{field.label}</label>
              {field.label === 'Bật TLS/SSL' ? (
                <div className="flex items-center gap-3">
                  <input type="checkbox" className="w-5 h-5 text-primary rounded" defaultChecked />
                  <span className="text-gray-600">Sử dụng mã hoá khi gửi mail</span>
                </div>
              ) : (
                <input
                  type={field.label.includes('Mật khẩu') ? 'password' : 'text'}
                  defaultValue=""
                  placeholder={field.placeholder}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              )}
            </div>
          ))}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button className="flex items-center gap-2 w-full justify-center">
              <Save size={18} />
              Lưu cấu hình mail
            </Button>
            <Button className="flex items-center gap-2 w-full justify-center bg-slate-900 text-white hover:bg-slate-800">
              <Mail size={18} />
              Gửi thử email
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AiSettings() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cấu hình AI</h1>
        <p className="mt-2 text-sm text-gray-600">Thiết lập cấu hình AI cho hệ thống, bao gồm API key và mô hình.</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-100 overflow-hidden shadow-sm">
        <div className="p-6 space-y-4">
          {[
            { label: 'Nhà cung cấp AI', placeholder: 'OpenAI / Azure / Custom' },
            { label: 'API key', placeholder: 'sk-...' },
            { label: 'Mô hình', placeholder: 'gpt-4.1' },
            { label: 'Nhiệt độ', placeholder: '0.7' },
          ].map((field, idx) => (
            <div key={idx}>
              <label className="block text-sm font-medium text-gray-900 mb-2">{field.label}</label>
              <input
                type={field.label === 'API key' ? 'password' : 'text'}
                placeholder={field.placeholder}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          ))}

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <input type="checkbox" className="w-5 h-5 text-primary rounded" defaultChecked />
              <span className="text-gray-600">Bật tính năng AI cho gợi ý và tự động</span>
            </div>
          </div>

          <Button className="flex items-center gap-2">
            <Save size={18} />
            Lưu cấu hình AI
          </Button>
        </div>
      </div>
    </div>
  );
}

function StoreSettings() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cấu hình bán hàng</h1>
        <p className="mt-2 text-sm text-gray-600">Thiết lập cấu hình cho trang cửa hàng trực tuyến (Shop).</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-100 overflow-hidden shadow-sm">
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Trạng thái cửa hàng</label>
            <div className="flex items-center gap-3">
              <input type="checkbox" className="w-5 h-5 text-primary rounded" defaultChecked />
              <span className="text-gray-600">Mở cửa hàng (Hiển thị công khai)</span>
            </div>
          </div>
          
          <div className="border-t border-slate-100 my-4 py-4">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Cấu hình Banner</h2>
            {[
              { label: 'URL Hình ảnh Banner', placeholder: 'https://...' },
              { label: 'Tiêu đề Banner', placeholder: 'Khám phá sản phẩm của chúng tôi' },
              { label: 'Phụ đề Banner', placeholder: 'Chất lượng hàng đầu' },
            ].map((field, idx) => (
              <div key={idx} className="mb-4">
                <label className="block text-sm font-medium text-gray-900 mb-2">{field.label}</label>
                <input
                  type="text"
                  placeholder={field.placeholder}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            ))}
          </div>

          <div className="border-t border-slate-100 my-4 py-4">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Sản phẩm & Danh mục</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-900 mb-2">Hiển thị danh mục</label>
              <div className="flex items-center gap-3">
                <input type="checkbox" className="w-5 h-5 text-primary rounded" defaultChecked />
                <span className="text-gray-600">Hiển thị thanh lọc theo danh mục</span>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-900 mb-2">Sản phẩm nổi bật (Phân cách bằng dấu phẩy SKU)</label>
              <textarea
                rows={3}
                placeholder="SKU-001, SKU-002"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              ></textarea>
            </div>
          </div>

          <Button className="flex items-center gap-2">
            <Save size={18} />
            Lưu cấu hình bán hàng
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Settings() {
  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cài đặt hệ thống</h1>
          <p className="mt-2 text-sm text-gray-600">Chọn một trang cấu hình để chỉ thao tác một chức năng.</p>
        </div>
      </div>

      <Outlet />
    </div>
  );
}

export { MailSettings, AiSettings, StoreSettings };
