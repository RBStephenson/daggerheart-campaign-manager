import { Navigate } from 'react-router-dom';
import { useAuth, type Role } from '../context/AuthContext';

interface ProtectedRouteProps {
  roles: Role[];
  children: React.ReactNode;
}

export default function ProtectedRoute({ roles, children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) return <p className="text-slate-600">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) {
    return <p className="text-slate-600">You don&apos;t have access to this area.</p>;
  }
  return <>{children}</>;
}
