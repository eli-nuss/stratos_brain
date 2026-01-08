import { useState, useRef, useEffect } from 'react';
import { Plus, Check, Brain, Bot, Pill, Rocket } from 'lucide-react';
import { useStockLists, useAssetLists, addToList, removeFromList, StockList } from '@/hooks/useStockLists';
import { createPortal } from 'react-dom';

interface AddToListButtonProps {
  assetId: number;
  onUpdate?: () => void;
}

// Map icon names to Lucide icons
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  brain: Brain,
  robot: Bot,
  pill: Pill,
  rocket: Rocket,
};

export default function AddToListButton({ assetId, onUpdate }: AddToListButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState<number | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const { lists } = useStockLists();
  const { lists: assetLists, mutate: mutateAssetLists } = useAssetLists(assetId);
  
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
        left: rect.left + window.scrollX - 120, // Offset to align right edge with button
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
  
  const isInList = (listId: number) => {
    return assetLists.some((list: StockList) => list.id === listId);
  };
  
  const handleToggleList = async (e: React.MouseEvent, list: StockList) => {
    e.stopPropagation();
    setIsUpdating(list.id);
    
    try {
      if (isInList(list.id)) {
        await removeFromList(list.id, assetId);
      } else {
        await addToList(list.id, assetId);
      }
      await mutateAssetLists();
      onUpdate?.();
    } catch (error) {
      console.error('Error updating list:', error);
    } finally {
      setIsUpdating(null);
    }
  };
  
  const getIcon = (iconName: string) => {
    const IconComponent = iconMap[iconName] || Plus;
    return IconComponent;
  };

  const dropdown = isOpen && createPortal(
    <div 
      ref={dropdownRef}
      className="fixed bg-card border border-border rounded-lg shadow-lg py-1 min-w-[160px]"
      style={{ 
        top: dropdownPosition.top, 
        left: dropdownPosition.left,
        zIndex: 9999,
      }}
    >
      <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground border-b border-border">
        Add to List
      </div>
      {lists.map((list) => {
        const Icon = getIcon(list.icon);
        const inList = isInList(list.id);
        const updating = isUpdating === list.id;
        
        return (
          <button
            key={list.id}
            onClick={(e) => handleToggleList(e, list)}
            disabled={updating}
            className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-muted/50 transition-colors ${
              inList ? 'text-foreground' : 'text-muted-foreground'
            } ${updating ? 'opacity-50' : ''}`}
          >
            <Icon className="w-4 h-4" style={{ color: list.color }} />
            <span className="flex-1">{list.name}</span>
            {inList && <Check className="w-4 h-4 text-primary" />}
          </button>
        );
      })}
    </div>,
    document.body
  );
  
  return (
    <>
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-1 rounded hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
        title="Add to list"
      >
        <Plus className="w-4 h-4" />
      </button>
      {dropdown}
    </>
  );
}
