import React from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, AlertCircle, LogIn } from 'lucide-react';
import Button from '../../shared/components/Button';

export default function Signup() {
  const navigate = useNavigate();
  const [formData, setFormData] = React.useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate
    if (!formData.fullName.trim()) {
      setError('Vui lòng nhập tên đầy đủ');
      return;
    }
    if (!formData.email.trim()) {
      setError('Vui lòng nhập email');
      return;
    }
    if (formData.password.length < 6) {
      setError('Mật khẩu phải ít nhất 6 ký tự');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Mật khẩu không khớp');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          fullName: formData.fullName,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Đăng ký thất bại');
      }

      // Đăng ký thành công - chuyển đến đăng nhập
      navigate('/login', { replace: true });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Đăng ký thất bại';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-primary-light flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-block bg-white rounded-lg p-4 mb-6">
            <div className="text-primary font-bold text-4xl">WMS</div>
          </div>
          <h1 className="text-3xl font-bold text-white">Smart WMS</h1>
          <p className="text-white opacity-75 mt-2">Hệ thống quản lý kho thông minh</p>
        </div>

        {/* Signup Card */}
        <div className="bg-white rounded-lg shadow-2xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Tạo tài khoản</h2>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-3">
              <AlertCircle size={20} className="text-red-600" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="signup-fullname" className="block text-sm font-medium text-gray-900 mb-2">
                Tên đầy đủ
              </label>
              <input
                id="signup-fullname"
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Nhập tên của bạn"
                required
              />
            </div>

            <div>
              <label htmlFor="signup-email" className="block text-sm font-medium text-gray-900 mb-2">
                Email
              </label>
              <input
                id="signup-email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="your@email.com"
                required
              />
            </div>

            <div>
              <label htmlFor="signup-password" className="block text-sm font-medium text-gray-900 mb-2">
                Mật khẩu
              </label>
              <input
                id="signup-password"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Nhập mật khẩu"
                required
              />
            </div>

            <div>
              <label htmlFor="signup-confirm-password" className="block text-sm font-medium text-gray-900 mb-2">
                Xác nhận mật khẩu
              </label>
              <input
                id="signup-confirm-password"
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Xác nhận mật khẩu"
                required
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="terms"
                name="terms"
                className="w-4 h-4 text-primary rounded"
                required
              />
              <label htmlFor="terms" className="text-sm text-gray-700">
                Tôi đồng ý với <a href="#" className="text-primary hover:underline">Điều khoản dịch vụ</a>
              </label>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2"
            >
              <UserPlus size={20} />
              {loading ? 'Đang tạo tài khoản...' : 'Đăng ký'}
            </Button>
          </form>

          {/* Login Link */}
          <div className="mt-6 pt-6 border-t border-gray-200 text-center">
            <p className="text-gray-600 text-sm">
              Đã có tài khoản?{' '}
              <button
                onClick={() => navigate('/login')}
                className="text-primary font-semibold hover:underline"
              >
                Đăng nhập ngay
              </button>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-white opacity-75 text-sm mt-8">
          © 2026 Smart WMS. Tất cả quyền được bảo lưu.
        </p>
      </div>
    </div>
  );
}
