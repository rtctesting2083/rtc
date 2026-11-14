import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { PlatformProvider } from './context/PlatformContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CompanyProvider } from './context/CompanyContext';
import { ModalProvider } from './context/ModalContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';

// Layouts
import { CompanyLayout } from './components/layout/CompanyLayout';
import { BranchLayout } from './components/layout/BranchLayout';
import { CustomerLayout } from './components/layout/CustomerLayout';
import { RiderLayout } from './components/layout/RiderLayout';

// Portal
import { LoginPage } from './pages/portal/LoginPage';

// Company
import { CompanyOverviewPage } from './pages/company/CompanyOverviewPage';
import { CompanyCreateOrderPage } from './pages/company/CompanyCreateOrderPage';
import { CompanyVerificationPage } from './pages/company/CompanyVerificationPage';
import { CompanyShipmentsPage } from './pages/company/CompanyShipmentsPage';
import { CompanyVendorOrdersReportPage } from './pages/company/CompanyVendorOrdersReportPage';
import { CompanyShipmentReportPage } from './pages/company/CompanyShipmentReportPage';
import { LocationOrderAnalysisReportPage } from './pages/common/LocationOrderAnalysisReportPage';
import { VendorWiseShipmentReportPage } from './pages/common/VendorWiseShipmentReportPage';
import { CompanyCodSettlementPage } from './pages/company/CompanyCodSettlementPage';
import { AdminWalletManagementPage } from './pages/company/AdminWalletManagementPage';
import { CompanyCouriersPage } from './pages/company/CompanyCouriersPage';
import { CompanyCustomersPage } from './pages/company/CompanyCustomersPage';
import { CompanyCustomerListPage } from './pages/company/CompanyCustomerListPage';
import { CompanyInvoicesPage } from './pages/company/CompanyInvoicesPage';
import { CompanyTrackPage } from './pages/company/CompanyTrackPage';
import { CompanyBranchesPage } from './pages/company/CompanyBranchesPage';
import { CompanyBranchReportsPage } from './pages/company/CompanyBranchReportsPage';
import { CompanyNoticesPage } from './pages/company/CompanyNoticesPage';
import { AdminProfilePage } from './pages/company/AdminProfilePage';

// Company Settings
import { CompanyThemeSettingsPage } from './pages/company/settings/CompanyThemeSettingsPage';
import { CompanySecuritySettingsPage } from './pages/company/settings/CompanySecuritySettingsPage';
import { AutoLogoutManager } from './components/common/AutoLogoutManager';
import { OrderTypesSettingsPage } from './pages/company/settings/OrderTypesSettingsPage';
import { ExchangeReasonsSettingsPage } from './pages/company/settings/ExchangeReasonsSettingsPage';
import { ReturnReasonsSettingsPage } from './pages/company/settings/ReturnReasonsSettingsPage';
import { DeliveryServiceTypesSettingsPage } from './pages/company/settings/DeliveryServiceTypesSettingsPage';
import { ProductCategoriesSettingsPage } from './pages/company/settings/ProductCategoriesSettingsPage';
import { LandmarksSettingsPage } from './pages/company/settings/LandmarksSettingsPage';
import { DeliveryChargesSettingsPage } from './pages/company/settings/DeliveryChargesSettingsPage';
import { ShipmentStatusesSettingsPage } from './pages/company/settings/ShipmentStatusesSettingsPage';
import { PortalMenuSettingsPage } from './pages/company/settings/PortalMenuSettingsPage';
import { VendorTypesCategoriesSettingsPage } from './pages/company/settings/VendorTypesCategoriesSettingsPage';
import { UserManagementSettingsPage } from './pages/company/settings/UserManagementSettingsPage';
import { SmsSettingsPage } from './pages/company/settings/SmsSettingsPage';

// Branch
import { BranchOverviewPage } from './pages/branch/BranchOverviewPage';
import { BranchCreateOrderPage } from './pages/branch/BranchCreateOrderPage';
import { BranchShipmentsPage } from './pages/branch/BranchShipmentsPage';
import { BranchReceivedShipmentsPage } from './pages/branch/BranchReceivedShipmentsPage';
import { BranchTrackReceivePage } from './pages/branch/BranchTrackReceivePage';
import { BranchShipmentReportPage } from './pages/branch/BranchShipmentReportPage';
import { BranchCodSettlementPage } from './pages/branch/BranchCodSettlementPage';
import { BranchRidersPage } from './pages/branch/BranchRidersPage';
import { BranchVendorsPage } from './pages/branch/BranchVendorsPage';
import { BranchProfilePage } from './pages/branch/BranchProfilePage';
import { BranchUserManagementPage } from './pages/branch/BranchUserManagementPage';
import { BranchNoticesPage } from './pages/branch/BranchNoticesPage';

