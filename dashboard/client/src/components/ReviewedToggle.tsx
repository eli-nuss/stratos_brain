import { Check, Circle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ReviewedToggleProps {
  isReviewed: boolean;
  onClick?: () => void;
}

export function ReviewedToggle({ isReviewed, onClick }: ReviewedToggleProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClick?.();
          }}
          className={`p-1 rounded transition-colors ${
            isReviewed
              ? "text-green-500 hover:text-green-400"
              : "text-muted-foreground/40 hover:text-muted-foreground"
          }`}
        >
          {isReviewed ? (
            <Check className="w-4 h-4" />
          ) : (
            <Circle className="w-4 h-4" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {isReviewed ? "Reviewed - Click to unmark" : "Not reviewed - Click to mark as reviewed"}
      </TooltipContent>
    </Tooltip>
  );
}
