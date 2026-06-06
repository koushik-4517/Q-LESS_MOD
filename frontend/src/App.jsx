import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import DoctorDashboard from './pages/DoctorDashboard';
import { useContext, useEffect } from 'react';
import { AuthContext } from './context/AuthContext';

const ProtectedRoute = ({ children, requireStaff = false }) => {
  const { user, token } = useContext(AuthContext);
  
  if (!token) return <Navigate to="/login" />;
  if (requireStaff && user?.role === 'user') return <Navigate to="/dashboard" />;
  
  return children;
};

function AppTitleManager() {
  const { user } = useContext(AuthContext);
  const location = useLocation();

  useEffect(() => {
    if (user) {
      if (user.role === 'admin') {
        document.title = 'Admin - Q-Less';
      } else if (user.role === 'service_provider') {
        document.title = 'Doctor - Q-Less';
      } else {
        document.title = 'Patient - Q-Less';
      }
    } else {
      if (location.pathname === '/register') {
        document.title = 'Register - Q-Less';
      } else {
        document.title = 'Login - Q-Less';
      }
    }
  }, [user, location.pathname]);

  return null;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />
      <Route path="/doctor" element={
        <ProtectedRoute requireStaff={true}>
          <DoctorDashboard />
        </ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to="/" />} />
      <Route path="/admin" element={
        <ProtectedRoute requireStaff={true}>
          <AdminDashboard />
        </ProtectedRoute>
      } />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-500 selection:text-white">
        <AppTitleManager />
        <AppRoutes />
      </div>
    </AuthProvider>
  );
}

export default App;