// Customer (Vendor)
import { CustomerDashboardPage } from './pages/customer/CustomerDashboardPage';
import { CustomerOrdersPage } from './pages/customer/CustomerOrdersPage';
import { CustomerCreateOrderPage } from './pages/customer/CustomerCreateOrderPage';
import { CustomerBulkImportPage } from './pages/customer/CustomerBulkImportPage';
import { CustomerBulkHistoryPage } from './pages/customer/CustomerBulkHistoryPage';
import { CustomerCreatePickupPage } from './pages/customer/CustomerCreatePickupPage';
import { CustomerPickupReportPage } from './pages/customer/CustomerPickupReportPage';
import { CustomerInvoicesPage } from './pages/customer/CustomerInvoicesPage';
import { CustomerCodSettlementPage } from './pages/customer/CustomerCodSettlementPage';
import { CustomerWalletLedgerPage } from './pages/customer/CustomerWalletLedgerPage';
import { CustomerNoticesPage } from './pages/customer/CustomerNoticesPage';
import { CustomerTicketsPage } from './pages/customer/CustomerTicketsPage';
import { CustomerCheckRatePage } from './pages/customer/CustomerCheckRatePage';
import { CustomerProfilePage } from './pages/customer/CustomerProfilePage';
import { CustomerAddressBookPage } from './pages/customer/CustomerAddressBookPage';
import { CustomerDetailsPage } from './pages/customer/CustomerDetailsPage';
import { CustomerStaffPage } from './pages/customer/CustomerStaffPage';
import { CustomerPlaceholderPage } from './pages/customer/CustomerPlaceholderPage';

// Rider
import { RiderDeliveriesPage } from './pages/rider/RiderDeliveriesPage';
import { RiderNoticesPage } from './pages/rider/RiderNoticesPage';
import { RiderProfilePage } from './pages/rider/RiderProfilePage';

function ProtectedRoute({ allowedTypes, children }) {
  const { session } = useAuth();

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (allowedTypes && !allowedTypes.includes(session.type)) {
    // Redirect to the session's natural landing page
    if (session.type === 'company') return <Navigate to="/company/overview" replace />;
    if (session.type === 'branch') return <Navigate to="/branch/overview" replace />;
    if (session.type === 'customer') return <Navigate to="/customer/dashboard" replace />;
    if (session.type === 'rider') return <Navigate to="/rider/deliveries" replace />;
    return <Navigate to="/login" replace />;
  }

  return children;
}

