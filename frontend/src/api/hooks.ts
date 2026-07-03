import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type {
  Asin,
  DashboardSummary,
  PaginatedAsins,
  ProductCard,
  RankingResponse,
  TrendResponse,
} from "./types";

// ---------------- ASINs ----------------
export interface AsinListParams {
  q?: string;
  category?: string;
  active?: boolean;
  page?: number;
  page_size?: number;
  sort?: string;
}

export function useAsins(params: AsinListParams) {
  return useQuery({
    queryKey: ["asins", params],
    queryFn: async () => {
      const { data } = await api.get<PaginatedAsins>("/asins", { params });
      return data;
    },
  });
}

export function useCreateAsin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Asin>) => (await api.post("/asins", payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["asins"] }),
  });
}

export function useUpdateAsin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: Partial<Asin> }) =>
      (await api.put(`/asins/${id}`, payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["asins"] }),
  });
}

export function useDeleteAsin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => (await api.delete(`/asins/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["asins"] }),
  });
}

export function useSetTracking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: number; is_active: boolean }) =>
      (await api.patch(`/asins/${id}/tracking`, { is_active })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["asins"] }),
  });
}

export function useBulkUpload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return (await api.post("/asins/bulk-upload", form)).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["asins"] }),
  });
}

// ---------------- Dashboard ----------------
export function useDashboardSummary() {
  return useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: async () => (await api.get<DashboardSummary>("/dashboard/summary")).data,
  });
}

export function useDashboardProducts() {
  return useQuery({
    queryKey: ["dashboard", "products"],
    queryFn: async () => (await api.get<ProductCard[]>("/dashboard/products")).data,
  });
}

// ---------------- Analytics ----------------
export interface TrendParams {
  metric: string;
  interval: string;
  asin?: string;
  category?: string;
  date_from?: string;
  date_to?: string;
}

export function useTrends(params: TrendParams) {
  return useQuery({
    queryKey: ["trends", params],
    queryFn: async () => (await api.get<TrendResponse>("/analytics/trends", { params })).data,
  });
}

export function useRankings(metric: string, interval: string, order: string) {
  return useQuery({
    queryKey: ["rankings", metric, interval, order],
    queryFn: async () =>
      (await api.get<RankingResponse>("/analytics/rankings", { params: { metric, interval, order } }))
        .data,
  });
}

export function useCompare(params: {
  metric: string;
  interval: string;
  asins?: string;
  categories?: string;
}) {
  return useQuery({
    queryKey: ["compare", params],
    queryFn: async () => (await api.get<TrendResponse>("/analytics/compare", { params })).data,
  });
}

// ---------------- Admin ----------------
export function useRunScrape() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.post("/admin/scrape/run")).data,
    onSuccess: () => qc.invalidateQueries(),
  });
}
