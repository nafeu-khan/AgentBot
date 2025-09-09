"use client";

import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Eye, EyeOff, User, Mail, Lock, Zap } from "lucide-react";

interface AuthModalProps {
	isOpen: boolean;
	onClose: () => void;
}

interface FormData {
	username: string;
	identifier: string;
	password: string;
	confirmPassword: string;
}

const initialFormData: FormData = {
	username: "",
	identifier: "",
	password: "",
	confirmPassword: "",
};

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
	const [isLogin, setIsLogin] = useState(true);
	const [formData, setFormData] = useState<FormData>(initialFormData);
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);
	const [error, setError] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	const { login, register } = useAuth();

	if (!isOpen) return null;

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const { name, value } = e.target;
		setFormData((prev) => ({ ...prev, [name]: value }));
		if (error) setError("");
	};

	const validateForm = (): boolean => {
		if (!isLogin && formData.username.length < 3) {
			setError("Username must be at least 3 characters long");
			return false;
		}

		if (isLogin) {
			if (!formData.identifier?.trim()) {
				setError("Please enter your email or username");
				return false;
			}
		} else {
			if (
				!formData.identifier ||
				!/\S+@\S+\.\S+/.test(formData.identifier)
			) {
				setError("Please enter a valid email address");
				return false;
			}
		}

		if (formData.password.length < 6) {
			setError("Password must be at least 6 characters long");
			return false;
		}

		if (
			!isLogin &&
			formData.password !== formData.confirmPassword
		) {
			setError("Passwords do not match");
			return false;
		}

		return true;
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!validateForm()) return;

		setIsLoading(true);
		setError("");

		try {
			const result = isLogin
				? await login(
						formData.identifier,
						formData.password
				  )
				: await register(
						formData.username,
						formData.identifier,
						formData.password
				  );

			if (result.success) {
				onClose();
				setFormData(initialFormData);
				window.location.href = "/";
			} else {
				setError(result.error || "An error occurred");
			}
		} catch (error) {
			setError("Network error. Please try again.");
		} finally {
			setIsLoading(false);
		}
	};

	const toggleMode = () => {
		setIsLogin(!isLogin);
		setError("");
		setFormData(initialFormData);
	};

	return (
		<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
			<div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
				{/* Header */}
				<div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center space-x-3">
							<div className="flex items-center justify-center w-10 h-10 bg-white bg-opacity-20 rounded-lg">
								<Zap className="w-6 h-6 text-white" />
							</div>
							<div>
								<h2 className="text-xl font-bold text-white">
									{isLogin
										? "Welcome Back"
										: "Join Us"}
								</h2>
								<p className="text-blue-100 text-sm">
									{isLogin
										? "Sign in to your account"
										: "Create your account"}
								</p>
							</div>
						</div>
						<button
							onClick={onClose}
							className="text-white hover:text-blue-200 text-2xl leading-none">
							×
						</button>
					</div>
				</div>

				{/* Form */}
				<div className="px-6 py-6">
					<form
						onSubmit={handleSubmit}
						className="space-y-4">
						{/* Username field (register only) */}
						{!isLogin && (
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">
									Username
								</label>
								<div className="relative">
									<input
										type="text"
										name="username"
										value={
											formData.username
										}
										onChange={
											handleInputChange
										}
										className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
										placeholder="Enter your username"
										required
									/>
									<User className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
								</div>
							</div>
						)}

						{/* Email/Username field */}
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">
								{isLogin
									? "Email or Username"
									: "Email Address"}
							</label>
							<div className="relative">
								<input
									type={
										isLogin
											? "text"
											: "email"
									}
									name="identifier"
									value={
										formData.identifier
									}
									onChange={
										handleInputChange
									}
									className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
									placeholder={
										isLogin
											? "Enter your email or username"
											: "Enter your email"
									}
									required
								/>
								{isLogin ? (
									<User className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
								) : (
									<Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
								)}
							</div>
						</div>

						{/* Password field */}
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">
								Password
							</label>
							<div className="relative">
								<input
									type={
										showPassword
											? "text"
											: "password"
									}
									name="password"
									value={
										formData.password
									}
									onChange={
										handleInputChange
									}
									className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
									placeholder="Enter your password"
									required
								/>
								<Lock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
								<button
									type="button"
									onClick={() =>
										setShowPassword(
											!showPassword
										)
									}
									className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
									{showPassword ? (
										<EyeOff className="h-4 w-4" />
									) : (
										<Eye className="h-4 w-4" />
									)}
								</button>
							</div>
						</div>

						{/* Confirm Password field (register only) */}
						{!isLogin && (
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">
									Confirm
									Password
								</label>
								<div className="relative">
									<input
										type={
											showConfirmPassword
												? "text"
												: "password"
										}
										name="confirmPassword"
										value={
											formData.confirmPassword
										}
										onChange={
											handleInputChange
										}
										className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
										placeholder="Confirm your password"
										required
									/>
									<Lock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
									<button
										type="button"
										onClick={() =>
											setShowConfirmPassword(
												!showConfirmPassword
											)
										}
										className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
										{showConfirmPassword ? (
											<EyeOff className="h-4 w-4" />
										) : (
											<Eye className="h-4 w-4" />
										)}
									</button>
								</div>
							</div>
						)}

						{/* Error message */}
						{error && (
							<div className="bg-red-50 border border-red-200 rounded-lg p-3">
								<p className="text-red-600 text-sm">
									{error}
								</p>
							</div>
						)}

						{/* Submit button */}
						<button
							type="submit"
							disabled={isLoading}
							className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-2 px-4 rounded-lg hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200">
							{isLoading ? (
								<div className="flex items-center justify-center">
									<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
									{isLogin
										? "Signing In..."
										: "Creating Account..."}
								</div>
							) : isLogin ? (
								"Sign In"
							) : (
								"Create Account"
							)}
						</button>
					</form>

					{/* Toggle between login/register */}
					<div className="mt-6 text-center">
						<p className="text-gray-600 text-sm">
							{isLogin
								? "Don't have an account?"
								: "Already have an account?"}
							<button
								onClick={
									toggleMode
								}
								className="ml-1 text-blue-600 hover:text-blue-700 font-medium">
								{isLogin
									? "Sign up"
									: "Sign in"}
							</button>
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
