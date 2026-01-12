import { GlobalChatInterface } from "@/components/GlobalChatInterface";

export default function StratosBrain() {
  return (
    <div className="h-full w-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-slate-700 bg-slate-900/50 px-6 py-4">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <span className="text-4xl">🧠</span> Stratos Brain
        </h1>
        <p className="text-slate-400 mt-2 max-w-3xl">
          Your autonomous Chief Investment Officer. Query the entire market, screen for opportunities, and analyze macro trends in real-time.
        </p>
      </div>

      {/* Chat Interface */}
      <div className="flex-1 min-h-0">
        <GlobalChatInterface />
      </div>
    </div>
  );
}
