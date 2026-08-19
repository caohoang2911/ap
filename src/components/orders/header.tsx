import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { DrawerActions } from '@react-navigation/native';

import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import { router, useNavigation } from 'expo-router';
import { useGetOrderStatusCounters } from '~/src/api/app-pick';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { useAssignMeToStore } from '~/src/api/app-pick/use-assign-me-to-store';
import { useRefreshToken } from '~/src/api/auth/use-refresh-token';
import { queryClient } from '~/src/api/shared';
import { Avatar, AvatarFallback } from '~/src/components/Avatar';
import TabsStatus from '~/src/components/orders/tab-status';
import { useAuth } from '~/src/core';
import { useRole, useRoleDriver } from '~/src/core/hooks/useRole';
import { useConfig } from '~/src/core/store/config';
import { setLoading } from '~/src/core/store/loading';
import { toggleScanQrCode, useOrders } from '~/src/core/store/orders';
import { getConfigNameById } from '~/src/core/utils/config';
import { stringUtils } from '~/src/core/utils/string';
import { Option } from '~/src/types/commons';
import { Role } from '~/src/types/employee';
import { colors } from '~/src/ui/colors';
import { Badge } from '../Badge';
import OrderListHeaderSkeleton from '../shared/skeleton/order-list-header-skeleton';
import StoreSelection from '../shared/store-selection';
import Skeleton from '../Skeleton';
import AssignStoreBottomSheet from './assign-store-bottom-sheet';
import DeliveryType from './delivery-type';
import InputSearch from './input-search';
import MissingInvoiceBottomSheet from './missing-invoice-bottom-sheet';
import OrderStatusBottomSheet from './order-status-bottom-sheet';
import { useGetUnseenNotiCounter } from '~/src/api/app-pick/use-get-unseen-noti-counter';
import { ROUTES } from '@/core/constants/routes';
import {
  getRepresentativeFirstName,
  stripEmployeeCodeFromName,
} from '~/src/core/utils/employee';

const MAX_DRIVER_ASSIGNED_STORE_CODES = 2;

