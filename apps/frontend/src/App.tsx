import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './shared/components/MainLayout';
import Home from './features/home/Home';
import Login from './features/auth/Login';
import Signup from './features/auth/Signup';
import Dashboard from './features/dashboard/Dashboard';
import Products from './features/products/Products';
import Categories from './features/categories/Categories';
import Suppliers from './features/suppliers/Suppliers';
import Personnel from './features/personnel/Personnel';
import WarehouseManagement from './features/warehouses/WarehouseManagement';
import Delivery from './features/delivery/Delivery';
import TransferRequestsPage from './features/delivery/pages/TransferRequestsPage';
import CreateTransferOrderPage from './features/delivery/pages/CreateTransferOrderPage';
import Inventory from './features/inventory/Inventory';
import Reports from './features/reports/Reports';
import AuditLog from './features/audit-log/AuditLog';
import Settings, { MailSettings, AiSettings } from './features/settings/Settings';
import ProfilePage from './features/user-management/pages/ProfilePage';
import SupplierProfilePage from './features/supplier-portal/pages/SupplierProfilePage';
import PurchaseOrdersPage from './features/inbound/pages/PurchaseOrdersPage';
import InboundSectionPlaceholderPage from './features/inbound/pages/InboundSectionPlaceholderPage';
import StockInOrdersPage from './features/inbound/pages/StockInOrdersPage';
import StockInReceiptsPage from './features/inbound/pages/StockInReceiptsPage';
import AssemblyPage from './features/inbound/pages/AssemblyPage';
import ProductionPage from './features/inbound/pages/ProductionPage';
import DistributionPage from './features/inbound/pages/DistributionPage';
import StocktakePage from './features/inventory/pages/StocktakePage';
import TaskAssignPage from './features/outbound/pages/TaskAssignPage';
import Outbound from './features/outbound/Outbound';
import ApproveOutboundPage from './features/outbound/pages/ApproveOutboundPage';
import OutboundShippingNotePage from './features/outbound/pages/OutboundOrderDetailPage';
import CustomerPortalPage from './features/customer-portal/pages/CustomerPortalPage';

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}') as { role?: string };
  } catch {
    return {};
  }
}

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  if (getStoredUser().role === 'customer') {
    return <Navigate to="/customer-portal" replace />;
  }
  return <>{children}</>;
}

function SupplierRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token');
  const user = getStoredUser();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  if (user.role !== 'supplier') {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

function CustomerRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token');
  const user = getStoredUser();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  if (user.role !== 'customer') {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

function RoleRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: string[] }) {
  const token = localStorage.getItem('token');
  const user = getStoredUser();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  if (user.role === 'supplier') {
    return <Navigate to="/supplier-portal" replace />;
  }
  if (user.role === 'customer') {
    return <Navigate to="/customer-portal" replace />;
  }
  if (!allowedRoles.includes(user.role || '')) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/supplier-portal"
          element={
            <SupplierRoute>
              <SupplierProfilePage />
            </SupplierRoute>
          }
        />
        <Route
          path="/customer-portal"
          element={
            <CustomerRoute>
              <CustomerPortalPage />
            </CustomerRoute>
          }
        />

        {/* Protected Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Dashboard />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/products"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Products />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/categories"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Categories />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/suppliers"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Suppliers />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/personnel"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Personnel />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/warehouses"
          element={
            <ProtectedRoute>
              <MainLayout>
                <WarehouseManagement />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/inbound"
          element={
            <ProtectedRoute>
              <Navigate to="/inbound/purchase-orders" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inbound/purchase-orders"
          element={
            <ProtectedRoute>
              <MainLayout>
                <PurchaseOrdersPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/inbound/return-requests"
          element={
            <ProtectedRoute>
              <MainLayout>
                <StockInReceiptsPage receiptTypeFilter="RETURNED_GOODS" />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/inbound/stock-in-orders"
          element={
            <ProtectedRoute>
              <MainLayout>
                <StockInOrdersPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/inbound/assembly"
          element={
            <ProtectedRoute>
              <Navigate to="/inbound/production" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inbound/production"
          element={
            <ProtectedRoute>
              <MainLayout>
                <ProductionPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/inbound/distribution"
          element={
            <ProtectedRoute>
              <MainLayout>
                <DistributionPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/inbound/stock-in"
          element={
            <ProtectedRoute>
              <MainLayout>
                <StockInReceiptsPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/outbound"
          element={
            <ProtectedRoute>
              <Navigate to="/outbound/orders" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/outbound/orders"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Outbound />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/outbound/task-assign"
          element={
            <ProtectedRoute>
              <MainLayout>
                <TaskAssignPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/outbound/approve"
          element={
            <ProtectedRoute>
              <MainLayout>
                <ApproveOutboundPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/outbound/shipping-notes"
          element={
            <ProtectedRoute>
              <MainLayout>
                <OutboundShippingNotePage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/delivery"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Delivery />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/delivery/transfer-requests"
          element={
            <ProtectedRoute>
              <MainLayout>
                <TransferRequestsPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/delivery/create-transfer-order"
          element={
            <ProtectedRoute>
              <MainLayout>
                <CreateTransferOrderPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Inventory />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/stocktake"
          element={
            <ProtectedRoute>
              <MainLayout>
                <StocktakePage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Reports />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/audit-log"
          element={
            <RoleRoute allowedRoles={['admin', 'manager']}>
              <MainLayout>
                <AuditLog />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <MainLayout>
                <ProfilePage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/*"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Settings />
              </MainLayout>
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="mail" replace />} />
          <Route path="mail" element={<MailSettings />} />
          <Route path="ai" element={<AiSettings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
