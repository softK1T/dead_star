import { useQuery } from "@tanstack/react-query";
import { fetchStars, fetchStar, fetchStats } from "../api/stars";

export function useStars(status?: string, search?: string, page = 1, limit = 50, mapMode = false) {
  return useQuery({
    queryKey: ["stars", status, search, page, limit, mapMode],
    queryFn: () => fetchStars(status, search, page, limit, mapMode),
  });
}

export function useStar(hipId: number | null) {
  return useQuery({
    queryKey: ["star", hipId],
    queryFn: () => fetchStar(hipId!),
    enabled: hipId !== null,
  });
}

export function useStats() {
  return useQuery({
    queryKey: ["stats"],
    queryFn: fetchStats,
  });
}
