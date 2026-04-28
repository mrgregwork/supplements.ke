import { cn } from "@/lib/utils";

interface SeoScoreBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export function SeoScoreBadge({ score, size = "md", showLabel = true }: SeoScoreBadgeProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20";
    if (score >= 60) return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20";
    return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return "Optimized";
    if (score >= 60) return "Needs Work";
    return "Critical";
  };

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
    lg: "text-base px-3 py-1.5",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 font-semibold rounded-md border",
        getScoreColor(score),
        sizeClasses[size]
      )}
      data-testid={`badge-seo-score-${score}`}
    >
      <span className="font-mono">{score}</span>
      {showLabel && <span className="font-normal text-xs opacity-80">/ 100</span>}
    </div>
  );
}

interface SeoScoreCircleProps {
  score: number;
  size?: number;
}

export function SeoScoreCircle({ score, size = 60 }: SeoScoreCircleProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "#22c55e";
    if (score >= 60) return "#eab308";
    return "#ef4444";
  };

  const circumference = 2 * Math.PI * 22;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }} data-testid={`circle-seo-score-${score}`}>
      <svg
        className="transform -rotate-90"
        width={size}
        height={size}
        viewBox="0 0 50 50"
      >
        <circle
          className="text-muted/30"
          strokeWidth="4"
          stroke="currentColor"
          fill="transparent"
          r="22"
          cx="25"
          cy="25"
        />
        <circle
          className="transition-all duration-500 ease-out"
          strokeWidth="4"
          strokeLinecap="round"
          stroke={getScoreColor(score)}
          fill="transparent"
          r="22"
          cx="25"
          cy="25"
          style={{
            strokeDasharray: circumference,
            strokeDashoffset,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold">{score}</span>
      </div>
    </div>
  );
}
