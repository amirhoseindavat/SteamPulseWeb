import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

if ("serviceWorker" in navigator && import.meta.env.PROD) {
	navigator.serviceWorker.register("/service-worker.js").catch((error) => {
		console.error("SteamPulse service worker registration failed:", error);
	});
}

createRoot(document.getElementById("root")).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
);
