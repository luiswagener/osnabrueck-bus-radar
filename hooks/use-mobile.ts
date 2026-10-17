import * as React from "react";

export const MOBILE_BREAKPOINT = 768;
const query = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

// same behavior as the waner-plan hook, as an external store (this project's lint forbids setState in effects)
function subscribe(onChange: () => void) {
	const mql = window.matchMedia(query);
	mql.addEventListener("change", onChange);
	return () => mql.removeEventListener("change", onChange);
}

export function useIsMobile() {
	return React.useSyncExternalStore(
		subscribe,
		() => window.innerWidth < MOBILE_BREAKPOINT,
		() => false, // server render: desktop until hydrated
	);
}
