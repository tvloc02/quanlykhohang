import React from 'react';
import {
  Save,
  Mail,
  Cpu,
  ShoppingBag,
  Send,
  Eye,
  EyeOff,
  Server,
  Sparkles,
  CheckCircle2,
  Lock,
  Globe,
} from 'lucide-react';
import { Outlet } from 'react-router-dom';
import Toast from '../../shared/components/Toast';

type SelectOption = {
  value: string;
  label: string;
};

function StyledSelect({
  value,
  options,
  onChange,
  className = '',
  disabled = false,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const selectedOption = options.find((option) => option.value === value) || options[0];

  return (
    <div className={`relative ${className}`} onBlur={() => window.setTimeout(() => setOpen(false), 120)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className="flex h-full min-h-[44px] w-full items-center justify-between rounded-xl border-2 border-cyan-500 bg-white px-4 text-left text-sm font-semibold text-slate-700 outline-none transition hover:border-cyan-600 focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10 disabled:bg-slate-50 disabled:text-slate-500"
      >
        <span className="truncate">{selectedOption?.label}</span>
        <ChevronDownIcon className={`h-4 w-4 text-cyan-600 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && !disabled && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-50 max-h-60 overflow-y-auto rounded-xl border-2 border-cyan-500 bg-white p-1 shadow-xl shadow-slate-900/10">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm font-semibold transition ${
                option.value === value
                  ? 'bg-cyan-600 text-white'
                  : 'text-slate-700 hover:bg-cyan-50 hover:text-cyan-700'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function MailSettings() {
  const [smtpServer, setSmtpServer] = React.useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = React.useState('587');
  const [username, setUsername] = React.useState('system.notification@smartwms.vn');
  const [password, setPassword] = React.useState('••••••••••••');
  const [showPassword, setShowPassword] = React.useState(false);
  const [senderEmail, setSenderEmail] = React.useState('no-reply@smartwms.vn');
  const [useTls, setUseTls] = React.useState(true);

  const [testEmail, setTestEmail] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [toastMessage, setToastMessage] = React.useState('');
  const [toastType, setToastType] = React.useState<'success' | 'error'>('success');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setToastType('success');
      setToastMessage('Đã lưu cấu hình máy chủ Email thành công.');
    }, 600);
  };

  const handleSendTest = () => {
    if (!testEmail.trim()) {
      setToastType('error');
      setToastMessage('Vui lòng nhập địa chỉ email nhận thử nghiệm.');
      return;
    }
    setTesting(true);
    setTimeout(() => {
      setTesting(false);
      setToastType('success');
      setToastMessage(`Đã gửi email thử nghiệm thành công tới ${testEmail}.`);
    }, 800);
  };

  return (
    <div className="space-y-6">
      <Toast message={toastMessage} type={toastType} onClose={() => setToastMessage('')} />

      {/* Header Badge */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2.5 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-4 py-2 text-white shadow-md">
            <Mail className="h-5 w-5 text-cyan-100" />
            <h1 className="text-lg font-bold tracking-tight text-white">Cấu hình Mail</h1>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b-2 border-slate-200 bg-cyan-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-cyan-600 p-2 text-white shadow-sm">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">Máy chủ Mail (SMTP)</h2>
              <p className="text-xs font-semibold text-slate-500">Thiết lập thông số máy chủ gửi thông báo và hóa đơn điện tử</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700">
            <CheckCircle2 size={13} />
            Đã kết nối
          </span>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Máy chủ SMTP <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Server className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-500" />
                <input
                  type="text"
                  value={smtpServer}
                  onChange={(e) => setSmtpServer(e.target.value)}
                  placeholder="smtp.example.com"
                  className="h-11 w-full rounded-xl border-2 border-cyan-500 bg-white pl-11 pr-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Cổng SMTP (Port) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={smtpPort}
                onChange={(e) => setSmtpPort(e.target.value)}
                placeholder="587 hoặc 465"
                className="h-11 w-full rounded-xl border-2 border-cyan-500 bg-white px-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Tên đăng nhập (Email) <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="user@example.com"
                className="h-11 w-full rounded-xl border-2 border-cyan-500 bg-white px-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Mật khẩu tài khoản / Mật khẩu ứng dụng <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-11 w-full rounded-xl border-2 border-cyan-500 bg-white px-4 pr-12 text-sm font-semibold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:text-cyan-600 transition"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Email người gửi hiển thị (From Address)
              </label>
              <input
                type="email"
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                placeholder="no-reply@domain.com"
                className="h-11 w-full rounded-xl border-2 border-cyan-500 bg-white px-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10"
              />
            </div>

            <div className="flex items-center">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-cyan-500 bg-cyan-50/40 p-3.5 w-full hover:bg-cyan-50 transition">
                <input
                  type="checkbox"
                  checked={useTls}
                  onChange={(e) => setUseTls(e.target.checked)}
                  className="h-5 w-5 rounded border-2 border-cyan-500 accent-cyan-600"
                />
                <div>
                  <span className="text-sm font-bold text-slate-800 block">Bật mã hóa TLS / SSL</span>
                  <span className="text-xs font-semibold text-slate-500">Khuyến nghị bắt buộc cho cổng 587 hoặc 465</span>
                </div>
              </label>
            </div>
          </div>

          <div className="border-t-2 border-slate-100 pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-6 py-3 text-sm font-bold text-white shadow-md transition hover:bg-cyan-700 disabled:opacity-60"
              >
                <Save size={18} />
                {saving ? 'Đang lưu...' : 'Lưu cấu hình mail'}
              </button>

              <div className="flex items-center gap-3">
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="Nhập email nhận thử..."
                  className="h-11 w-64 rounded-xl border-2 border-cyan-500 bg-white px-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10"
                />
                <button
                  type="button"
                  onClick={handleSendTest}
                  disabled={testing}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-cyan-500 bg-white px-5 py-2.5 text-sm font-bold text-cyan-600 shadow-sm transition hover:bg-cyan-50 hover:text-cyan-700 disabled:opacity-60"
                >
                  <Send size={16} />
                  {testing ? 'Đang gửi...' : 'Gửi thử email'}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function AiSettings() {
  const [provider, setProvider] = React.useState('openai');
  const [apiKey, setApiKey] = React.useState('sk-proj-9847291847921847918274981');
  const [showApiKey, setShowApiKey] = React.useState(false);
  const [model, setModel] = React.useState('gpt-4.1-turbo');
  const [temperature, setTemperature] = React.useState('0.7');
  const [enableAiSuggestions, setEnableAiSuggestions] = React.useState(true);
  const [autoSlottingAi, setAutoSlottingAi] = React.useState(true);

  const [saving, setSaving] = React.useState(false);
  const [toastMessage, setToastMessage] = React.useState('');
  const [toastType, setToastType] = React.useState<'success' | 'error'>('success');

  const providerOptions = [
    { value: 'openai', label: 'OpenAI GPT (Khuyên dùng)' },
    { value: 'gemini', label: 'Google Gemini Pro' },
    { value: 'anthropic', label: 'Anthropic Claude 3.5' },
    { value: 'azure', label: 'Azure OpenAI Enterprise' },
  ];

  const modelOptionsMap: Record<string, SelectOption[]> = {
    openai: [
      { value: 'gpt-4.1-turbo', label: 'GPT-4.1 Turbo (Nhanh & Chính xác)' },
      { value: 'gpt-4o', label: 'GPT-4o Omnimodel' },
      { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
    ],
    gemini: [
      { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
      { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    ],
    anthropic: [
      { value: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet' },
      { value: 'claude-3-haiku', label: 'Claude 3 Haiku' },
    ],
    azure: [
      { value: 'azure-gpt-4', label: 'Azure Deployment GPT-4' },
    ],
  };

  const currentModelOptions = modelOptionsMap[provider] || modelOptionsMap.openai;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setToastType('success');
      setToastMessage('Đã cập nhật cấu hình Trí tuệ Nhân tạo (AI) hệ thống.');
    }, 600);
  };

  return (
    <div className="space-y-6">
      <Toast message={toastMessage} type={toastType} onClose={() => setToastMessage('')} />

      {/* Header Badge */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2.5 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-4 py-2 text-white shadow-md">
            <Cpu className="h-5 w-5 text-cyan-100" />
            <h1 className="text-lg font-bold tracking-tight text-white">Cấu hình AI</h1>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b-2 border-slate-200 bg-cyan-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-cyan-600 p-2 text-white shadow-sm">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">AI & Trợ lý thông minh</h2>
              <p className="text-xs font-semibold text-slate-500">Thiết lập kết nối Model AI hỗ trợ tối ưu vị trí kho và đề xuất mua hàng</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-300 bg-cyan-100 px-3 py-1 text-xs font-extrabold text-cyan-800">
            <Sparkles size={13} />
            AI Active
          </span>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Nhà cung cấp dịch vụ AI <span className="text-red-500">*</span>
              </label>
              <StyledSelect
                value={provider}
                options={providerOptions}
                onChange={(val) => {
                  setProvider(val);
                  setModel(modelOptionsMap[val]?.[0]?.value || '');
                }}
                className="h-11 w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Mô hình AI (Model) <span className="text-red-500">*</span>
              </label>
              <StyledSelect
                value={model}
                options={currentModelOptions}
                onChange={setModel}
                className="h-11 w-full"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-slate-700 mb-2">
                API Key bí mật <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-cyan-500" />
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="h-11 w-full rounded-xl border-2 border-cyan-500 bg-white pl-11 pr-12 text-sm font-semibold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:text-cyan-600 transition"
                >
                  {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Độ sáng tạo (Temperature: 0.0 đến 1.0)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="1"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                className="h-11 w-full rounded-xl border-2 border-cyan-500 bg-white px-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10"
              />
            </div>

            <div className="space-y-3">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-cyan-500 bg-cyan-50/40 p-3 w-full hover:bg-cyan-50 transition">
                <input
                  type="checkbox"
                  checked={enableAiSuggestions}
                  onChange={(e) => setEnableAiSuggestions(e.target.checked)}
                  className="h-5 w-5 rounded border-2 border-cyan-500 accent-cyan-600"
                />
                <span className="text-sm font-bold text-slate-800">Bật gợi ý thông minh cho xuất nhập kho</span>
              </label>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-cyan-500 bg-cyan-50/40 p-3 w-full hover:bg-cyan-50 transition">
                <input
                  type="checkbox"
                  checked={autoSlottingAi}
                  onChange={(e) => setAutoSlottingAi(e.target.checked)}
                  className="h-5 w-5 rounded border-2 border-cyan-500 accent-cyan-600"
                />
                <span className="text-sm font-bold text-slate-800">Bật tính năng Smart Slotting tối ưu vị trí lưu kho</span>
              </label>
            </div>
          </div>

          <div className="border-t-2 border-slate-100 pt-6">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-6 py-3 text-sm font-bold text-white shadow-md transition hover:bg-cyan-700 disabled:opacity-60"
            >
              <Save size={18} />
              {saving ? 'Đang lưu...' : 'Lưu cấu hình AI'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StoreSettings() {
  const [storeStatus, setStoreStatus] = React.useState(true);
  const [storeName, setStoreName] = React.useState('Smart WMS - Cửa hàng Trực tuyến');
  const [bannerUrl, setBannerUrl] = React.useState('https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=1200');
  const [bannerTitle, setBannerTitle] = React.useState('Hệ thống Quản lý & Cung ứng Vật tư Kho thông minh');
  const [bannerSubtitle, setBannerSubtitle] = React.useState('Giao hàng nhanh chóng - Uy tín - Chất lượng hàng đầu');
  const [showCategoryFilter, setShowCategoryFilter] = React.useState(true);
  const [featuredSkus, setFeaturedSkus] = React.useState('SKU-SP-001, SKU-SP-002, SKU-SP-005');

  const [saving, setSaving] = React.useState(false);
  const [toastMessage, setToastMessage] = React.useState('');
  const [toastType, setToastType] = React.useState<'success' | 'error'>('success');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setToastType('success');
      setToastMessage('Đã lưu cấu hình Cửa hàng trực tuyến thành công.');
    }, 600);
  };

  return (
    <div className="space-y-6">
      <Toast message={toastMessage} type={toastType} onClose={() => setToastMessage('')} />

      {/* Header Badge */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2.5 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-4 py-2 text-white shadow-md">
            <ShoppingBag className="h-5 w-5 text-cyan-100" />
            <h1 className="text-lg font-bold tracking-tight text-white">Cấu hình bán hàng</h1>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b-2 border-slate-200 bg-cyan-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-cyan-600 p-2 text-white shadow-sm">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">Bán hàng & Shop Trực tuyến</h2>
              <p className="text-xs font-semibold text-slate-500">Thiết lập hiển thị Cửa hàng, Banner quảng cáo và Danh mục sản phẩm nổi bật</p>
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-extrabold ${
              storeStatus
                ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                : 'border-slate-300 bg-slate-100 text-slate-600'
            }`}
          >
            <Globe size={13} />
            {storeStatus ? 'Đang mở cửa' : 'Đang tạm đóng'}
          </span>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-6">
          <div className="rounded-xl border-2 border-cyan-500 bg-cyan-50/40 p-4">
            <label className="flex cursor-pointer items-center justify-between">
              <div>
                <span className="text-base font-bold text-slate-900 block">Trạng thái Cửa hàng (Shop Public)</span>
                <span className="text-xs font-semibold text-slate-500">Bật để cho phép Khách hàng xem và đặt mua hàng trực tuyến</span>
              </div>
              <input
                type="checkbox"
                checked={storeStatus}
                onChange={(e) => setStoreStatus(e.target.checked)}
                className="h-6 w-6 rounded border-2 border-cyan-500 accent-cyan-600"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Tên cửa hàng <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="h-11 w-full rounded-xl border-2 border-cyan-500 bg-white px-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10"
                required
              />
            </div>

            <div className="md:col-span-2 border-t-2 border-slate-100 pt-6">
              <h3 className="text-base font-black text-slate-900 mb-4">Cấu hình Banner trang chủ Shop</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">URL Hình ảnh Banner</label>
                  <input
                    type="text"
                    value={bannerUrl}
                    onChange={(e) => setBannerUrl(e.target.value)}
                    placeholder="https://..."
                    className="h-11 w-full rounded-xl border-2 border-cyan-500 bg-white px-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Tiêu đề Banner chính</label>
                  <input
                    type="text"
                    value={bannerTitle}
                    onChange={(e) => setBannerTitle(e.target.value)}
                    className="h-11 w-full rounded-xl border-2 border-cyan-500 bg-white px-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Phụ đề Banner</label>
                  <input
                    type="text"
                    value={bannerSubtitle}
                    onChange={(e) => setBannerSubtitle(e.target.value)}
                    className="h-11 w-full rounded-xl border-2 border-cyan-500 bg-white px-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10"
                  />
                </div>
              </div>
            </div>

            <div className="md:col-span-2 border-t-2 border-slate-100 pt-6">
              <h3 className="text-base font-black text-slate-900 mb-4">Sản phẩm & Hiển thị</h3>
              
              <div className="space-y-4">
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-cyan-500 bg-cyan-50/40 p-3.5 w-full hover:bg-cyan-50 transition">
                  <input
                    type="checkbox"
                    checked={showCategoryFilter}
                    onChange={(e) => setShowCategoryFilter(e.target.checked)}
                    className="h-5 w-5 rounded border-2 border-cyan-500 accent-cyan-600"
                  />
                  <span className="text-sm font-bold text-slate-800">Hiển thị thanh lọc theo danh mục sản phẩm trên Shop</span>
                </label>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Danh sách SKU Sản phẩm Nổi bật (Phân cách bằng dấu phẩy)
                  </label>
                  <textarea
                    rows={3}
                    value={featuredSkus}
                    onChange={(e) => setFeaturedSkus(e.target.value)}
                    placeholder="SKU-001, SKU-002, SKU-003"
                    className="w-full rounded-xl border-2 border-cyan-500 bg-white p-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t-2 border-slate-100 pt-6">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-6 py-3 text-sm font-bold text-white shadow-md transition hover:bg-cyan-700 disabled:opacity-60"
            >
              <Save size={18} />
              {saving ? 'Đang lưu...' : 'Lưu cấu hình bán hàng'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Settings() {
  return <Outlet />;
}

export { MailSettings, AiSettings, StoreSettings };
