import Image from "next/image";
import { cn } from "@/lib/utils";

interface WordmarkProps {
  className?: string;
  /** Renders a larger lockup for loading / hero contexts. */
  size?: "sm" | "md" | "lg";
}

export function Wordmark({ className, size = "md" }: WordmarkProps) {
  const dimensions = {
    sm: "h-7 w-[122px]",
    md: "h-8 w-[140px] md:h-9 md:w-[157px]",
    lg: "h-14 w-[244px] md:h-16 md:w-[279px]",
  }[size];

  return (
    <span
      className={cn("relative inline-flex shrink-0 select-none", dimensions, className)}
      aria-label="LUKSO UP!Store"
    >
      <Image
        src="/brand/upstore-wordmark.webp"
        alt="LUKSO UP!Store"
        width={960}
        height={220}
        priority
        className="h-full w-full object-contain"
        sizes={size === "lg" ? "279px" : "157px"}
      />
    </span>
  );
}

export default Wordmark;
