export interface Star {
  HIP: number;
  SpType: string;
  Vmag: number;
  "B-V": number;
  M_V: number;
  distance_ly: number;
  light_left_year: number;
  L: number;
  M: number;
  t_life: number;
  t_age: number;
  t_remaining_gyr: number;
  status: string;
  RAdeg: number;
  DEdeg: number;
}

export interface StarsResponse {
  data: Star[];
  total: number;
  page: number;
  limit: number;
}

export interface Stats {
  total: number;
  likely_dead: number;
  uncertain: number;
  alive: number;
}
