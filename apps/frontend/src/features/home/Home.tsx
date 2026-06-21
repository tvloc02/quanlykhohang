import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Package, TrendingUp, Shield, Zap, LogIn, UserPlus,
    ArrowRight, CheckCircle, Star, Target, AlertTriangle,
    ShieldCheck, Server, Database, Globe, ChevronRight, BarChart3
} from 'lucide-react';

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

export default function Home() {
    const navigate = useNavigate();

    const features = [
        {
            icon: <Package className="w-8 h-8" />,
            title: 'Quản lý kho thời gian thực',
            description: 'Kiểm soát hàng tồn kho với độ chính xác tuyệt đối. Tự động đồng bộ đa kênh.',
        },
        {
            icon: <BarChart3 className="w-8 h-8" />,
            title: 'Báo cáo OLAP thông minh',
            description: 'Dashboard trực quan, phân tích dữ liệu khổng lồ mà không làm nghẽn hệ thống core.',
        },
        {
            icon: <Shield className="w-8 h-8" />,
            title: 'Bảo mật & Phân quyền',
            description: 'Mã hóa dữ liệu đầu cuối, RBAC chi tiết đảm bảo an toàn tuyệt đối cho luồng công việc.',
        },
        {
            icon: <Zap className="w-8 h-8" />,
            title: 'Kiến trúc High Performance',
            description: 'Xử lý hàng triệu giao dịch mượt mà nhờ kiến trúc Microservices và CQRS.',
        },
    ];

    const actorRequirements = [
        {
            group: 'Quản trị nội bộ & Phân quyền (Internal)',
            icon: <Server className="w-6 h-6 text-cyan-600" />,
            actors: [
                {
                    name: 'Administrator',
                    role: 'System Admin',
                    business: 'Quản lý tài khoản, cấu hình RBAC (Role-Based Access Control) và theo dõi audit logs toàn hệ thống.',
                    risk: 'Rủi ro tự xóa tài khoản (Self-deletion) hoặc cấp quyền sai gây leo thang đặc quyền (Privilege Escalation).',
                    solution: 'Triển khai RBAC nghiêm ngặt trong NestJS Guard. Chặn hard-delete admin cuối cùng. Audit_logs thiết kế theo dạng append-only (chỉ ghi thêm).',
                },
                {
                    name: 'Warehouse Manager',
                    role: 'Manager',
                    business: 'Theo dõi dashboard hiệu suất, phê duyệt các phiếu xuất/nhập/điều chỉnh tồn kho.',
                    risk: 'Query báo cáo dữ liệu lớn (heavy queries) có thể làm treo database chính trong giờ hành chính.',
                    solution: 'Áp dụng kiến trúc CQRS. Tách biệt Read/Write DB, ưu tiên read-replica hoặc database OLAP riêng biệt cho báo cáo.',
                },
                {
                    name: 'Warehouse Staff',
                    role: 'Operator',
                    business: 'Sử dụng thiết bị cầm tay quét QR/barcode, thực hiện nhập/xuất kho và kiểm kê định kỳ.',
                    risk: 'Mất kết nối Wi-Fi tại các góc khuất trong kho làm mất dữ liệu quét đang thực hiện.',
                    solution: 'Xây dựng PWA với cơ chế Offline-first. Lưu dữ liệu tạm vào IndexedDB và đồng bộ batch/chunk khi có mạng trở lại.',
                },
            ]
        },
        {
            group: 'Đối tác & Chuỗi cung ứng (B2B)',
            icon: <Globe className="w-6 h-6 text-cyan-600" />,
            actors: [
                {
                    name: 'Supplier',
                    role: 'Partner',
                    business: 'Gửi ASN (Advance Shipping Notice) và dán mã vạch lên kiện hàng trước khi giao đến kho.',
                    risk: 'Trùng lặp mã vạch giữa nhiều nhà cung cấp khác nhau gây loạn hệ thống quét.',
                    solution: 'Mapping supplier_barcode 1-N với supplier_id. Giữ internal_sku làm định danh duy nhất; in và dán tem phụ (internal barcode) khi nhận hàng.',
                },
                {
                    name: 'Customer',
                    role: 'End User',
                    business: 'Theo dõi tiến độ đơn xuất kho và kiểm tra tồn kho theo thời gian thực trước khi đặt hàng.',
                    risk: 'Lượng truy cập lớn hoặc spam refresh kiểm tra tồn kho làm cạn kiệt connection pool của DB.',
                    solution: 'Rate limiting tại tầng API Gateway. Cache số lượng tồn kho (Inventory Cache) trên Redis với TTL phù hợp.',
                },
            ]
        },
        {
            group: 'Tích hợp hệ thống bên ngoài (External Integrations)',
            icon: <Database className="w-6 h-6 text-cyan-600" />,
            actors: [
                {
                    name: 'Mock ERP System',
                    role: 'Integration',
                    business: 'Đồng bộ hai chiều: Nhận/gửi thông tin đơn hàng và dữ liệu tài chính qua REST API/gRPC.',
                    risk: 'Kho đã trừ tồn thành công nhưng gọi API ghi nhận ERP bị lỗi mạng (Network timeout), gây bất đồng bộ dữ liệu (inconsistent state).',
                    solution: 'Triển khai Transactional Outbox Pattern kết hợp Message Queue (RabbitMQ/Kafka). Sử dụng Idempotency-Key để chống xử lý trùng lặp khi retry.',
                },
            ]
        }
    ];

    // Class dùng chung để giới hạn độ rộng nội dung
    const containerClass = "w-full mx-auto px-6 md:px-12 lg:px-24 xl:px-40";

    return (
        <div className="min-h-screen bg-white font-sans text-slate-800 selection:bg-cyan-200 selection:text-cyan-900">

            {/* Navigation */}
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
                        <a href="#" className="text-sm font-medium text-slate-600 hover:text-cyan-600 transition">Giải pháp</a>
                        <a href="#" className="text-sm font-medium text-slate-600 hover:text-cyan-600 transition">Tính năng</a>
                        <a href="#" className="text-sm font-medium text-slate-600 hover:text-cyan-600 transition">Tài liệu API</a>
                        <div className="h-4 w-[1px] bg-slate-200 mx-2"></div>
                        <Button onClick={() => navigate('/login')} variant="ghost" className="text-slate-700">
                            Đăng nhập
                        </Button>
                        <Button onClick={() => navigate('/signup')} variant="primary" className="shadow-cyan-600/20">
                            Dùng thử miễn phí
                        </Button>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden bg-slate-50">
                {/* Background Grid Pattern */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>

                {/* Decorative blur */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] opacity-30 bg-cyan-300 rounded-[100%] blur-[120px] mix-blend-multiply pointer-events-none"></div>

                <div className={`${containerClass} relative z-10`}>
                    <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">

                        {/* Hero Content (Trái - 7 cột) */}
                        <div className="lg:col-span-7 max-w-3xl">
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-700 font-medium text-sm mb-8 shadow-sm">
                                <span className="flex h-2 w-2 rounded-full bg-cyan-500 animate-pulse"></span>
                                Phiên bản 2.0 Core-Architecture đã ra mắt
                            </div>

                            {/* CHỮ TO HƠN, ẤN TƯỢNG HƠN */}
                            <h2 className="text-5xl md:text-6xl lg:text-[4.5rem] font-black text-slate-900 mb-8 leading-[1.1] tracking-tight">
                                Quản lý kho <br className="hidden md:block"/>
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-blue-600">
                  thông minh hơn
                </span>
                            </h2>

                            {/* MÔ TẢ TO HƠN, RÕ RÀNG HƠN */}
                            <p className="text-xl md:text-2xl text-slate-600 mb-10 leading-relaxed font-light max-w-2xl">
                                Giải pháp quản lý kho toàn diện giúp <strong className="font-semibold text-slate-800">tối ưu hóa hoạt động</strong>, giảm chi phí vận hành và <strong className="font-semibold text-slate-800">tăng hiệu suất kinh doanh lên gấp 3 lần</strong>.
                            </p>

                            <div className="flex flex-col sm:flex-row gap-4 mb-12">
                                <Button onClick={() => navigate('/signup')} variant="primary" size="lg" className="flex items-center gap-2 group">
                                    Khởi tạo Workspace
                                    <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                </Button>
                                <Button onClick={() => navigate('/demo')} variant="ghost" size="lg" className="bg-white border border-slate-200 shadow-sm">
                                    Xem tài liệu kỹ thuật
                                </Button>
                            </div>
                        </div>

                        {/* Hero Graphics (Phải - 5 cột) - MOCKUP UI NHÌN THẬT HƠN */}
                        <div className="lg:col-span-5 relative">
                            {/* Card giả lập Giao diện phần mềm */}
                            <div className="relative rounded-2xl bg-white border border-slate-200 shadow-2xl shadow-slate-200/50 overflow-hidden transform md:rotate-2 hover:rotate-0 transition-transform duration-500">
                                {/* Header thanh công cụ giả */}
                                <div className="bg-slate-100 border-b border-slate-200 px-4 py-3 flex items-center gap-2">
                                    <div className="flex gap-1.5">
                                        <div className="w-3 h-3 rounded-full bg-red-400"></div>
                                        <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                                        <div className="w-3 h-3 rounded-full bg-green-400"></div>
                                    </div>
                                    <div className="mx-auto bg-white border border-slate-200 rounded-md px-24 py-1.5 text-xs text-slate-400 font-mono">
                                        wms.yourcompany.com
                                    </div>
                                </div>

                                {/* Nội dung Mockup */}
                                <div className="p-6">
                                    <div className="flex justify-between items-center mb-6">
                                        <div>
                                            <h4 className="font-bold text-slate-900">Tổng quan tồn kho</h4>
                                            <p className="text-xs text-slate-500">Cập nhật: Vài giây trước</p>
                                        </div>
                                        <div className="bg-cyan-50 text-cyan-700 text-xs font-bold px-3 py-1.5 rounded-lg border border-cyan-100">
                                            Syncing...
                                        </div>
                                    </div>

                                    {/* Fake stats */}
                                    <div className="grid grid-cols-2 gap-4 mb-6">
                                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                            <p className="text-xs text-slate-500 mb-1">Tổng mã SKU</p>
                                            <p className="text-2xl font-black text-slate-800">12,450</p>
                                            <p className="text-xs text-green-600 mt-1 flex items-center gap-1"><TrendingUp size={12}/> +2.4%</p>
                                        </div>
                                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                            <p className="text-xs text-slate-500 mb-1">Đơn đang xuất</p>
                                            <p className="text-2xl font-black text-slate-800">842</p>
                                            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1"><AlertTriangle size={12}/> 12 High priority</p>
                                        </div>
                                    </div>

                                    {/* Fake table */}
                                    <div className="space-y-3">
                                        <div className="h-8 bg-slate-100 rounded-md w-full mb-2"></div>
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className="flex items-center justify-between border-b border-slate-50 pb-2">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded bg-cyan-100 flex items-center justify-center text-xs text-cyan-700 font-bold">ITM</div>
                                                    <div>
                                                        <div className="w-24 h-3 bg-slate-200 rounded mb-1.5"></div>
                                                        <div className="w-16 h-2 bg-slate-100 rounded"></div>
                                                    </div>
                                                </div>
                                                <div className="w-12 h-4 bg-green-100 rounded-full"></div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Floating Element */}
                            <div className="absolute -bottom-6 -left-10 bg-white p-4 rounded-xl shadow-xl border border-slate-100 flex items-center gap-4 animate-bounce" style={{animationDuration: '3s'}}>
                                <div className="bg-green-100 p-2 rounded-full text-green-600">
                                    <CheckCircle size={24} />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-800">ERP Synced</p>
                                    <p className="text-xs text-slate-500">2,000 records / 0.5s</p>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </section>

            {/* Trusted By Section (Mới - làm cho thật hơn) */}
            <section className="border-y border-slate-200 bg-white py-10">
                <div className={containerClass}>
                    <p className="text-center text-sm font-semibold text-slate-400 uppercase tracking-widest mb-8">
                        Kiến trúc hệ thống đáp ứng tiêu chuẩn của các đối tác
                    </p>
                    <div className="flex flex-wrap justify-center items-center gap-12 md:gap-24 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
                        {/* Giả lập logo đối tác bằng Text cho tiện */}
                        <div className="text-xl font-black text-slate-800 font-serif">TechLogistics</div>
                        <div className="text-2xl font-black text-slate-800 italic tracking-tighter">FastExpress</div>
                        <div className="text-xl font-bold text-slate-800 flex items-center gap-1"><Package size={24}/> OmniWare</div>
                        <div className="text-xl font-bold text-slate-800 tracking-widest">GLOBAL<span className="font-light">SUPPLY</span></div>
                    </div>
                </div>
            </section>

            {/* Features Section - Tinh gọn lại */}
            <section className="bg-white py-24">
                <div className={containerClass}>
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">Nền tảng vững chắc cho quy mô doanh nghiệp</h2>
                        <p className="text-lg text-slate-600">Thiết kế tinh gọn, dễ dàng sử dụng ở frontend nhưng sở hữu sức mạnh xử lý dữ liệu và logic phức tạp ở backend.</p>
                    </div>

                    <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6">
                        {features.map((feature, idx) => (
                            <div key={idx} className="bg-slate-50 rounded-2xl p-6 border border-slate-100 hover:border-cyan-300 hover:bg-cyan-50/50 transition-all duration-300">
                                <div className="text-cyan-600 bg-white w-14 h-14 rounded-xl flex items-center justify-center mb-5 shadow-sm border border-slate-100">
                                    {feature.icon}
                                </div>
                                <h4 className="text-lg font-bold text-slate-900 mb-2">{feature.title}</h4>
                                <p className="text-sm text-slate-600 leading-relaxed">{feature.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ACTOR REQUIREMENTS SECTION (Thiết kế lại Khách quan & Chuyên nghiệp) */}
            <section className="bg-slate-50 py-24 border-y border-slate-200">
                <div className={containerClass}>
                    <div className="max-w-4xl mb-16">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-200/50 text-slate-700 font-semibold text-xs uppercase tracking-wider mb-4">
                            <Server size={14} /> Architecture Blueprint
                        </div>
                        <h2 className="text-3xl md:text-5xl font-black text-slate-900 mb-6 tracking-tight">
                            Đặc tả kiến trúc hệ thống
                        </h2>
                        <p className="text-lg text-slate-600 font-normal leading-relaxed">
                            Hệ thống không chỉ giải quyết bài toán giao diện (UI). Các luồng nghiệp vụ phức tạp, rủi ro (Edge Cases) từ mất mạng, phân quyền chéo, đến race condition khi gọi API đều có lớp xử lý tương ứng ở mức Backend & Database.
                        </p>
                    </div>

                    <div className="space-y-12">
                        {actorRequirements.map((group, groupIdx) => (
                            <div key={groupIdx} className="relative">
                                {/* Header của Group */}
                                <div className="flex items-center gap-3 mb-6 pb-2 border-b-2 border-slate-200">
                                    {group.icon}
                                    <h3 className="text-2xl font-bold text-slate-800">{group.group}</h3>
                                </div>

                                {/* Grid các Actor */}
                                <div className="grid lg:grid-cols-2 gap-6">
                                    {group.actors.map((actor, idx) => (
                                        <div key={idx} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">

                                            {/* Actor Header */}
                                            <div className="bg-slate-100/50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                                                <div className="flex items-center gap-2">
                                                    <UserPlus className="w-5 h-5 text-slate-500" />
                                                    <span className="font-bold text-slate-800 text-lg">{actor.name}</span>
                                                </div>
                                                <span className="text-xs font-mono bg-white border border-slate-200 px-2.5 py-1 rounded-md text-slate-600">
                          {actor.role}
                        </span>
                                            </div>

                                            {/* Actor Details */}
                                            <div className="p-6 flex-1 space-y-6">
                                                {/* Nghiệp vụ */}
                                                <div>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Target className="w-4 h-4 text-slate-400" />
                                                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Nghiệp vụ cốt lõi</h4>
                                                    </div>
                                                    <p className="text-sm text-slate-700 leading-relaxed pl-6">{actor.business}</p>
                                                </div>

                                                {/* Rủi ro */}
                                                <div className="bg-red-50/50 -mx-6 px-6 py-4 border-y border-red-50">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <AlertTriangle className="w-4 h-4 text-red-500" />
                                                        <h4 className="text-xs font-bold uppercase tracking-wider text-red-700">Rủi ro / Edge Case</h4>
                                                    </div>
                                                    <p className="text-sm text-red-900/80 leading-relaxed pl-6">{actor.risk}</p>
                                                </div>

                                                {/* Giải pháp */}
                                                <div>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <ShieldCheck className="w-4 h-4 text-teal-600" />
                                                        <h4 className="text-xs font-bold uppercase tracking-wider text-teal-700">Giải pháp kỹ thuật</h4>
                                                    </div>
                                                    <p className="text-sm text-slate-700 leading-relaxed pl-6 font-medium">{actor.solution}</p>
                                                </div>
                                            </div>

                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-24 relative overflow-hidden bg-slate-900">
                {/* Abstract background elements */}
                <div className="absolute inset-0 opacity-20">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
                    <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-600 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2"></div>
                </div>

                <div className={`${containerClass} relative z-10 text-center max-w-4xl mx-auto`}>
                    <h2 className="text-4xl md:text-5xl font-black text-white mb-6">Sẵn sàng để chuẩn hóa quy trình kho?</h2>
                    <p className="text-xl text-slate-300 mb-10 font-light">
                        Trải nghiệm hệ thống WMS được xây dựng trên nền tảng kỹ thuật hiện đại nhất. Đảm bảo tính toàn vẹn dữ liệu cho mọi quy mô doanh nghiệp.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Button onClick={() => navigate('/signup')} variant="primary" size="lg" className="px-8 bg-cyan-500 hover:bg-cyan-400 text-slate-900">
                            Khởi tạo hệ thống ngay
                        </Button>
                        <Button onClick={() => navigate('/contact')} variant="ghost" size="lg" className="border border-slate-700 text-white hover:bg-slate-800">
                            Liên hệ tư vấn kiến trúc
                        </Button>
                    </div>
                </div>
            </section>

            {/* Footer */}
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
        </div>
    );
}