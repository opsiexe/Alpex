export default function LogConsole({ logs = [] }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 font-mono text-xs text-zinc-400 h-48 overflow-y-auto">
      {logs.length === 0
        ? <span className="text-zinc-600">Aucun log disponible.</span>
        : logs.map((l, i) => <div key={i}>{l}</div>)
      }
    </div>
  )
}
