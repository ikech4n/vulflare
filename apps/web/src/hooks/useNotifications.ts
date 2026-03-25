import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  EventType,
  NotificationChannel,
  NotificationChannelType,
  NotificationLog,
  NotificationRule,
} from "@vulflare/shared/types";
import { toast } from "sonner";
import { api } from "@/lib/api.ts";

export interface LogsResponse {
  data: NotificationLog[];
  total: number;
  page: number;
  limit: number;
}

export interface LogFilters {
  channelId?: string;
  eventType?: string;
  status?: "sent" | "failed" | "pending";
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export function useChannels() {
  return useQuery<NotificationChannel[]>({
    queryKey: ["notifications", "channels"],
    queryFn: async () => {
      const res = await api.get("/notifications/channels");
      return res.data;
    },
  });
}

export function useRules() {
  return useQuery<NotificationRule[]>({
    queryKey: ["notifications", "rules"],
    queryFn: async () => {
      const res = await api.get("/notifications/rules");
      return res.data;
    },
  });
}

export function useLogs(filters: LogFilters = {}) {
  return useQuery<LogsResponse>({
    queryKey: ["notifications", "logs", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.channelId) params.set("channelId", filters.channelId);
      if (filters.eventType) params.set("eventType", filters.eventType);
      if (filters.status) params.set("status", filters.status);
      if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
      if (filters.dateTo) params.set("dateTo", filters.dateTo);
      if (filters.page) params.set("page", String(filters.page));
      if (filters.limit) params.set("limit", String(filters.limit));
      const res = await api.get(`/notifications/logs?${params.toString()}`);
      return res.data;
    },
  });
}

export function useCreateChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      type: NotificationChannelType;
      config: Record<string, unknown>;
    }) => {
      await api.post("/notifications/channels", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "channels"] });
      toast.success("通知先を作成しました");
    },
    onError: () => {
      toast.error("通知先の作成に失敗しました");
    },
  });
}

export function useUpdateChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: { name?: string; config?: Record<string, unknown>; isActive?: boolean };
    }) => {
      await api.patch(`/notifications/channels/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "channels"] });
      toast.success("通知先を更新しました");
    },
    onError: () => {
      toast.error("通知先の更新に失敗しました");
    },
  });
}

export function useDeleteChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/notifications/channels/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("通知先を削除しました");
    },
    onError: () => {
      toast.error("通知先の削除に失敗しました");
    },
  });
}

export function useTestChannel() {
  return useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/notifications/channels/${id}/test`);
    },
    onSuccess: () => {
      toast.success("テスト通知を送信しました");
    },
    onError: () => {
      toast.error("テスト送信に失敗しました。設定を確認してください");
    },
  });
}

export function useCreateRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      channelId: string;
      eventType: EventType;
      filterConfig?: Record<string, unknown>;
    }) => {
      await api.post("/notifications/rules", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "rules"] });
      toast.success("ルールを作成しました");
    },
    onError: () => {
      toast.error("ルールの作成に失敗しました");
    },
  });
}

export function useDeleteRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/notifications/rules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "rules"] });
      toast.success("ルールを削除しました");
    },
    onError: () => {
      toast.error("ルールの削除に失敗しました");
    },
  });
}

export function useToggleRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await api.patch(`/notifications/rules/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "rules"] });
    },
    onError: () => {
      toast.error("ルールの更新に失敗しました");
    },
  });
}

export function useResendLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/notifications/logs/${id}/resend`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "logs"] });
      toast.success("再送信をトリガーしました");
    },
    onError: () => {
      toast.error("再送信に失敗しました");
    },
  });
}
