import { useState } from "react";
import { REGIONS } from "../config/regions";
import { ChevronRight, CheckCircle2 } from "lucide-react";

export default function RegionSelect({
	value,
	onChange,
	regions = REGIONS,
	ariaLabel = "Steam price region",
}) {
	const [open, setOpen] = useState(false);
	const selected = regions.find((item) => item.code === value) || regions[0];
	return (
		<div
			className={`region-select-control custom-region-select ${open ? "is-open" : ""}`}>
			<button
				type="button"
				className="region-select-trigger"
				aria-label={ariaLabel}
				aria-haspopup="listbox"
				aria-expanded={open}
				onClick={() => setOpen((current) => !current)}>
				<img
					className="region-select-flag"
					src={`https://flagcdn.com/w40/${selected.code.toLowerCase()}.png`}
					alt=""
				/>
				<span className="region-select-value">
					{selected.label}{" "}
					<small>
						({selected.code} · {selected.currency})
					</small>
				</span>
				<ChevronRight className="region-select-chevron" size={15} />
			</button>
			{open && (
				<div
					className="region-select-menu"
					role="listbox"
					aria-label={ariaLabel}>
					{regions.map((item) => (
						<button
							type="button"
							role="option"
							aria-selected={item.code === value}
							key={item.code}
							className={`region-select-option ${item.code === value ? "active" : ""}`}
							onClick={() => {
								onChange(item.code);
								setOpen(false);
							}}>
							<img
								src={`https://flagcdn.com/w40/${item.code.toLowerCase()}.png`}
								alt=""
							/>
							<span>
								{item.label}
								<small>
									{item.code} · {item.currency}
								</small>
							</span>
							{item.code === value && <CheckCircle2 size={15} />}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
