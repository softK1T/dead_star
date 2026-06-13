import axios from "axios"
import type { Star, StarsResponse, Stats } from "../types/star"

const api = axios.create({ baseURL: "http://localhost:8000" })

export const fetchStars = (params: {
  status?: string
  sp_class?: string
  limit?: number
  offset?: number
}) => api.get<StarsResponse>("/stars/", { params }).then(r => r.data)

export const fetchStar = (hip_id: number) =>
  api.get<Star>(`/stars/${hip_id}`).then(r => r.data)

export const fetchStats = () =>
  api.get<Stats>("/stars/stats").then(r => r.data)