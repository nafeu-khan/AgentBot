"use client";

import { ReactNode } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Shield, Lock } from "lucide-react";

interface ProtectedRouteProps {
	children: ReactNode;
	requireAuth?: boolean;
	requireRole?: "admin" | "user";
	fallback?: ReactNode;
}

export default function ProtectedRoute({
	children,
	requireAuth = true,
	requireRole,
	fallback,
}: ProtectedRouteProps) {
	const { isAuthenticated, user, isLoading } = useAuth();

	// Show loading spinner while checking auth
	if (isLoading) {
		return (
			<div className="flex items-center justify-center min-h-64">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
			</div>
		);
	}

	// Check authentication requirement
	if (requireAuth && !isAuthenticated) {
		return (
			fallback || (
				<div className="flex flex-col items-center justify-center min-h-64 p-8">
					<div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 max-w-md text-center">
						<Lock className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
						<h3 className="text-lg font-semibold text-gray-900 mb-2">
							Authentication Required
						</h3>
						<p className="text-gray-600 mb-4">
							You need to sign in to access this feature.
						</p>
						<button
							onClick={() => window.location.reload()}
							className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
						>
							Sign In
						</button>
					</div>
				</div>
			)
		);
	}

	// Check role requirement
	if (requireRole && user?.role !== requireRole) {
		return (
			fallback || (
				<div className="flex flex-col items-center justify-center min-h-64 p-8">
					<div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md text-center">
						<Shield className="w-12 h-12 text-red-600 mx-auto mb-4" />
						<h3 className="text-lg font-semibold text-gray-900 mb-2">
							Insufficient Permissions
						</h3>
						<p className="text-gray-600 mb-4">
							You don't have permission to access this feature.
							{requireRole === "admin" &&
								" Admin access required."}
						</p>
						<p className="text-sm text-gray-500">
							Current role: {user?.role || "none"}
						</p>
					</div>
				</div>
			)
		);
	}

	// All checks passed, render children
	return <>{children}</>;
}

// Convenience wrapper for admin-only content
export function AdminOnly({
	children,
	fallback,
}: {
	children: ReactNode;
	fallback?: ReactNode;
}) {
	return (
		<ProtectedRoute
			requireAuth={true}
			requireRole="admin"
			fallback={fallback}
		>
			{children}
		</ProtectedRoute>
	);
}

// Convenience wrapper for authenticated-only content
export function AuthOnly({
	children,
	fallback,
}: {
	children: ReactNode;
	fallback?: ReactNode;
}) {
	return (
		<ProtectedRoute requireAuth={true} fallback={fallback}>
			{children}
		</ProtectedRoute>
	);
}
