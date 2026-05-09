export default function BotControls({ onStart, onStop, running }) {
  return (
    <div className="flex gap-2">
      <button
        onClick={onStart}
        disabled={running}
        className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-sm font-semibold transition-colors"
      >
        Démarrer
      </button>
      <button
        onClick={onStop}
        disabled={!running}
        className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-40 text-sm font-semibold transition-colors"
      >
        Arrêter
      </button>
    </div>
  )
}
