// src/App.tsx
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";

import { AuthProvider } from "@/lib/auth";
import { TenantProvider } from "@/lib/tenantContext";

import ProtectedRoute from "@/components/ProtectedRoute";
import RequireSuperAdmin from "@/components/RequireSuperAdmin";
import RequireTenant from "@/components/RequireTenant";
import RequireCompanyAdmin from "@/components/RequireCompanyAdmin";
import CompanyDetail from "@/pages/admin/CompanyDetail";

import Suppliers from "@/pages/app/Suppliers";
import AppLayout from "@/components/AppLayout";
import AdminLayout from "@/components/AdminLayout";

import EhoVisits from "@/pages/app/EhoVisits";
import EhoVisitNew from "@/pages/app/EhoVisitNew";
import EhoVisitDetail from "@/pages/app/EhoVisitDetail";

import Dashboard from "@/pages/Dashboard";
import DailyChecks from "@/pages/DailyChecks";
import CheckRun from "@/pages/app/CheckRun";
import Incidents from "@/pages/Incidents";
import IncidentNew from "@/pages/app/IncidentNew";
import IncidentDetail from "@/pages/app/IncidentDetail";
import HACCP from "@/pages/HACCP";
import Training from "@/pages/Training";

import Temps from "@/pages/app/Temps";
import TempRecord from "@/pages/app/TempRecord";
import TempAssets from "@/pages/app/TempAssets";

import Sites from "@/pages/app/Sites";
import Users from "@/pages/app/Users";

import AdminDashboard from "@/pages/admin/AdminDashboard";
import Companies from "@/pages/admin/Companies";
import AdminUsers from "@/pages/admin/Users";

import Login from "@/pages/Login";
import NoAccess from "@/pages/NoAccess";
import Hub from "@/pages/Hub";
import NotFound from "@/pages/NotFound";
import IncidentReports from "./pages/app/IncidentReports";


const queryClient = new QueryClient();

function Landing() {
  return <Navigate to="/hub" replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Analytics />

        <AuthProvider>
          <TenantProvider>
            <BrowserRouter>
              <Routes>
                {/* Public */}
                <Route path="/login" element={<Login />} />

                {/* Protected */}
                <Route element={<ProtectedRoute />}>
                  {/* Smart landing */}
                  <Route path="/" element={<Landing />} />

                  {/* Super Admin area (Hub + Admin pages share the same layout) */}
                  <Route element={<RequireSuperAdmin />}>
                    <Route element={<AdminLayout />}>
                      <Route path="/hub" element={<Hub />} />
                      <Route path="/admin" element={<AdminDashboard />} />
                      <Route path="/admin/companies" element={<Companies />} />
                      <Route path="/admin/companies/:companyId" element={<CompanyDetail />} />
                      <Route path="/admin/users" element={<AdminUsers />} />
                    </Route>
                  </Route>

                  {/* No access */}
                  <Route path="/no-access" element={<NoAccess />} />

                  {/* Tenant App */}
                  <Route element={<RequireTenant />}>
                    <Route element={<AppLayout />}>
                      {/* Core */}
                      <Route path="/app" element={<Dashboard />} />

                      {/* Checklists */}
                      <Route path="/app/checks" element={<DailyChecks />} />
                      <Route path="/app/checks/run/:runId" element={<CheckRun />} />

                      {/* Temps (ALL temps routes should live inside AppLayout so sidebar shows) */}
                      <Route path="/app/temps" element={<Temps />} />
                      <Route path="/app/temps/record" element={<TempRecord />} />

                      {/* Company Admin tools inside Tenant App */}
                      <Route element={<RequireCompanyAdmin />}>
                        {/* temps config */}
                        <Route path="/app/temps/assets" element={<TempAssets />} />

                        {/* tenant admin */}
                        <Route path="/app/sites" element={<Sites />} />
                        <Route path="/app/users" element={<Users />} />
                      </Route>

                      {/* Other modules */}
                      <Route path="/app/suppliers" element={<Suppliers />} />
                      <Route path="/app/incidents" element={<Incidents />} />
                      <Route path="/app/incidents/new" element={<IncidentNew />} />
                      <Route path="/app/incidents/:id" element={<IncidentDetail />} />
                      <Route path="/app/reports" element={<IncidentReports />} />
                      <Route path="/app/eho" element={<EhoVisits />} />
                      <Route path="/app/eho/new" element={<EhoVisitNew />} />
                      <Route path="/app/eho/:visitId" element={<EhoVisitDetail />} />
                      <Route path="/app/haccp" element={<HACCP />} />
                      <Route path="/app/training" element={<Training />} />
                      
                    </Route>
                  </Route>
                </Route>

                {/* 404 */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TenantProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
