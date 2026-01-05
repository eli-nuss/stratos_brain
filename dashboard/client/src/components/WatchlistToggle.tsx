import { useState } from 'react'
import { Star } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface WatchlistToggleProps {
  assetId: number
  isInWatchlist: boolean
  onToggle: (assetId: number) => Promise<boolean>
}

export default function WatchlistToggle({ assetId, isInWatchlist, onToggle }: WatchlistToggleProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [optimisticState, setOptimisticState] = useState<boolean | null>(null)

  const displayState = optimisticState !== null ? optimisticState : isInWatchlist

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    
    if (isLoading) return
    
    setIsLoading(true)
    setOptimisticState(!displayState)
    
    const success = await onToggle(assetId)
    
    if (!success) {
      // Revert optimistic update on failure
      setOptimisticState(null)
    } else {
      setOptimisticState(null)
    }
    
    setIsLoading(false)
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={handleClick}
          disabled={isLoading}
          className={`p-1 rounded-full transition-all duration-200 ${
            isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110'
          }`}
        >
          <Star
            className={`w-4 h-4 transition-colors duration-200 ${
              displayState
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-muted-foreground hover:text-yellow-400'
            }`}
          />
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {displayState ? 'Remove from watchlist' : 'Add to watchlist'}
      </TooltipContent>
    </Tooltip>
  )
}
