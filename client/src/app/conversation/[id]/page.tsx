"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import ChatBox from "../../../components/ChatBox";
import Header from "../../../components/Header";
import StatusPanel from "../../../components/StatusPanel";
import ObservabilityPanel from "../../../components/ObservabilityPanel";
import AuthModal from "../../../components/AuthModal";
import UserProfile from "../../../components/UserProfile";
import AdminPanel from "../../../components/AdminPanel";

interface ConversationPageProps {
	params: {
		id: string;
	};
}

export default function ConversationPage({ params }: ConversationPageProps) {
	const router = useRouter();
	const { user, isLoading, isAuthenticated } = useAuth();
	const conversationId = params.id;

	// UI state
	const [showStatus, setShowStatus] = useState(false);
	const [showObservability, setShowObservability] = useState(false);
	const [showAuthModal, setShowAuthModal] = useState(false);
	const [showUserProfile, setShowUserProfile] = useState(false);
	const [showAdminPanel, setShowAdminPanel] = useState(false);

	// Redirect to login if not authenticated
	useEffect(() => {
		if (!isLoading && !isAuthenticated) {
			router.push("/");
		}
	}, [isAuthenticated, isLoading, router]);

	// Show loading while checking authentication
	if (isLoading) {
		return (
			<div className="min-h-screen bg-gray-50 flex items-center justify-center">
				<div className="flex items-center space-x-2">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
					<span className="text-gray-600">
						Loading...
					</span>
				</div>
			</div>
		);
	}

	if (!isAuthenticated || !user) {
		return null;
	}

	return (
		<div className="h-screen flex flex-col">
			{/* Header */}
			<Header
				user={user}
				isAuthenticated={isAuthenticated}
				isLoading={isLoading}
				showStatus={showStatus}
				setShowStatus={setShowStatus}
				showObservability={showObservability}
				setShowObservability={setShowObservability}
				setShowAuthModal={setShowAuthModal}
				setShowUserProfile={setShowUserProfile}
				setShowAdminPanel={setShowAdminPanel}
			/>

			{/* Main content */}
			<div className="flex-1 flex overflow-hidden bg-gray-50">
				{/* Chat area */}
				<div className="flex-1 flex flex-col">
					<ChatBox
						conversationId={conversationId}
					/>
				</div>

				{/* Status panel */}
				{/* {showStatus && (
					<div className="w-80 border-l border-gray-200 bg-white">
						<StatusPanel
							onClose={() =>
								setShowStatus(
									false
								)
							}
						/>
					</div>
				)} */}

				{/* Observability panel */}
				{/* {showObservability && (
					<div className="w-96 border-l border-gray-200 bg-gray-900 p-4 overflow-y-auto">
						<div className="flex justify-between items-center mb-4">
							<h2 className="text-xl font-bold text-white">
								Observability
							</h2>
							<button
								onClick={() =>
									setShowObservability(
										false
									)
								}
								className="text-gray-400 hover:text-white text-2xl leading-none"
							>
								×
							</button>
						</div>
						<ObservabilityPanel />
					</div>
				)} */}
			</div>

			{/* Authentication Modals */}
			<AuthModal
				isOpen={showAuthModal}
				onClose={() => setShowAuthModal(false)}
			/>
			<UserProfile
				isOpen={showUserProfile}
				onClose={() => setShowUserProfile(false)}
			/>
			<AdminPanel
				isOpen={showAdminPanel}
				onClose={() => setShowAdminPanel(false)}
			/>
		</div>
	);
}
