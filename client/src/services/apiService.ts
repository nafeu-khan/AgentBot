
class ApiService {
	private baseURL: string;

	constructor() {
		this.baseURL =
			process.env.NEXT_PUBLIC_API_URL ||
			"http://localhost:3001";
	}

	private getAuthToken(): string | null {
		if (typeof window === "undefined") return null;
		return localStorage.getItem("authToken");
	}

	private getHeaders(includeAuth = true): HeadersInit {
		const headers: HeadersInit = {
			"Content-Type": "application/json",
		};

		if (includeAuth) {
			const token = this.getAuthToken();
			if (token) {
				headers.Authorization = `Bearer ${token}`;
			}
		}

		return headers;
	}

	private async tryRefreshToken(): Promise<boolean> {
		try {
			const refreshToken =
				localStorage.getItem("refreshToken");
			if (!refreshToken) {
                                console.warn("No refresh token available");
				return false;
			}

			const response = await fetch(
				`${this.baseURL}/api/auth/refresh`,
				{
					method: "POST",
					headers: {
						"Content-Type":
							"application/json",
					},
					body: JSON.stringify({ refreshToken }),
				}
			);

			if (response.ok) {
				const data = await response.json();
				if (data.success && data.tokens?.accessToken) {
					localStorage.setItem(
						"authToken",
						data.tokens.accessToken
					);
					if (data.tokens.refreshToken) {
						localStorage.setItem(
							"refreshToken",
							data.tokens.refreshToken
						);
					}
					return true;
				}
			}

			return false;
		} catch (error) {
			console.error("Token refresh failed:", error);
			return false;
		}
	}


	private async handleResponse<T>(response: Response): Promise<T> {
		if (!response.ok) {
			// Handle 401 Unauthorized
			if (response.status === 401) {
				const refreshSuccess =
					await this.tryRefreshToken();
				if (!refreshSuccess) {
					// Refresh failed, clear all tokens and redirect to login
					if (typeof window !== "undefined") {
						localStorage.removeItem(
							"authToken"
						);
						localStorage.removeItem(
							"refreshToken"
						);
						localStorage.removeItem(
							"userData"
						);
						window.location.href =
							"/auth/login";
					}
					throw new Error(
						"Authentication failed. Please login again."
					);
				}

				throw new Error("TOKEN_REFRESHED");
			}

			let errorMessage: string;
			try {
				const errorData = await response.json();
				errorMessage =
					errorData.message ||
					errorData.error ||
					"An error occurred";
			} catch {
				errorMessage = `HTTP ${response.status}: ${response.statusText}`;
			}

			throw new Error(errorMessage);
		}

		try {
			return await response.json();
		} catch {
			// If response is not JSON, return empty object
			return {} as T;
		}
	}

	async get<T>(endpoint: string, includeAuth = true): Promise<T> {
		const url = `${this.baseURL}${endpoint}`;
		const response = await fetch(url, {
			method: "GET",
			headers: this.getHeaders(includeAuth),
		});

		return this.handleResponse<T>(response);
	}


	async post<T>(
		endpoint: string,
		data?: any,
		includeAuth = true
	): Promise<T> {
		const url = `${this.baseURL}${endpoint}`;
		const response = await fetch(url, {
			method: "POST",
			headers: this.getHeaders(includeAuth),
			body: data ? JSON.stringify(data) : undefined,
		});

		return this.handleResponse<T>(response);
	}

	/**
	 * Make PUT request
	 */
	async put<T>(
		endpoint: string,
		data?: any,
		includeAuth = true
	): Promise<T> {
		const url = `${this.baseURL}${endpoint}`;
		const response = await fetch(url, {
			method: "PUT",
			headers: this.getHeaders(includeAuth),
			body: data ? JSON.stringify(data) : undefined,
		});

		return this.handleResponse<T>(response);
	}

	/**
	 * Make DELETE request
	 */
	async delete<T>(endpoint: string, includeAuth = true): Promise<T> {
		const url = `${this.baseURL}${endpoint}`;
		const response = await fetch(url, {
			method: "DELETE",
			headers: this.getHeaders(includeAuth),
		});

		return this.handleResponse<T>(response);
	}


	async stream(
		endpoint: string,
		options: RequestInit = {}
	): Promise<Response> {
		const url = `${this.baseURL}${endpoint}`;
		const headers = {
			...this.getHeaders(),
			Accept: "text/stream",
			"Cache-Control": "no-cache",
		};

		const response = await fetch(url, {
			...options,
			headers: {
				...headers,
				...options.headers,
			},
		});

		if (!response.ok) {
			throw new Error(
				`HTTP ${response.status}: ${response.statusText}`
			);
		}

		return response;
	}

	async public<T>(endpoint: string): Promise<T> {
		return this.get<T>(endpoint, false);
	}

	async upload<T>(
		endpoint: string,
		file: File,
		additionalData?: Record<string, string>
	): Promise<T> {
		const url = `${this.baseURL}${endpoint}`;
		const formData = new FormData();
		formData.append("file", file);

		if (additionalData) {
			Object.entries(additionalData).forEach(
				([key, value]) => {
					formData.append(key, value);
				}
			);
		}

		const token = this.getAuthToken();
		const headers: HeadersInit = {};
		if (token) {
			headers.Authorization = `Bearer ${token}`;
		}

		const response = await fetch(url, {
			method: "POST",
			headers,
			body: formData,
		});

		return this.handleResponse<T>(response);
	}


	setBaseURL(url: string): void {
		this.baseURL = url;
	}


	getBaseURL(): string {
		return this.baseURL;
	}
}

// Export singleton instance
export default new ApiService();
