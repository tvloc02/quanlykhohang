import { Cable, CheckCircle2, Database, RefreshCw, ShieldCheck } from 'lucide-react';

type DistributorIntegrationWindowProps = {
  compact?: boolean;
};

const connectors = [
  { name: 'ERP nội bộ', type: 'REST API', status: 'Sẵn sàng', lastSync: '20/06/2026 15:40' },
  { name: 'Catalog sản phẩm', type: 'CSV/SFTP', status: 'Chờ cấu hình', lastSync: 'Chưa đồng bộ' },
  { name: 'Hóa đơn điện tử', type: 'Webhook', status: 'Mock', lastSync: '20/06/2026 09:12' },
];

function statusClass(status: string) {
  if (status === 'Sẵn sàng') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'Chờ cấu hình') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-slate-200 bg-slate-100 text-slate-700';
}

export default function DistributorIntegrationWindow({ compact }: DistributorIntegrationWindowProps) {
  if (compact) {
    return (
      <div className="flex h-full flex-col gap-3">
        {/* Metric Cards Header */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-2.5 shadow-2xs">
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">API Gateway</p>
            <p className="mt-1 text-sm font-bold text-emerald-900">REST API v2</p>
          </div>
          <div className="rounded-xl border border-cyan-200 bg-cyan-50/70 p-2.5 shadow-2xs">
            <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-700">Tần suất Sync</p>
            <p className="mt-1 text-sm font-bold text-cyan-900">Tự động (Realtime)</p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-2.5 shadow-2xs">
            <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700">Kênh kết nối</p>
            <p className="mt-1 text-sm font-bold text-blue-900">3 / 3 Hoạt động</p>
          </div>
          <div className="rounded-xl border border-purple-200 bg-purple-50/70 p-2.5 shadow-2xs">
            <p className="text-[11px] font-bold uppercase tracking-wider text-purple-700">Chuẩn bảo mật</p>
            <p className="mt-1 text-sm font-bold text-purple-900">OAuth2 / TLS 1.3</p>
          </div>
        </div>

        {/* Integration Cards Grid */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {connectors.map((connector) => (
            <div key={connector.name} className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
              <div className="flex items-center justify-between gap-3">
                <p className="font-bold text-slate-900 text-sm">{connector.name}</p>
                <span className={`rounded-lg border px-2 py-0.5 text-xs font-semibold ${statusClass(connector.status)}`}>
                  {connector.status}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2">
                <span>Giao thức: <b className="text-slate-700">{connector.type}</b></span>
                <span>Lần sync: <b className="text-slate-700">{connector.lastSync}</b></span>
              </div>
            </div>
          ))}

          <div className="rounded-xl border border-cyan-200 bg-cyan-50/40 p-3 shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold text-cyan-900 text-sm">Sandbox mô phỏng WMS</p>
              <span className="rounded-lg border border-cyan-300 bg-cyan-100/80 px-2 py-0.5 text-xs font-bold text-cyan-800">
                Active
              </span>
            </div>
            <p className="mt-1.5 text-xs font-normal text-cyan-800">
              Đang thử nghiệm luồng dữ liệu tự động giữa NCC & Hệ thống quản lý kho tổng.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4">
          <CheckCircle2 className="h-6 w-6 text-emerald-600" />
          <p className="mt-3 text-xs font-black uppercase text-emerald-600">Kết nối sẵn sàng</p>
          <p className="mt-2 text-2xl font-black text-emerald-700">1</p>
        </div>
        <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-4">
          <Cable className="h-6 w-6 text-amber-600" />
          <p className="mt-3 text-xs font-black uppercase text-amber-600">Chờ cấu hình</p>
          <p className="mt-2 text-2xl font-black text-amber-700">1</p>
        </div>
        <div className="rounded-xl border-2 border-slate-200 bg-slate-50 p-4">
          <Database className="h-6 w-6 text-slate-600" />
          <p className="mt-3 text-xs font-black uppercase text-slate-500">Luồng mock</p>
          <p className="mt-2 text-2xl font-black text-slate-800">3</p>
        </div>
        <div className="rounded-xl border-2 border-cyan-200 bg-cyan-50 p-4">
          <ShieldCheck className="h-6 w-6 text-cyan-600" />
          <p className="mt-3 text-xs font-black uppercase text-cyan-600">Bảo mật</p>
          <p className="mt-2 text-2xl font-black text-cyan-700">Token</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {connectors.map((connector) => (
          <div key={connector.name} className="rounded-xl border-2 border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-black text-slate-900">{connector.name}</p>
                <p className="mt-1 text-sm font-semibold text-slate-500">{connector.type}</p>
              </div>
              <span className={`rounded-lg border px-3 py-1 text-xs font-bold ${statusClass(connector.status)}`}>{connector.status}</span>
            </div>
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase text-slate-500">Đồng bộ gần nhất</p>
              <p className="mt-2 text-sm font-bold text-slate-800">{connector.lastSync}</p>
            </div>
            <button type="button" className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
              <RefreshCw className="h-4 w-4" />
              Kiểm tra kết nối
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-xl border-2 border-cyan-100 bg-cyan-50 p-5">
        <p className="font-black text-cyan-900">Màn này đang dùng mock data</p>
        <p className="mt-2 text-sm font-semibold leading-6 text-cyan-800">
          Sau này có thể nối ERP/CRM của nhà phân phối tại đây: đồng bộ catalog, giá nhập, trạng thái PO, hóa đơn và webhook giao hàng.
        </p>
      </div>
    </div>
  );
}
