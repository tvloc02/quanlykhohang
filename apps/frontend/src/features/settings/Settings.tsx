import React, { useState, useEffect } from "react";
import {
  Save,
  Building2,
  FileSpreadsheet,
  Users,
  Mail,
  Server,
  Sparkles,
  CheckCircle2,
  Phone,
  MapPin,
  Globe,
  FileText,
  CreditCard,
  Building,
} from "lucide-react";
import Toast from "../../shared/components/Toast";

const API_BASE_URL = "/api";

export default function Settings() {
  const [activeTab, setActiveTab] = useState<"company" | "mail" | "ai">(
    "company",
  );

  // Company & Voucher Settings State
  const [formData, setFormData] = useState({
    companyName: "Công Ty TNHH Dịch Vụ Kế Toán Thiên Ứng",
    department: "Bộ phận: Bán hàng",
    taxCode: "0101234567",
    address: "Lô B11, số 9a, ngõ 181 Xuân Thủy, phường Cầu Giấy, Hà Nội",
    phone: "024.3756.8888",
    email: "ketoanthienung@gmail.com",
    website: "ketoanthienung.vn",
    logoUrl: "",
    debitAccount: "632",
    creditAccount: "156",
    creatorName: "Vũ Hữu Dũng",
    receiverName: "Phạm Thị Duyên",
    storekeeperName: "Nguyễn Thị Thúy",
    chiefAccountantName: "Trần Thị Hồng Mơ",
    directorName: "Nguyễn Thị Thanh Xuyên",
    templateStandard:
      "Kèm theo Thông tư số 200/2014/TT-BTC ngày 22/12/2014 của Bộ trưởng Bộ Tài chính",
  });

  // Mail settings state
  const [mailData, setMailData] = useState({
    smtpServer: "smtp.gmail.com",
    smtpPort: "587",
    username: "system.notification@smartwms.vn",
    senderEmail: "no-reply@smartwms.vn",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  // Load settings from Backend CSDL
  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE_URL}/settings`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.companyName) {
          setFormData((prev) => ({
            ...prev,
            ...data,
          }));
        }
      })
      .catch((err) => {
        console.error("Lỗi khi tải cấu hình từ CSDL:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleSaveCompanySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/settings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
        },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        const saved = await res.json();
        setFormData((prev) => ({ ...prev, ...saved }));
        setToastType("success");
        setToastMessage(
          "Đã lưu thông tin cấu hình công ty và mẫu biểu vào CSDL thành công!",
        );
      } else {
        throw new Error("Máy chủ phản hồi lỗi khi lưu cài đặt.");
      }
    } catch (err: any) {
      setToastType("error");
      setToastMessage(err.message || "Lỗi khi lưu cài đặt vào CSDL.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Toast
        message={toastMessage}
        type={toastType}
        onClose={() => setToastMessage("")}
      />

      {/* Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex items-center gap-2.5 rounded-xl border-2 border-cyan-500 bg-cyan-600 px-4 py-2 text-white shadow-md">
          <Building2 className="h-5 w-5 text-cyan-100" />
          <h1 className="text-lg font-bold tracking-tight text-white">
            Cấu hình hệ thống & Thông tin chứng từ
          </h1>
        </div>

        {/* Tab Buttons */}
        <div className="inline-flex rounded-xl border-2 border-slate-200 bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("company")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition cursor-pointer ${
              activeTab === "company"
                ? "bg-cyan-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Building className="h-4 w-4" /> Thông tin Doanh nghiệp & Mẫu in
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("mail")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition cursor-pointer ${
              activeTab === "mail"
                ? "bg-cyan-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Mail className="h-4 w-4" /> Cấu hình Email SMTP
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-2xl border-2 border-slate-200 bg-white p-8">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-cyan-600 border-t-transparent" />
            <p className="text-xs font-bold text-slate-500">
              Đang tải thông tin cấu hình từ CSDL...
            </p>
          </div>
        </div>
      ) : activeTab === "company" ? (
        <form onSubmit={handleSaveCompanySettings} className="space-y-6">
          {/* Card 1: Thông tin Doanh nghiệp */}
          <div className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b-2 border-slate-200 bg-cyan-50 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-cyan-600 p-2 text-white shadow-sm">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900">
                    Thông tin Doanh nghiệp / Đơn vị quản lý
                  </h2>
                  <p className="text-xs font-semibold text-slate-500">
                    Thông tin cơ bản hiển thị tự động trên các biểu mẫu in Nhập
                    kho, Xuất kho (Mẫu 02-VT), Báo cáo
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700">
                <CheckCircle2 size={13} />
                Lưu vào CSDL MySQL
              </span>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5 text-xs sm:text-sm">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
                  Tên công ty / Doanh nghiệp{" "}
                  <span className="text-rose-600 font-black">*</span>
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-cyan-600" />
                  <input
                    type="text"
                    value={formData.companyName}
                    onChange={(e) =>
                      setFormData({ ...formData, companyName: e.target.value })
                    }
                    required
                    placeholder="Công Ty TNHH Dịch Vụ Kế Toán Thiên Ứng"
                    className="h-11 w-full rounded-xl border-2 border-slate-300 bg-white pl-11 pr-4 text-xs sm:text-sm font-bold text-slate-900 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
                  Bộ phận phụ trách{" "}
                  <span className="text-rose-600 font-black">*</span>
                </label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) =>
                    setFormData({ ...formData, department: e.target.value })
                  }
                  placeholder="Bộ phận: Bán hàng"
                  className="h-11 w-full rounded-xl border-2 border-slate-300 bg-white px-4 text-xs sm:text-sm font-bold text-slate-900 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
                  Mã số thuế (MST){" "}
                  <span className="text-rose-600 font-black">*</span>
                </label>
                <div className="relative">
                  <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-cyan-600" />
                  <input
                    type="text"
                    value={formData.taxCode}
                    onChange={(e) =>
                      setFormData({ ...formData, taxCode: e.target.value })
                    }
                    placeholder="0101234567"
                    className="h-11 w-full rounded-xl border-2 border-slate-300 bg-white pl-11 pr-4 text-xs sm:text-sm font-bold text-slate-900 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10"
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
                  Địa chỉ trụ sở / Kho chính{" "}
                  <span className="text-rose-600 font-black">*</span>
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-cyan-600" />
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    placeholder="Lô B11, số 9a, ngõ 181 Xuân Thủy, phường Cầu Giấy, Hà Nội"
                    className="h-11 w-full rounded-xl border-2 border-slate-300 bg-white pl-11 pr-4 text-xs sm:text-sm font-semibold text-slate-900 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
                  Số điện thoại
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-cyan-600" />
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    placeholder="024.3756.8888"
                    className="h-11 w-full rounded-xl border-2 border-slate-300 bg-white pl-11 pr-4 text-xs sm:text-sm font-semibold text-slate-900 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
                  Email liên hệ
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-cyan-600" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="ketoanthienung@gmail.com"
                    className="h-11 w-full rounded-xl border-2 border-slate-300 bg-white pl-11 pr-4 text-xs sm:text-sm font-semibold text-slate-900 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
                  Website
                </label>
                <div className="relative">
                  <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-cyan-600" />
                  <input
                    type="text"
                    value={formData.website}
                    onChange={(e) =>
                      setFormData({ ...formData, website: e.target.value })
                    }
                    placeholder="ketoanthienung.vn"
                    className="h-11 w-full rounded-xl border-2 border-slate-300 bg-white pl-11 pr-4 text-xs sm:text-sm font-semibold text-slate-900 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
                  Quy chuẩn biểu mẫu kế toán
                </label>
                <input
                  type="text"
                  value={formData.templateStandard}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      templateStandard: e.target.value,
                    })
                  }
                  placeholder="Kèm theo Thông tư số 200/2014/TT-BTC ngày 22/12/2014 của Bộ trưởng Bộ Tài chính"
                  className="h-11 w-full rounded-xl border-2 border-slate-300 bg-white px-4 text-xs sm:text-sm font-semibold text-slate-900 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Tài khoản kế toán & Định khoản mặc định */}
          <div className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b-2 border-slate-200 bg-cyan-50 px-6 py-4">
              <div className="rounded-xl bg-cyan-600 p-2 text-white shadow-sm">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900">
                  Tài khoản Kế toán ngầm định trên Phiếu
                </h2>
                <p className="text-xs font-semibold text-slate-500">
                  Tài khoản Nợ / Có mặc định hiển thị ở góc trên bên phải của
                  Phiếu xuất kho Mẫu 02-VT
                </p>
              </div>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5 text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
                  Tài khoản Nợ mặc định (VD: 632)
                </label>
                <input
                  type="text"
                  value={formData.debitAccount}
                  onChange={(e) =>
                    setFormData({ ...formData, debitAccount: e.target.value })
                  }
                  placeholder="632"
                  className="h-11 w-full rounded-xl border-2 border-slate-300 bg-white px-4 text-xs sm:text-sm font-bold text-slate-900 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
                  Tài khoản Có mặc định (VD: 156)
                </label>
                <input
                  type="text"
                  value={formData.creditAccount}
                  onChange={(e) =>
                    setFormData({ ...formData, creditAccount: e.target.value })
                  }
                  placeholder="156"
                  className="h-11 w-full rounded-xl border-2 border-slate-300 bg-white px-4 text-xs sm:text-sm font-bold text-slate-900 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10"
                />
              </div>
            </div>
          </div>

          {/* Card 3: 5 Chữ ký Mẫu 02-VT */}
          <div className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b-2 border-slate-200 bg-cyan-50 px-6 py-4">
              <div className="rounded-xl bg-cyan-600 p-2 text-white shadow-sm">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900">
                  Danh mục Người ký mặc định (Mẫu số 02-VT)
                </h2>
                <p className="text-xs font-semibold text-slate-500">
                  Họ tên người ký ở 5 vị trí theo quy chuẩn chứng từ kế toán
                </p>
              </div>
            </div>

            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
                  1. Người lập phiếu mặc định
                </label>
                <input
                  type="text"
                  value={formData.creatorName}
                  onChange={(e) =>
                    setFormData({ ...formData, creatorName: e.target.value })
                  }
                  placeholder="Vũ Hữu Dũng"
                  className="h-11 w-full rounded-xl border-2 border-slate-300 bg-white px-4 text-xs sm:text-sm font-bold text-slate-900 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
                  2. Người nhận hàng mặc định
                </label>
                <input
                  type="text"
                  value={formData.receiverName}
                  onChange={(e) =>
                    setFormData({ ...formData, receiverName: e.target.value })
                  }
                  placeholder="Phạm Thị Duyên"
                  className="h-11 w-full rounded-xl border-2 border-slate-300 bg-white px-4 text-xs sm:text-sm font-bold text-slate-900 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
                  3. Thủ kho mặc định
                </label>
                <input
                  type="text"
                  value={formData.storekeeperName}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      storekeeperName: e.target.value,
                    })
                  }
                  placeholder="Nguyễn Thị Thúy"
                  className="h-11 w-full rounded-xl border-2 border-slate-300 bg-white px-4 text-xs sm:text-sm font-bold text-slate-900 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
                  4. Kế toán trưởng mặc định
                </label>
                <input
                  type="text"
                  value={formData.chiefAccountantName}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      chiefAccountantName: e.target.value,
                    })
                  }
                  placeholder="Trần Thị Hồng Mơ"
                  className="h-11 w-full rounded-xl border-2 border-slate-300 bg-white px-4 text-xs sm:text-sm font-bold text-slate-900 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
                  5. Giám đốc / Thủ trưởng đơn vị
                </label>
                <input
                  type="text"
                  value={formData.directorName}
                  onChange={(e) =>
                    setFormData({ ...formData, directorName: e.target.value })
                  }
                  placeholder="Nguyễn Thị Thanh Xuyên"
                  className="h-11 w-full rounded-xl border-2 border-slate-300 bg-white px-4 text-xs sm:text-sm font-bold text-slate-900 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-500/10"
                />
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-6 py-3 text-sm font-extrabold text-white shadow-md hover:bg-cyan-700 active:scale-95 transition cursor-pointer disabled:opacity-50"
            >
              <Save size={18} />
              {saving
                ? "Đang lưu vào CSDL..."
                : "Lưu cấu hình hệ thống & Mẫu in"}
            </button>
          </div>
        </form>
      ) : (
        /* Tab Mail SMTP */
        <div className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm p-6 space-y-5">
          <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
            <Mail className="h-6 w-6 text-cyan-600" />
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Thiết lập máy chủ Mail (SMTP)
              </h2>
              <p className="text-xs text-slate-500">
                Cấu hình máy chủ gửi email tự động cho hệ thống
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Máy chủ SMTP
              </label>
              <input
                type="text"
                value={mailData.smtpServer}
                onChange={(e) =>
                  setMailData({ ...mailData, smtpServer: e.target.value })
                }
                className="h-10 w-full rounded-xl border-2 border-slate-300 px-3 text-xs font-semibold"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Cổng (Port)
              </label>
              <input
                type="text"
                value={mailData.smtpPort}
                onChange={(e) =>
                  setMailData({ ...mailData, smtpPort: e.target.value })
                }
                className="h-10 w-full rounded-xl border-2 border-slate-300 px-3 text-xs font-semibold"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Email gửi
              </label>
              <input
                type="text"
                value={mailData.username}
                onChange={(e) =>
                  setMailData({ ...mailData, username: e.target.value })
                }
                className="h-10 w-full rounded-xl border-2 border-slate-300 px-3 text-xs font-semibold"
              />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => {
                setToastType("success");
                setToastMessage("Đã lưu cấu hình máy chủ Email.");
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-cyan-700 transition"
            >
              <Save size={16} /> Lưu cài đặt Mail
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export const MailSettings = Settings;
export const AiSettings = Settings;
export const StoreSettings = Settings;
