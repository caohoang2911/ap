import { hideAlert, showAlert } from '@/core/store/alert-dialog';
import { AntDesign } from '@expo/vector-icons';
import moment from 'moment-timezone';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import { useDeleteWorkShift } from '~/src/api/app-pick/use-delete-work-shift';
import { useGetListWorkShifts } from '~/src/api/app-pick/use-get-list-work-shifts';
import ButtonBack from '~/src/components/ButtonBack';
import Header from '~/src/components/shared/header';
import PullToRefreshFlatList from '~/src/components/shared/pull-to-refresh-flat-list';
import WorkShiftActionsBottomSheet, {
  type WorkShiftActionsBottomSheetRef,
} from '~/src/components/picker-shift-management/work-shift-actions-bottom-sheet';
import WorkShiftDatePickerBottomSheet, {
  type WorkShiftDatePickerBottomSheetRef,
} from '~/src/components/picker-shift-management/work-shift-date-picker-bottom-sheet';
import WorkShiftFormBottomSheet, {
  type WorkShiftFormBottomSheetRef,
} from '~/src/components/picker-shift-management/work-shift-form-bottom-sheet';
import WorkShiftItem from '~/src/components/picker-shift-management/work-shift-item';
import WorkShiftWeekCalendar from '~/src/components/picker-shift-management/week-calendar';
import { canManagePickerShift } from '~/src/core/utils/employee';
import {
  buildWorkShiftDays,
  buildWorkShiftTimeRange,
  formatWorkShiftHeaderRange,
  getDefaultWorkShiftTimeRange,
  groupWorkShiftsByDay,
  WORK_SHIFT_TIMEZONE,
} from '~/src/core/utils/work-shift';
import { useAuth } from '~/src/core';
import type { WorkShift } from '~/src/types/work-shift';

export default function PickerShiftManagementScreen() {
  const userRole = useAuth.use.userInfo()?.role;
  const canAccess = canManagePickerShift(userRole);

  const defaultRange = useMemo(() => getDefaultWorkShiftTimeRange(), []);

  const [rangeStart, setRangeStart] = useState(() => defaultRange.fromDate);
  const [rangeEnd, setRangeEnd] = useState(() => defaultRange.toDate);

  const timeRange = useMemo(
    () =>
      buildWorkShiftTimeRange(
        moment.tz(rangeStart, WORK_SHIFT_TIMEZONE),
        moment.tz(rangeEnd, WORK_SHIFT_TIMEZONE),
      ).timeRangeFilter,
    [rangeEnd, rangeStart],
  );
  const days = useMemo(
    () => buildWorkShiftDays(rangeStart, rangeEnd),
    [rangeEnd, rangeStart],
  );
  const todayKey = useMemo(
    () => days.find((day) => day.isToday)?.key ?? days[0]?.key ?? '',
    [days],
  );

  const [selectedDayKey, setSelectedDayKey] = useState(todayKey);
  const [refreshing, setRefreshing] = useState(false);

  const formRef = useRef<WorkShiftFormBottomSheetRef>(null);
  const actionsRef = useRef<WorkShiftActionsBottomSheetRef>(null);
  const datePickerRef = useRef<WorkShiftDatePickerBottomSheetRef>(null);

  const { data, isLoading, refetch, isFetching } = useGetListWorkShifts(
    timeRange,
    canAccess,
  );

  const shifts = data?.data ?? [];
  const groupedShifts = useMemo(() => groupWorkShiftsByDay(shifts), [shifts]);
  const shiftCountByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const [key, list] of groupedShifts) {
      map.set(key, list.length);
    }
    return map;
  }, [groupedShifts]);
  const selectedDayShifts = groupedShifts.get(selectedDayKey) ?? [];

  const { mutate: deleteWorkShift } = useDeleteWorkShift(() => {
    showMessage({ message: 'Xóa ca thành công', type: 'success' });
    refetch();
  });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const handleRangeChange = useCallback(
    ({
      startTimestamp,
      endTimestamp,
    }: {
      startTimestamp: number;
      endTimestamp: number;
    }) => {
      setRangeStart(startTimestamp);
      setRangeEnd(endTimestamp);
      const nextDays = buildWorkShiftDays(startTimestamp, endTimestamp);
      const nextTodayKey =
        nextDays.find((day) => day.isToday)?.key ?? nextDays[0]?.key ?? '';
      setSelectedDayKey((prev) =>
        nextDays.some((day) => day.key === prev) ? prev : nextTodayKey,
      );
    },
    [],
  );

  const handleOpenDatePicker = useCallback(() => {
    datePickerRef.current?.present({
      startTimestamp: rangeStart,
      endTimestamp: rangeEnd,
    });
  }, [rangeEnd, rangeStart]);

  const handleAdd = useCallback(() => {
    formRef.current?.present({ dayKey: selectedDayKey });
  }, [selectedDayKey]);

  const handleEdit = useCallback((shift: WorkShift) => {
    const dayKey = moment
      .tz(shift.startTime, WORK_SHIFT_TIMEZONE)
      .format('YYYY-MM-DD');
    formRef.current?.present({ dayKey, shift });
  }, []);

  const handleDelete = useCallback(
    (shift: WorkShift) => {
      showAlert({
        title: 'Xóa ca làm việc',
        message: `Bạn có chắc muốn xóa ca của ${shift.employee.username}?`,
        onConfirm: () => {
          hideAlert();
          deleteWorkShift({ workShiftId: shift.id });
        },
      });
    },
    [deleteWorkShift],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: WorkShift; index: number }) => (
      <WorkShiftItem
        shift={item}
        index={index}
        canManage={canAccess}
        onOpenActions={(shift) => actionsRef.current?.present(shift)}
      />
    ),
    [canAccess],
  );

  if (!canAccess) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-center text-gray-500 mb-4">
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
        headerRight={
          <Pressable onPress={handleAdd} hitSlop={10}>
            <View className="w-8 h-8 rounded-full bg-blue-500 items-center justify-center">
              <AntDesign name="plus" size={18} color="#FFFFFF" />
            </View>
          </Pressable>
        }
        title={
          <Pressable onPress={handleOpenDatePicker} hitSlop={8}>
            <Text className="text-base font-semibold text-blue-600 text-center px-10">
              {formatWorkShiftHeaderRange(days)}
            </Text>
          </Pressable>
        }
      />

      <View className="shrink-0 bg-white border-b border-gray-100">
        <WorkShiftWeekCalendar
          days={days}
          selectedDayKey={selectedDayKey}
          shiftCountByDay={shiftCountByDay}
          onSelectDay={setSelectedDayKey}
        />
      </View>

      <View className="flex-1">
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" />
          </View>
        ) : (
          <PullToRefreshFlatList
            className="flex-1"
            data={selectedDayShifts}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: 'flex-start',
              paddingTop: 8,
              paddingBottom: 24,
            }}
            refreshing={refreshing || (isFetching && !isLoading)}
            onRefresh={handleRefresh}
            ListEmptyComponent={
              <View className="pt-4 items-center">
                <Text className="text-gray-400">Chưa có ca làm việc</Text>
              </View>
            }
          />
        )}
      </View>

      <WorkShiftFormBottomSheet ref={formRef} onSuccess={() => refetch()} />
      <WorkShiftDatePickerBottomSheet
        ref={datePickerRef}
        onSelect={handleRangeChange}
      />
      <WorkShiftActionsBottomSheet
        ref={actionsRef}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </View>
  );
}
