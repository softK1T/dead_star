import { useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useStars, useStats, useStar } from "./hooks/useStars"
import SkyMap from "./components/SkyMap"

const queryClient = new QueryClient()

function Dashboard() {
  const [status, setStatus] = useState<string>("")
  const [selectedHip, setSelectedHip] = useState<number>(0)

  const { data: stats } = useStats()
  const { data, isLoading } = useStars({ status: status || undefined, limit: 1000 })
  const { data: star } = useStar(selectedHip)

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white p-6">
      <h1 className="text-3xl font-bold mb-2">🌌 Dead Stars</h1>
      <p className="text-gray-400 mb-6">
        A map of stars that might no longer exist
      </p>

      {/* Stats */}
      {stats && (
        <div className="flex gap-6 mb-6">
          <div className="text-green-400">🟢 Alive: {stats.alive}</div>
          <div className="text-yellow-400">🟡 Uncertain: {stats.uncertain}</div>
          <div className="text-red-400">💀 Dead: {stats.likely_dead}</div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-3 mb-4">
        {["", "alive", "uncertain", "likely dead"].map(s => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-4 py-1 rounded-full border text-sm ${
              status === s ? "bg-white text-black" : "border-gray-600 text-gray-300"
            }`}
          >
            {s || "all"}
          </button>
        ))}
      </div>

      {/* Map */}
      {isLoading ? (
        <div className="text-gray-400">Loading stars...</div>
      ) : (
        <SkyMap stars={data?.stars ?? []} onSelect={setSelectedHip} />
      )}

      {/* Star detail */}
      {star && (
        <div className="mt-6 p-4 bg-[#111130] rounded-xl border border-gray-700">
          <h2 className="text-xl font-bold mb-2">HIP {star.HIP} · {star.SpType}</h2>
          <div className="grid grid-cols-2 gap-2 text-sm text-gray-300">
            <div>Distance: {star.distance_ly.toFixed(0)} ly</div>
            <div>Light left: {star.light_left_year}</div>
            <div>Luminosity: {star.L.toFixed(2)} L☉</div>
            <div>Mass: {star.M.toFixed(2)} M☉</div>
            <div>Lifetime: {(star.t_life / 1e9).toFixed(2)} Gyr</div>
            <div>Remaining: {star.t_remaining_gyr.toFixed(2)} Gyr</div>
            <div className="col-span-2 font-bold">
              Status: {star.status === "likely dead" ? "💀" : star.status === "uncertain" ? "🟡" : "🟢"} {star.status}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Dashboard />
    </QueryClientProvider>
  )
}