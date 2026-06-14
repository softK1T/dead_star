import axios from "axios";
import type { Star, StarsResponse, Stats } from "../types/star";

const api = axios.create({ baseURL: "/api" });

export async function fetchStars(
  status?: string,
  search?: string,
  page = 1,
  limit = 50,
  mapMode = false,
): Promise<StarsResponse> {
  const { data } = await api.get<StarsResponse>("/stars", {
    params: { status, search, page, limit, map_mode: mapMode },
  });
  return data;
}

export async function fetchStar(hipId: number): Promise<Star> {
  const { data } = await api.get<Star>(`/stars/${hipId}`);
  return data;
}

export async function fetchStats(): Promise<Stats> {
  const { data } = await api.get<Stats>("/stats");
  return data;
}
