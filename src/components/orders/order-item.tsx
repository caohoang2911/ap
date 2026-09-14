import { useRouter } from 'expo-router';
import { isEmpty, toLower } from 'lodash';
import moment from 'moment';
import React, { Fragment, memo, useCallback, useMemo, useRef } from 'react';
import { Image, Text, View } from 'react-native';

import Feather from '@expo/vector-icons/Feather';
import { TouchableOpacity } from 'react-native-gesture-handler';
import {
  ORDER_DELIVERY_TYPE,
  ORDER_STATUS_BADGE_VARIANT,
} from '@/core/constants/order';
import { useConfig } from '~/src/core/store/config';
import { getConfigNameById } from '~/src/core/utils/config';
import { expectedDeliveryTime, getRelativeTime } from '~/src/core/utils/moment';
import { formatCurrency } from '~/src/core/utils/number';
import { Order } from '~/src/types/order';
import { prefetchOrderDetailForCode } from '~/src/api/app-pick/use-get-order-detail';
import { Badge } from '../Badge';
import CountdownTimer from '../shared/count-down-timer';
import CopyButton from '../shared/copy-button';
import MoreActionsBtn from './more-actions-btn';

// Grab Logo Component - không cần memo vì không có props và quá đơn giản
const GrabLogo = () => (
  <Image
    source={require('~/assets/grab-logo.png')}
    style={{ width: 35, height: 35 }}
    resizeMode="contain"
  />
);

const RowWithLabel = memo(
  ({
    icon,
    label,
    value,
    pickedItemProgress,
    bagsSize,
    numberOfLines,
  }: {
    icon: React.ReactNode;
    label: string;
    value: string | React.ReactNode;
    pickedItemProgress?: number;
    bagsSize?: number;
    numberOfLines?: number;
  }) => {
    return (
      <View className="flex flex-row gap-1 items-center">
        <View className="mr-2 -mt-0.5">{icon}</View>
        <View style={{ width: 72 }}>
          <Text className="text-gray-500">{label}</Text>
        </View>
        {typeof value === 'string' ? (
          <Text
            className="font-medium"
            numberOfLines={numberOfLines || 1}
            style={{ maxWidth: pickedItemProgress ? '60%' : '68%' }}
            ellipsizeMode="tail"
          >
            {value}
          </Text>
        ) : (
          <>{value}</>
        )}
        {pickedItemProgress && (
          <View className="flex flex-row ml-auto gap-1 items-center">
            <Badge label={`Pick ${pickedItemProgress}`} variant="warning" />
          </View>
        )}
        {Boolean(bagsSize) && (
          <View className="flex flex-row ml-auto gap-1 items-center">
            <Badge label={`${bagsSize} túi`} variant="warning" />
          </View>
        )}
      </View>
    );
  },
);
RowWithLabel.displayName = 'RowWithLabel';

