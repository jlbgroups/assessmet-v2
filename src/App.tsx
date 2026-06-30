import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Auth from './pages/Auth';
import AdminDashboard from './pages/AdminDashboard';
import Institutes from './pages/Institutes';
import Assessments from './pages/Assessments';
import LiveProctoring from './pages/LiveProctoring';
import Violations from './pages/Violations';
import Reports from './pages/Reports';
import CandidateDashboard from './pages/CandidateDashboard';
import SystemCheck from './pages/SystemCheck';
import AssessmentEngine from './pages/AssessmentEngine';
import StudentReport from './pages/StudentReport';
import Feedback from './pages/Feedback';
import LandingPage from './pages/LandingPage';
import PlatformPage from './pages/PlatformPage';
import ContactPage from './pages/ContactPage';
import PublicSiteLayout from './components/PublicSiteLayout';
import { getAuthToken } from './utils/api';

const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRole: string }> = ({ children, allowedRole }) => {
  const token = getAuthToken();
  const role = localStorage.getItem('user_role');

  if (!token) {
    return <Navigate to="/auth" replace />;
  }

  if (role !== allowedRole) {
    return <Navigate to={role === 'admin' ? '/admin' : '/candidate'} replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route element={<PublicSiteLayout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/platform" element={<PlatformPage />} />
          <Route path="/contact" element={<ContactPage />} />
        </Route>

        <Route path="/auth" element={<Auth />} />

        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/institutes"
          element={
            <ProtectedRoute allowedRole="admin">
              <Institutes />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/assessments"
          element={
            <ProtectedRoute allowedRole="admin">
              <Assessments />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/proctoring"
          element={
            <ProtectedRoute allowedRole="admin">
              <LiveProctoring />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/violations"
          element={
            <ProtectedRoute allowedRole="admin">
              <Violations />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/reports"
          element={
            <ProtectedRoute allowedRole="admin">
              <Reports />
            </ProtectedRoute>
          }
        />

        <Route
          path="/candidate"
          element={
            <ProtectedRoute allowedRole="candidate">
              <CandidateDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/system-check"
          element={
            <ProtectedRoute allowedRole="candidate">
              <SystemCheck />
            </ProtectedRoute>
          }
        />
        <Route
          path="/exam"
          element={
            <ProtectedRoute allowedRole="candidate">
              <AssessmentEngine />
            </ProtectedRoute>
          }
        />
        <Route
          path="/report/:attempt_id"
          element={
            <ProtectedRoute allowedRole="admin">
              <StudentReport />
            </ProtectedRoute>
          }
        />
        <Route
          path="/feedback/:attempt_id"
          element={
            <ProtectedRoute allowedRole="candidate">
              <Feedback />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
