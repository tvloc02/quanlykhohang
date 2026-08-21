import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './shared/components/MainLayout';
import Home from './features/home/Home';
import Login from './features/auth/Login';
import Signup from './features/auth/Signup';
import Dashboard from './features/dashboard/Dashboard';
import Products from './features/products/Products';
import Categories from './features/categories/Categories';
import AreasPage from './features/categories/pages/AreasPage';
import Suppliers from './features/suppliers/Suppliers';
import Personnel from './features/personnel/Personnel';
import ProjectTeamsPage from './features/personnel/ProjectTeamsPage';
import PermissionGroupsPage from './features/personnel/PermissionGroupsPage';
import WarehouseManagement from './features/warehouses/WarehouseManagement';
import CreateWarehousePage from './features/warehouses/pages/CreateWarehousePage';
import Delivery from './features/delivery/Delivery';
import TransferRequestsPage from './features/delivery/pages/TransferRequestsPage';
import CreateTransferOrderPage from './features/delivery/pages/CreateTransferOrderPage';
import CreateTransferRequestPage from './features/delivery/pages/CreateTransferRequestPage';
import ShipperManagementPage from './features/delivery/pages/ShipperManagementPage';
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
import Inbound from './features/inbound/Inbound';
import ReturnSupplierPage from './features/inbound/pages/ReturnSupplierPage';
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
import CreateStocktakeOrderPage from './features/inventory/pages/CreateStocktakeOrderPage';
import StocktakeScanPage from './features/inventory/pages/StocktakeScanPage';
import AdjustmentApprovalPage from './features/inventory/pages/AdjustmentApprovalPage';
import WarehouseVisualizerPage from './features/inventory/pages/WarehouseVisualizerPage';
import SmartSlottingPage from './features/inventory/pages/SmartSlottingPage';
import TaskAssignPage from './features/outbound/pages/TaskAssignPage';
import Outbound from './features/outbound/Outbound';
import ApproveOutboundPage from './features/outbound/pages/ApproveOutboundPage';
import PickingPage from './features/outbound/pages/PickingPage';
import OutboundShippingNotePage from './features/outbound/pages/OutboundOrderDetailPage';
import CreateOutboundOrderPage from './features/outbound/pages/CreateOutboundOrderPage';
import CustomerPortalPage from './features/customer-portal/pages/CustomerPortalPage';
import ScannerPage from './features/scanner/ScannerPage';
import SupplierProducts from './features/supplier-products/SupplierProducts';
import UnitsPage from './features/products/UnitsPage';
import CurrenciesPage from './features/products/CurrenciesPage';
import BankAccountsPage from './features/finance/pages/BankAccountsPage';

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
import AccessDenied from './shared/components/AccessDenied';
import { usePermissions } from './shared/hooks/usePermissions';

