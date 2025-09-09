import "./globals.css";
import { Inter } from "next/font/google";
import { AuthProvider } from "../contexts/AuthContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
	title: "Energy Demand AI Chatbot",
	description: "Real-time energy demand insights powered by AI",
	keywords: ["energy", "AI", "chatbot", "demand", "real-time"],
	authors: [{ name: "AI Assistant" }],
	viewport: "width=device-width, initial-scale=0.1",
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en" className="h-full">
			<body className={`${inter.className} h-full antialiased  m-2 p-1`}>
				<AuthProvider>
					<div className="min-h-full bg-gradient-to-br from-blue-50 via-white to-purple-50">
						{children}
					</div>
				</AuthProvider>
			</body>
		</html>
	);
}
