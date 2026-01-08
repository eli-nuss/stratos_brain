import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Tag, Star, HelpCircle, XCircle, Check } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAssetTags, setAssetTag, clearAssetTag, AssetTag } from "@/hooks/useAssetTags";

interface AssetTagButtonProps {
  assetId: number;
  onUpdate?: () => void;
}

const TAG_OPTIONS: { value: AssetTag; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'interesting', label: 'Interesting', icon: <Star className="w-4 h-4" />, color: 'text-yellow-500' },
  { value: 'maybe', label: 'Maybe', icon: <HelpCircle className="w-4 h-4" />, color: 'text-blue-400' },
  { value: 'no', label: 'No', icon: <XCircle className="w-4 h-4" />, color: 'text-red-400' },
];

export default function AssetTagButton({ assetId, onUpdate }: AssetTagButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  
  const { getTag, mutate } = useAssetTags();
  const currentTag = getTag(assetId);

  // Calculate dropdown position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left
      });
    }
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close on scroll
  useEffect(() => {
    const handleScroll = () => setIsOpen(false);
    if (isOpen) {
      window.addEventListener('scroll', handleScroll, true);
      return () => window.removeEventListener('scroll', handleScroll, true);
    }
  }, [isOpen]);

  const handleTagSelect = async (tag: AssetTag) => {
    setIsUpdating(true);
    
    if (currentTag === tag) {
      // If clicking the same tag, clear it
      await clearAssetTag(assetId);
    } else {
      // Set the new tag
      await setAssetTag(assetId, tag);
    }
    
    await mutate();
    onUpdate?.();
    setIsUpdating(false);
    setIsOpen(false);
  };

  // Get the current tag display
  const getCurrentTagDisplay = () => {
    if (!currentTag) {
      return <Tag className="w-4 h-4 text-muted-foreground/50" />;
    }
    const tagOption = TAG_OPTIONS.find(t => t.value === currentTag);
    if (!tagOption) return <Tag className="w-4 h-4 text-muted-foreground/50" />;
    return <span className={tagOption.color}>{tagOption.icon}</span>;
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            ref={buttonRef}
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(!isOpen);
            }}
            disabled={isUpdating}
            className={`p-1 rounded transition-colors hover:bg-muted ${isUpdating ? 'opacity-50' : ''}`}
          >
            {getCurrentTagDisplay()}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          {currentTag ? `Tagged: ${currentTag}` : 'Tag this asset'}
        </TooltipContent>
      </Tooltip>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className="fixed bg-popover border border-border rounded-lg shadow-lg py-1 z-[9999] min-w-[140px]"
          style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
        >
          {TAG_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={(e) => {
                e.stopPropagation();
                handleTagSelect(option.value);
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2 transition-colors"
            >
              <span className={option.color}>{option.icon}</span>
              <span>{option.label}</span>
              {currentTag === option.value && (
                <Check className="w-4 h-4 ml-auto text-primary" />
              )}
            </button>
          ))}
          {currentTag && (
            <>
              <div className="border-t border-border my-1" />
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  setIsUpdating(true);
                  await clearAssetTag(assetId);
                  await mutate();
                  onUpdate?.();
                  setIsUpdating(false);
                  setIsOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2 transition-colors text-muted-foreground"
              >
                <XCircle className="w-4 h-4" />
                <span>Clear tag</span>
              </button>
            </>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
