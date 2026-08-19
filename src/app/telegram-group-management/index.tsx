import { hideAlert, showAlert } from '@/core/store/alert-dialog';
import Feather from '@expo/vector-icons/Feather';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { showMessage } from 'react-native-flash-message';
import { queryClient } from '~/src/api/shared/api-provider';
import { useAddEmployeeToStoreTeleMentionList } from '~/src/api/app-pick/use-add-employee-to-store-tele-mention-list';
import {
  useGetMyStoreDetail,
  type TeleMentionedEmployee,
} from '~/src/api/app-pick/use-get-my-store-detail';
import { useRemoveEmployeeFromStoreTeleMentionList } from '~/src/api/app-pick/use-remove-employee-from-store-tele-mention-list';
import { useSetStoreEmployeeTeleId } from '~/src/api/app-pick/use-set-store-employee-tele-id';
import ButtonBack from '~/src/components/ButtonBack';
import PullToRefreshFlatList from '~/src/components/shared/pull-to-refresh-flat-list';
import EmployeeSelection from '~/src/components/shared/employee-selection';
import Header from '~/src/components/shared/header';
import SetTeleIdBottomSheet, {
  type SetTeleIdBottomSheetRef,
  type SetTeleIdEmployee,
} from '~/src/components/shared/set-tele-id-bottom-sheet';
import TeleEmployeeActionsBottomSheet, {
  type TeleEmployeeActionsBottomSheetRef,
} from '~/src/components/telegram-group-management/tele-employee-actions-bottom-sheet';
import TeleEmployeeItem from '~/src/components/telegram-group-management/tele-employee-item';
import { useAuth } from '~/src/core';
import { useConfig } from '~/src/core/store/config';
import { setLoading } from '~/src/core/store/loading';
import { getConfigNameById } from '~/src/core/utils/config';
import { canManageStoreTeleGroup } from '~/src/core/utils/employee';
import { colors } from '~/src/ui/colors';

