const fs = require('fs');
const path = require('path');

const appPath = path.resolve(__dirname, '../apps/frontend/src/app/App.tsx');
let appContent = fs.readFileSync(appPath, 'utf8');

const targetRoutes = `{/* Primary Manager Dashboard */}
                      <Route element={<ProtectedRoute allowedRoles={['PRIMARY_MANAGER', 'ADMIN']} />}>
                        <Route path="/manager/*" element={<PrimaryManagerDashboard />} />
                      </Route>
                      <Route path="/primary-manager/*" element={<Navigate to="/admin/home" replace />} />`;

const replacementRoutes = `{/* Primary Manager Legacy Routes -> Canonical Admin Redirects (Phase C.A) */}
                      <Route element={<ProtectedRoute allowedRoles={['PRIMARY_MANAGER', 'ADMIN']} />}>
                        <Route path="/manager/home" element={<Navigate to="/admin/home" replace />} />
                        <Route path="/manager/branches" element={<Navigate to="/admin/branches" replace />} />
                        <Route path="/manager/accounts" element={<Navigate to="/admin/accounts" replace />} />
                        <Route path="/manager/team" element={<Navigate to="/admin/team" replace />} />
                        <Route path="/manager/approvals" element={<Navigate to="/admin/approvals" replace />} />
                        <Route path="/manager/cashbox" element={<Navigate to="/admin/cashbox" replace />} />
                        <Route path="/manager/receipts" element={<Navigate to="/admin/receipts" replace />} />
                        <Route path="/manager/financial-policy" element={<Navigate to="/admin/financial-policy" replace />} />
                        <Route path="/manager/reports" element={<Navigate to="/admin/reports" replace />} />
                        <Route path="/manager/subscriptions" element={<Navigate to="/admin/subscriptions" replace />} />
                        <Route path="/manager/students" element={<Navigate to="/admin/students" replace />} />
                        <Route path="/manager/teacher-income" element={<Navigate to="/admin/reports" replace />} />
                        <Route path="/manager/settings" element={<Navigate to="/admin/profile" replace />} />
                        <Route path="/manager/*" element={<Navigate to="/admin/home" replace />} />
                      </Route>
                      <Route path="/primary-manager/*" element={<Navigate to="/admin/home" replace />} />`;

if (appContent.includes('<Route path="/manager/*" element={<PrimaryManagerDashboard />} />')) {
  // Normalize whitespace matching
  appContent = appContent.replace(
    /<Route element=\{<ProtectedRoute allowedRoles=\{.+?\} \/>\}>\s+<Route path="\/manager\/\*" element=\{<PrimaryManagerDashboard \/>\} \/>\s+<\/Route>/s,
    replacementRoutes
  );
  fs.writeFileSync(appPath, appContent, 'utf8');
  console.log('[SUCCESS] App.tsx updated with canonical /admin/* redirects for all /manager/* routes');
} else {
  console.log('[SKIP] App.tsx already updated or target pattern not found');
}

