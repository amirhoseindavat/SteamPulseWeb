import { Monitor } from "lucide-react";

export default function RequirementsSection({ activeTab, game }) {
	if (activeTab !== "requirements") return null;

	return (
		<div className="detail-card requirements-card">
			<div className="card-title">
				<Monitor size={17} />
				<h3>PC system requirements</h3>
			</div>
			{game.pc_requirements?.minimum ? (
				<div
					className="requirements-copy"
					dangerouslySetInnerHTML={{ __html: game.pc_requirements.minimum }}
				/>
			) : (
				<p>Steam has not provided minimum PC requirements for this title.</p>
			)}
			{game.pc_requirements?.recommended && (
				<>
					<h4>Recommended</h4>
					<div
						className="requirements-copy"
						dangerouslySetInnerHTML={{
							__html: game.pc_requirements.recommended.replace(
								/^\s*(?:<h[1-6][^>]*>\s*Recommended\s*<\/h[1-6]>|<(?:strong|b)[^>]*>\s*Recommended\s*:?\s*<\/(?:strong|b)>|Recommended\s*:?)(?:\s|&nbsp;|<br\s*\/?>)*/i,
								"",
							),
						}}
					/>
				</>
			)}
		</div>
	);
}
