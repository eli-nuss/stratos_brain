import { useState, useRef, useEffect } from 'react';
import { Briefcase, Check } from 'lucide-react';
import { useModelPortfolio } from '@/hooks/useModelPortfolio';
import { useCorePortfolio, useCorePortfolioHoldingsCheck } from '@/hooks/useCorePortfolio';
import { createPortal } from 'react-dom';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface AddToPortfolioButtonProps {
  assetId: number;
  onUpdate?: () => void;
  variant?: 'icon' | 'button';
}

export default function AddToPortfolioButton({ assetId, onUpdate, variant = 'icon' }: AddToPortfolioButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState<'model' | 'core' | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const { 
    isInModelPortfolio, 
    addToModelPortfolio, 
    removeFromModelPortfolio 
  } = useModelPortfolio();
  
  const { 
    isInCorePortfolio, 
    addToCorePortfolio, 
    removeFromCorePortfolio 
  } = useCorePortfolio();

  // Also check the new holdings table
  const {
    isInCoreHoldings,
    addToCoreHoldings,
    removeFromCoreHoldings
  } = useCorePortfolioHoldingsCheck();
  
  const inModel = isInModelPortfolio(assetId);
  const inCore = isInCorePortfolio(assetId) || isInCoreHoldings(assetId);
  const inAnyPortfolio = inModel || inCore;
  
  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update dropdown position when opened
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX - 80,
      });
    }
  }, [isOpen]);

  // Close on scroll
  useEffect(() => {
    if (isOpen) {
      const handleScroll = () => setIsOpen(false);
      window.addEventListener('scroll', handleScroll, true);
      return () => window.removeEventListener('scroll', handleScroll, true);
    }
  }, [isOpen]);
  
  const handleToggleModelPortfolio = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsUpdating('model');
    
    try {
      if (inModel) {
        await removeFromModelPortfolio(assetId);
      } else {
        await addToModelPortfolio(assetId);
      }
      onUpdate?.();
    } catch (error) {
      console.error('Error updating model portfolio:', error);
    } finally {
      setIsUpdating(null);
    }
  };
  
  const handleToggleCorePortfolio = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsUpdating('core');
    
    try {
      // Use the new holdings system
      if (isInCoreHoldings(assetId)) {
        await removeFromCoreHoldings(assetId);
      } else {
        // Try to add to new holdings system
        await addToCoreHoldings(assetId);
      }
      
      // Also handle legacy system for backwards compatibility
      if (isInCorePortfolio(assetId)) {
        await removeFromCorePortfolio(assetId);
      }
      
      onUpdate?.();
    } catch (error) {
      console.error('Error updating core portfolio:', error);
    } finally {
      setIsUpdating(null);
    }
  };

  const dropdown = isOpen && createPortal(
    <div 
      ref={dropdownRef}
      className="fixed bg-card border border-border rounded-lg shadow-lg py-1 min-w-[180px]"
      style={{ 
        top: dropdownPosition.top, 
        left: dropdownPosition.left,
        zIndex: 9999,
      }}
    >
      <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground border-b border-border">
        Add to Portfolio
      </div>
      
      {/* Model Portfolio Option */}
      <button
        onClick={handleToggleModelPortfolio}
        disabled={isUpdating === 'model'}
        className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-muted/50 transition-colors ${
          inModel ? 'text-foreground' : 'text-muted-foreground'
        } ${isUpdating === 'model' ? 'opacity-50' : ''}`}
      >
        <span 
          className="w-3 h-3 rounded-full shrink-0 bg-blue-500" 
        />
        <span className="flex-1">Model Portfolio</span>
        {inModel && <Check className="w-4 h-4 text-primary" />}
      </button>
      
      {/* Core Portfolio Option */}
      <button
        onClick={handleToggleCorePortfolio}
        disabled={isUpdating === 'core'}
        className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-muted/50 transition-colors ${
          inCore ? 'text-foreground' : 'text-muted-foreground'
        } ${isUpdating === 'core' ? 'opacity-50' : ''}`}
      >
        <span 
          className="w-3 h-3 rounded-full shrink-0 bg-emerald-500" 
        />
        <span className="flex-1">Core Portfolio</span>
        {inCore && <Check className="w-4 h-4 text-primary" />}
      </button>
    </div>,
    document.body
  );
  
  if (variant === 'button') {
    return (
      <>
        <button
          ref={buttonRef}
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          className={`px-2 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1 ${
            inAnyPortfolio 
              ? 'bg-primary/10 text-primary hover:bg-primary/20' 
              : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <Briefcase className="w-3.5 h-3.5" />
          Portfolio
        </button>
        {dropdown}
      </>
    );
  }
  
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
            className={`p-1.5 rounded-full transition-colors ${
              inAnyPortfolio 
                ? 'bg-primary/10 text-primary hover:bg-primary/20' 
                : 'hover:bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            <Briefcase className="w-4 h-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          {inAnyPortfolio ? 'In portfolio' : 'Add to portfolio'}
        </TooltipContent>
      </Tooltip>
      {dropdown}
    </>
  );
}
