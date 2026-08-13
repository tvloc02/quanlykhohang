import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/tailwind.css';

// Xóa dữ liệu cũ trong localStorage để đảm bảo UI luôn lấy từ database
const STALE_CACHE_KEYS = [
  'smart-wms-catalog-categories',
  'smart-wms-warehouses',
  'smart-wms-customer-profiles',
  'smart-wms-units',
  'smart-wms-personnel-users',
  'smart-wms-permission-groups',
  'smart-wms-audit-logs',
];
STALE_CACHE_KEYS.forEach((key) => localStorage.removeItem(key));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
