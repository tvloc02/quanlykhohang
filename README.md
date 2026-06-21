# Smart WMS - Hệ thống quản lý kho thông minh

Ứng dụng web toàn diện quản lý kho với backend NestJS + TypeORM và frontend React + TypeScript.

## 📋 Mục lục

- [Yêu cầu hệ thống](#yêu-cầu-hệ-thống)
- [Cấu trúc dự án](#cấu-trúc-dự-án)
- [Backend Setup](#backend-setup)
- [Frontend Setup](#frontend-setup)
- [Chạy ứng dụng](#chạy-ứng-dụng)
- [Database Setup](#database-setup)
- [Các tính năng](#các-tính-năng-chính)

## 🖥️ Yêu cầu hệ thống

- Node.js 16+
- npm hoặc yarn
- MySQL 5.7+
- Docker & Docker Compose (tùy chọn)

## 📁 Cấu trúc dự án

```
smart-wms/
├── apps/
│   ├── backend/              # NestJS backend API
│   │   ├── src/
│   │   │   ├── auth/        # Authentication module
│   │   │   ├── users/       # Users management
│   │   │   ├── products/    # Product catalog
│   │   │   ├── categories/  # Product categories
│   │   │   ├── suppliers/   # Suppliers management
│   │   │   ├── customers/   # Customers management
│   │   │   ├── inbound/     # Inbound receipts & details
│   │   │   ├── outbound/    # Outbound orders & picking
│   │   │   ├── inventory/   # Stock balance management
│   │   │   ├── delivery/    # Delivery orders
│   │   │   ├── reports/     # Reports & analytics
│   │   │   └── database/    # Database config & migrations
│   │   ├── migrations/       # Database migrations
│   │   └── package.json
│   │
│   └── frontend/            # React frontend
│       ├── src/
│       │   ├── features/    # Feature modules
│       │   ├── shared/      # Shared components & utilities
│       │   ├── styles/      # Styles
│       │   └── App.tsx
│       └── package.json
│
├── docker-compose.yml
└── package.json (root)
```

## 🚀 Backend Setup

### 1. Cài đặt dependencies

```bash
cd apps/backend
npm install
```

### 2. Cấu hình environment

Tạo file `.env` từ `.env.example`:

```bash
cp .env.example .env
```

Chỉnh sửa `.env`:

```env
DATABASE_URL=mysql://root:root@localhost:3306/smart_wms
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRATION=24h
NODE_ENV=development
PORT=3000
```

### 3. Setup Database

#### Option A: Dùng Docker Compose

```bash
cd ../..
docker-compose up -d
```

#### Option B: Local MySQL

Tạo database:

```sql
CREATE DATABASE smart_wms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 4. Chạy migrations

```bash
cd apps/backend
npm run migration:run
```

### 5. Seed dữ liệu

```bash
npm run seed:run
```

### 6. Chạy backend

```bash
# Development mode
npm run start:dev

# Production build
npm run build
npm start
```

Backend sẽ chạy tại: `http://localhost:3000`

## 🎨 Frontend Setup

### 1. Cài đặt dependencies

```bash
cd apps/frontend
npm install
```

### 2. Cấu hình environment

Tạo file `.env` từ `.env.example`:

```bash
cp .env.example .env
```

### 3. Chạy frontend

```bash
# Development mode
npm run dev

# Production build
npm run build

# Preview build
npm run preview
```

Frontend sẽ chạy tại: `http://localhost:5173`

## 🎯 Chạy ứng dụng

### Chạy cả backend và frontend

**Terminal 1 - Backend:**

```bash
cd apps/backend
npm run start:dev
```

**Terminal 2 - Frontend:**

```bash
cd apps/frontend
npm run dev
```

Sau đó mở trình duyệt:
- **Frontend:** http://localhost:5173
- **API:** http://localhost:3000/api

### Login credentials

- **Email:** admin@example.com
- **Password:** Admin@123

## 🗄️ Database Setup

### Migrations

```bash
# Chạy tất cả migrations
npm run migration:run

# Revert migrations
npm run migration:revert
```

### Seed data

```bash
npm run seed:run
```

Dữ liệu sẽ tạo:
- 3 roles: admin, manager, staff
- 1 admin user (admin@example.com)
- 1 category: General
- 1 supplier: Default Supplier
- 1 customer: Default Customer
- 1 sample product (SKU-001)
- 1 stock balance entry

## 📊 Các tính năng chính

### Dashboard
- Thống kê tổng quan
- Biểu đồ phân bố nhân sự
- Biểu đồ trạng thái minh chứng
- Hoạt động gần đây

### Quản lý catalog
- **Sản phẩm:** CRUD, search, filter, SKU management
- **Danh mục:** Category management
- **Nhà cung cấp:** Supplier information & tracking
- **Khách hàng:** Customer management & analytics

### Quản lý kho
- **Nhập hàng:** PO creation, receipt tracking, detail management
- **Xuất hàng:** SO creation, picking tasks, shipping
- **Giao hàng:** Delivery tracking & driver assignment
- **Tồn kho:** Stock balance, allocation, location tracking

### Reports & Analytics
- Stock report
- Inbound/outbound history
- Exportable data

### Audit & Settings
- Activity log
- User profile management
- Password change
- Notification settings

## 🔐 Authentication

Ứng dụng sử dụng JWT authentication:

- JWT token được tạo khi đăng nhập
- Token được lưu trong localStorage
- Mỗi API request bao gồm token trong header Authorization
- Token hết hạn sau 24 giờ

## 🛠️ Công nghệ sử dụng

### Backend
- **NestJS 10** - Progressive Node.js framework
- **TypeORM 0.3** - ORM cho TypeScript
- **MySQL 2** - Database driver
- **JWT** - Token-based authentication
- **Passport** - Authentication middleware
- **Class Validator** - Data validation
- **bcryptjs** - Password hashing

### Frontend
- **React 18** - UI framework
- **TypeScript** - Strongly typed JavaScript
- **Tailwind CSS** - Utility-first CSS
- **Vite** - Fast build tool
- **React Router 6** - Navigation
- **Lucide React** - Icons
- **Axios** - HTTP client

## 📄 License

MIT

## 👥 Contributors

- Dương Ngọc Anh

