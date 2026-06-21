# Getting Started - Smart WMS

Hướng dẫn chi tiết để bắt đầu với Smart WMS.

## 📋 Điều kiện tiên quyết

Trước khi bắt đầu, đảm bảo bạn đã cài đặt:

- **Node.js 16+** - [Download](https://nodejs.org/)
- **npm 8+** - Đi kèm với Node.js
- **MySQL 5.7+** - [Download](https://www.mysql.com/downloads/) hoặc dùng Docker
- **Git** - [Download](https://git-scm.com/)

## 🚀 Quick Start (5 phút)

### 1. Clone/Open Project

```bash
cd /path/to/smart-wms
```

### 2. Setup Backend

```bash
cd apps/backend

# Cài đặt dependencies
npm install

# Tạo .env file
cp .env.example .env

# Database setup (chọn một)
# Option A: Docker (dễ nhất)
cd ../.. && docker-compose up -d

# Option B: Local MySQL (tạo database)
mysql -u root -p < setup.sql
```

### 3. Initialize Database

```bash
cd apps/backend

# Chạy migrations
npm run migration:run

# Seed dữ liệu mẫu
npm run seed:run
```

### 4. Start Backend

```bash
npm run start:dev
```

Bạn sẽ thấy:
```
[Nest] 12345  - 06/19/2026, 10:00:00 AM     LOG [NestFactory] Nest application successfully started
```

✅ Backend chạy tại: `http://localhost:3000`

### 5. Setup Frontend (Terminal mới)

```bash
cd apps/frontend

# Cài đặt dependencies
npm install

# Chạy dev server
npm run dev
```

✅ Frontend chạy tại: `http://localhost:5173`

### 6. Login

Mở http://localhost:5173 và đăng nhập:
- **Email:** admin@example.com
- **Password:** Admin@123

---

## 🐳 Docker Setup (Recommended)

Nếu bạn dùng Docker, quá trình sẽ dễ dàng hơn:

### 1. Cài đặt Docker

- [Docker Desktop](https://www.docker.com/products/docker-desktop)

### 2. Start Services

```bash
cd smart-wms (root directory)
docker-compose up -d
```

Lệnh này sẽ:
- Tạo MySQL container (port 3306)
- Tạo database `smart_wms`

### 3. Kiểm tra MySQL running

```bash
docker ps
```

Bạn sẽ thấy `mysql:8.0` container running.

### 4. Stop Services

```bash
docker-compose down
```

---

## 📁 Cấu trúc thư mục

```
smart-wms/
├── apps/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── app.module.ts         ← Root module
│   │   │   ├── main.ts               ← Entry point
│   │   │   ├── auth/                 ← Login, JWT
│   │   │   ├── products/             ← Product CRUD
│   │   │   ├── inbound/              ← Receipts
│   │   │   ├── outbound/             ← Orders
│   │   │   ├── inventory/            ← Stock
│   │   │   └── database/             ← Migrations, seed
│   │   ├── migrations/               ← Database migrations
│   │   ├── .env.example
│   │   └── package.json
│   │
│   └── frontend/
│       ├── src/
│       │   ├── App.tsx               ← Main component
│       │   ├── features/             ← Page components
│       │   │   ├── auth/
│       │   │   ├── dashboard/
│       │   │   ├── products/
│       │   │   ├── inbound/
│       │   │   ├── outbound/
│       │   │   ├── delivery/
│       │   │   ├── inventory/
│       │   │   ├── reports/
│       │   │   └── settings/
│       │   └── shared/               ← Components, utilities
│       ├── .env.example
│       └── package.json
│
└── docker-compose.yml
```

---

## 🔧 Troubleshooting

### ❌ "Cannot find module 'mysql2'"

```bash
cd apps/backend
npm install
```

### ❌ "Port 3000 is already in use"

```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS/Linux
lsof -i :3000
kill -9 <PID>
```

### ❌ "Cannot connect to database"

```bash
# Kiểm tra MySQL running
docker ps  # hoặc Services nếu local MySQL

# Kiểm tra .env
cat .env | grep DATABASE_URL

# Kiểm tra credentials
mysql -u root -p -h localhost
```

### ❌ "npm run build fails"

```bash
# Clear cache
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run build
```

### ❌ "Port 5173 already in use"

```bash
# Vite sẽ dùng port khác tự động
# Hoặc chỉ định port
npm run dev -- --port 5174
```

---

## 📚 Các lệnh hữu ích

### Backend

```bash
cd apps/backend

# Start development
npm run start:dev

# Build production
npm run build

# Start production
npm start

# Run migrations
npm run migration:run

# Revert migrations
npm run migration:revert

# Seed data
npm run seed:run
```

### Frontend

```bash
cd apps/frontend

# Development
npm run dev

# Build
npm run build

# Preview build
npm run preview
```

---

## 🌐 Các URLs

| Service | URL | Notes |
|---------|-----|-------|
| Frontend | http://localhost:5173 | React app |
| Backend API | http://localhost:3000 | NestJS API |
| API Root | http://localhost:3000/api | API endpoints |
| MySQL | localhost:3306 | Database |

---

## 🔐 Default Credentials

```
Email: admin@example.com
Password: Admin@123
Role: admin
```

---

## 📖 API Documentation

### Authentication

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin@123"}'
```

Response:
```json
{
  "access_token": "eyJhbGc..."
}
```

### Using Token

```bash
curl -X GET http://localhost:3000/api/products \
  -H "Authorization: Bearer eyJhbGc..."
```

---

## 🎯 Next Steps

1. ✅ Chạy ứng dụng thành công
2. 📖 Đọc [Backend Documentation](./apps/backend/README.md)
3. 🎨 Đọc [Frontend Documentation](./apps/frontend/README.md)
4. 🧪 Chạy tests: `npm test`
5. 📤 Deploy to production

---

## 💡 Tips

- Dùng Thunder Client hoặc Postman để test API
- Check console logs nếu có error
- Database reset: `npm run migration:revert && npm run migration:run && npm run seed:run`
- Hard refresh frontend: `Ctrl+Shift+R` (Windows) hoặc `Cmd+Shift+R` (Mac)

---

## 📞 Support

Nếu gặp vấn đề:
1. Check [Troubleshooting](#-troubleshooting)
2. Xem console logs
3. Đọc file .env
4. Liên hệ admin@example.com

---

**Happy coding! 🚀**
