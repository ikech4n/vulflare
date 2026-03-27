import type { NotificationChannel, NotificationRule } from "@vulflare/shared/types";
import { Plus } from "lucide-react";
import { useState } from "react";
import {
  useCreateChannel,
  useDeleteChannel,
  useTestChannel,
  useUpdateChannel,
} from "@/hooks/useNotifications.ts";
import { ChannelCard } from "./ChannelCard.tsx";
import { ChannelForm } from "./ChannelForm.tsx";

interface ChannelListProps {
  channels: NotificationChannel[];
  rules: NotificationRule[];
}

export function ChannelList({ channels, rules }: ChannelListProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingChannel, setEditingChannel] = useState<NotificationChannel | null>(null);

  const createChannel = useCreateChannel();
  const updateChannel = useUpdateChannel();
  const deleteChannel = useDeleteChannel();
  const testChannel = useTestChannel();

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            setShowCreateForm(!showCreateForm);
            setEditingChannel(null);
          }}
          className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          通知先を追加
        </button>
      </div>

      {showCreateForm && (
        <ChannelForm
          mode="create"
          onSubmit={(data) => {
            createChannel.mutate(
              { name: data.name, type: data.type, config: data.config },
              { onSuccess: () => setShowCreateForm(false) },
            );
          }}
          onCancel={() => setShowCreateForm(false)}
          isPending={createChannel.isPending}
        />
      )}

      {editingChannel && (
        <ChannelForm
          mode="edit"
          channel={editingChannel}
          onSubmit={(data) => {
            updateChannel.mutate(
              {
                id: editingChannel.id,
                data: { name: data.name, config: data.config, isActive: data.isActive },
              },
              { onSuccess: () => setEditingChannel(null) },
            );
          }}
          onCancel={() => setEditingChannel(null)}
          isPending={updateChannel.isPending}
        />
      )}

      {channels.length === 0 && !showCreateForm ? (
        <div className="text-center py-16 text-sm text-gray-400 dark:text-gray-500">
          通知先がありません。「通知先を追加」から作成してください。
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {channels.map((channel) => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              rules={rules.filter((r) => r.channel_id === channel.id)}
              onEdit={(channel) => {
                setEditingChannel(channel);
                setShowCreateForm(false);
              }}
              onTest={(id) => testChannel.mutate(id)}
              onDelete={(id) => deleteChannel.mutate(id)}
              isTestPending={testChannel.isPending}
              isDeletePending={deleteChannel.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}
