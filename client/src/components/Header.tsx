"use client";

import { Activity, Zap, Eye, User, LogIn, Settings } from "lucide-react";

interface User {
	id: number;
	username: string;
	email: string;
	role: string;
}

interface HeaderProps {
	user: User | null;
	isAuthenticated: boolean;
	isLoading: boolean;
	showStatus: boolean;
	setShowStatus: (show: boolean) => void;
	showObservability: boolean;
	setShowObservability: (show: boolean) => void;
	setShowAuthModal: (show: boolean) => void;
	setShowUserProfile: (show: boolean) => void;
	setShowAdminPanel: (show: boolean) => void;
}

export default function Header({
	user,
	isAuthenticated,
	isLoading,
	showStatus,
	setShowStatus,
	showObservability,
	setShowObservability,
	setShowAuthModal,
	setShowUserProfile,
	setShowAdminPanel,
}: HeaderProps) {
	return (
		<header className="bg-white shadow-sm border-b border-gray-200">
			<div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
				<div className="flex justify-between items-center h-16">
					<div className="flex items-center space-x-3">
						<div className="flex items-center justify-center w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
							<Zap className="w-6 h-6 text-white" />
						</div>
						<div>
							<h1 className="text-lg font-bold text-gray-900">
								Energy Demand AI
							</h1>
							<p className="text-sm text-gray-500">
								Real-time insights powered by agentic AI
							</p>
						</div>
					</div>

					<div className="flex items-center space-x-2">
						<div className="flex items-center space-x-2">
							{/* <button
								onClick={() =>
									setShowStatus(
										!showStatus
									)
								}
								className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
							>
								<Activity className="w-4 h-4" />
								<span className="hidden sm:block">
									System
									Status
								</span>
							</button>

							<button
								onClick={() =>
									setShowObservability(
										!showObservability
									)
								}
								className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-md transition-colors"
							>
								<Eye className="w-4 h-4" />
								<span className="hidden sm:block">
									Observability
								</span>
							</button> */}

							{/* Authentication Controls */}
							{!isLoading &&
								(isAuthenticated ? (
									<div className="flex items-center space-x-2">
										{user?.role ===
											"admin" && (
											<button
												onClick={() =>
													setShowAdminPanel(
														true
													)
												}
												className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-md transition-colors"
												title="Admin Panel">
												<Settings className="w-4 h-4" />
												<span className="hidden sm:block">
													Admin
												</span>
											</button>
										)}
										<button
											onClick={() =>
												setShowUserProfile(
													true
												)
											}
											className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors">
											<User className="w-4 h-4" />
											<span className="hidden sm:block">
												{
													user?.username
												}
											</span>
										</button>
									</div>
								) : (
									<button
										onClick={() =>
											setShowAuthModal(
												true
											)
										}
										className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors">
										<LogIn className="w-4 h-4" />
										<span className="hidden sm:block">
											Sign In
										</span>
									</button>
								))}
						</div>
					</div>
				</div>
			</div>
		</header>
	);
}
