"use client";

import React, { useState, useEffect } from "react";
import {
	Activity,
	Eye,
	ExternalLink,
	AlertCircle,
	CheckCircle,
	XCircle,
} from "lucide-react";
import { ObservabilityData, DashboardData } from "../types/types";

const REFRESH_INTERVAL = 30000; // 30 seconds

const STATUS_CONFIG = {
	disabled: { icon: XCircle, text: "Disabled", color: "text-gray-400" },
	noApiKey: {
		icon: AlertCircle,
		text: "No API Key",
		color: "text-yellow-400",
	},
	active: { icon: CheckCircle, text: "Active", color: "text-green-400" },
} as const;

const ObservabilityPanel: React.FC = () => {
	const [observabilityData, setObservabilityData] =
		useState<ObservabilityData | null>(null);
	const [dashboardData, setDashboardData] =
		useState<DashboardData | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isExpanded, setIsExpanded] = useState(false);

	const fetchObservabilityData = async () => {
		try {
			setLoading(true);
			setError(null);

			const statusResponse = await fetch(
				"/api/observability/status"
			);
			const statusData = await statusResponse.json();
			setObservabilityData(statusData);

			if (statusData.langsmith.enabled) {
				const dashboardResponse = await fetch(
					"/api/observability/dashboard"
				);
				const dashboardResult =
					await dashboardResponse.json();
				setDashboardData(dashboardResult);
			}
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "Failed to fetch observability data"
			);
		} finally {
			setLoading(false);
		}
	};

	const createTestTrace = async () => {
		try {
			const response = await fetch(
				"/api/observability/test-trace",
				{
					method: "POST",
					headers: {
						"Content-Type":
							"application/json",
					},
				}
			);
			const result = await response.json();

			if (result.success) {
				alert(
					`Test trace created! Run ID: ${result.runId}`
				);
				if (result.dashboardUrl) {
					window.open(
						result.dashboardUrl,
						"_blank"
					);
				}
			} else {
				alert(
					`Failed to create test trace: ${result.message}`
				);
			}
		} catch (err) {
			alert(
				`Error creating test trace: ${
					err instanceof Error
						? err.message
						: "Unknown error"
				}`
			);
		}
	};

	const getStatusConfig = (enabled: boolean, hasApiKey: boolean) => {
		if (!enabled) return STATUS_CONFIG.disabled;
		if (!hasApiKey) return STATUS_CONFIG.noApiKey;
		return STATUS_CONFIG.active;
	};

	useEffect(() => {
		fetchObservabilityData();
		const interval = setInterval(
			fetchObservabilityData,
			REFRESH_INTERVAL
		);
		return () => clearInterval(interval);
	}, []);

	if (loading) {
		return (
			<div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
				<div className="flex items-center space-x-2">
					<Activity className="w-5 h-5 text-blue-400 animate-pulse" />
					<span className="text-gray-300">
						Loading observability data...
					</span>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="bg-gray-800 rounded-lg p-4 border border-red-500">
				<div className="flex items-center space-x-2">
					<AlertCircle className="w-5 h-5 text-red-400" />
					<span className="text-red-300">
						Error: {error}
					</span>
				</div>
				<button
					onClick={fetchObservabilityData}
					className="mt-2 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
				>
					Retry
				</button>
			</div>
		);
	}

	if (!observabilityData) return null;

	const statusConfig = getStatusConfig(
		observabilityData.langsmith.enabled,
		observabilityData.langsmith.hasApiKey
	);
	const StatusIcon = statusConfig.icon;

	return (
		<div className="bg-gray-800 rounded-lg border border-gray-700">
			<div
				className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-750 transition-colors"
				onClick={() => setIsExpanded(!isExpanded)}
			>
				<div className="flex items-center space-x-3">
					<Eye className="w-5 h-5 text-blue-400" />
					<h3 className="text-lg font-semibold text-white">
						Observability
					</h3>
					<div className="flex items-center space-x-2">
						<StatusIcon
							className={`w-4 h-4 ${statusConfig.color}`}
						/>
						<span
							className={`text-sm ${statusConfig.color}`}
						>
							{statusConfig.text}
						</span>
					</div>
				</div>
				<button className="text-gray-400 hover:text-white">
					{isExpanded ? "▼" : "▶"}
				</button>
			</div>

			{isExpanded && (
				<div className="px-4 pb-4 space-y-4">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						{/* LangSmith Status */}
						<div className="bg-gray-700 rounded-lg p-3">
							<h4 className="font-medium text-white mb-2">
								LangSmith
								Configuration
							</h4>
							<div className="space-y-2 text-sm">
								<div className="flex justify-between">
									<span className="text-gray-300">
										Enabled:
									</span>
									<span
										className={
											observabilityData
												.langsmith
												.enabled
												? "text-green-400"
												: "text-red-400"
										}
									>
										{observabilityData
											.langsmith
											.enabled
											? "Yes"
											: "No"}
									</span>
								</div>
								<div className="flex justify-between">
									<span className="text-gray-300">
										Project:
									</span>
									<span className="text-blue-400">
										{
											observabilityData
												.langsmith
												.project
										}
									</span>
								</div>
								<div className="flex justify-between">
									<span className="text-gray-300">
										Tracing:
									</span>
									<span
										className={
											observabilityData
												.langsmith
												.tracing
												? "text-green-400"
												: "text-red-400"
										}
									>
										{observabilityData
											.langsmith
											.tracing
											? "Active"
											: "Inactive"}
									</span>
								</div>
								<div className="flex justify-between">
									<span className="text-gray-300">
										API
										Key:
									</span>
									<span
										className={
											observabilityData
												.langsmith
												.hasApiKey
												? "text-green-400"
												: "text-yellow-400"
										}
									>
										{observabilityData
											.langsmith
											.hasApiKey
											? "Configured"
											: "Missing"}
									</span>
								</div>
							</div>
						</div>

						{/* Environment Info */}
						<div className="bg-gray-700 rounded-lg p-3">
							<h4 className="font-medium text-white mb-2">
								Environment
							</h4>
							<div className="space-y-2 text-sm">
								<div className="flex justify-between">
									<span className="text-gray-300">
										Node
										Environment:
									</span>
									<span className="text-blue-400">
										{
											observabilityData
												.environment
												.nodeEnv
										}
									</span>
								</div>
								<div className="flex justify-between">
									<span className="text-gray-300">
										Last
										Updated:
									</span>
									<span className="text-gray-400">
										{new Date(
											observabilityData.environment.timestamp
										).toLocaleTimeString()}
									</span>
								</div>
							</div>
						</div>
					</div>

					{/* Actions */}
					<div className="flex flex-wrap gap-2">
						<button
							onClick={
								fetchObservabilityData
							}
							className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
						>
							Refresh Status
						</button>

						{observabilityData.langsmith
							.enabled && (
							<button
								onClick={
									createTestTrace
								}
								className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm"
							>
								Create Test
								Trace
							</button>
						)}

						{dashboardData?.dashboardUrl && (
							<button
								onClick={() =>
									window.open(
										dashboardData.dashboardUrl,
										"_blank"
									)
								}
								className="px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors text-sm flex items-center space-x-1"
							>
								<span>
									Open
									Dashboard
								</span>
								<ExternalLink className="w-4 h-4" />
							</button>
						)}
					</div>

					{!observabilityData.langsmith
						.hasApiKey &&
						observabilityData.langsmith
							.enabled && (
							<div className="bg-yellow-900 border border-yellow-600 rounded-lg p-3">
								<div className="flex items-start space-x-2">
									<AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5" />
									<div>
										<h5 className="text-yellow-400 font-medium">
											API
											Key
											Required
										</h5>
										<p className="text-yellow-200 text-sm mt-1">
											To
											enable
											full
											LangSmith
											functionality,
											please
											add
											your
											API
											key
											to
											the
											backend
											environment
											variables.
											Check
											the
											LANGSMITH_GUIDE.md
											for
											setup
											instructions.
										</p>
									</div>
								</div>
							</div>
						)}
				</div>
			)}
		</div>
	);
};

export default ObservabilityPanel;
