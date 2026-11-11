function Strip({ label, value, icon: Icon }) {
	return (
		<div className="strip-item">
			<span className="strip-icon">
				<Icon size={16} />
			</span>
			<span>
				<small>{label}</small>
				<strong>{value || "—"}</strong>
			</span>
		</div>
	);
}
export default Strip;
