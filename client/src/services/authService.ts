import apiService from "./apiService";

export interface User {
	id: number;
	username: string;
	email: string;
	role: string;
	createdAt: string;
	lastLoginAt?: string;
}

export interface LoginCredentials {
	identifier: string;
	password: string;
}

export interface RegisterData {
	username: string;
	email: string;
	password: string;
	confirmPassword: string;
}

export interface AuthResponse {
	success: boolean;
	message: string;
	tokens?: {
		accessToken: string;
		refreshToken: string;
		tokenType: string;
		expiresIn: number;
	};
	user?: User;
	sessionId?: string;
}

export interface TokenValidationResponse {
	success: boolean;
	valid: boolean;
	user?: User;
	message?: string;
}

class AuthService {
	private static readonly TOKEN_KEY = "authToken";
	private static readonly USER_KEY = "userData";

	async login(credentials: LoginCredentials): Promise<AuthResponse> {
		const response = await apiService.post<AuthResponse>(
			"/api/auth/login",
			credentials,
			false // Don't include auth header for login
		);

		if (response.success && response.tokens) {
			this.storeToken(response.tokens.accessToken);
			// Also store refresh token
			if (typeof window !== "undefined") {
				localStorage.setItem(
					"refreshToken",
					response.tokens.refreshToken
				);
			}
			if (response.user) {
				this.storeUser(response.user);
			}
		}

		return response;
	}


	async register(userData: RegisterData): Promise<AuthResponse> {
		const response = await apiService.post<AuthResponse>(
			"/api/auth/register",
			userData,
			false // Don't include auth header for registration
		);

		if (response.success && response.tokens) {
			this.storeToken(response.tokens.accessToken);
			// Also store refresh token
			if (typeof window !== "undefined") {
				localStorage.setItem(
					"refreshToken",
					response.tokens.refreshToken
				);
			}
			if (response.user) {
				this.storeUser(response.user);
			}
		}

		return response;
	}


	async logout(): Promise<void> {
		try {
			// Call logout endpoint to invalidate token on server
			await apiService.post("/api/auth/logout");
		} catch (error) {
			// Continue with local logout even if server call fails
		} finally {
			this.clearLocalStorage();
		}
	}


	async validateToken(): Promise<TokenValidationResponse> {
		try {
			return await apiService.get<TokenValidationResponse>(
				"/api/auth/validate"
			);
		} catch (error) {
			// If validation fails, clear invalid token
			this.clearLocalStorage();
			return {
				success: false,
				valid: false,
				message:
					error instanceof Error
						? error.message
						: "Token validation failed",
			};
		}
	}

	async getProfile(): Promise<{
		success: boolean;
		user: User;
	}> {
		return apiService.get("/api/auth/profile");
	}

	async updateProfile(updates: Partial<User>): Promise<{
		success: boolean;
		user: User;
		message: string;
	}> {
		const response = await apiService.put<{
			success: boolean;
			user: User;
			message: string;
		}>("/api/auth/profile", updates);

		if (response.success && response.user) {
			this.storeUser(response.user);
		}

		return response;
	}


	async changePassword(data: {
		currentPassword: string;
		newPassword: string;
		confirmPassword: string;
	}): Promise<{
		success: boolean;
		message: string;
	}> {
		return apiService.put("/api/auth/password", data);
	}


	async requestPasswordReset(email: string): Promise<{
		success: boolean;
		message: string;
	}> {
		return apiService.post(
			"/api/auth/forgot-password",
			{ email },
			false // Don't include auth header
		);
	}

	async resetPassword(data: {
		token: string;
		password: string;
		confirmPassword: string;
	}): Promise<{
		success: boolean;
		message: string;
	}> {
		return apiService.post(
			"/api/auth/reset-password",
			data,
			false // Don't include auth header
		);
	}


	async refreshToken(): Promise<{
		success: boolean;
		tokens?: {
			accessToken: string;
			refreshToken: string;
			tokenType: string;
			expiresIn: number;
		};
		message: string;
	}> {
		const refreshToken = this.getRefreshToken();
		if (!refreshToken) {
			return {
				success: false,
				message: "No refresh token available",
			};
		}

		const response = await apiService.post<{
			success: boolean;
			tokens?: {
				accessToken: string;
				refreshToken: string;
				tokenType: string;
				expiresIn: number;
			};
			message: string;
		}>("/api/auth/refresh", { refreshToken });

		if (response.success && response.tokens) {
			this.storeToken(response.tokens.accessToken);
			// Store new refresh token if provided
			if (response.tokens.refreshToken) {
				localStorage.setItem(
					"refreshToken",
					response.tokens.refreshToken
				);
			}
		}

		return response;
	}


	isAuthenticated(): boolean {
		return this.getStoredToken() !== null;
	}

	/**
	 * Get stored authentication token
	 */
	getStoredToken(): string | null {
		if (typeof window === "undefined") return null;
		return localStorage.getItem(AuthService.TOKEN_KEY);
	}


	getRefreshToken(): string | null {
		if (typeof window === "undefined") return null;
		return localStorage.getItem("refreshToken");
	}


	getStoredUser(): User | null {
		if (typeof window === "undefined") return null;

		const userData = localStorage.getItem(AuthService.USER_KEY);
		if (!userData) return null;

		try {
			return JSON.parse(userData);
		} catch {
			return null;
		}
	}

	getCurrentUser(): User | null {
		return this.getStoredUser();
	}

	/**
	 * Refresh tokens (alias for refreshToken for backward compatibility)
	 */
	async refreshTokens(): Promise<void> {
		const result = await this.refreshToken();
		if (!result.success) {
			throw new Error(result.message);
		}
	}

	/**
	 * Store user data (public method for AuthContext)
	 */
	storeUserData(user: User): void {
		this.storeUser(user);
	}
	/**
	 * Store authentication token
	 */
	private storeToken(token: string): void {
		if (typeof window !== "undefined") {
			localStorage.setItem(AuthService.TOKEN_KEY, token);
		}
	}

	/**
	 * Store user data
	 */
	private storeUser(user: User): void {
		if (typeof window !== "undefined") {
			localStorage.setItem(
				AuthService.USER_KEY,
				JSON.stringify(user)
			);
		}
	}


	private clearLocalStorage(): void {
		if (typeof window !== "undefined") {
			localStorage.removeItem(AuthService.TOKEN_KEY);
			localStorage.removeItem(AuthService.USER_KEY);
			localStorage.removeItem("refreshToken");
		}
	}


	setupTokenRefresh(): void {
		// Check token validity every 15 minutes
		const interval = setInterval(async () => {
			if (this.isAuthenticated()) {
				try {
					const validation =
						await this.validateToken();
					if (!validation.valid) {
						this.clearLocalStorage();
						// Redirect to login page
						if (
							typeof window !==
							"undefined"
						) {
							window.location.href =
								"/auth/login";
						}
					}
				} catch (error) {
					// Token validation failed - handled silently
				}
			} else {
				clearInterval(interval);
			}
		}, 15 * 60 * 1000); // 15 minutes
	}
}

// Export singleton instance
export default new AuthService();
