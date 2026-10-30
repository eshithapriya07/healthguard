import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Spinner from './components/Spinner';

import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import LanguageSelect from './pages/LanguageSelect';
import Dashboard from './pages/Dashboard';
import Readings from './pages/Readings';
import Trends from './pages/Trends';
import Alerts from './pages/Alerts';
import Reminders from './pages/Reminders';
import Reports from './pages/Reports';
import Sharing from './pages/Sharing';
import SharedWithMe from './pages/SharedWithMe';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import NotFound from './pages/NotFound';

export default function App() {
  const { user, booting } = useAuth();
  const location = useLocation();

  if (booting) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/language" replace /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to="/language" replace /> : <Register />} />
      <Route path="/forgot" element={<ForgotPassword />} />
      <Route path="/reset" element={<ResetPassword />} />

      <Route element={<ProtectedRoute />}>
        {/* Full-screen language selector shown immediately after every login */}
        <Route path="/language" element={<LanguageSelect />} />

        <Route element={<Layout />}>
          <Route path="/" element={<ProtectedRoute roles={['patient']}><Dashboard /></ProtectedRoute>} />
          <Route path="/readings" element={<ProtectedRoute roles={['patient']}><Readings /></ProtectedRoute>} />
          <Route path="/trends" element={<ProtectedRoute roles={['patient']}><Trends /></ProtectedRoute>} />
          <Route path="/alerts" element={<ProtectedRoute roles={['patient']}><Alerts /></ProtectedRoute>} />
          <Route path="/reminders" element={<ProtectedRoute roles={['patient']}><Reminders /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute roles={['patient']}><Reports /></ProtectedRoute>} />
          <Route path="/sharing" element={<ProtectedRoute roles={['patient']}><Sharing /></ProtectedRoute>} />
          <Route path="/shared" element={<ProtectedRoute roles={['caregiver', 'doctor']}><SharedWithMe /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute roles={['admin']}><Admin /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="*" element={<NotFound state={{ from: location.pathname }} />} />
        </Route>
      </Route>
    </Routes>
  );
}
