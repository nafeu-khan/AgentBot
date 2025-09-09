"use client";

import { useState, useEffect } from "react";
import { useAuth, useAuthenticatedFetch } from "../contexts/AuthContext";
import { AdminOnly } from "./ProtectedRoute";
import {
	Users,
	Settings,
	BarChart3,
	Shield,
	Trash2,
	Edit,
	X,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

interface User {
	id: number;
	username: string;
	email: string;
	role: "user" | "admin";
	created_at: string;
	last_login: string | null;
	is_active: boolean;
	email_verified: boolean;
}

interface AdminPanelProps {
	isOpen: boolean;
	onClose: () => void;
}

export default function AdminPanel({ isOpen, onClose }: AdminPanelProps) {
	const { user } = useAuth();
	const authenticatedFetch = useAuthenticatedFetch();
	const [users, setUsers] = useState<User[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");
	const [selectedUser, setSelectedUser] = useState<User | null>(null);
	const [activeTab, setActiveTab] = useState<"users" | "settings">(
		"users"
	);

	if (!isOpen) return null;

	const fetchUsers = async () => {
		setIsLoading(true);
		setError("");
		try {
			const response = await authenticatedFetch(
				`${API_URL}/api/auth/users`
			);

			if (response.ok) {
				const data = (await response.json()) as {
					users: User[];
				};
				setUsers(data.users || []);
			} else {
				const errorData = (await response.json()) as {
					message?: string;
				};
				setError(
					errorData.message ||
						"Failed to fetch users"
				);
			}
		} catch (error) {
			setError("Network error. Please try again.");
		} finally {
			setIsLoading(false);
		}
	};

	const updateUserRole = async (
		userId: number,
		newRole: "user" | "admin"
	) => {
		try {
			const response = await authenticatedFetch(
				`${API_URL}/api/auth/users/${userId}/role`,
				{
					method: "PUT",
					body: JSON.stringify({ role: newRole }),
				}
			);

			if (response.ok) {
				setUsers((prev) =>
					prev.map((u) =>
						u.id === userId
							? {
									...u,
									role: newRole,
							  }
							: u
					)
				);
			} else {
				const errorData = (await response.json()) as {
					message?: string;
				};
				setError(
					errorData.message ||
						"Failed to update user role"
				);
			}
		} catch (error) {
			setError("Network error. Please try again.");
		}
	};

	const deleteUser = async (userId: number) => {
		if (
			!confirm(
				"Are you sure you want to delete this user? This action cannot be undone."
			)
		) {
			return;
		}

		try {
			const response = await authenticatedFetch(
				`${API_URL}/api/auth/users/${userId}`,
				{
					method: "DELETE",
				}
			);

			if (response.ok) {
				setUsers((prev) =>
					prev.filter((u) => u.id !== userId)
				);
				setSelectedUser(null);
			} else {
				const errorData = (await response.json()) as {
					message?: string;
				};
				setError(
					errorData.message ||
						"Failed to delete user"
				);
			}
		} catch (error) {
			setError("Network error. Please try again.");
		}
	};

	useEffect(() => {
		if (isOpen) {
			fetchUsers();
		}
	}, [isOpen]);

	return (
		<AdminOnly
			fallback={
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
					<div className="bg-white rounded-lg p-6 max-w-md">
						<p className="text-red-600">
							Admin access required
						</p>
						<button
							onClick={onClose}
							className="mt-4 px-4 py-2 bg-gray-500 text-white rounded"
						>
							Close
						</button>
					</div>
				</div>
			}
		>
			<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
				<div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
					{/* Header */}
					<div className="bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4">
						<div className="flex items-center justify-between">
							<div className="flex items-center space-x-3">
								<div className="flex items-center justify-center w-10 h-10 bg-white bg-opacity-20 rounded-lg">
									<Shield className="w-6 h-6 text-white" />
								</div>
								<div>
									<h2 className="text-xl font-bold text-white">
										Admin
										Panel
									</h2>
									<p className="text-purple-100 text-sm">
										System
										management
										and
										user
										administration
									</p>
								</div>
							</div>
							<button
								onClick={
									onClose
								}
								className="text-white hover:text-purple-200 text-2xl leading-none"
							>
								<X className="w-6 h-6" />
							</button>
						</div>

						{/* Tabs */}
						<div className="mt-4 flex space-x-1">
							<button
								onClick={() =>
									setActiveTab(
										"users"
									)
								}
								className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
									activeTab ===
									"users"
										? "bg-white bg-opacity-20 text-white"
										: "text-purple-200 hover:text-white hover:bg-white hover:bg-opacity-10"
								}`}
							>
								<Users className="w-4 h-4" />
								<span>
									User
									Management
								</span>
							</button>
							<button
								onClick={() =>
									setActiveTab(
										"settings"
									)
								}
								className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
									activeTab ===
									"settings"
										? "bg-white bg-opacity-20 text-white"
										: "text-purple-200 hover:text-white hover:bg-white hover:bg-opacity-10"
								}`}
							>
								<Settings className="w-4 h-4" />
								<span>
									System
									Settings
								</span>
							</button>
						</div>
					</div>

					{/* Content */}
					<div className="p-6 max-h-[60vh] overflow-y-auto">
						{error && (
							<div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
								<p className="text-red-600 text-sm">
									{error}
								</p>
							</div>
						)}

						{activeTab === "users" && (
							<div className="space-y-4">
								<div className="flex justify-between items-center">
									<h3 className="text-lg font-semibold text-gray-900">
										User
										Management
									</h3>
									<button
										onClick={
											fetchUsers
										}
										disabled={
											isLoading
										}
										className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
									>
										{isLoading
											? "Loading..."
											: "Refresh"}
									</button>
								</div>

								{isLoading ? (
									<div className="flex justify-center py-8">
										<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
									</div>
								) : (
									<div className="overflow-x-auto">
										<table className="min-w-full bg-white border border-gray-200 rounded-lg">
											<thead className="bg-gray-50">
												<tr>
													<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
														User
													</th>
													<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
														Role
													</th>
													<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
														Status
													</th>
													<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
														Last
														Login
													</th>
													<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
														Actions
													</th>
												</tr>
											</thead>
											<tbody className="divide-y divide-gray-200">
												{users.map(
													(
														u
													) => (
														<tr
															key={
																u.id
															}
															className="hover:bg-gray-50"
														>
															<td className="px-4 py-3">
																<div>
																	<div className="font-medium text-gray-900">
																		{
																			u.username
																		}
																	</div>
																	<div className="text-sm text-gray-500">
																		{
																			u.email
																		}
																	</div>
																</div>
															</td>
															<td className="px-4 py-3">
																<select
																	value={
																		u.role
																	}
																	onChange={(
																		e
																	) =>
																		updateUserRole(
																			u.id,
																			e
																				.target
																				.value as
																				| "user"
																				| "admin"
																		)
																	}
																	disabled={
																		u.id ===
																		user?.id
																	}
																	className="text-sm border border-gray-300 rounded px-2 py-1 disabled:bg-gray-100"
																>
																	<option value="user">
																		User
																	</option>
																	<option value="admin">
																		Admin
																	</option>
																</select>
															</td>
															<td className="px-4 py-3">
																<span
																	className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
																		u.is_active
																			? "bg-green-100 text-green-800"
																			: "bg-red-100 text-red-800"
																	}`}
																>
																	{u.is_active
																		? "Active"
																		: "Inactive"}
																</span>
															</td>
															<td className="px-4 py-3 text-sm text-gray-500">
																{u.last_login
																	? new Date(
																			u.last_login
																	  ).toLocaleDateString()
																	: "Never"}
															</td>
															<td className="px-4 py-3">
																<div className="flex space-x-2">
																	<button
																		onClick={() =>
																			setSelectedUser(
																				u
																			)
																		}
																		className="text-blue-600 hover:text-blue-800"
																		title="View Details"
																	>
																		<Edit className="w-4 h-4" />
																	</button>
																	{u.id !==
																		user?.id && (
																		<button
																			onClick={() =>
																				deleteUser(
																					u.id
																				)
																			}
																			className="text-red-600 hover:text-red-800"
																			title="Delete User"
																		>
																			<Trash2 className="w-4 h-4" />
																		</button>
																	)}
																</div>
															</td>
														</tr>
													)
												)}
											</tbody>
										</table>

										{users.length ===
											0 &&
											!isLoading && (
												<div className="text-center py-8 text-gray-500">
													No
													users
													found
												</div>
											)}
									</div>
								)}
							</div>
						)}

						{activeTab === "settings" && (
							<div className="space-y-6">
								<h3 className="text-lg font-semibold text-gray-900">
									System
									Settings
								</h3>

								<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
									<div className="bg-gray-50 p-4 rounded-lg">
										<div className="flex items-center space-x-3 mb-3">
											<BarChart3 className="w-5 h-5 text-blue-600" />
											<h4 className="font-medium text-gray-900">
												System
												Statistics
											</h4>
										</div>
										<div className="space-y-2 text-sm">
											<div className="flex justify-between">
												<span className="text-gray-600">
													Total
													Users:
												</span>
												<span className="font-medium">
													{
														users.length
													}
												</span>
											</div>
											<div className="flex justify-between">
												<span className="text-gray-600">
													Active
													Users:
												</span>
												<span className="font-medium">
													{
														users.filter(
															(
																u
															) =>
																u.is_active
														)
															.length
													}
												</span>
											</div>
											<div className="flex justify-between">
												<span className="text-gray-600">
													Admin
													Users:
												</span>
												<span className="font-medium">
													{
														users.filter(
															(
																u
															) =>
																u.role ===
																"admin"
														)
															.length
													}
												</span>
											</div>
										</div>
									</div>

									<div className="bg-gray-50 p-4 rounded-lg">
										<div className="flex items-center space-x-3 mb-3">
											<Settings className="w-5 h-5 text-purple-600" />
											<h4 className="font-medium text-gray-900">
												Configuration
											</h4>
										</div>
										<div className="space-y-2 text-sm text-gray-600">
											<p>
												•
												JWT
												tokens:
												15m
												access,
												7d
												refresh
											</p>
											<p>
												•
												Session
												timeout:
												24
												hours
											</p>
											<p>
												•
												Rate
												limiting:
												100
												requests/15min
											</p>
											<p>
												•
												Max
												concurrent
												sessions:
												5
											</p>
										</div>
									</div>
								</div>
							</div>
						)}
					</div>

					{/* User Details Modal */}
					{selectedUser && (
						<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60 p-4">
							<div className="bg-white rounded-lg p-6 max-w-md w-full">
								<div className="flex justify-between items-center mb-4">
									<h3 className="text-lg font-semibold">
										User
										Details
									</h3>
									<button
										onClick={() =>
											setSelectedUser(
												null
											)
										}
										className="text-gray-400 hover:text-gray-600"
									>
										<X className="w-5 h-5" />
									</button>
								</div>

								<div className="space-y-3 text-sm">
									<div>
										<span className="font-medium text-gray-700">
											ID:
										</span>
										<span className="ml-2">
											{
												selectedUser.id
											}
										</span>
									</div>
									<div>
										<span className="font-medium text-gray-700">
											Username:
										</span>
										<span className="ml-2">
											{
												selectedUser.username
											}
										</span>
									</div>
									<div>
										<span className="font-medium text-gray-700">
											Email:
										</span>
										<span className="ml-2">
											{
												selectedUser.email
											}
										</span>
									</div>
									<div>
										<span className="font-medium text-gray-700">
											Role:
										</span>
										<span className="ml-2 capitalize">
											{
												selectedUser.role
											}
										</span>
									</div>
									<div>
										<span className="font-medium text-gray-700">
											Created:
										</span>
										<span className="ml-2">
											{new Date(
												selectedUser.created_at
											).toLocaleString()}
										</span>
									</div>
									<div>
										<span className="font-medium text-gray-700">
											Email
											Verified:
										</span>
										<span className="ml-2">
											{selectedUser.email_verified
												? "Yes"
												: "No"}
										</span>
									</div>
								</div>
							</div>
						</div>
					)}
				</div>
			</div>
		</AdminOnly>
	);
}
