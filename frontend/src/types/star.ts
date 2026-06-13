export type StarStatus = "alive" | "uncertain" | "likely dead"

export interface Star {
  HIP: number
  SpType: string
  RAdeg: number
  DEdeg: number
  distance_ly: number
  light_left_year: number
  "B-V": number
  L: number
  M: number
  t_life: number
  t_age: number
  t_remaining_gyr: number
  status: StarStatus
}

export interface StarsResponse {
  total: number
  offset: number
  limit: number
  stars: Star[]
}

export interface Stats {
  total: number
  alive: number
  uncertain: number
  likely_dead: number
}