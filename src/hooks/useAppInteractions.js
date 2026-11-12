import { useEffect, useRef } from "react";

export function useAppInteractions({ setSearchOpen }) {
	const calculatorRef = useRef(null);
	const searchRef = useRef(null);
	const headerSearchRef = useRef(null);

	useEffect(() => {
		const close = (event) => {
			if (
				!searchRef.current?.contains(event.target) &&
				!headerSearchRef.current?.contains(event.target)
			) {
				setSearchOpen(false);
			}
		};

		document.addEventListener("mousedown", close);
		return () => document.removeEventListener("mousedown", close);
	}, [setSearchOpen]);

	return { calculatorRef, searchRef, headerSearchRef };
}
