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
import ProjectTeamsPage from './features/personnel/ProjectTeamsPage';
import PermissionGroupsPage from './features/personnel/PermissionGroupsPage';
import WarehouseManagement from './features/warehouses/WarehouseManagement';
import Delivery from './features/delivery/Delivery';
import TransferRequestsPage from './features/delivery/pages/TransferRequestsPage';
import CreateTransferOrderPage from './features/delivery/pages/CreateTransferOrderPage';
import Inventory from './features/inventory/Inventory';
import Reports from './features/reports/Reports';
import SalesReportPage from './features/reports/pages/SalesReportPage';
import RevenueReportPage from './features/reports/pages/RevenueReportPage';
import CashflowReportPage from './features/reports/pages/CashflowReportPage';
import InventoryReportPage from './features/reports/pages/InventoryReportPage';
import InventoryBaseUnitReportPage from './features/reports/pages/InventoryBaseUnitReportPage';
import GenericReportPage from './features/reports/pages/GenericReportPage';
import BillProfitReportPage from './features/reports/pages/BillProfitReportPage';
import CategoryProfitReportPage from './features/reports/pages/CategoryProfitReportPage';
import CustomerProfitReportPage from './features/reports/pages/CustomerProfitReportPage';
import VatManagementPage from './features/vat/pages/VatManagementPage';
import VatConfigPage from './features/vat/pages/VatConfigPage';
import ReceiptVouchersPage from './features/finance/pages/ReceiptVouchersPage';
import PaymentVouchersPage from './features/finance/pages/PaymentVouchersPage';
import ReceiptFromBillPage from './features/finance/pages/ReceiptFromBillPage';
import AuditLog from './features/audit-log/AuditLog';
import Settings, { MailSettings, AiSettings, StoreSettings } from './features/settings/Settings';
import ProfilePage from './features/user-management/pages/ProfilePage';
import SupplierProfilePage from './features/supplier-portal/pages/SupplierProfilePage';
import PurchaseOrdersPage from './features/inbound/pages/PurchaseOrdersPage';
import InboundSectionPlaceholderPage from './features/inbound/pages/InboundSectionPlaceholderPage';
import StockInOrdersPage from './features/inbound/pages/StockInOrdersPage';
import CreateStockInOrderPage from './features/inbound/pages/CreateStockInOrderPage';
import StockInReceiptsPage from './features/inbound/pages/StockInReceiptsPage';
import GoodsReceiptsPage from './features/inbound/pages/GoodsReceiptsPage';
import ApproveReceiptPage from './features/inbound/pages/ApproveReceiptPage';
import AssemblyPage from './features/inbound/pages/AssemblyPage';
import ProductionPage from './features/inbound/pages/ProductionPage';
import DistributionPage from './features/inbound/pages/DistributionPage';
import StocktakePage from './features/inventory/pages/StocktakePage';
import StocktakeScanPage from './features/inventory/pages/StocktakeScanPage';
import AdjustmentApprovalPage from './features/inventory/pages/AdjustmentApprovalPage';
import WarehouseVisualizerPage from './features/inventory/pages/WarehouseVisualizerPage';
import SmartSlottingPage from './features/inventory/pages/SmartSlottingPage';
import TaskAssignPage from './features/outbound/pages/TaskAssignPage';
import Outbound from './features/outbound/Outbound';
import ApproveOutboundPage from './features/outbound/pages/ApproveOutboundPage';
import PickingPage from './features/outbound/pages/PickingPage';
import OutboundShippingNotePage from './features/outbound/pages/OutboundOrderDetailPage';
import CustomerPortalPage from './features/customer-portal/pages/CustomerPortalPage';
import ScannerPage from './features/scanner/ScannerPage';
import SupplierProducts from './features/supplier-products/SupplierProducts';
import UnitsPage from './features/products/UnitsPage';

import Shop from './features/shop/Shop';
import CartCheckoutPage from './features/shop/pages/CartCheckoutPage';
import ShopUserProfilePage from './features/shop/pages/ShopUserProfilePage';
import Customers from './features/customers/Customers';
import BarcodeMappingsPage from './features/inbound/pages/BarcodeMappingsPage';
import SyncConflictsPage from './features/offline-sync/pages/SyncConflictsPage';
import ErpSyncStatusPage from './features/erp-status/pages/ErpSyncStatusPage';

