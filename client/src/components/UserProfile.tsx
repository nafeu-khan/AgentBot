"use client";

import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
	User,
	Mail,
	Calendar,
	Shield,
	LogOut,
	Settings,
	X,
} from "lucide-react";

interface UserProfileProps {
	isOpen: boolean;
	onClose: () => void;
}

export default function UserProfile({ isOpen, onClose }: UserProfileProps) {
	const { user, logout, updateProfile } = useAuth();
	const [isEditing, setIsEditing] = useState(false);
	const [formData, setFormData] = useState({
		username: user?.username || "",
		email: user?.email || "",
	});
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");

	if (!isOpen || !user) return null;

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const { name, value } = e.target;
		setFormData((prev) => ({ ...prev, [name]: value }));
		setError("");
		setSuccess("");
	};

	const handleUpdateProfile = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);
		setError("");
		setSuccess("");

		try {
			const result = await updateProfile({
				username: formData.username,
				email: formData.email,
			});

			if (result.success) {
				setSuccess("Profile updated successfully!");
				setIsEditing(false);
			} else {
				setError(
					result.error ||
						"Failed to update profile"
				);
			}
		} catch (error) {
			setError("Network error. Please try again.");
		} finally {
			setIsLoading(false);
		}
	};

	const handleLogout = async () => {
		try {
			await logout();
			onClose();
		} catch (error) {
			// Logout error handled silently
		}
	};

	const cancelEdit = () => {
		setIsEditing(false);
		setFormData({
			username: user.username,
			email: user.email,
		});
		setError("");
		setSuccess("");
	};

	return (
		<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
			<div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
				{/* Header */}
				<div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center space-x-3">
							<div className="flex items-center justify-center w-12 h-12 bg-white bg-opacity-20 rounded-full">
								<User className="w-6 h-6 text-white" />
							</div>
							<div>
								<h2 className="text-xl font-bold text-white">
									Profile
								</h2>
								<p className="text-blue-100 text-sm">
									Manage
									your
									account
								</p>
							</div>
						</div>
						<button
							onClick={onClose}
							className="text-white hover:text-blue-200 text-2xl leading-none"
						>
							<X className="w-6 h-6" />
						</button>
					</div>
				</div>

				{/* Content */}
				<div className="px-6 py-6">
					{!isEditing ? (
						/* View Mode */
						<div className="space-y-6">
							{/* User Info */}
							<div className="space-y-4">
								<div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
									<User className="w-5 h-5 text-gray-400" />
									<div>
										<p className="text-sm text-gray-500">
											Username
										</p>
										<p className="font-medium text-gray-900">
											{
												user.username
											}
										</p>
									</div>
								</div>

								<div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
									<Mail className="w-5 h-5 text-gray-400" />
									<div>
										<p className="text-sm text-gray-500">
											Email
										</p>
										<p className="font-medium text-gray-900">
											{
												user.email
											}
										</p>
									</div>
								</div>

								<div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
									<Shield className="w-5 h-5 text-gray-400" />
									<div>
										<p className="text-sm text-gray-500">
											Role
										</p>
										<span
											className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
												user.role ===
												"admin"
													? "bg-purple-100 text-purple-800"
													: "bg-green-100 text-green-800"
											}`}
										>
											{user.role ===
											"admin"
												? "Administrator"
												: "User"}
										</span>
									</div>
								</div>

								<div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
									<Calendar className="w-5 h-5 text-gray-400" />
									<div>
										<p className="text-sm text-gray-500">
											Member
											Since
										</p>
										<p className="font-medium text-gray-900">
											{user.createdAt
												? new Date(
														user.createdAt
												  ).toLocaleDateString()
												: "Unknown"}
										</p>
									</div>
								</div>

								{user.lastLoginAt && (
									<div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
										<Calendar className="w-5 h-5 text-gray-400" />
										<div>
											<p className="text-sm text-gray-500">
												Last
												Login
											</p>
											<p className="font-medium text-gray-900">
												{new Date(
													user.lastLoginAt
												).toLocaleString()}
											</p>
										</div>
									</div>
								)}
							</div>

							{/* Action Buttons */}
							<div className="space-y-3">
								<button
									onClick={() =>
										setIsEditing(
											true
										)
									}
									className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
								>
									<Settings className="w-4 h-4" />
									<span>
										Edit
										Profile
									</span>
								</button>

								<button
									onClick={
										handleLogout
									}
									className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
								>
									<LogOut className="w-4 h-4" />
									<span>
										Sign
										Out
									</span>
								</button>
							</div>
						</div>
					) : (
						/* Edit Mode */
						<div>
							<form
								onSubmit={
									handleUpdateProfile
								}
								className="space-y-4"
							>
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

								<div>
									<label className="block text-sm font-medium text-gray-700 mb-1">
										Email
										Address
									</label>
									<div className="relative">
										<input
											type="email"
											name="email"
											value={
												formData.email
											}
											onChange={
												handleInputChange
											}
											className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
											placeholder="Enter your email"
											required
										/>
										<Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
									</div>
								</div>

								{/* Error/Success messages */}
								{error && (
									<div className="bg-red-50 border border-red-200 rounded-lg p-3">
										<p className="text-red-600 text-sm">
											{
												error
											}
										</p>
									</div>
								)}

								{success && (
									<div className="bg-green-50 border border-green-200 rounded-lg p-3">
										<p className="text-green-600 text-sm">
											{
												success
											}
										</p>
									</div>
								)}

								{/* Action Buttons */}
								<div className="flex space-x-3">
									<button
										type="submit"
										disabled={
											isLoading
										}
										className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
									>
										{isLoading ? (
											<div className="flex items-center justify-center">
												<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
												Updating...
											</div>
										) : (
											"Save Changes"
										)}
									</button>

									<button
										type="button"
										onClick={
											cancelEdit
										}
										className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors"
									>
										Cancel
									</button>
								</div>
							</form>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
