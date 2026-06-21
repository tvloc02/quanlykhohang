# Smart WMS Frontend

Ứng dụng quản lý kho tích hợp xây dựng với **React**, **TypeScript**, **Tailwind CSS** và **Vite**.

## 🎨 Đặc điểm

- **Giao diện hiện đại** với theme màu cyan
- **Sidebar điều hướng** gọn gàng với menu thu gọn
- **Dashboard** hiển thị thống kê tổng quan
- **Quản lý sản phẩm** (CRUD, tìm kiếm, lọc)
- **Quản lý nhập hàng** (PO tracking, trạng thái)
- **Quản lý xuất hàng** (SO tracking, picking tasks)
- **Quản lý tồn kho** (stock balance, location tracking)
- **Báo cáo** (stock report, history export)
- **Nhật ký hoạt động** (audit log)
- **Cài đặt tài khoản** (profile, password, notifications)

## 📋 Yêu cầu

- Node.js 16+
- npm hoặc yarn

## 🚀 Cài đặt

```bash
cd apps/frontend
npm install
```

## 💻 Chạy phát triển

```bash
npm run dev
```

Mở [http://localhost:5173](http://localhost:5173) để xem ứng dụng.

## 🔨 Build production

```bash
npm run build
```

Thư mục `dist/` chứa bản build tối ưu hóa.

## 📁 Cấu trúc dự án

```
src/
├── app/                      # Cấu hình ứng dụng
├── features/                 # Các tính năng chính
│   ├── dashboard/           # Dashboard
│   ├── products/            # Quản lý sản phẩm
│   ├── inbound/             # Quản lý nhập hàng
│   ├── outbound/            # Quản lý xuất hàng
│   ├── inventory/           # Quản lý tồn kho
│   ├── reports/             # Báo cáo
│   ├── audit-log/           # Nhật ký hoạt động
│   └── settings/            # Cài đặt
├── shared/                  # Thành phần dùng chung
│   ├── components/          # Components
│   ├── api/                 # API client
│   └── hooks/               # Custom hooks
└── styles/                  # Style files
```

## 🎯 Các tính năng chính

### Dashboard
- Hiển thị thống kê tổng quan (người dùng, sản phẩm, báo cáo)
- Biểu đồ phân bố nhân sự
- Biểu đồ trạng thái minh chứng
- Hoạt động gần đây

### Sản phẩm
- Danh sách sản phẩm
- Tìm kiếm và lọc
- Thêm/sửa/xóa sản phẩm
- Quản lý SKU, barcode, giá cả

### Nhập hàng
- Theo dõi phiếu nhập (PO)
- Trạng thái nhập (pending, received, completed)
- Chi tiết hàng hóa
- Quản lý nhà cung cấp

### Xuất hàng
- Theo dõi đơn hàng (SO)
- Trạng thái xuất (pending, picking, shipped)
- Picking tasks
- Quản lý khách hàng

### Tồn kho
- Số lượng tồn kho thực
- Số lượng đã phân bổ
- Số lượng có sẵn
- Theo dõi vị trí lưu trữ

### Báo cáo
- Báo cáo tồn kho
- Báo cáo nhập hàng
- Báo cáo xuất hàng
- Xuất dữ liệu

## 🎨 Màu sắc theme

- **Primary**: `#06B6D4` (Cyan)
- **Primary Light**: `#7EE7F5`
- **Primary Dark**: `#0891B2`
- **Secondary**: `#CFF9FB`
- **Accent**: `#E6FBFF`

## 🔧 Công nghệ sử dụng

- **React 18** - UI framework
- **TypeScript** - Strongly typed JavaScript
- **Tailwind CSS** - Utility-first CSS
- **Vite** - Fast build tool
- **React Router** - Navigation
- **Lucide React** - Icons
- **Axios** - HTTP client

## 📝 Hướng dẫn sử dụng

1. Đăng nhập với tài khoản admin
2. Sử dụng sidebar để điều hướng
3. Mỗi trang có chức năng tương ứng
4. Sử dụng nút "Thêm" để tạo mới
5. Sử dụng bộ lọc để tìm kiếm dữ liệu

## 🤝 Kết nối Backend

Frontend kết nối với backend API tại:

```
baseURL: http://localhost:3000/api
```

Đảm bảo backend đang chạy trên cổng 3000.

## 📄 License

MIT
