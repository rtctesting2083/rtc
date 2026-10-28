import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import { CompanyShipmentReportPage } from './pages/company/CompanyShipmentReportPage';
import { CompanyCodSettlementPage } from './pages/company/CompanyCodSettlementPage';
import { CompanyCouriersPage } from './pages/company/CompanyCouriersPage';
import { CompanyCustomersPage } from './pages/company/CompanyCustomersPage';
import { CompanyInvoicesPage } from './pages/company/CompanyInvoicesPage';
import { CompanyTrackPage } from './pages/company/CompanyTrackPage';
import { CompanyBranchesPage } from './pages/company/CompanyBranchesPage';
import { CompanyBranchReportsPage } from './pages/company/CompanyBranchReportsPage';

// Company Settings
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

// Customer (Vendor)
import { CustomerDashboardPage } from './pages/customer/CustomerDashboardPage';
import { CustomerOrdersPage } from './pages/customer/CustomerOrdersPage';
import { CustomerInvoicesPage } from './pages/customer/CustomerInvoicesPage';
import { CustomerProfilePage } from './pages/customer/CustomerProfilePage';
import { CustomerAddressBookPage } from './pages/customer/CustomerAddressBookPage';
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
                  <Route path="shipments" element={<CompanyShipmentsPage />} />
                  <Route path="shipment-reports" element={<CompanyShipmentReportPage />} />
                  <Route path="cod-settlement" element={<CompanyCodSettlementPage />} />
                  <Route path="couriers" element={<CompanyCouriersPage />} />
                  <Route path="customers" element={<CompanyCustomersPage />} />
                  <Route path="invoices" element={<CompanyInvoicesPage />} />
                  <Route path="track" element={<CompanyTrackPage />} />
                  <Route path="branches" element={<CompanyBranchesPage />} />
                  <Route path="branch-reports" element={<CompanyBranchReportsPage />} />

                  {/* Settings sub-routes */}
                  <Route path="settings/order-types" element={<OrderTypesSettingsPage />} />
                  <Route path="settings/delivery-service-types" element={<DeliveryServiceTypesSettingsPage />} />
                  <Route path="settings/product-categories" element={<ProductCategoriesSettingsPage />} />
                  <Route path="settings/landmarks" element={<LandmarksSettingsPage />} />
                  <Route path="settings/delivery-charges" element={<DeliveryChargesSettingsPage />} />
                  <Route path="settings/shipment-statuses" element={<ShipmentStatusesSettingsPage />} />
                  <Route path="settings/users" element={<UserManagementSettingsPage />} />
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
                  <Route path="orders" element={<CustomerOrdersPage />} />
                  <Route path="invoices" element={<CustomerInvoicesPage />} />
                  <Route path="profile" element={<CustomerProfilePage />} />
                  <Route path="customers" element={<CustomerAddressBookPage />} />
                  <Route path="staff" element={<CustomerStaffPage />} />
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
  );
}

export default App;
