import { Navigate, Outlet } from 'react-router-dom';
import { ROLE_HOME, useAuth } from '../context/AuthContext';
import Spinner from './Spinner';

/**
 * Front-end route guard.
 *  - no token  -> /login
 *  - wrong role -> the user's own home page
 * Used both as <ProtectedRoute> (renders the Outlet) and as
 * <ProtectedRoute roles={[...]}>children</ProtectedRoute>.
 */
export default function ProtectedRoute({ roles, children }) {
  const { user, booting } = useAuth();

  if (booting) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={ROLE_HOME[user.role] || '/login'} replace />;
  return children ?? <Outlet />;
}
