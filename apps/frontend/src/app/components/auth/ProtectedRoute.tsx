import { Navigate, Outlet } from 'react-router-dom';
import { useAuth, UserRole } from '../../contexts/AuthContext';

interface ProtectedRouteProps {
  allowedRoles: UserRole[];
}

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // Intercept users with mandatory first-login password change
  if (user.mustChangePassword) {
    return <Navigate to="/first-login/change-password" replace />;
  }

  // Intercept restricted students and redirect them to dedicated restriction screen
  if (user.role === 'CENTER_STUDENT' && user.financialAccessStatus === 'RESTRICTED') {
    return <Navigate to="/financial-restricted" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    // If authenticated but role not allowed, redirect to unauthorized page
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}
