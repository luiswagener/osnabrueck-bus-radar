import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type SelectOption = { value: string; label: string };

type SelectProps = {
	options: readonly SelectOption[];
	value: string;
	onValueChange: (value: string) => void;
	className?: string;
	"aria-label"?: string;
};

// native <select>: the OS picker on phones, keyboard and screen readers for free
function Select({ options, value, onValueChange, className, "aria-label": ariaLabel }: SelectProps) {
	return (
		<div className={cn("relative w-full", className)} data-slot="select-wrapper">
			<select
				aria-label={ariaLabel}
				className="flex h-9 w-full min-w-0 appearance-none items-center rounded-md border border-input bg-card px-3 py-2 pr-9 text-sm whitespace-nowrap transition-[color,box-shadow] outline-none hover:border-ring/50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
				data-slot="select"
				onChange={(event) => onValueChange(event.target.value)}
				style={{ WebkitAppearance: "none" }}
				value={value}
			>
				{options.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
			<ChevronDownIcon
				aria-hidden="true"
				className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground opacity-50"
			/>
		</div>
	);
}

export { Select };
