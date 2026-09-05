# 🧠 AI Slotting Engine – Python FastAPI Microservice

> Smart WMS AI Slotting Optimization Service

## Kiến trúc 4 Tầng

| Tầng | Chức năng | Công nghệ |
|------|-----------|-----------|
| **Tầng 1** | Hard Constraint Filtering | Pure Python |
| **Tầng 2** | Multi-Objective Scoring | NumPy (vectorized) |
| **Tầng 3** | 3D Bin Packing | Extreme Point Heuristic |
| **Tầng 4** | Explainable AI (XAI) | Rule-based Vietnamese |

## Cài đặt & Chạy

```bash
# Tạo virtual environment
python -m venv venv
venv\Scripts\activate   # Windows
# source venv/bin/activate  # Linux/Mac

# Cài dependencies
pip install -r requirements.txt

# Chạy development server
python main.py
# hoặc
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## API Endpoints

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `POST` | `/engine/solve` | Realtime Inbound Slotting (< 100ms) |
| `POST` | `/engine/re-slot` | Dynamic Re-slotting (batch) |
| `GET` | `/engine/health` | Health check |
| `GET` | `/engine/config` | Xem trọng số scoring |
| `GET` | `/docs` | Swagger UI |

## Tích hợp với NestJS Backend

NestJS backend gọi AI Engine qua HTTP:
- URL mặc định: `http://localhost:8000`
- Configurable qua env var: `AI_ENGINE_URL`
- Graceful Degradation: Nếu engine lỗi/timeout → NestJS tự động fallback sang heuristic