import DocumentsPage from './features/documents/DocumentsPage';
import SalesInvoiceDocPage from './features/documents/pages/SalesInvoiceDocPage';
import StockInDocPage from './features/documents/pages/StockInDocPage';
import StockOutDocPage from './features/documents/pages/StockOutDocPage';
import TransferDocPage from './features/documents/pages/TransferDocPage';

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
        <Route path="/shop" element={<Shop />} />
        <Route path="/shop/profile" element={<ShopUserProfilePage />} />
        <Route path="/cart" element={<CartCheckoutPage />} />
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
        <Route path="/products" element={<Navigate to="/products/main" replace />} />
        <Route
          path="/products/main"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Products />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/products/supplier"
          element={
            <ProtectedRoute>
              <MainLayout>
                <SupplierProducts />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/units"
          element={
            <ProtectedRoute>
              <MainLayout>
                <UnitsPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/products/units"
          element={
            <ProtectedRoute>
              <MainLayout>
                <UnitsPage />
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
            <RoleRoute allowedRoles={['admin']}>
              <MainLayout>
                <Personnel />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route path="/personnel/permission-groups" element={<RoleRoute allowedRoles={['admin']}><MainLayout><PermissionGroupsPage /></MainLayout></RoleRoute>} />
        <Route path="/personnel/teams" element={<RoleRoute allowedRoles={['admin']}><MainLayout><PermissionGroupsPage /></MainLayout></RoleRoute>} />
        <Route
          path="/customers"
          element={
            <RoleRoute allowedRoles={['admin', 'manager', 'staff']}>
              <MainLayout>
                <Customers />
              </MainLayout>
            </RoleRoute>
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
          path="/inbound/stock-in-orders/create"
          element={
            <ProtectedRoute>
              <CreateStockInOrderPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inbound/return-customers"
          element={
            <ProtectedRoute>
              <Navigate to="/inbound/return-requests" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/initial-stock"
          element={
            <ProtectedRoute>
              <Navigate to="/inventory" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/outbound/retail"
          element={
            <ProtectedRoute>
              <Navigate to="/outbound/orders" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/outbound/sales-orders"
          element={
            <ProtectedRoute>
              <Navigate to="/outbound/orders" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/outbound/disposal"
          element={
            <ProtectedRoute>
              <Navigate to="/outbound/orders" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/documents/quotes"
          element={
            <ProtectedRoute>
              <Navigate to="/documents/sales-invoice" replace />
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
                <GoodsReceiptsPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/inbound/approve"
          element={
            <RoleRoute allowedRoles={['admin', 'manager']}>
              <MainLayout>
                <ApproveReceiptPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/inbound/barcode-mappings"
          element={
            <ProtectedRoute>
              <MainLayout>
                <BarcodeMappingsPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/sync-conflicts"
          element={
            <RoleRoute allowedRoles={['admin', 'manager']}>
              <MainLayout>
                <SyncConflictsPage />
              </MainLayout>
            </RoleRoute>
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
            <RoleRoute allowedRoles={['admin', 'manager']}>
              <MainLayout>
                <ApproveOutboundPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/outbound/picking"
          element={
            <ProtectedRoute>
              <MainLayout>
                <PickingPage />
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
          path="/delivery/transfer-orders"
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
          path="/inventory/visualizer"
          element={
            <ProtectedRoute>
              <MainLayout>
                <WarehouseVisualizerPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/smart-slotting"
          element={
            <ProtectedRoute>
              <MainLayout>
                <SmartSlottingPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/stocktake"
          element={
            <ProtectedRoute>
              <MainLayout>
                <StocktakePage viewMode="stocktake" />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/stocktake/requests"
          element={
            <ProtectedRoute>
              <MainLayout>
                <StocktakePage viewMode="requests" />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/stocktake/create"
          element={
            <ProtectedRoute>
              <MainLayout>
                <StocktakePage viewMode="create" />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/stocktake/my-tasks"
          element={
            <ProtectedRoute>
              <MainLayout>
                <StocktakePage viewMode="my-tasks" />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/stocktake/scan"
          element={
            <RoleRoute allowedRoles={['admin', 'manager', 'staff', 'inventory_checker']}>
              <MainLayout>
                <StocktakeScanPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/inventory/stocktake/adjustment-approval"
          element={
            <RoleRoute allowedRoles={['admin', 'manager']}>
              <MainLayout>
                <AdjustmentApprovalPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/inventory/stocktake/request-new"
          element={
            <ProtectedRoute>
              <MainLayout>
                <StocktakePage viewMode="request-new" />
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
          path="/reports/sales"
          element={
            <ProtectedRoute>
              <MainLayout>
                <SalesReportPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/revenue"
          element={
            <ProtectedRoute>
              <MainLayout>
                <RevenueReportPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/cashflow"
          element={
            <ProtectedRoute>
              <MainLayout>
                <CashflowReportPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/inventory"
          element={
            <ProtectedRoute>
              <MainLayout>
                <InventoryReportPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/inventory-base-unit"
          element={
            <ProtectedRoute>
              <MainLayout>
                <InventoryBaseUnitReportPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/inventory-summary"
          element={
            <ProtectedRoute>
              <MainLayout>
                <GenericReportPage title="Hàng tồn Tổng hợp" description="Báo cáo tổng hợp số lượng tồn kho toàn hệ thống" />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/customer-debt"
          element={
            <ProtectedRoute>
              <MainLayout>
                <GenericReportPage title="Công nợ Khách hàng" description="Báo cáo theo dõi công nợ phải thu của khách hàng" />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/supplier-debt"
          element={
            <ProtectedRoute>
              <MainLayout>
                <GenericReportPage title="Công nợ Nhà cung cấp" description="Báo cáo theo dõi công nợ phải trả cho nhà cung cấp" />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/fund-balance"
          element={
            <ProtectedRoute>
              <MainLayout>
                <GenericReportPage title="Tồn quỹ" description="Báo cáo theo dõi số dư tồn quỹ tiền mặt và tài khoản" />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/cashbook"
          element={
            <ProtectedRoute>
              <MainLayout>
                <GenericReportPage title="Sao kê - Sổ quỹ" description="Sao kê sổ quỹ chi tiết thu chi theo từng giao dịch" />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/stock-card"
          element={
            <ProtectedRoute>
              <MainLayout>
                <GenericReportPage title="Thẻ kho" description="Thẻ kho theo dõi biến động xuất nhập tồn của từng sản phẩm" />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/sales-detail"
          element={
            <ProtectedRoute>
              <MainLayout>
                <GenericReportPage title="Chi tiết hàng bán ra" description="Báo cáo chi tiết từng mặt hàng đã bán trong kỳ" />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/sales-by-staff"
          element={
            <ProtectedRoute>
              <MainLayout>
                <GenericReportPage title="Hàng bán ra theo Nhân viên" description="Thống kê sản phẩm bán ra theo từng nhân viên" />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/bill-profit"
          element={
            <ProtectedRoute>
              <MainLayout>
                <BillProfitReportPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/category-profit"
          element={
            <ProtectedRoute>
              <MainLayout>
                <CategoryProfitReportPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/customer-profit"
          element={
            <ProtectedRoute>
              <MainLayout>
                <CustomerProfitReportPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/business-summary"
          element={
            <ProtectedRoute>
              <MainLayout>
                <GenericReportPage title="Tổng hợp Kinh doanh" description="Báo cáo kết quả kinh doanh tổng hợp toàn công ty" />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/below-min-stock"
          element={
            <ProtectedRoute>
              <MainLayout>
                <GenericReportPage title="Hàng tồn dưới định mức" description="Cảnh báo các sản phẩm đang có số lượng tồn kho dưới định mức tối thiểu" />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/revenue-huu"
          element={
            <ProtectedRoute>
              <MainLayout>
                <GenericReportPage title="Báo cáo doanh thu - Huu" description="Báo cáo doanh thu phân tích chuyên sâu" />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports-summary"
          element={
            <ProtectedRoute>
              <MainLayout>
                <SalesReportPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/documents"
          element={
            <RoleRoute allowedRoles={['admin', 'manager', 'staff']}>
              <MainLayout>
                <DocumentsPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/documents/sales-invoice"
          element={
            <RoleRoute allowedRoles={['admin', 'manager', 'staff']}>
              <MainLayout>
                <SalesInvoiceDocPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/documents/stock-in-note"
          element={
            <RoleRoute allowedRoles={['admin', 'manager', 'staff']}>
              <MainLayout>
                <StockInDocPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/documents/stock-out-note"
          element={
            <RoleRoute allowedRoles={['admin', 'manager', 'staff']}>
              <MainLayout>
                <StockOutDocPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/documents/transfer-note"
          element={
            <RoleRoute allowedRoles={['admin', 'manager', 'staff']}>
              <MainLayout>
                <TransferDocPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/vat/management"
          element={
            <ProtectedRoute>
              <MainLayout>
                <VatManagementPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/vat/config"
          element={
            <ProtectedRoute>
              <MainLayout>
                <VatConfigPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/finance/receipts"
          element={
            <ProtectedRoute>
              <MainLayout>
                <ReceiptVouchersPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/finance/payment-vouchers"
          element={
            <ProtectedRoute>
              <MainLayout>
                <PaymentVouchersPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/finance/receipt-from-bill"
          element={
            <ProtectedRoute>
              <MainLayout>
                <ReceiptFromBillPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/erp-status"
          element={
            <RoleRoute allowedRoles={['admin', 'manager']}>
              <MainLayout>
                <ErpSyncStatusPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/audit-log"
          element={
            <RoleRoute allowedRoles={['admin']}>
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
            <RoleRoute allowedRoles={['admin']}>
              <MainLayout>
                <Settings />
              </MainLayout>
            </RoleRoute>
          }
        >
          <Route index element={<Navigate to="mail" replace />} />
          <Route path="mail" element={<MailSettings />} />
          <Route path="ai" element={<AiSettings />} />
          <Route path="store" element={<StoreSettings />} />
        </Route>
        <Route
          path="/scanner"
          element={
            <ProtectedRoute>
              <MainLayout>
                <ScannerPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route path="/stocktake" element={<Navigate to="/inventory/stocktake" replace />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
