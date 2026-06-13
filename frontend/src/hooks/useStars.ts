import { useQuery } from "@tanstack/react-query"
import { fetchStars, fetchStar, fetchStats } from "../api/stars"

export const useStars = (filters: {
  status?: string
  sp_class?: string
  limit?: number
}) =>
  useQuery({
    queryKey: ["stars", filters],
    queryFn: () => fetchStars(filters),
  })

export const useStar = (hip_id: number) =>
  useQuery({
    queryKey: ["star", hip_id],
    queryFn: () => fetchStar(hip_id),
    enabled: !!hip_id,
  })

export const useStats = () =>
  useQuery({
    queryKey: ["stats"],
    queryFn: fetchStats,
  })