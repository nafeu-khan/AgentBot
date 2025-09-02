"use client";

import { useState } from "react";
import ChatBox from "../components/ChatBox";
import StatusPanel from "../components/StatusPanel";
import ObservabilityPanel from "../components/ObservabilityPanel";
import { Activity, Zap, Eye } from "lucide-react";

/**
 * Main page component
 * Displays the chat interface and status information
 */
export default function Home() {
	const [showStatus, setShowStatus] = useState(false);
	const [showObservability, setShowObservability] = useState(false);

	return (
		<div className="h-screen flex flex-col">
			<header className="bg-white shadow-sm border-b border-gray-200">
				<div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex justify-between items-center h-16">
						<div className="flex items-center space-x-3">
							<div className="flex items-center justify-center w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
								<Zap className="w-6 h-6 text-white" />
							</div>
							<div>
								<h1 className="text-lg font-bold text-gray-900  ">
									Energy Demand AI 
								</h1>
								<p className="text-sm font-size text-gray-500">
									Real-time insights powered by agentic AI
								</p>
							</div>
						</div>

						<div className="flex items-center space-x-2">
							<div className="flex items-center space-x-2">
								<button
									onClick={() => setShowStatus(!showStatus)}
									className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
								>
									<Activity className="w-4 h-4" />
									<span className="hidden sm:block">System Status</span>
								</button>

								<button
									onClick={() =>
										setShowObservability(!showObservability)
									}
									className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-md transition-colors"
								>
									<Eye className="w-4 h-4" />
									<span className="hidden sm:block">Observability</span>
								</button>
							</div>
						</div>
					</div>
				</div>
			</header>

			{/* Main content */}
			<div className="flex-1 flex overflow-hidden">
				{/* Chat area */}
				<div className="flex-1 flex flex-col px-15">
					<ChatBox />
				</div>

				{/* Status panel */}
				{showStatus && (
					<div className="w-80 border-l border-gray-200 bg-white">
						<StatusPanel onClose={() => setShowStatus(false)} />
					</div>
				)}

				{/* Observability panel */}
				{showObservability && (
					<div className="w-96 border-l border-gray-200 bg-gray-900 p-4 overflow-y-auto">
						<div className="flex justify-between items-center mb-4">
							<h2 className="text-xl font-bold text-white">
								Observability
							</h2>
							<button
								onClick={() => setShowObservability(false)}
								className="text-gray-400 hover:text-white text-2xl leading-none"
							>
								×
							</button>
						</div>
						<ObservabilityPanel />
					</div>
				)}
			</div>

			{/* Footer */}
			<footer className="bg-white border-t border-gray-200 px-4 py-3">
				<div className="max-w-7xl mx-auto sm:flex justify-between items-center text-sm text-gray-500">
					<div className="flex items-center space-x-4 sm:space-x-6 ">
						<span className="md:block">Built with LangChain + LangGraph + Ollama</span>
						<span className="md:block">•</span>
						<span className="md:block">Monitored with LangSmith</span>
						<span className="md:block">•</span>
						<span className="md:block">Data updates every 5 seconds</span>
					</div>
					<div className="flex items-center space-x-2">
						<div className="w-2 h-2 bg-green-400 rounded-full"></div>
						<span className="md:block">Connected</span>
					</div>
				</div>
			</footer>
		</div>
	);
}
