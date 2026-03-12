import { HelpCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface HelpTooltipProps {
  content: string;
  position?: "top" | "bottom" | "left" | "right";
}

export function HelpTooltip({ content, position = "top" }: HelpTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsVisible(false);
      }
    }

    if (isVisible) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isVisible]);

  const getPositionClasses = () => {
    switch (position) {
      case "top":
        return "bottom-full mb-2 left-1/2 -translate-x-1/2";
      case "bottom":
        return "top-full mt-2 left-1/2 -translate-x-1/2";
      case "left":
        return "right-full mr-2 top-1/2 -translate-y-1/2";
      case "right":
        return "left-full ml-2 top-1/2 -translate-y-1/2";
      default:
        return "bottom-full mb-2 left-1/2 -translate-x-1/2";
    }
  };

  const getArrowClasses = () => {
    switch (position) {
      case "top":
        return "top-full left-1/2 -translate-x-1/2 border-t-gray-900";
      case "bottom":
        return "bottom-full left-1/2 -translate-x-1/2 border-b-gray-900";
      case "left":
        return "left-full top-1/2 -translate-y-1/2 border-l-gray-900";
      case "right":
        return "right-full top-1/2 -translate-y-1/2 border-r-gray-900";
      default:
        return "top-full left-1/2 -translate-x-1/2 border-t-gray-900";
    }
  };

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsVisible(!isVisible)}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="inline-flex items-center justify-center w-5 h-5 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="ヘルプ"
      >
        <HelpCircle className="w-4 h-4" />
      </button>

      {isVisible && (
        <div
          ref={tooltipRef}
          className={`absolute z-50 ${getPositionClasses()}`}
          onMouseEnter={() => setIsVisible(true)}
          onMouseLeave={() => setIsVisible(false)}
        >
          <div className="bg-gray-900 text-white text-sm rounded-lg px-3 py-2 shadow-lg max-w-xs">
            {content}
          </div>
          <div className={`absolute w-0 h-0 border-4 border-transparent ${getArrowClasses()}`} />
        </div>
      )}
    </div>
  );
}
