import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import type { Role } from '../api/auth';

interface ProtectedRouteProps {
  children: ReactNode;
  roles?: Role[];
}

/**
 * Hides pages from the wrong role, but this is only UX. The backend enforces
 * every permission independently.
 */
export function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="container page-loading" role="status">
        Checking your session…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <div className="container page-loading">
        <p>Your account does not have access to this page.</p>
      </div>
    );
  }

  return <>{children}</>;
}
