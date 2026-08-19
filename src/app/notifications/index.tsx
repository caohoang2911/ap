import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { usePullNotis } from '~/src/api/app-pick/use-pull-notis';
import NotificationItem from '~/src/components/notifications/notification-item';
import type { AppNotification } from '~/src/types/notification';
import PullToRefreshFlatList from '~/src/components/shared/pull-to-refresh-flat-list';

export default function NotificationsScreen() {
  const { data, isLoading, isFetching, refetch } = usePullNotis();
  const notifications = data?.data ?? [];
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const renderItem = useCallback(
    ({ item }: { item: AppNotification }) => <NotificationItem {...item} />,
    [],
  );

  const keyExtractor = useCallback(
    (item: AppNotification) => String(item.id),
    [],
  );

  const ListEmptyComponent = useCallback(() => {
    if (isLoading) {
      return (
        <View className="py-12 items-center">
          <ActivityIndicator size="large" />
        </View>
      );
    }

    return (
      <View className="py-12 items-center">
        <Text className="text-gray-400">Chưa có thông báo</Text>
      </View>
    );
  }, [isLoading]);

  const showInitialLoading = isLoading && notifications.length === 0;

  return (
    <View className="flex-1 bg-white">
      {showInitialLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <PullToRefreshFlatList
          data={notifications}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={
            notifications.length === 0 ? { flexGrow: 1 } : undefined
          }
          refreshing={refreshing || (isFetching && !isLoading)}
          onRefresh={handleRefresh}
          ListEmptyComponent={ListEmptyComponent}
        />
      )}
    </View>
  );
}
