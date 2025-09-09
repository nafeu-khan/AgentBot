
"use client";

import { useState } from "react";
import AuthModal from "../../../components/AuthModal";


function LoginPage() {
        const [showAuthModal, setShowAuthModal] = useState(true);
	return (
		<AuthModal
			isOpen={true} //{ showAuthModal}
			onClose={() => setShowAuthModal(false)}
		/>
	);
}

export default LoginPage;
