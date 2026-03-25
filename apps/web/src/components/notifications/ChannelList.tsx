import type { NotificationChannel } from "@vulflare/shared/types";
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
}

export function ChannelList({ channels }: ChannelListProps) {
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
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          通知先追加
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
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          通知先がありません。「通知先追加」から作成してください。
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {channels.map((channel) => (
            <ChannelCard
              key={channel.id}
              channel={channel}
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
