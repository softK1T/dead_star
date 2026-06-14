import { useStar } from "../hooks/useStars";

export default function StarDetail({ hipId, onClose }: { hipId: number; onClose: () => void }) {
  const { data: star, isLoading } = useStar(hipId);

  if (isLoading) return <p className="text-gray-400 p-4">Loading...</p>;
  if (!star) return <p className="text-red-400 p-4">Not found</p>;

  const rows: [string, any][] = [
    ["HIP", star.HIP],
    ["Spectral Type", star.SpType],
    ["V mag", star.Vmag?.toFixed(2)],
    ["B-V", star["B-V"]?.toFixed(3)],
    ["Abs Mag (M_V)", star.M_V?.toFixed(2)],
    ["Distance (ly)", star.distance_ly?.toFixed(0)],
    ["Light left Earth (year)", star.light_left_year],
    ["Luminosity (L☉)", star.L?.toExponential(2)],
    ["Mass (M☉)", star.M?.toFixed(2)],
    ["Total lifetime (yr)", star.t_life?.toExponential(1)],
    ["Estimated age (yr)", star.t_age?.toExponential(1)],
    ["Remaining (Gyr)", star.t_remaining_gyr?.toFixed(2)],
    ["Status", star.status],
    ["RA (deg)", star.RAdeg?.toFixed(2)],
    ["Dec (deg)", star.DEdeg?.toFixed(2)],
  ];

  return (
    <div className="relative">
      <button onClick={onClose} className="absolute top-2 right-2 text-gray-400 hover:text-white text-xl">&times;</button>
      <h2 className="text-lg font-semibold mb-3">HIP {star.HIP}</h2>
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} className="border-b border-gray-700">
              <td className="py-1 pr-4 text-gray-400">{label}</td>
              <td className={`py-1 ${label === "Status" ? statusColor(String(value)) : ""}`}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function statusColor(s: string) {
  if (s === "likely dead") return "text-red-400";
  if (s === "uncertain") return "text-yellow-400";
  return "text-green-400";
}
