"use client";

import { useState, useEffect } from "react";
import { X, Activity, Database, Server, TrendingUp } from "lucide-react";

interface StatusPanelProps {
	onClose: () => void;
}

interface ServerStatus {
	uptime: number;
	memory: {
		rss: number;
		heapUsed: number;
	};
	timestamp: number;
}

interface DataServiceStatus {
	isFresh: boolean;
	hasData: boolean;
	dataAge?: number;
	lastFetch?: string;
}

interface CacheStatus {
	keys: number;
	hits: number;
	misses: number;
}

interface SystemStatus {
	server?: ServerStatus;
	dataService?: DataServiceStatus;
	cache?: CacheStatus;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const STATUS_CHECK_INTERVAL =
	parseInt(process.env.NEXT_PUBLIC_STATUS_CHECK_INTERVAL || "60") * 1000;

export default function StatusPanel({ onClose }: StatusPanelProps) {
	const [status, setStatus] = useState<SystemStatus | null>(null);
	const [loading, setLoading] = useState(true);

	const fetchStatus = async () => {
		try {
			const response = await fetch(
				`${API_URL}/api/chat/status`
			);
			if (response.ok) {
				const data = await response.json();
				setStatus(data.status);
			} else {
				throw new Error("Failed to fetch status");
			}
		} catch (error) {
			// Error handled silently - status will remain null/previous state
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchStatus();
		const interval = setInterval(
			fetchStatus,
			STATUS_CHECK_INTERVAL
		);
		return () => clearInterval(interval);
	}, []);

	const formatUptime = (seconds: number): string => {
		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		const secs = Math.floor(seconds % 60);
		return `${hours}h ${minutes}m ${secs}s`;
	};

	const formatMemory = (bytes: number): string => {
		return `${Math.round(bytes / 1024 / 1024)} MB`;
	};

	const calculateHitRate = (hits: number, misses: number): number => {
		const total = hits + misses;
		return total > 0 ? Math.round((hits / total) * 100) : 0;
	};

	if (loading) {
		return (
			<div className="h-full p-4">
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-lg font-semibold text-gray-900">
						System Status
					</h2>
					<button
						onClick={onClose}
						className="p-1 hover:bg-gray-100 rounded"
					>
						<X className="w-5 h-5" />
					</button>
				</div>
				<div className="animate-pulse space-y-4">
					<div className="h-4 bg-gray-200 rounded"></div>
					<div className="h-4 bg-gray-200 rounded"></div>
					<div className="h-4 bg-gray-200 rounded"></div>
				</div>
			</div>
		);
	}

	return (
		<div className="h-full p-4 overflow-y-auto">
			<div className="flex items-center justify-between mb-6">
				<h2 className="text-lg font-semibold text-gray-900">
					System Status
				</h2>
				<button
					onClick={onClose}
					className="p-1 hover:bg-gray-100 rounded transition-colors"
				>
					<X className="w-5 h-5" />
				</button>
			</div>

			{status && (
				<div className="space-y-6">
					{/* Data Service Status */}
					<div className="bg-gray-50 rounded-lg p-4">
						<div className="flex items-center space-x-2 mb-3">
							<Database className="w-5 h-5 text-blue-600" />
							<h3 className="font-medium text-gray-900">
								Data Service
							</h3>
						</div>

						<div className="space-y-2 text-sm">
							<div className="flex justify-between">
								<span className="text-gray-600">
									Status:
								</span>
								<span
									className={`font-medium ${
										status
											.dataService
											?.isFresh
											? "text-green-600"
											: "text-yellow-600"
									}`}
								>
									{status
										.dataService
										?.isFresh
										? "✅ Fresh"
										: "⚠️ Stale"}
								</span>
							</div>

							<div className="flex justify-between">
								<span className="text-gray-600">
									Has
									Data:
								</span>
								<span
									className={`font-medium ${
										status
											.dataService
											?.hasData
											? "text-green-600"
											: "text-red-600"
									}`}
								>
									{status
										.dataService
										?.hasData
										? "Yes"
										: "No"}
								</span>
							</div>

							{status.dataService
								?.dataAge && (
								<div className="flex justify-between">
									<span className="text-gray-600">
										Data
										Age:
									</span>
									<span className="font-medium text-gray-900">
										{Math.round(
											status
												.dataService
												.dataAge /
												1000
										)}

										s
									</span>
								</div>
							)}

							{status.dataService
								?.lastFetch && (
								<div className="flex justify-between">
									<span className="text-gray-600">
										Last
										Fetch:
									</span>
									<span className="font-medium text-gray-900">
										{new Date(
											status.dataService.lastFetch
										).toLocaleTimeString()}
									</span>
								</div>
							)}
						</div>
					</div>

					{/* Cache Status */}
					<div className="bg-gray-50 rounded-lg p-4">
						<div className="flex items-center space-x-2 mb-3">
							<TrendingUp className="w-5 h-5 text-purple-600" />
							<h3 className="font-medium text-gray-900">
								Cache
							</h3>
						</div>

						<div className="space-y-2 text-sm">
							<div className="flex justify-between">
								<span className="text-gray-600">
									Keys:
								</span>
								<span className="font-medium text-gray-900">
									{status
										.cache
										?.keys ||
										0}
								</span>
							</div>

							<div className="flex justify-between">
								<span className="text-gray-600">
									Hits:
								</span>
								<span className="font-medium text-green-600">
									{status
										.cache
										?.hits ||
										0}
								</span>
							</div>

							<div className="flex justify-between">
								<span className="text-gray-600">
									Misses:
								</span>
								<span className="font-medium text-red-600">
									{status
										.cache
										?.misses ||
										0}
								</span>
							</div>

							{status.cache?.hits &&
								status.cache
									?.misses && (
									<div className="flex justify-between">
										<span className="text-gray-600">
											Hit
											Rate:
										</span>
										<span className="font-medium text-blue-600">
											{calculateHitRate(
												status
													.cache
													.hits,
												status
													.cache
													.misses
											)}
											%
										</span>
									</div>
								)}
						</div>
					</div>

					{/* Server Status */}
					<div className="bg-gray-50 rounded-lg p-4">
						<div className="flex items-center space-x-2 mb-3">
							<Server className="w-5 h-5 text-green-600" />
							<h3 className="font-medium text-gray-900">
								Server
							</h3>
						</div>

						<div className="space-y-2 text-sm">
							<div className="flex justify-between">
								<span className="text-gray-600">
									Uptime:
								</span>
								<span className="font-medium text-gray-900">
									{formatUptime(
										status
											.server
											?.uptime ||
											0
									)}
								</span>
							</div>

							<div className="flex justify-between">
								<span className="text-gray-600">
									Memory
									(RSS):
								</span>
								<span className="font-medium text-gray-900">
									{formatMemory(
										status
											.server
											?.memory
											?.rss ||
											0
									)}
								</span>
							</div>

							<div className="flex justify-between">
								<span className="text-gray-600">
									Memory
									(Heap):
								</span>
								<span className="font-medium text-gray-900">
									{formatMemory(
										status
											.server
											?.memory
											?.heapUsed ||
											0
									)}
								</span>
							</div>

							<div className="flex justify-between">
								<span className="text-gray-600">
									Last
									Update:
								</span>
								<span className="font-medium text-gray-900">
									{new Date(
										status
											.server
											?.timestamp ||
											Date.now()
									).toLocaleTimeString()}
								</span>
							</div>
						</div>
					</div>

					{/* Refresh Status */}
					<div className="text-center">
						<button
							onClick={fetchStatus}
							className="flex items-center space-x-2 mx-auto px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
						>
							<Activity className="w-4 h-4" />
							<span>
								Refresh Status
							</span>
						</button>
					</div>
				</div>
			)}

			{!status && !loading && (
				<div className="text-center py-8">
					<div className="text-gray-500">
						<Server className="w-12 h-12 mx-auto mb-4 opacity-50" />
						<p>
							Unable to fetch system
							status
						</p>
						<button
							onClick={fetchStatus}
							className="mt-4 px-4 py-2 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
						>
							Retry
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
