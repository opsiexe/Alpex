export default function MetricCard({ label, value, icon: Icon, color = 'text-violet-400' }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-zinc-500 uppercase tracking-wider">{label}</span>
        {Icon && <Icon size={14} className={color} />}
      </div>
      <div className="text-xl font-bold font-mono">{value}</div>
    </div>
  )
}