export default function TelegramGroupManagementScreen() {
  const userInfo = useAuth.use.userInfo();
  const canAccess = canManageStoreTeleGroup(userInfo?.role);

  const config = useConfig.use.config();
  const employeeRoles = config?.employeeRoles || [];

  const [refreshing, setRefreshing] = useState(false);

  const employeeSelectionRef = useRef<any>(null);
  const actionsRef = useRef<TeleEmployeeActionsBottomSheetRef>(null);
  const setTeleIdRef = useRef<SetTeleIdBottomSheetRef>(null);

  const {
    data: storeDetail,
    isLoading,
    isFetching,
    refetch,
  } = useGetMyStoreDetail(canAccess);

  const teleGroupLink = storeDetail?.teleGroupLink || '';
  const mentionedEmployees = storeDetail?.teleMentionedEmployees || [];

  // Đồng bộ lại badge "Nhận Đơn Tele" / icon tele bên màn Quản lý nhân viên.
  const refreshAfterMutation = useCallback(() => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['searchStoreEmployees'] });
  }, [refetch]);

  const { mutate: addEmployee } =
    useAddEmployeeToStoreTeleMentionList(refreshAfterMutation);
  const { mutate: removeEmployee } =
    useRemoveEmployeeFromStoreTeleMentionList(refreshAfterMutation);
  const { mutate: setEmployeeTeleId } =
    useSetStoreEmployeeTeleId(refreshAfterMutation);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const handleOpenGroupLink = useCallback(async () => {
    if (!teleGroupLink) return;
    try {
      await Linking.openURL(teleGroupLink);
    } catch {
      showMessage({
        message: 'Không mở được link nhóm Tele',
        type: 'danger',
      });
    }
  }, [teleGroupLink]);

  const handleSelectEmployee = useCallback(
    (employee: { id?: string | number; name?: string; username: string }) => {
      if (!employee?.username) return;
      const existed = mentionedEmployees.some(
        (item) => item.username === employee.username,
      );
      if (existed) {
        showMessage({
          message: 'Nhân viên đã có trong danh sách nhận thông báo',
          type: 'warning',
        });
        return;
      }
      showAlert({
        title: 'Thêm vào nhóm nhận thông báo',
        message: `Thêm ${employee.name || employee.username} vào danh sách nhận thông báo Tele của siêu thị?`,
        confirmText: 'Xác nhận',
        onConfirm: () => {
          hideAlert();
          setLoading(true);
          addEmployee({ employeeCode: employee.username });
        },
      });
    },
    [addEmployee, mentionedEmployees],
  );

  const handleRemove = useCallback(
    (employee: TeleMentionedEmployee) => {
      showAlert({
        title: 'Xoá khỏi nhóm nhận thông báo',
        message: `Xoá ${employee.name || employee.username} khỏi danh sách nhận thông báo Tele?`,
        confirmText: 'Xoá',
        onConfirm: () => {
          hideAlert();
          setLoading(true);
          removeEmployee({ employeeCode: employee.username });
        },
      });
    },
    [removeEmployee],
  );

  const handleOpenSetTeleId = useCallback((employee: TeleMentionedEmployee) => {
    setTeleIdRef.current?.present(employee);
  }, []);

  const handleSubmitTeleId = useCallback(
    (employee: SetTeleIdEmployee, teleId: string) => {
      setLoading(true);
      setEmployeeTeleId({ employeeCode: employee.username, teleId });
    },
    [setEmployeeTeleId],
  );

  const renderItem = useCallback(
    ({ item }: { item: TeleMentionedEmployee }) => (
      <TeleEmployeeItem
        employee={item}
        roleLabel={getConfigNameById(employeeRoles, item.role) || item.role}
        onOpenActions={(employee) => actionsRef.current?.present(employee)}
      />
    ),
    [employeeRoles],
  );

  if (!canAccess) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text className="mb-4 text-center text-gray-500">
          Bạn không có quyền truy cập tính năng này
        </Text>
        <ButtonBack />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <Header
        headerLeft={<ButtonBack />}
        title="Quản lý nhóm Tele"
        headerRight={
          <Pressable
            onPress={() => employeeSelectionRef.current?.present()}
            hitSlop={10}
          >
            <Ionicons name="person-add-outline" size={22} color="#2563EB" />
          </Pressable>
        }
      />

      {/* Link nhóm Tele của siêu thị (store.teleGroupLink) */}
      {teleGroupLink ? (
        <Pressable
          onPress={handleOpenGroupLink}
          className="mx-4 mt-3 flex-row items-center gap-3 rounded-lg bg-white px-4 py-3"
          style={styles.card}
        >
          <View className="h-9 w-9 items-center justify-center rounded-full bg-blue-50">
            <Ionicons name="paper-plane" size={18} color={colors.blue[600]} />
          </View>
          <Text
            numberOfLines={1}
            className="flex-1 text-sm font-medium text-blue-600"
          >
            {teleGroupLink}
          </Text>
          <Feather name="external-link" size={16} color="#A0AEC0" />
        </Pressable>
      ) : (
        !isLoading && (
          <View
            className="mx-4 mt-3 flex-row items-center gap-3 rounded-lg bg-white px-4 py-3"
            style={styles.card}
          >
            <View className="h-9 w-9 items-center justify-center rounded-full bg-gray-50">
              <Ionicons name="paper-plane" size={18} color={colors.gray[500]} />
            </View>
            <Text className="flex-1 text-sm text-gray-500">
              Siêu thị chưa cấu hình link nhóm Tele
            </Text>
          </View>
        )
      )}

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <PullToRefreshFlatList
          data={mentionedEmployees}
          keyExtractor={(item, index) => `${item.id ?? item.username}-${index}`}
          renderItem={renderItem}
          refreshing={refreshing || (isFetching && !isLoading)}
          onRefresh={handleRefresh}
          ListEmptyComponent={
            <View className="items-center px-6 pt-8">
              <Text className="text-center text-gray-400">
                Chưa có nhân viên trong danh sách nhận thông báo
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 24 }}
        />
      )}

      {/* Chọn nhân viên của siêu thị để thêm vào danh sách mention */}
      <EmployeeSelection
        ref={employeeSelectionRef}
        selectedId=""
        onSelect={handleSelectEmployee}
      />

      <TeleEmployeeActionsBottomSheet
        ref={actionsRef}
        onSetTeleId={handleOpenSetTeleId}
        onRemove={handleRemove}
      />

      <SetTeleIdBottomSheet ref={setTeleIdRef} onSubmit={handleSubmitTeleId} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...Platform.select({
      ios: {
        shadowColor: '#222',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: { elevation: 1 },
    }),
  },
});
