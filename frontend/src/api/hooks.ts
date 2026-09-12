import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type {
  AlertsResponse,
  Asin,
  DashboardSummary,
  PaginatedAsins,
  ProductCard,
  RankingResponse,
  ManagedUser,
  OperationalActualUploadResult,
  OperationalActualUpload,
  OperationalDashboard,
  OperationalForecastAmendment,
  OperationalForecastUpload,
  OperationalUploadResult,
  ScrapeRun,
  SalesByAsin,
  SalesByState,
  SalesSummary,
  SalesUpload,
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

// ---------------- Alerts ----------------
export interface AlertParams {
  interval: "latest" | "24h" | "7" | "30" | "90" | "custom";
  date_from?: string;
  date_to?: string;
}

export function useAlerts(params: AlertParams, enabled = true) {
  return useQuery({
    queryKey: ["alerts", params],
    queryFn: async () => (await api.get<AlertsResponse>("/alerts", { params })).data,
    enabled,
  });
}

// ---------------- Users ----------------
export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: async () => (await api.get<ManagedUser[]>("/users")).data,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { email: string; password: string }) =>
      (await api.post<ManagedUser>("/users", payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

// ---------------- Admin ----------------
export function useRunScrape() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.post<ScrapeRun>("/admin/scrape/run")).data,
    onSuccess: () => qc.invalidateQueries(),
  });
}

// ---------------- Sales ----------------
export interface SalesFilters {
  asin?: string;
  date_from?: string;
  date_to?: string;
}

export function useSalesSummary(filters: SalesFilters) {
  return useQuery({
    queryKey: ["sales", "summary", filters],
    queryFn: async () =>
      (await api.get<SalesSummary>("/sales/summary", { params: filters })).data,
  });
}

export function useSalesByAsin(filters: SalesFilters) {
  return useQuery({
    queryKey: ["sales", "by-asin", filters],
    queryFn: async () =>
      (await api.get<SalesByAsin[]>("/sales/by-asin", { params: filters })).data,
  });
}

export function useSalesByState(filters: SalesFilters) {
  return useQuery({
    queryKey: ["sales", "by-state", filters],
    queryFn: async () =>
      (await api.get<SalesByState[]>("/sales/by-state", { params: filters })).data,
  });
}

export function useSalesUploads() {
  return useQuery({
    queryKey: ["sales", "uploads"],
    queryFn: async () => (await api.get<SalesUpload[]>("/sales/uploads")).data,
  });
}

export function useUploadSales() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return (await api.post("/sales/upload", form)).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sales"] }),
  });
}

export function useDeleteSalesUpload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => (await api.delete(`/sales/uploads/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sales"] }),
  });
}

// ---------------- Operational Analytics ----------------
export interface OperationalFilters {
  date_from?: string;
  date_to?: string;
}

export function useOperationalDashboard(filters: OperationalFilters) {
  return useQuery({
    queryKey: ["operational", "dashboard", filters],
    queryFn: async () =>
      (await api.get<OperationalDashboard>("/operational/dashboard", { params: filters })).data,
  });
}

export function useOperationalForecasts() {
  return useQuery({
    queryKey: ["operational", "forecasts"],
    queryFn: async () =>
      (await api.get<OperationalForecastUpload[]>("/operational/forecasts")).data,
  });
}

export function useOperationalForecastAmendments() {
  return useQuery({
    queryKey: ["operational", "forecast-amendments"],
    queryFn: async () =>
      (
        await api.get<OperationalForecastAmendment[]>(
          "/operational/forecast-amendments"
        )
      ).data,
  });
}

export function useOperationalActuals() {
  return useQuery({
    queryKey: ["operational", "actuals"],
    queryFn: async () =>
      (await api.get<OperationalActualUpload[]>("/operational/actuals")).data,
  });
}

export function useUploadOperationalForecast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, month }: { file: File; month: string }) => {
      const form = new FormData();
      form.append("file", file);
      return (
        await api.post<OperationalUploadResult>("/operational/forecasts", form, {
          params: { forecast_month: month },
        })
      ).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["operational"] }),
  });
}

export function useAddOperationalTargetAsins() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      uploadId,
      file,
      effectiveFrom,
    }: {
      uploadId: number;
      file: File;
      effectiveFrom: string;
    }) => {
      const form = new FormData();
      form.append("file", file);
      return (
        await api.post<OperationalUploadResult>(
          `/operational/forecasts/${uploadId}/amendments`,
          form,
          { params: { effective_from: effectiveFrom } }
        )
      ).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["operational"] }),
  });
}

export function useUploadOperationalActual() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, reportDate }: { file: File; reportDate: string }) => {
      const form = new FormData();
      form.append("file", file);
      return (
        await api.post<OperationalActualUploadResult>("/operational/actuals", form, {
          params: { report_date: reportDate },
        })
      ).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["operational"] }),
  });
}

export function useDeleteOperationalForecast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => (await api.delete(`/operational/forecasts/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["operational"] }),
  });
}

export function useDeleteOperationalTargetAmendment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) =>
      (await api.delete(`/operational/forecast-amendments/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["operational"] }),
  });
}

export function useDeleteOperationalActual() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => (await api.delete(`/operational/actuals/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["operational"] }),
  });
}
