import { useState } from "react";
import { createPortal } from "react-dom";
import { Plus, X, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface CreateListButtonProps {
  onListCreated: () => void;
}

const COLOR_OPTIONS = [
  { name: "Purple", value: "#a855f7" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Green", value: "#22c55e" },
  { name: "Yellow", value: "#eab308" },
  { name: "Orange", value: "#f97316" },
  { name: "Red", value: "#ef4444" },
  { name: "Pink", value: "#ec4899" },
  { name: "Cyan", value: "#06b6d4" },
];

export default function CreateListButton({ onListCreated }: CreateListButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedColor, setSelectedColor] = useState("#a855f7");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/dashboard/stock-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          color: selectedColor,
        }),
      });

      if (response.ok) {
        setIsOpen(false);
        setName("");
        setDescription("");
        setSelectedColor("#a855f7");
        onListCreated();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setName("");
    setDescription("");
    setSelectedColor("#a855f7");
  };

  const modal = isOpen && (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal content */}
      <div className="relative bg-card border border-border rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Create New List</h2>
          <button
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Semiconductors"
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Description <span className="text-muted-foreground">(optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Chip makers and semiconductor companies"
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Color selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLOR_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSelectedColor(option.value)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    selectedColor === option.value
                      ? "border-foreground scale-110"
                      : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: option.value }}
                  title={option.name}
                />
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isSubmitting}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Create List
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setIsOpen(true)}
            className="px-2 py-1 text-xs font-medium rounded transition-all text-muted-foreground hover:text-foreground hover:bg-muted/50 flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Create new list</TooltipContent>
      </Tooltip>

      {/* Portal modal to body to avoid overflow issues */}
      {modal && createPortal(modal, document.body)}
    </>
  );
}