export function App() {
  return (
    <ThemeProvider>
      <PlatformProvider>
        <AuthProvider>
          <CompanyProvider>
            <BrowserRouter>
              <ModalProvider>
                <AutoLogoutManager />
                <ErrorBoundary title="Application Error">
                  <Routes>
                {/* Public Login & Tracking Routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/track" element={<LoginPage defaultTab="track" />} />
                <Route path="/tracking" element={<LoginPage defaultTab="track" />} />

                {/* Company Routes */}
                <Route
                  path="/company"
                  element={
                    <ProtectedRoute allowedTypes={['company']}>
                      <CompanyLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Navigate to="overview" replace />} />
                  <Route path="overview" element={<CompanyOverviewPage />} />
                  <Route path="orders/create" element={<CompanyCreateOrderPage />} />
                  <Route path="shipments/create" element={<CompanyCreateOrderPage />} />
                  <Route path="create-order" element={<CompanyCreateOrderPage />} />
                  <Route path="verification" element={<CompanyVerificationPage />} />
                  <Route path="shipments" element={<CompanyShipmentsPage view="shipments" />} />
                  <Route path="orders" element={<CompanyShipmentsPage view="shipments" />} />
                  <Route path="order-list" element={<CompanyShipmentsPage view="shipments" />} />
                  <Route path="pickup-requests" element={<CompanyShipmentsPage view="pickup_requests" />} />
                  <Route path="exchange-orders" element={<CompanyShipmentsPage view="exchange" />} />
                  <Route path="returns" element={<CompanyShipmentsPage view="returns" />} />
                  <Route path="status-comments" element={<Navigate to="../shipments" replace />} />
                  <Route path="vendor-orders" element={<CompanyVendorOrdersReportPage />} />
                  <Route path="vendor-orders-report" element={<CompanyVendorOrdersReportPage />} />
                  <Route path="vendor-wise-report" element={<VendorWiseShipmentReportPage portalType="admin" />} />
                  <Route path="vendor-wise-shipment-report" element={<Navigate to="../vendor-wise-report" replace />} />
                  <Route path="shipment-reports" element={<CompanyShipmentReportPage view="all" />} />
                  <Route path="sales-report" element={<CompanyShipmentReportPage view="sales" />} />
                  <Route path="location-report" element={<LocationOrderAnalysisReportPage portalType="admin" />} />
                  <Route path="cod-settlement" element={<CompanyCodSettlementPage />} />
                  <Route path="wallet" element={<AdminWalletManagementPage />} />
                  <Route path="wallet-management" element={<AdminWalletManagementPage />} />
                  <Route path="wallet-transactions" element={<AdminWalletManagementPage />} />
                  <Route path="couriers" element={<CompanyCouriersPage />} />
                  <Route path="customers" element={<CompanyCustomersPage />} />
                  <Route path="customer-list" element={<CompanyCustomerListPage />} />
                  <Route path="vendor-customers" element={<CompanyCustomerListPage />} />
                  <Route path="customers-list" element={<CompanyCustomerListPage />} />
                  <Route path="invoices" element={<CompanyInvoicesPage view="invoices" />} />
                  <Route path="revenue-report" element={<CompanyInvoicesPage view="sales_register" />} />
                  <Route path="track" element={<CompanyTrackPage />} />
                  <Route path="branches" element={<CompanyBranchesPage />} />
                  <Route path="branch-reports" element={<CompanyBranchReportsPage />} />
                  <Route path="notices" element={<CompanyNoticesPage />} />

                  {/* Settings sub-routes */}
                  <Route path="settings/company" element={<CompanyThemeSettingsPage />} />
                  <Route path="settings/theme" element={<CompanyThemeSettingsPage />} />
                  <Route path="settings/order-types" element={<OrderTypesSettingsPage />} />
                  <Route path="settings/exchange-reasons" element={<ExchangeReasonsSettingsPage />} />
                  <Route path="settings/return-reasons" element={<ReturnReasonsSettingsPage />} />
                  <Route path="settings/delivery-service-types" element={<DeliveryServiceTypesSettingsPage />} />
                  <Route path="settings/product-categories" element={<ProductCategoriesSettingsPage />} />
                  <Route path="settings/landmarks" element={<LandmarksSettingsPage />} />
                  <Route path="settings/delivery-charges" element={<DeliveryChargesSettingsPage />} />
                  <Route path="settings/shipment-statuses" element={<ShipmentStatusesSettingsPage />} />
                  <Route path="settings/portal-menus" element={<PortalMenuSettingsPage />} />
                  <Route path="settings/vendor-types-categories" element={<VendorTypesCategoriesSettingsPage />} />
                  <Route path="settings/users" element={<UserManagementSettingsPage />} />
                  <Route path="settings/sms" element={<SmsSettingsPage />} />
                  <Route path="settings/sms-gateway" element={<SmsSettingsPage />} />
                  <Route path="settings/security" element={<CompanySecuritySettingsPage />} />
                  <Route path="settings/auto-logout" element={<CompanySecuritySettingsPage />} />
                  <Route path="settings/profile" element={<AdminProfilePage />} />
                  <Route path="profile" element={<AdminProfilePage />} />
                </Route>

                {/* Branch Routes */}
                <Route
                  path="/branch"
                  element={
                    <ProtectedRoute allowedTypes={['branch']}>
                      <BranchLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Navigate to="overview" replace />} />
                  <Route path="overview" element={<BranchOverviewPage />} />
                  <Route path="orders/create" element={<BranchCreateOrderPage />} />
                  <Route path="shipments/create" element={<BranchCreateOrderPage />} />
                  <Route path="create-order" element={<BranchCreateOrderPage />} />
                  <Route path="shipments" element={<BranchShipmentsPage />} />
                  <Route path="received-shipments" element={<BranchReceivedShipmentsPage />} />
                  <Route path="track" element={<BranchTrackReceivePage />} />
                  <Route path="track-receive" element={<Navigate to="../track" replace />} />
                  <Route path="reports" element={<BranchShipmentReportPage />} />
                  <Route path="vendor-wise-report" element={<VendorWiseShipmentReportPage portalType="branch" />} />
                  <Route path="vendor-wise-shipment-report" element={<Navigate to="../vendor-wise-report" replace />} />
                  <Route path="location-report" element={<LocationOrderAnalysisReportPage portalType="branch" />} />
                  <Route path="cod-settlement" element={<BranchCodSettlementPage />} />
                  <Route path="riders" element={<BranchRidersPage />} />
                  <Route path="vendors" element={<BranchVendorsPage />} />
                  <Route path="profile" element={<BranchProfilePage />} />
                  <Route path="users" element={<BranchUserManagementPage />} />
                  <Route path="notices" element={<BranchNoticesPage />} />
                </Route>

                {/* Customer / Vendor Routes */}
                <Route
                  path="/customer"
                  element={
                    <ProtectedRoute allowedTypes={['customer']}>
                      <CustomerLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="dashboard" element={<CustomerDashboardPage />} />
                  <Route path="tickets" element={<CustomerTicketsPage />} />
                  <Route path="notices" element={<CustomerNoticesPage />} />
                  <Route path="orders" element={<CustomerOrdersPage />} />
                  <Route path="orders/create" element={<CustomerCreateOrderPage />} />
                  <Route path="orders/edit/:orderId" element={<CustomerCreateOrderPage />} />
                  <Route path="orders/edit" element={<Navigate to="../orders" replace />} />
                  <Route path="orders/import" element={<CustomerBulkImportPage />} />
                  <Route path="orders/bulk-import" element={<CustomerBulkImportPage />} />
                  <Route path="orders/bulk-history" element={<CustomerBulkHistoryPage />} />
                  <Route path="orders/import-history" element={<CustomerBulkHistoryPage />} />
                  <Route path="orders/pickup-request" element={<CustomerPickupReportPage />} />
                  <Route path="orders/pickup-create" element={<CustomerCreatePickupPage />} />
                  <Route path="orders/pickup-report" element={<CustomerPickupReportPage />} />
                  <Route path="orders/pickup-requests" element={<CustomerPickupReportPage />} />
                  <Route path="invoices" element={<CustomerInvoicesPage />} />
                  <Route path="cod-settlement" element={<CustomerCodSettlementPage />} />
                  <Route path="wallet-ledger" element={<CustomerWalletLedgerPage />} />
                  <Route path="accounts/wallet-ledger" element={<Navigate to="../wallet-ledger" replace />} />
                  <Route path="profile" element={<CustomerProfilePage />} />
                  <Route path="customers" element={<CustomerAddressBookPage />} />
                  <Route path="address-book" element={<CustomerAddressBookPage />} />
                  <Route path="customer-details" element={<CustomerDetailsPage />} />
                  <Route path="staff" element={<CustomerStaffPage />} />
                  <Route path="check-rate" element={<CustomerCheckRatePage />} />
                  <Route path="reports" element={<Navigate to="reports/location-report" replace />} />
                  <Route path="reports/location-report" element={<LocationOrderAnalysisReportPage portalType="vendor" />} />
                  <Route path="location-report" element={<LocationOrderAnalysisReportPage portalType="vendor" />} />
                  <Route path="reports/sales-report" element={<CustomerPlaceholderPage title="Sales Report" />} />
                  <Route path="reports/pending-report" element={<CustomerPlaceholderPage title="Pending Orders Report" />} />
                  <Route path="reports/rto-analysis" element={<CustomerPlaceholderPage title="RTO Analysis" />} />
                  <Route path="placeholder/Customer Details" element={<Navigate to="../customer-details" replace />} />
                  <Route path="placeholder/:title" element={<CustomerPlaceholderPage />} />
                </Route>

                {/* Rider Routes */}
                <Route
                  path="/rider"
                  element={
                    <ProtectedRoute allowedTypes={['rider']}>
                      <RiderLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Navigate to="deliveries" replace />} />
                  <Route path="deliveries" element={<RiderDeliveriesPage />} />
                  <Route path="notices" element={<RiderNoticesPage />} />
                  <Route path="profile" element={<RiderProfilePage />} />
                </Route>

                  {/* Default Fallback */}
                  <Route path="*" element={<Navigate to="/login" replace />} />
                </Routes>
              </ErrorBoundary>
            </ModalProvider>
          </BrowserRouter>
        </CompanyProvider>
      </AuthProvider>
    </PlatformProvider>
    </ThemeProvider>
  );
}

export default App;