const Header = () => {
  const userInfo = useAuth.use.userInfo();

  const role = useRole();

  const config = useConfig.use.config();
  const stores = config?.stores || [];
  const employeeRoles = config?.employeeRoles || [];
  const storeRef = useRef<any>(null);
  const storeName = getConfigNameById(stores, userInfo?.storeCode);
  const roleName = getConfigNameById(employeeRoles, userInfo?.role);
  // Tài xế nội bộ: name dạng "… - Sang Nguyễn - SC009226" — bỏ mã NV trước khi lấy tên/avatar.
  const displayName = stripEmployeeCodeFromName(
    userInfo?.name,
    userInfo?.username,
  );
  const representativeName = getRepresentativeFirstName(displayName);

  const driverAssignedStoreCodes = userInfo?.driverAssignedStoreCodes || [];
  const driverOrderAssignStatus = userInfo?.driverOrderAssignStatus;

  const isPickerShiftStatusOnShift = userInfo?.kposShiftStatus === 'ON_SHIFT';

  const isDriver = useRoleDriver();
  const selectedOrderCounter = useOrders.use.selectedOrderCounter();
  const deliveryType = useOrders.use.deliveryType();
  const fromScanQrCode = useOrders.use.fromScanQrCode();
  const searchParams = useMemo(
    () => ({
      status: fromScanQrCode ? 'ALL' : selectedOrderCounter,
      deliveryType: fromScanQrCode ? null : deliveryType,
    }),
    [selectedOrderCounter, deliveryType, fromScanQrCode],
  );

  const orderStatusBottomSheetRef = useRef<any>(null);
  const assignStoreBottomSheetRef = useRef<any>(null);
  const missingInvoiceBottomSheetRef = useRef<any>(null);

  const { data: counterData } = useGetOrderStatusCounters();
  const missingInvoiceCount = counterData?.data?.MISSING_INVOICE ?? 0;
  const { data: unseenNotiCounterData } = useGetUnseenNotiCounter(false);
  const unseenNotiCount = unseenNotiCounterData?.data ?? 10;

  const handleOrderStatusBottomSheet = () => {
    orderStatusBottomSheetRef.current?.present();
  };

  const handleAssignStoreBottomSheet = () => {
    assignStoreBottomSheetRef.current?.present();
  };

  const { mutate: assignMeToStore } = useAssignMeToStore(() => {
    refreshTokenAsync();
  });

  const { mutateAsync: refreshTokenAsync } = useRefreshToken(() => {
    queryClient.invalidateQueries({});
  });

  // Track mutation state from mutationKey to get isPending from any instance
  const isLoadingRefreshToken =
    useIsMutating({ mutationKey: ['refreshToken'] }) > 0;
  const isLoadingGetMyProfile =
    useIsMutating({ mutationKey: ['getMyProfile'] }) > 0;
  const isLoadingOrderListInitial =
    useIsFetching({
      queryKey: ['searchOrders', searchParams],
      exact: true,
      predicate: (query) =>
        query.state.status === 'pending' &&
        query.state.data === undefined &&
        query.getObserversCount() > 0,
    }) > 0;
  const canShowInitialSkeletonRef = useRef(true);
  const hasSeenInitialLoadingRef = useRef(false);

  useEffect(() => {
    if (isLoadingOrderListInitial) {
      hasSeenInitialLoadingRef.current = true;
      return;
    }

    // Only lock skeleton after we have truly seen initial loading once.
    // This avoids turning it off too early during first mount race.
    if (
      canShowInitialSkeletonRef.current &&
      hasSeenInitialLoadingRef.current &&
      !isLoadingOrderListInitial
    ) {
      canShowInitialSkeletonRef.current = false;
    }
  }, [isLoadingOrderListInitial]);

  const shouldShowInitialSkeleton =
    canShowInitialSkeletonRef.current && isLoadingOrderListInitial;

  const navigation = useNavigation();
  const toggleMenu = () => navigation.dispatch(DrawerActions.toggleDrawer());

  const handleSelectedStore = (store: Option & { address: string }) => {
    setLoading(true);
    assignMeToStore({ storeCode: store?.id });
  };

  const handleOpenStoreSelection = useCallback(() => {
    storeRef.current?.present();
  }, []);

  const renderStoreSelection = useMemo(() => {
    return (
      <View className="mt-1.5 flex-row flex-wrap items-center gap-1.5">
        <View className="flex-row items-center self-start">
          {isLoadingRefreshToken || isLoadingGetMyProfile ? (
            <Skeleton width={100} height={20} variant="round-rectangle" />
          ) : (
            <Pressable onPress={handleOpenStoreSelection} hitSlop={10}>
              <View className="flex-row items-center rounded-lg border border-blue-100 bg-blue-50 px-2 py-1">
                <Ionicons
                  className="mr-1"
                  name="storefront-outline"
                  size={12}
                  color={colors.blue[400]}
                />
                <Text className="text-xs font-medium text-blue-600">
                  {userInfo?.storeCode} - {storeName}
                </Text>
                <MaterialIcons
                  name={'keyboard-arrow-down'}
                  size={16}
                  color={colors.blue[400]}
                />
              </View>
            </Pressable>
          )}
        </View>
        {isLoadingRefreshToken || isLoadingGetMyProfile ? (
          <Skeleton width={120} height={20} variant="round-rectangle" />
        ) : (
          <View className="flex-row flex-wrap items-center gap-1.5 self-start">
            <Badge
              label={
                !isPickerShiftStatusOnShift
                  ? 'Chưa vào ca KPOS'
                  : 'Đang vào ca KPOS'
              }
              variant={!isPickerShiftStatusOnShift ? 'danger' : 'success'}
            />
            {missingInvoiceCount > 0 && (
              <Pressable
                onPress={() => missingInvoiceBottomSheetRef.current?.present()}
              >
                <Badge
                  label={`${missingInvoiceCount} đơn chưa tạo HĐ`}
                  variant="warning"
                />
              </Pressable>
            )}
          </View>
        )}
      </View>
    );
  }, [
    userInfo,
    storeName,
    isLoadingRefreshToken,
    isLoadingGetMyProfile,
    isPickerShiftStatusOnShift,
    handleOpenStoreSelection,
    missingInvoiceCount,
  ]);

  const renderDriverSelection = useMemo(() => {
    const isDisable = driverOrderAssignStatus === 'DISABLE';
    return (
      <View className="flex flex-row items-center gap-2 mt-1 ">
        <Pressable onPress={handleOrderStatusBottomSheet}>
          <Badge
            icon={
              <Ionicons
                name={
                  isDisable
                    ? 'notifications-off-outline'
                    : 'notifications-outline'
                }
                size={12}
                color={isDisable ? 'red' : 'green'}
              />
            }
            label={isDisable ? 'Ngưng nhận đơn' : 'Đang nhận đơn'}
            variant={isDisable ? 'danger' : 'success'}
          />
        </Pressable>
        <View className="flex flex-row items-center gap-1 flex-1">
          <Pressable onPress={handleAssignStoreBottomSheet}>
            <Badge
              className="self-start"
              label={
                driverAssignedStoreCodes
                  .slice(0, MAX_DRIVER_ASSIGNED_STORE_CODES)
                  .join(', ') +
                (driverAssignedStoreCodes.length >
                MAX_DRIVER_ASSIGNED_STORE_CODES
                  ? ` (+${driverAssignedStoreCodes.length - MAX_DRIVER_ASSIGNED_STORE_CODES})`
                  : '')
              }
              variant="default"
            />
          </Pressable>
        </View>
      </View>
    );
  }, [userInfo, storeName, driverAssignedStoreCodes, driverOrderAssignStatus]);

  if (shouldShowInitialSkeleton) {
    return <OrderListHeaderSkeleton />;
  }

  return (
    <View className="border-b border-slate-200 bg-white pb-2 pt-2">
      <View className="flex-row items-start gap-2.5 px-4 pb-2">
        <TouchableOpacity onPress={toggleMenu} className="self-start pt-0.5">
          <Avatar>
            <AvatarFallback
              className="bg-blue-500"
              textClassname="text-sm font-bold text-white"
            >
              {stringUtils.getInitials(displayName || userInfo?.username)}
            </AvatarFallback>
          </Avatar>
        </TouchableOpacity>
        <View className="flex-1 min-w-0">
          <View className="flex-row items-center justify-between gap-2">
            <View className="min-w-0 flex-1 flex-row items-center gap-1.5">
              <Text
                className="shrink text-[15px] font-bold text-slate-900"
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {userInfo?.username?.toUpperCase()} - {representativeName}
              </Text>
              <Badge label={roleName || userInfo?.role} />
            </View>
            <Pressable
              className="h-9 w-9 items-center justify-center rounded-full bg-slate-50"
              hitSlop={10}
              onPress={() => router.push(ROUTES.APP.NOTIFICATIONS)}
            >
              <View className="relative">
                <Ionicons
                  name="notifications-outline"
                  size={22}
                  color={colors.black}
                />
                {unseenNotiCount > 0 && (
                  <View className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 rounded-full bg-red-500 items-center justify-center px-1">
                    <Text className="text-[10px] font-bold text-white leading-3">
                      {unseenNotiCount > 99 ? '99+' : unseenNotiCount}
                    </Text>
                  </View>
                )}
              </View>
            </Pressable>
          </View>
          {!isDriver && renderStoreSelection}
          {isDriver && renderDriverSelection}
        </View>
      </View>
      <View className="z-10 flex-row items-center justify-between gap-3 border-y border-slate-100 bg-slate-50 px-4 py-2">
        <InputSearch toggleScanQrCode={() => toggleScanQrCode(true)} />
      </View>
      <View className="px-4 pt-2">
        <TabsStatus />
      </View>
      {role !== Role.DRIVER && (
        <View className="mt-2 px-4">
          <DeliveryType />
        </View>
      )}
      {/* Bottom sheet */}
      <StoreSelection
        onSelect={handleSelectedStore}
        ref={storeRef}
        selectedId={userInfo?.storeCode}
      />
      <OrderStatusBottomSheet
        ref={orderStatusBottomSheetRef}
        onClose={handleOrderStatusBottomSheet}
        currentStatus={driverOrderAssignStatus}
      />

      <AssignStoreBottomSheet
        ref={assignStoreBottomSheetRef}
        driverAssignedStoreCodes={driverAssignedStoreCodes}
      />
      <MissingInvoiceBottomSheet ref={missingInvoiceBottomSheetRef} />
    </View>
  );
};

export default Header;
