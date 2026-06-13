import { useState } from "react";
import type { Star, StarsResponse } from "../types/star";

interface Props {
  data: StarsResponse | undefined;
  isLoading: boolean;
  onSelect: (hip: number) => void;
  statusFilter: string;
  onStatusChange: (s: string) => void;
  search: string;
  onSearchChange: (s: string) => void;
  page: number;
  onPageChange: (p: number) => void;
}

const STATUS_OPTIONS = ["", "likely dead", "uncertain", "alive"];

const FIXED_COLS = 6;

export default function StarTable({
  data,
  isLoading,
  onSelect,
  statusFilter,
  onStatusChange,
  search,
  onSearchChange,
  page,
  onPageChange,
}: Props) {
  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="flex gap-2 flex-wrap">
        <select
          value={statusFilter}
          onChange={(e) => {
            onStatusChange(e.target.value);
            onPageChange(1);
          }}
          className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s || "All statuses"}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Search HIP..."
          value={search}
          onChange={(e) => {
            onSearchChange(e.target.value);
            onPageChange(1);
          }}
          className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm"
        />
        <div className="flex gap-1 items-center ml-auto">
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="px-2 py-1 bg-gray-700 rounded disabled:opacity-30 text-sm"
          >
            Prev
          </button>
          <span className="text-sm px-2">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="px-2 py-1 bg-gray-700 rounded disabled:opacity-30 text-sm"
          >
            Next
          </button>
        </div>
      </div>

      <div className="overflow-auto flex-1">
        {isLoading ? (
          <p className="text-gray-400 p-4">Loading...</p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-gray-800">
              <tr>
                <th className="p-2 text-left">HIP</th>
                <th className="p-2 text-left">SpType</th>
                <th className="p-2 text-right">Dist (ly)</th>
                <th className="p-2 text-right">t_remain (Gyr)</th>
                <th className="p-2 text-right">B-V</th>
                <th className="p-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {data?.data.map((s) => (
                <tr
                  key={s.HIP}
                  onClick={() => onSelect(s.HIP)}
                  className="border-b border-gray-700 hover:bg-gray-700 cursor-pointer"
                >
                  <td className="p-2">{s.HIP}</td>
                  <td className="p-2">{s.SpType}</td>
                  <td className="p-2 text-right">{s.distance_ly?.toFixed(0)}</td>
                  <td className="p-2 text-right">{s.t_remaining_gyr?.toFixed(2)}</td>
                  <td className="p-2 text-right">{s["B-V"]?.toFixed(3)}</td>
                  <td className={`p-2 ${statusColor(s.status)}`}>{s.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function statusColor(s: string) {
  if (s === "likely dead") return "text-red-400";
  if (s === "uncertain") return "text-yellow-400";
  return "text-green-400";
}
