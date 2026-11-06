import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { PlatformProvider } from './context/PlatformContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CompanyProvider } from './context/CompanyContext';
import { ModalProvider } from './context/ModalContext';

// Layouts
import { CompanyLayout } from './components/layout/CompanyLayout';
import { BranchLayout } from './components/layout/BranchLayout';
import { CustomerLayout } from './components/layout/CustomerLayout';
import { RiderLayout } from './components/layout/RiderLayout';

// Portal
import { LoginPage } from './pages/portal/LoginPage';

// Company
import { CompanyOverviewPage } from './pages/company/CompanyOverviewPage';
import { CompanyVerificationPage } from './pages/company/CompanyVerificationPage';
import { CompanyShipmentsPage } from './pages/company/CompanyShipmentsPage';
import { CompanyVendorOrdersReportPage } from './pages/company/CompanyVendorOrdersReportPage';
import { CompanyShipmentReportPage } from './pages/company/CompanyShipmentReportPage';
import { CompanyCodSettlementPage } from './pages/company/CompanyCodSettlementPage';
import { CompanyCouriersPage } from './pages/company/CompanyCouriersPage';
import { CompanyCustomersPage } from './pages/company/CompanyCustomersPage';
import { CompanyInvoicesPage } from './pages/company/CompanyInvoicesPage';
import { CompanyTrackPage } from './pages/company/CompanyTrackPage';
import { CompanyBranchesPage } from './pages/company/CompanyBranchesPage';
import { CompanyBranchReportsPage } from './pages/company/CompanyBranchReportsPage';
import { CompanyNoticesPage } from './pages/company/CompanyNoticesPage';
import { AdminProfilePage } from './pages/company/AdminProfilePage';

// Company Settings
import { CompanyThemeSettingsPage } from './pages/company/settings/CompanyThemeSettingsPage';
import { OrderTypesSettingsPage } from './pages/company/settings/OrderTypesSettingsPage';
import { DeliveryServiceTypesSettingsPage } from './pages/company/settings/DeliveryServiceTypesSettingsPage';
import { ProductCategoriesSettingsPage } from './pages/company/settings/ProductCategoriesSettingsPage';
import { LandmarksSettingsPage } from './pages/company/settings/LandmarksSettingsPage';
import { DeliveryChargesSettingsPage } from './pages/company/settings/DeliveryChargesSettingsPage';
import { ShipmentStatusesSettingsPage } from './pages/company/settings/ShipmentStatusesSettingsPage';
import { UserManagementSettingsPage } from './pages/company/settings/UserManagementSettingsPage';

// Branch
import { BranchOverviewPage } from './pages/branch/BranchOverviewPage';
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
import { CustomerCreatePickupPage } from './pages/customer/CustomerCreatePickupPage';
import { CustomerPickupReportPage } from './pages/customer/CustomerPickupReportPage';
import { CustomerInvoicesPage } from './pages/customer/CustomerInvoicesPage';
import { CustomerCodSettlementPage } from './pages/customer/CustomerCodSettlementPage';
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
            <ModalProvider>
              <BrowserRouter>
                <Routes>
                {/* Public Login Route */}
                <Route path="/login" element={<LoginPage />} />

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
                  <Route path="verification" element={<CompanyVerificationPage />} />
                  <Route path="shipments" element={<CompanyShipmentsPage view="shipments" />} />
                  <Route path="pickup-requests" element={<CompanyShipmentsPage view="pickup_requests" />} />
                  <Route path="exchange-orders" element={<CompanyShipmentsPage view="exchange" />} />
                  <Route path="returns" element={<CompanyShipmentsPage view="returns" />} />
                  <Route path="status-comments" element={<CompanyShipmentsPage view="comments" />} />
                  <Route path="vendor-orders" element={<CompanyVendorOrdersReportPage />} />
                  <Route path="vendor-orders-report" element={<CompanyVendorOrdersReportPage />} />
                  <Route path="shipment-reports" element={<CompanyShipmentReportPage view="all" />} />
                  <Route path="sales-report" element={<CompanyShipmentReportPage view="sales" />} />
                  <Route path="location-report" element={<CompanyShipmentReportPage view="locations" />} />
                  <Route path="cod-settlement" element={<CompanyCodSettlementPage />} />
                  <Route path="couriers" element={<CompanyCouriersPage />} />
                  <Route path="customers" element={<CompanyCustomersPage />} />
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
                  <Route path="settings/delivery-service-types" element={<DeliveryServiceTypesSettingsPage />} />
                  <Route path="settings/product-categories" element={<ProductCategoriesSettingsPage />} />
                  <Route path="settings/landmarks" element={<LandmarksSettingsPage />} />
                  <Route path="settings/delivery-charges" element={<DeliveryChargesSettingsPage />} />
                  <Route path="settings/shipment-statuses" element={<ShipmentStatusesSettingsPage />} />
                  <Route path="settings/users" element={<UserManagementSettingsPage />} />
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
                  <Route path="shipments" element={<BranchShipmentsPage />} />
                  <Route path="received-shipments" element={<BranchReceivedShipmentsPage />} />
                  <Route path="track" element={<BranchTrackReceivePage />} />
                  <Route path="track-receive" element={<Navigate to="../track" replace />} />
                  <Route path="reports" element={<BranchShipmentReportPage />} />
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
                  <Route path="orders/pickup-request" element={<CustomerCreatePickupPage />} />
                  <Route path="orders/pickup-create" element={<CustomerCreatePickupPage />} />
                  <Route path="orders/pickup-report" element={<CustomerPickupReportPage />} />
                  <Route path="orders/pickup-requests" element={<CustomerPickupReportPage />} />
                  <Route path="invoices" element={<CustomerInvoicesPage />} />
                  <Route path="cod-settlement" element={<CustomerCodSettlementPage />} />
                  <Route path="profile" element={<CustomerProfilePage />} />
                  <Route path="customers" element={<CustomerAddressBookPage />} />
                  <Route path="address-book" element={<CustomerAddressBookPage />} />
                  <Route path="customer-details" element={<CustomerDetailsPage />} />
                  <Route path="staff" element={<CustomerStaffPage />} />
                  <Route path="check-rate" element={<CustomerCheckRatePage />} />
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
                </Route>

                {/* Default Fallback */}
                <Route path="*" element={<Navigate to="/login" replace />} />
              </Routes>
            </BrowserRouter>
          </ModalProvider>
        </CompanyProvider>
      </AuthProvider>
    </PlatformProvider>
    </ThemeProvider>
  );
}

export default App;