function getStoredUser() {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    let role = parsed.role;
    if (!role && Array.isArray(parsed.roles) && parsed.roles.length > 0) {
      const r = parsed.roles[0];
      role = typeof r === 'string' ? r : (r?.name || r?.role || r?.id);
    }
    return { ...parsed, role: String(role || 'admin').toLowerCase() };
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

function RoleRoute({ children, allowedRoles, menuId }: { children: React.ReactNode; allowedRoles?: string[]; menuId?: string }) {
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
  const { isAdmin, canViewMenu } = usePermissions();
  if (isAdmin) {
    return <>{children}</>;
  }
  if (menuId) {
    if (canViewMenu(menuId)) {
      return <>{children}</>;
    }
    return (
      <MainLayout>
        <AccessDenied />
      </MainLayout>
    );
  }
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role || '')) {
    return (
      <MainLayout>
        <AccessDenied />
      </MainLayout>
    );
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
        <Route path="/system-menu" element={<Navigate to="/personnel" replace />} />
        <Route path="/categories-menu" element={<Navigate to="/categories" replace />} />
        <Route path="/nhap-xuat" element={<Navigate to="/inbound/stock-in-orders" replace />} />
        <Route path="/reports-summary" element={<Navigate to="/reports/sales" replace />} />
        <Route path="/products" element={<Navigate to="/products/main" replace />} />
        <Route
          path="/products/main"
          element={
            <RoleRoute menuId="products-main">
              <MainLayout>
                <Products />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/products/supplier"
          element={
            <RoleRoute menuId="products-main">
              <MainLayout>
                <SupplierProducts />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/units"
          element={
            <RoleRoute menuId="units">
              <MainLayout>
                <UnitsPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/products/units"
          element={
            <RoleRoute menuId="units">
              <MainLayout>
                <UnitsPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/currencies"
          element={
            <RoleRoute menuId="currency">
              <MainLayout>
                <CurrenciesPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/bank-accounts"
          element={
            <RoleRoute menuId="bank-accounts">
              <MainLayout>
                <BankAccountsPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/categories"
          element={
            <RoleRoute menuId="categories">
              <MainLayout>
                <Categories />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/suppliers"
          element={
            <RoleRoute menuId="suppliers">
              <MainLayout>
                <Suppliers />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/personnel"
          element={
            <RoleRoute menuId="personnel">
              <MainLayout>
                <Personnel />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route path="/personnel/permission-groups" element={<RoleRoute menuId="permission-groups"><MainLayout><PermissionGroupsPage /></MainLayout></RoleRoute>} />
        <Route path="/personnel/teams" element={<RoleRoute menuId="permission-groups"><MainLayout><PermissionGroupsPage /></MainLayout></RoleRoute>} />
        <Route
          path="/customers"
          element={
            <RoleRoute menuId="customers">
              <MainLayout>
                <Customers />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/areas"
          element={
            <RoleRoute menuId="areas">
              <MainLayout>
                <AreasPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/warehouses"
          element={
            <RoleRoute menuId="warehouses">
              <MainLayout>
                <WarehouseManagement />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/warehouses/create"
          element={
            <RoleRoute menuId="warehouses">
              <CreateWarehousePage />
            </RoleRoute>
          }
        />
        <Route
          path="/warehouses/:id/edit"
          element={
            <RoleRoute menuId="warehouses">
              <CreateWarehousePage />
            </RoleRoute>
          }
        />
        <Route
          path="/inbound"
          element={
            <RoleRoute menuId="inbound-stock-in-orders">
              <Navigate to="/inbound/orders" replace />
            </RoleRoute>
          }
        />
        <Route
          path="/inbound/orders"
          element={
            <RoleRoute menuId="inbound-stock-in-orders">
              <MainLayout>
                <Inbound featureMode="stock-in" title="DANH SÁCH PHIẾU NHẬP HÀNG KHO" codePrefix="PNK" partnerLabel="Nhà cung cấp" />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/inbound/purchase-orders"
          element={
            <RoleRoute menuId="inbound-purchase-orders">
              <MainLayout>
                <PurchaseOrdersPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/inbound/return-requests"
          element={
            <RoleRoute menuId="inbound-return-requests">
              <MainLayout>
                <ReturnSupplierPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/inbound/stock-in-orders"
          element={
            <RoleRoute menuId="inbound-stock-in-orders">
              <MainLayout>
                <Inbound featureMode="stock-in" title="DANH SÁCH PHIẾU NHẬP HÀNG KHO" codePrefix="PNK" partnerLabel="Nhà cung cấp" />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/inbound/stock-in-orders/create"
          element={
            <RoleRoute menuId="inbound-stock-in-orders">
              <CreateStockInOrderPage />
            </RoleRoute>
          }
        />
        <Route
          path="/inbound/return-customers"
          element={
            <RoleRoute menuId="inbound-return-customers">
              <MainLayout>
                <Inbound featureMode="return-customer" title="DANH SÁCH PHIẾU NHẬP HÀNG KHÁCH TRẢ LẠI" codePrefix="NHKT" partnerLabel="Khách hàng" />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/delivery/transfer-orders"
          element={
            <RoleRoute menuId="delivery-transfer-orders">
              <MainLayout>
                <Delivery />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/delivery/transfer-requests"
          element={
            <RoleRoute menuId="delivery-transfer-requests">
              <MainLayout>
                <TransferRequestsPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/inventory/initial-stock"
          element={
            <RoleRoute menuId="inventory-initial-stock">
              <MainLayout>
                <Inbound featureMode="initial-stock" title="DANH SÁCH PHIẾU NHẬP TỒN ĐẦU KỲ" codePrefix="TDK" partnerLabel="Ghi chú kho" />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/outbound/retail"
          element={
            <RoleRoute menuId="outbound-retail">
              <MainLayout>
                <Outbound featureMode="retail" title="DANH SÁCH PHIẾU XUẤT BÁN LẺ" codePrefix="XBL" partnerLabel="Khách hàng" />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/outbound/sales-orders"
          element={
            <RoleRoute menuId="outbound-sales-orders">
              <MainLayout>
                <Outbound featureMode="sales-order" title="DANH SÁCH ĐƠN ĐẶT HÀNG CỦA KHÁCH HÀNG" codePrefix="DDH" partnerLabel="Khách hàng" />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/outbound/disposal"
          element={
            <RoleRoute menuId="outbound-disposal">
              <MainLayout>
                <Outbound featureMode="disposal" title="DANH SÁCH PHIẾU XUẤT HỦY HÀNG HÓA" codePrefix="XH" partnerLabel="Lý do xuất hủy" />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/documents/quotes"
          element={
            <RoleRoute menuId="documents-quotes">
              <MainLayout>
                <Outbound featureMode="quote" title="DANH SÁCH PHIẾU BÁO GIÁ HÀNG HÓA" codePrefix="BG" partnerLabel="Khách hàng" />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/inbound/assembly"
          element={
            <RoleRoute menuId="inbound-assembly">
              <MainLayout>
                <Inbound featureMode="assembly" title="DANH SÁCH PHIẾU TẠO BỘ / COMBO HÀNG HÓA" codePrefix="COMBO" partnerLabel="Ghi chú Combo" />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/inbound/production"
          element={
            <RoleRoute menuId="inbound-assembly">
              <MainLayout>
                <ProductionPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/inbound/distribution"
          element={
            <RoleRoute menuId="inbound-assembly">
              <MainLayout>
                <DistributionPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/inbound/stock-in"
          element={
            <RoleRoute menuId="inbound-stock-in-orders">
              <MainLayout>
                <GoodsReceiptsPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/inbound/approve"
          element={
            <RoleRoute allowedRoles={['admin', 'manager']} menuId="inbound-stock-in-orders">
              <MainLayout>
                <ApproveReceiptPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/inbound/barcode-mappings"
          element={
            <RoleRoute menuId="inbound-stock-in-orders">
              <MainLayout>
                <BarcodeMappingsPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/sync-conflicts"
          element={
            <RoleRoute allowedRoles={['admin', 'manager']} menuId="data-maintenance">
              <MainLayout>
                <SyncConflictsPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/outbound"
          element={
            <RoleRoute menuId="outbound-orders">
              <Navigate to="/outbound/orders" replace />
            </RoleRoute>
          }
        />
        <Route
          path="/outbound/orders"
          element={
            <RoleRoute menuId="outbound-orders">
              <MainLayout>
                <Outbound />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/outbound/orders/create"
          element={
            <ProtectedRoute>
              <CreateOutboundOrderPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/outbound/create"
          element={
            <ProtectedRoute>
              <CreateOutboundOrderPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/outbound/task-assign"
          element={
            <RoleRoute menuId="outbound-orders">
              <MainLayout>
                <TaskAssignPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/outbound/approve"
          element={
            <RoleRoute allowedRoles={['admin', 'manager']} menuId="outbound-orders">
              <MainLayout>
                <ApproveOutboundPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/outbound/picking"
          element={
            <RoleRoute menuId="outbound-orders">
              <MainLayout>
                <PickingPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/outbound/shipping-notes"
          element={
            <RoleRoute menuId="outbound-orders">
              <MainLayout>
                <OutboundShippingNotePage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/delivery"
          element={
            <RoleRoute menuId="delivery-transfer-orders">
              <MainLayout>
                <Delivery />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/delivery/transfer-orders"
          element={
            <RoleRoute menuId="delivery-transfer-orders">
              <MainLayout>
                <Delivery />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/delivery/transfer-requests"
          element={
            <RoleRoute menuId="delivery-transfer-requests">
              <MainLayout>
                <TransferRequestsPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/delivery/shippers"
          element={
            <RoleRoute menuId="delivery-transfer-orders">
              <MainLayout>
                <ShipperManagementPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/delivery/create-transfer-order"
          element={
            <RoleRoute menuId="delivery-transfer-orders">
              <CreateTransferOrderPage />
            </RoleRoute>
          }
        />
        <Route
          path="/delivery/receive-transfer-order"
          element={
            <RoleRoute menuId="delivery-transfer-requests">
              <CreateTransferOrderPage />
            </RoleRoute>
          }
        />
        <Route
          path="/delivery/create-transfer-request"
          element={
            <RoleRoute menuId="delivery-transfer-requests">
              <CreateTransferRequestPage />
            </RoleRoute>
          }
        />
        <Route
          path="/inventory"
          element={
            <RoleRoute menuId="inventory-stocktake">
              <MainLayout>
                <Inventory />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/inventory/visualizer"
          element={
            <RoleRoute menuId="inventory-stocktake">
              <MainLayout>
                <WarehouseVisualizerPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/inventory/smart-slotting"
          element={
            <RoleRoute menuId="inventory-stocktake">
              <MainLayout>
                <SmartSlottingPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/inventory/stocktake"
          element={
            <RoleRoute menuId="inventory-stocktake">
              <MainLayout>
                <StocktakePage viewMode="stocktake" />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/inventory/stocktake/requests"
          element={
            <RoleRoute menuId="inventory-stocktake">
              <MainLayout>
                <StocktakePage viewMode="requests" />
              </MainLayout>
            </RoleRoute>
          }
        />

        <Route
          path="/inventory/stocktake/create"
          element={
            <RoleRoute menuId="inventory-stocktake">
              <MainLayout>
                <CreateStocktakeOrderPage standalone={false} />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/inventory/stocktake/my-tasks"
          element={
            <RoleRoute menuId="inventory-stocktake">
              <MainLayout>
                <StocktakePage viewMode="my-tasks" />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/inventory/stocktake/scan"
          element={
            <RoleRoute menuId="inventory-stocktake">
              <MainLayout>
                <StocktakeScanPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/inventory/stocktake/adjustment-approval"
          element={
            <RoleRoute allowedRoles={['admin', 'manager']} menuId="inventory-stocktake">
              <MainLayout>
                <AdjustmentApprovalPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/inventory/stocktake/request-new"
          element={
            <RoleRoute menuId="inventory-stocktake">
              <MainLayout>
                <StocktakePage viewMode="request-new" />
              </MainLayout>
            </RoleRoute>
          }
        />

        <Route
          path="/reports"
          element={
            <RoleRoute menuId="report-sales">
              <MainLayout>
                <Reports />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/reports/sales"
          element={
            <RoleRoute menuId="report-sales">
              <MainLayout>
                <SalesReportPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/reports/revenue"
          element={
            <RoleRoute menuId="report-revenue">
              <MainLayout>
                <RevenueReportPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/reports/cashflow"
          element={
            <RoleRoute menuId="report-cashflow">
              <MainLayout>
                <CashflowReportPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/reports/inventory"
          element={
            <RoleRoute menuId="report-inventory">
              <MainLayout>
                <InventoryReportPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/reports/inventory-base-unit"
          element={
            <RoleRoute menuId="report-inventory-base-unit">
              <MainLayout>
                <InventoryBaseUnitReportPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/reports/inventory-summary"
          element={
            <RoleRoute menuId="report-inventory-summary">
              <MainLayout>
                <GenericReportPage reportType="inventory-summary-report" title="Hàng tồn Tổng hợp" description="Báo cáo tổng hợp số lượng tồn kho toàn hệ thống" />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route path="/reports/inventory summary" element={<Navigate to="/reports/inventory-summary" replace />} />
        <Route path="/reports/inventory_summary" element={<Navigate to="/reports/inventory-summary" replace />} />
        <Route path="/reports/inventory base unit" element={<Navigate to="/reports/inventory-base-unit" replace />} />
        <Route path="/reports/inventory_base_unit" element={<Navigate to="/reports/inventory-base-unit" replace />} />
        <Route path="/reports/customer debt" element={<Navigate to="/reports/customer-debt" replace />} />
        <Route path="/reports/supplier debt" element={<Navigate to="/reports/supplier-debt" replace />} />
        <Route path="/reports/fund balance" element={<Navigate to="/reports/fund-balance" replace />} />
        <Route path="/reports/stock card" element={<Navigate to="/reports/stock-card" replace />} />
        <Route path="/reports/sales detail" element={<Navigate to="/reports/sales-detail" replace />} />
        <Route path="/reports/sales by staff" element={<Navigate to="/reports/sales-by-staff" replace />} />
        <Route path="/reports/bill profit" element={<Navigate to="/reports/bill-profit" replace />} />
        <Route path="/reports/category profit" element={<Navigate to="/reports/category-profit" replace />} />
        <Route path="/reports/customer profit" element={<Navigate to="/reports/customer-profit" replace />} />
        <Route
          path="/reports/customer-debt"
          element={
            <RoleRoute menuId="report-customer-debt">
              <MainLayout>
                <GenericReportPage reportType="customer-debt" title="Công nợ Khách hàng" description="Báo cáo theo dõi công nợ phải thu của khách hàng" />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/reports/supplier-debt"
          element={
            <RoleRoute menuId="report-supplier-debt">
              <MainLayout>
                <GenericReportPage reportType="supplier-debt" title="Công nợ Nhà cung cấp" description="Báo cáo theo dõi công nợ phải trả cho nhà cung cấp" />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/reports/fund-balance"
          element={
            <RoleRoute menuId="report-fund-balance">
              <MainLayout>
                <GenericReportPage reportType="fund-balance" title="Tồn quỹ" description="Báo cáo theo dõi số dư tồn quỹ tiền mặt và tài khoản" />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/reports/cashbook"
          element={
            <RoleRoute menuId="report-cashbook">
              <MainLayout>
                <GenericReportPage reportType="cashbook" title="Sao kê - Sổ quỹ" description="Sao kê sổ quỹ chi tiết thu chi theo từng giao dịch" />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/reports/stock-card"
          element={
            <RoleRoute menuId="report-stock-card">
              <MainLayout>
                <GenericReportPage reportType="stock-card" title="Thẻ kho" description="Thẻ kho theo dõi biến động xuất nhập tồn của từng sản phẩm" />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/reports/sales-detail"
          element={
            <RoleRoute menuId="report-sales-detail">
              <MainLayout>
                <GenericReportPage reportType="sales-detail" title="Chi tiết hàng bán ra" description="Báo cáo chi tiết từng mặt hàng đã bán trong kỳ" />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/reports/sales-by-staff"
          element={
            <RoleRoute menuId="report-sales-by-staff">
              <MainLayout>
                <GenericReportPage reportType="sales-by-staff" title="Hàng bán ra theo Nhân viên" description="Thống kê sản phẩm bán ra theo từng nhân viên" />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/reports/bill-profit"
          element={
            <RoleRoute menuId="report-bill-profit">
              <MainLayout>
                <BillProfitReportPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/reports/category-profit"
          element={
            <RoleRoute menuId="report-category-profit">
              <MainLayout>
                <CategoryProfitReportPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/reports/customer-profit"
          element={
            <RoleRoute menuId="report-customer-profit">
              <MainLayout>
                <CustomerProfitReportPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/reports/business-summary"
          element={
            <RoleRoute menuId="report-business-summary">
              <MainLayout>
                <GenericReportPage title="Tổng hợp Kinh doanh" description="Báo cáo kết quả kinh doanh tổng hợp toàn công ty" />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/reports/below-min-stock"
          element={
            <RoleRoute menuId="report-below-min-stock">
              <MainLayout>
                <GenericReportPage title="Hàng tồn dưới định mức" description="Cảnh báo các sản phẩm đang có số lượng tồn kho dưới định mức tối thiểu" />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/reports/revenue-huu"
          element={
            <RoleRoute menuId="report-revenue-huu">
              <MainLayout>
                <GenericReportPage title="Báo cáo doanh thu - Huu" description="Báo cáo doanh thu phân tích chuyên sâu" />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/reports-summary"
          element={
            <RoleRoute menuId="report-sales">
              <MainLayout>
                <SalesReportPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/documents"
          element={
            <RoleRoute menuId="print-templates">
              <MainLayout>
                <DocumentsPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/documents/sales-invoice"
          element={
            <RoleRoute menuId="print-templates">
              <MainLayout>
                <SalesInvoiceDocPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/documents/stock-in-note"
          element={
            <RoleRoute menuId="print-templates">
              <MainLayout>
                <StockInDocPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/documents/stock-out-note"
          element={
            <RoleRoute menuId="print-templates">
              <MainLayout>
                <StockOutDocPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/documents/transfer-note"
          element={
            <RoleRoute menuId="print-templates">
              <MainLayout>
                <TransferDocPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/vat/management"
          element={
            <RoleRoute menuId="evat-config">
              <MainLayout>
                <VatManagementPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/vat/config"
          element={
            <RoleRoute menuId="evat-config">
              <MainLayout>
                <VatConfigPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/finance/receipts"
          element={
            <RoleRoute menuId="finance-receipts">
              <MainLayout>
                <ReceiptVouchersPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/finance/payment-vouchers"
          element={
            <RoleRoute menuId="finance-payment-vouchers">
              <MainLayout>
                <PaymentVouchersPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/finance/receipt-from-bill"
          element={
            <RoleRoute menuId="finance-receipt-from-bill">
              <MainLayout>
                <ReceiptFromBillPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/erp-status"
          element={
            <RoleRoute allowedRoles={['admin', 'manager']} menuId="sys-info">
              <MainLayout>
                <ErpSyncStatusPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/audit-log"
          element={
            <RoleRoute allowedRoles={['admin']} menuId="audit-log">
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
            <RoleRoute allowedRoles={['admin']} menuId="sys-config">
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
            <RoleRoute menuId="print-barcode">
              <MainLayout>
                <ScannerPage />
              </MainLayout>
            </RoleRoute>
          }
        />
        <Route path="/stocktake" element={<Navigate to="/inventory/stocktake" replace />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
