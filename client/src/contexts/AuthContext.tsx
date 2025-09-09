"use client";

import React, {
	createContext,
	useContext,
	useState,
	useEffect,
	ReactNode,
} from "react";
import { authService, type User } from "../services";

import { AuthContextType,AuthProviderProps } from "@/types/types";

const AuthContext = createContext<AuthContextType | undefined>(undefined);



export function AuthProvider({ children }: AuthProviderProps) {
	const [user, setUser] = useState<User | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isAuthenticated, setIsAuthenticated] = useState(false);

	// Initialize auth state
	useEffect(() => {
		// Only initialize auth in browser environment
		if (typeof window !== "undefined") {
			initializeAuth();
		}

		// Listen for auth refresh failures
		const handleRefreshFailure = (event: any) => {
			// Only log out if it's a real auth failure, not a network issue
			const error = event.detail?.error || "";
			const isNetworkError =
				error.includes("Failed to fetch") ||
				error.includes("Network") ||
				error.includes("ECONNREFUSED") ||
				error.includes("timeout");

			if (isNetworkError) {
				// Don't log out for network errors
				return;
			}

			setUser(null);
			setIsAuthenticated(false);
		};

		if (typeof window !== "undefined") {
			window.addEventListener(
				"auth:refresh-failed",
				handleRefreshFailure
			);
		}

		return () => {
			if (typeof window !== "undefined") {
				window.removeEventListener(
					"auth:refresh-failed",
					handleRefreshFailure
				);
			}
		};
	}, []);

	const initializeAuth = async () => {
		try {
			setIsLoading(true);

			// Check if user has tokens
			const isAuth = authService.isAuthenticated();

			if (isAuth) {
				// Get stored user data first (for immediate UI update)
				const storedUser = authService.getCurrentUser();

				if (storedUser) {
					setUser(storedUser);
					setIsAuthenticated(true);
				} else {
					setUser(null);
					setIsAuthenticated(false);
				}

				// Don't try to verify tokens immediately on page load
				// Let the user stay logged in with stored data
				// The apiService will handle token refresh on first API call
			} else {
				// No tokens available
				setUser(null);
				setIsAuthenticated(false);
			}
		} catch (error) {
			setUser(null);
			setIsAuthenticated(false);
		} finally {
			setIsLoading(false);
		}
	};

	const login = async (identifier: string, password: string) => {
		try {
			setIsLoading(true);
			const response = await authService.login({
				identifier: identifier, // Use identifier (can be username or email)
				password: password,
			});

			if (response.success && response.user) {
				setUser(response.user);
				authService.storeUserData(response.user); // Make sure user is stored
				setIsAuthenticated(true);
				return { success: true };
			} else {
				return {
					success: false,
					error:
						response.message ||
						"Login failed",
				};
			}
		} catch (error) {
			return {
				success: false,
				error:
					error instanceof Error
						? error.message
						: "Login failed",
			};
		} finally {
			setIsLoading(false);
		}
	};

	const register = async (
		username: string,
		email: string,
		password: string
	) => {
		try {
			setIsLoading(true);
			const response = await authService.register({
				username,
				email,
				password,
				confirmPassword: password, // Use same password for confirmPassword
			});

			if (response.success && response.user) {
				setUser(response.user);
				setIsAuthenticated(true);
				return { success: true };
			} else {
				return {
					success: false,
					error:
						response.message ||
						"Registration failed",
				};
			}
		} catch (error) {
			return {
				success: false,
				error:
					error instanceof Error
						? error.message
						: "Registration failed",
			};
		} finally {
			setIsLoading(false);
		}
	};

	const logout = async () => {
		try {
			setIsLoading(true);
			await authService.logout();
		} catch (error) {
			// Error handled silently
		} finally {
			setUser(null);
			setIsAuthenticated(false);
			setIsLoading(false);
		}
	};

	const refreshToken = async (): Promise<boolean> => {
		try {
			const result = await authService.refreshToken();
			if (result.success && result.tokens) {
				// Update user state if needed
				const storedUser = authService.getCurrentUser();
				if (storedUser && !user) {
					setUser(storedUser);
					setIsAuthenticated(true);
				}
				return true;
			} else {
				// Refresh failed, clear auth state
				setUser(null);
				setIsAuthenticated(false);
				return false;
			}
		} catch (error) {
			console.error("Token refresh error:", error);
			setUser(null);
			setIsAuthenticated(false);
			return false;
		}
	};

	const updateProfile = async (updates: Partial<User>) => {
		try {
			setIsLoading(true);
			const response = await authService.updateProfile(
				updates
			);

			if (response.success && response.user) {
				setUser(response.user);
				return { success: true };
			} else {
				return {
					success: false,
					error: "Profile update failed",
				};
			}
		} catch (error) {
			return {
				success: false,
				error:
					error instanceof Error
						? error.message
						: "Profile update failed",
			};
		} finally {
			setIsLoading(false);
		}
	};

	const value: AuthContextType = {
		user,
		isLoading,
		isAuthenticated,
		login,
		register,
		logout,
		refreshToken,
		updateProfile,
	};

	return (
		<AuthContext.Provider value={value}>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth() {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
}

// Legacy hook for backward compatibility - now uses the apiService directly
export function useAuthenticatedFetch() {
	const { isAuthenticated } = useAuth();

	return async (url: string, options: RequestInit = {}) => {
		if (!isAuthenticated) {
			throw new Error("User not authenticated");
		}

		// Import the apiService dynamically to avoid circular dependencies
		const { apiService } = await import("../services");

		// Extract endpoint from full URL if provided
		const endpoint = url.includes("http")
			? new URL(url).pathname
			: url;

		// Use the appropriate method based on options
		const method = (options.method || "GET").toUpperCase();
		const body = options.body
			? JSON.parse(options.body as string)
			: undefined;

		switch (method) {
			case "GET":
				return {
					ok: true,
					json: async () =>
						await apiService.get(endpoint),
				};
			case "POST":
				return {
					ok: true,
					json: async () =>
						await apiService.post(
							endpoint,
							body
						),
				};
			case "PUT":
				return {
					ok: true,
					json: async () =>
						await apiService.put(
							endpoint,
							body
						),
				};
			case "DELETE":
				return {
					ok: true,
					json: async () =>
						await apiService.delete(
							endpoint
						),
				};
			default:
				throw new Error(
					`Unsupported method: ${method}`
				);
		}
	};
}