const OrderItem = ({
  statusName,
  orderTime,
  code,
  status,
  customer,
  payment,
  deliveryTimeRange,
  amount,
  tags,
  pickerNote,
  driverNote,
  deliveryType,
  fulfillError,
  groupShippingCode,
  lastTimeUpdateStatus,
  deliveryAddress,
  picker,
  maxPickingTime,
  pickedItemProgress,
  bagLabels,
  saleChannel,
}: Order) => {
  const router = useRouter();
  const isNavigatingRef = useRef(false);

  const config = useConfig.use.config();
  const orderTags = config?.orderTags || [];
  const fulfillErrorTypes = config?.fulfillErrorTypes || [];
  const fulfillErrorTypeDisplay = getConfigNameById(
    fulfillErrorTypes,
    fulfillError?.type,
  );

  const handlePress = useCallback(() => {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;

    prefetchOrderDetailForCode({
      orderCode: code,
    });
    router.push({
      pathname: `orders/order-pick/${code}`,
      params: { status },
    });

    setTimeout(() => {
      isNavigatingRef.current = false;
    }, 800);
  }, [code, status, router]);

  const shouldShowassignee = picker?.username && picker?.name;

  const notes = useMemo(() => {
    if (deliveryType === ORDER_DELIVERY_TYPE.APARTMENT_COMPLEX_DELIVERY) {
      return [pickerNote, driverNote].filter(Boolean);
    }

    return [pickerNote].filter(Boolean);
  }, [driverNote, pickerNote, deliveryType]);

  // Memo icons để RowWithLabel không bị re-render không cần thiết
  const userIcon = useMemo(
    () => <Feather name="user" size={22} color="black" />,
    [],
  );
  const mapPinIcon = useMemo(
    () => <Feather name="map-pin" size={17} color="gray" />,
    [],
  );
  const calendarIcon = useMemo(
    () => <Feather name="calendar" size={18} color="gray" />,
    [],
  );
  const packageIcon = useMemo(
    () => <Feather name="package" size={18} color="gray" />,
    [],
  );

  return (
    <TouchableOpacity onPress={handlePress} className="flex-1">
      <View className="rounded-md border-bgPrimary border overflow-hidden">
        <View className="bg-bgPrimary pl-3 py-4 pr-0 flex flex-row justify-between items-center">
          <View className="flex flex-row items-center gap-2">
            <Text className="font-semibold text-base text-colorPrimary">
              {code}
            </Text>
            <CopyButton value={code} />
            {saleChannel === 'GRAB_MART' && <GrabLogo />}
            {groupShippingCode && (
              <Badge label={groupShippingCode} variant="warning" />
            )}
          </View>
          <View className="flex flex-row items-center gap-0">
            <Badge
              label={statusName}
              variant={toLower(status) as any}
              extraLabel={
                <Text className="text-xs text-contentPrimary ml-3">
                  | {getRelativeTime(lastTimeUpdateStatus)}
                </Text>
              }
            />
            <View className="mr-1 rounded-full">
              <MoreActionsBtn code={code} />
            </View>
          </View>
        </View>
        <View className="py-4 px-3 pt-3 gap-3">
          <View className="flex flex-row gap-1 items-center justify-between mb-1">
            <View className="flex flex-row gap-2 items-center flex-1 ">
              <View className="-mt-0.5">{userIcon}</View>
              <Text
                className="text-md font-semibold "
                style={{ width: '85%' }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {customer?.name}
              </Text>
            </View>
            <View className="flex flex-row gap-1 items-center flex-grow-1">
              <Badge
                label={
                  <Text className="text-base mr-2">
                    {formatCurrency(amount, { unit: true })}
                  </Text>
                }
                extraLabel={
                  <Text className="text-sm text-contentPrimary ml-3">
                    - {payment?.methodName}
                  </Text>
                }
                variant="warning"
              />
            </View>
          </View>
          <RowWithLabel
            icon={mapPinIcon}
            label="ĐC giao"
            value={deliveryAddress?.fullAddress}
            numberOfLines={1}
          />
          <RowWithLabel
            icon={calendarIcon}
            label="Ngày đặt"
            value={moment(orderTime).format('DD/MM/YYYY')}
          />
          <RowWithLabel
            icon={calendarIcon}
            label="Ngày giao"
            value={
              deliveryTimeRange ? (
                <Text>
                  {expectedDeliveryTime(deliveryTimeRange).day} {'  '}
                  <Text className="text-orange-500 font-semibold">
                    {expectedDeliveryTime(deliveryTimeRange).hh}
                  </Text>
                </Text>
              ) : (
                '--'
              )
            }
            bagsSize={bagLabels?.length}
          />
          <RowWithLabel
            icon={packageIcon}
            label="NV Pick"
            value={
              shouldShowassignee ? (
                `${picker?.name && `${picker?.name}`}`
              ) : (
                <>
                  {maxPickingTime && (
                    <CountdownTimer
                      size="sm"
                      autoStart
                      initialMilliseconds={maxPickingTime - moment().valueOf()}
                    />
                  )}
                </>
              )
            }
            pickedItemProgress={pickedItemProgress}
          />

          {tags?.length > 0 && (
            <View className="pt-1 flex flex-row gap-1 flex-wrap">
              {tags?.map((tag: string, index: number) => {
                const tagName = getConfigNameById(orderTags, tag);
                return (
                  <Badge
                    key={index}
                    label={(tagName as string) || tag}
                    variant={
                      ORDER_STATUS_BADGE_VARIANT[
                        tag as keyof typeof ORDER_STATUS_BADGE_VARIANT
                      ] as any
                    }
                    className="self-start rounded-md px-1"
                  />
                );
              })}
            </View>
          )}
        </View>
        {notes.length > 0 && (
          <View className="w-full bg-orange-500 px-3 py-3">
            {notes.map((note, index) => {
              if (isEmpty(note)) return null;
              const newNotes = note.trim().split('\\n');
              return (
                <Fragment key={index}>
                  {newNotes?.map((newNote, noteIndex) => (
                    <View
                      key={`${newNote}-${noteIndex}`}
                      className="flex flex-row py-1"
                    >
                      <View className="size-1.5 bg-white rounded-full mr-2 mt-2.5" />
                      <Text className="flex-1 text-base font-semibold text-white">
                        {newNote?.trim()}
                      </Text>
                    </View>
                  ))}
                </Fragment>
              );
            })}
          </View>
        )}
        {fulfillError?.type && (
          <View className="rounded-b bg-red-400 px-3 py-3">
            <View className="flex flex-row items-start">
              <View className="mr-2 mt-2 size-1.5 rounded-full bg-white" />
              <Text className="flex-1 text-base font-semibold text-white">
                {fulfillErrorTypeDisplay}
              </Text>
            </View>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

export default React.memo(OrderItem);
