import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, BarChart3, CheckCircle2, Lock, Mail, Package, ShieldCheck, X, Zap } from 'lucide-react';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential?: string }) => void }) => void;
          renderButton: (element: HTMLElement, options: { theme: 'outline' | 'filled_blue' | 'filled_black'; size: 'large' | 'medium' | 'small'; text?: string; shape?: string; logo_alignment?: string }) => void;
          prompt: () => void;
          disableAutoSelect?: () => void;
        };
      };
    };
  }
}

type Toast = {
  type: 'success' | 'error';
  title: string;
  message: string;
};

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = React.useState('admin@example.com');
  const [password, setPassword] = React.useState('Admin@123');
  const [toast, setToast] = React.useState<Toast | null>(null);
  const [loading, setLoading] = React.useState(false);
  
  const handleGoogleSignIn = () => {
    if (window.google?.accounts?.id) {
      try {
        window.google.accounts.id.prompt();
      } catch (e) {
        setToast({ type: 'error', title: 'Lỗi Google', message: 'Không thể mở popup Google' });
      }
    } else {
      setToast({ type: 'error', title: 'Lỗi Google', message: 'Google Identity chưa sẵn sàng' });
    }
  };

  React.useEffect(() => {
    if (!toast) return;

    const timer = window.setTimeout(() => {
      setToast(null);
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [toast]);

  React.useEffect(() => {
    const clientId = '1079704717727-3c0hitge9b5sniqh619lassoc0pd9262.apps.googleusercontent.com';

    const initializeGoogle = () => {
      if (!window.google?.accounts?.id) return;

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: { credential?: string }) => {
          if (!response.credential) return;

          setLoading(true);
          try {
            const responsePayload = await fetch('http://localhost:3000/api/auth/google-login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ credential: response.credential }),
            });

            if (!responsePayload.ok) {
              const errorData = await responsePayload.json().catch(() => null);
              throw new Error(errorData?.message || 'Đăng nhập Google thất bại');
            }

            const data = await responsePayload.json();
            const loggedInUser = data.user || { email: 'google-user@example.com', role: 'staff' };
            localStorage.setItem('token', data.access_token);
            localStorage.setItem('user', JSON.stringify(loggedInUser));

            setToast({
              type: 'success',
              title: 'Đăng nhập thành công',
              message: 'Đang chuyển bạn vào bảng điều khiển.',
            });

            window.setTimeout(() => {
              navigate(loggedInUser.role === 'supplier' ? '/supplier-portal' : '/dashboard');
            }, 700);
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Đăng nhập Google thất bại';
            setToast({
              type: 'error',
              title: 'Đăng nhập thất bại',
              message: errorMessage,
            });
          } finally {
            setLoading(false);
          }
        },
      });

      // We will use a custom-styled button (see JSX) and trigger the prompt on click.
    };

    if (window.google?.accounts?.id) {
      initializeGoogle();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initializeGoogle;
    document.body.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setToast(null);
    setLoading(true);

    try {
      const response = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || 'Email hoặc mật khẩu không đúng');
      }

      const data = await response.json();

      const loggedInUser = data.user || { email, role: 'admin' };
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user', JSON.stringify(loggedInUser));

      setToast({
        type: 'success',
        title: 'Đăng nhập thành công',
        message: 'Đang chuyển bạn vào bảng điều khiển.',
      });

      window.setTimeout(() => {
        if (loggedInUser.role === 'supplier') {
          navigate('/supplier-portal');
        } else if (loggedInUser.role === 'customer') {
          navigate('/customer-portal');
        } else {
          navigate('/dashboard');
        }
      }, 700);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Email hoặc mật khẩu không đúng';
      setToast({
        type: 'error',
        title: 'Đăng nhập thất bại',
        message: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-cyan-50 flex items-center justify-center p-4 md:p-8 font-sans">
      
      {/* Nút quay lại trang chủ ở góc trái */}
      <button
        onClick={() => navigate('/')}
        className="absolute top-4 left-4 md:top-8 md:left-8 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/60 backdrop-blur-md border border-cyan-200 text-cyan-800 font-bold shadow-sm hover:shadow-md hover:bg-white transition-all z-20"
      >
        <ArrowLeft size={18} />
        Trang chủ
      </button>

      {toast && (
        <div className="fixed right-5 top-5 z-50 w-[calc(100%-2.5rem)] max-w-sm">
          <div
            className={`flex items-start gap-3 rounded-2xl border bg-white p-4 shadow-2xl shadow-slate-900/10 ${
              toast.type === 'success' ? 'border-cyan-100' : 'border-red-100'
            }`}
          >
            <div
              className={`mt-0.5 rounded-full p-1 ${
                toast.type === 'success' ? 'bg-cyan-50 text-cyan-600' : 'bg-red-50 text-red-600'
              }`}
            >
              {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">{toast.title}</p>
              <p className="mt-1 text-sm leading-5 text-slate-600">{toast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label="Đóng thông báo"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <div className="w-full max-w-[1340px] bg-white rounded-[28px] shadow-2xl shadow-cyan-900/15 overflow-hidden flex flex-col lg:flex-row min-h-[730px]">
        <div className="w-full lg:w-[47%] bg-gradient-to-br from-cyan-700 to-cyan-500 text-white p-10 lg:p-14 flex flex-col relative overflow-hidden">
          <div className="absolute bottom-0 left-0 w-full opacity-20 pointer-events-none">
            <svg viewBox="0 0 1440 320" className="w-full h-auto">
              <path fill="#ffffff" fillOpacity="1" d="M0,160L48,176C96,192,192,224,288,213.3C384,203,480,149,576,144C672,139,768,181,864,197.3C960,213,1056,203,1152,176C1248,149,1344,107,1392,85.3L1440,64L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
            </svg>
          </div>
          <div className="absolute bottom-0 left-0 w-full opacity-10 pointer-events-none">
            <svg viewBox="0 0 1440 320" className="w-full h-auto">
              <path fill="#ffffff" fillOpacity="1" d="M0,256L48,229.3C96,203,192,149,288,154.7C384,160,480,224,576,218.7C672,213,768,139,864,128C960,117,1056,171,1152,197.3C1248,224,1344,224,1392,224L1440,224L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
            </svg>
          </div>

          <div className="relative z-10 flex-1 flex flex-col">
            <div className="flex items-center gap-2 mb-12">
              <Package size={28} className="text-cyan-300" />
              <span className="font-bold text-xl tracking-wide">Smart WMS</span>
            </div>

            <h1 className="text-4xl lg:text-5xl font-bold mb-6 leading-tight">
              Hệ thống Quản lý<br />Kho thông minh
            </h1>
            <p className="text-cyan-50/80 text-lg mb-12 leading-relaxed max-w-md">
              Giải pháp toàn diện giúp tối ưu hóa vận hành, theo dõi tồn kho theo thời gian thực và tự động hóa quy trình nghiệp vụ.
            </p>

            <div className="grid grid-cols-2 gap-4 lg:gap-6 mb-auto">
              <div className="p-5 rounded-2xl bg-white/5 border border-white/10 transition-all duration-200 cursor-pointer hover:bg-white/10 active:shadow-[0_4px_20px_rgba(0,0,0,0.15)] active:scale-[0.98]">
                <Zap className="w-6 h-6 text-cyan-300 mb-3" />
                <h3 className="font-semibold text-lg mb-1">Tự động hóa</h3>
                <p className="text-sm text-cyan-50/70">Tối ưu quy trình nhập xuất nhanh chóng</p>
              </div>
              <div className="p-5 rounded-2xl bg-white/5 border border-white/10 transition-all duration-200 cursor-pointer hover:bg-white/10 active:shadow-[0_4px_20px_rgba(0,0,0,0.15)] active:scale-[0.98]">
                <BarChart3 className="w-6 h-6 text-cyan-300 mb-3" />
                <h3 className="font-semibold text-lg mb-1">Báo cáo đa chiều</h3>
                <p className="text-sm text-cyan-50/70">Quản lý và trích xuất dữ liệu trực quan</p>
              </div>
              <div className="p-5 rounded-2xl bg-white/5 border border-white/10 transition-all duration-200 cursor-pointer hover:bg-white/10 active:shadow-[0_4px_20px_rgba(0,0,0,0.15)] active:scale-[0.98]">
                <Package className="w-6 h-6 text-cyan-300 mb-3" />
                <h3 className="font-semibold text-lg mb-1">Kiểm soát tồn kho</h3>
                <p className="text-sm text-cyan-50/70">Theo dõi chính xác số lượng hàng hóa</p>
              </div>
              <div className="p-5 rounded-2xl bg-white/5 border border-white/10 transition-all duration-200 cursor-pointer hover:bg-white/10 active:shadow-[0_4px_20px_rgba(0,0,0,0.15)] active:scale-[0.98]">
                <ShieldCheck className="w-6 h-6 text-cyan-300 mb-3" />
                <h3 className="font-semibold text-lg mb-1">Bảo mật tuyệt đối</h3>
                <p className="text-sm text-cyan-50/70">Bảo vệ thông tin và dữ liệu của bạn</p>
              </div>
            </div>

            <div className="mt-12 text-sm text-cyan-50/60 pt-8 border-t border-white/10">
              © 2026 Smart WMS. Developed by Tech Team.
            </div>
          </div>
        </div>

        <div className="w-full lg:w-[53%] p-10 lg:p-20 flex flex-col relative bg-white">
          <div className="max-w-[500px] w-full mx-auto flex-1 flex flex-col justify-center">
            <div className="text-center mb-10">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-cyan-50 text-cyan-700 mb-7">
                <Package size={32} />
              </div>
              <h2 className="text-4xl font-bold text-slate-800 mb-4">Đăng nhập vào hệ thống</h2>
              <p className="text-base text-slate-500">Vui lòng đăng nhập để tiếp tục sử dụng hệ thống</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="login-email" className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input
                    id="login-email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-colors"
                    placeholder="Nhập địa chỉ email của bạn"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="login-password" className="block text-sm font-semibold text-slate-700 mb-2">Mật khẩu</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                  <input
                    id="login-password"
                    name="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-colors"
                    placeholder="Nhập mật khẩu của bạn"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <label htmlFor="remember-me" className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input
                    id="remember-me"
                    name="rememberMe"
                    type="checkbox"
                    className="w-4 h-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                  />
                  Ghi nhớ đăng nhập
                </label>
                <a href="#" className="text-sm font-semibold text-cyan-700 hover:underline">
                  Quên mật khẩu?
                </a>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 px-4 bg-cyan-600 hover:bg-cyan-700 text-white rounded-2xl font-semibold transition-colors duration-200 shadow-lg shadow-cyan-600/25 mt-4 flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? 'Đang xử lý...' : 'Đăng nhập'}
              </button>
            </form>

            <div className="my-8 flex items-center gap-4">
              <div className="flex-1 h-px bg-slate-200"></div>
              <span className="text-sm text-slate-400 font-medium">Hoặc đăng nhập với tài khoản</span>
              <div className="flex-1 h-px bg-slate-200"></div>
            </div>

            <div className="w-full flex justify-center">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="w-full py-4 px-4 bg-white border border-cyan-100 hover:bg-cyan-50 text-slate-700 rounded-2xl font-semibold transition-colors duration-200 flex items-center justify-center gap-3 shadow-lg"
                style={{ minWidth: 0 }}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Đăng nhập bằng Google
              </button>
            </div>

            <p className="text-center text-sm text-slate-500 mt-8">
              Bạn chưa có tài khoản? Vui lòng liên hệ <a href="#" className="font-semibold text-cyan-700 hover:underline">quản trị viên</a> để được hỗ trợ.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}