import { useState } from "react";
import { useStars, useStats } from "./hooks/useStars";
import SkyMap from "./components/SkyMap";
import StarTable from "./components/StarTable";
import StarDetail from "./components/StarDetail";

export default function App() {
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedHip, setSelectedHip] = useState<number | null>(null);

  const { data, isLoading } = useStars(statusFilter || undefined, search || undefined, page);
  const { data: stats } = useStats();

  const allStars = data?.data ?? [];

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-white">
      <header className="bg-gray-800 px-4 py-2 flex items-center gap-6 shrink-0">
        <h1 className="text-xl font-bold">Dead Stars</h1>
        {stats && (
          <div className="flex gap-4 text-sm">
            <span>Total: <strong>{stats.total}</strong></span>
            <span className="text-red-400">Dead: <strong>{stats.likely_dead}</strong></span>
            <span className="text-yellow-400">Uncertain: <strong>{stats.uncertain}</strong></span>
            <span className="text-green-400">Alive: <strong>{stats.alive}</strong></span>
          </div>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-1/2 p-2">
          <SkyMap stars={allStars} />
        </div>

        <div className="w-1/2 flex flex-col overflow-hidden">
          <div className="flex-1 p-2 overflow-hidden">
            <StarTable
              data={data}
              isLoading={isLoading}
              onSelect={setSelectedHip}
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              search={search}
              onSearchChange={setSearch}
              page={page}
              onPageChange={setPage}
            />
          </div>

          {selectedHip && (
            <div className="border-t border-gray-700 bg-gray-850 p-4 shrink-0 overflow-auto max-h-72">
              <StarDetail hipId={selectedHip} onClose={() => setSelectedHip(null)} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
