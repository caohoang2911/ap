import { useIsFocused } from '@react-navigation/native';
import clsx from 'clsx';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Dimensions,
  InteractionManager,
  Keyboard,
  LayoutAnimation,
  ListRenderItemInfo,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  UIManager,
  View,
} from 'react-native';
import { FlatList } from 'react-native';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { queryClient } from '~/src/api/shared';
import PullToRefreshFlatList from '~/src/components/shared/pull-to-refresh-flat-list';
import {
  resetOrderPick,
  setCurrentCode,
  setCurrentId,
  setInitOrderPickProducts,
  setIsPickedByManualBarcodeInput,
  setIsScrolledDown,
  setKeyword,
  setLastScannedId,
  setSuccessForBarcodeScan,
  toggleShowAmountInput,
  useOrderPick,
} from '~/src/core/store/order-pick';
import { useOrderPickProductsFlat } from '~/src/core/hooks/useOrderPickProductsFlat';
import {
  handleScanBarcode,
  resolvePickScanBarcode,
} from '~/src/core/utils/order-bags';
import { Product, ProductItemGroup } from '~/src/types/product';
import Empty from '../shared/empty';
import OrderPickProduct from './product';
import ProductCombo from './product-combo';
import ProductGift from './product-gift';
import UserNote from './user-note';
import { useOrderDetailForCode } from '~/src/api/app-pick/use-get-order-detail';

const EmptyProductList = () => (
  <View className="mt-3">
    <Empty />
  </View>
);

// Memoize các component render item
const ProductItem = memo(
  ({
    item,
    isLast,
    statusOrder,
  }: {
    item: Product | ProductItemGroup | any;
    isLast: boolean;
    statusOrder?: string;
  }) => {
    const renderProduct = () => {
      if (item.type === 'COMBO' && 'elements' in item) {
        return (
          <ProductCombo
            statusOrder={statusOrder || ''}
            combo={item as ProductItemGroup}
          />
        );
      }
      if (item.type === 'GIFT_PACK' && 'elements' in item) {
        return (
          <ProductGift
            statusOrder={statusOrder || ''}
            giftPack={item as ProductItemGroup}
          />
        );
      }
      return (
        <OrderPickProduct
          statusOrder={statusOrder || ''}
          {...(item.elements?.[0] as Product)}
        />
      );
    };

    return (
      <View className={clsx('px-4 mb-4', { 'mb-10': isLast })}>
        {renderProduct()}
      </View>
    );
  },
);

// Component chính
const OrderPickProducts = () => {
  const { code } = useLocalSearchParams<{ code: string }>();
  // Chỉ màn đang focus được ghi store global. Tránh màn order-pick ở nền (đơn cũ,
  // vẫn mounted khi noti push đơn mới) refetch (vd reconnect / invalidate) rồi sync
  // đè sản phẩm đơn cũ lên store của đơn đang xem.
  const isFocused = useIsFocused();
  const keyword = useOrderPick.use.keyword();
  const { orderDetail } = useOrderDetailForCode(code);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  // Keep pull-to-refresh but delegate to root query cache
  const handleRefresh = useCallback(async () => {
    if (!code) return;
    setIsRefreshing(true);
    try {
      await queryClient.refetchQueries({
        queryKey: ['orderDetail', code],
        exact: true,
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [code]);

  const orderPickProducts = useOrderPick.use.orderPickProducts();
  const orderPickProductsFlat = useOrderPickProductsFlat();
  const lastScannedId = useOrderPick.use.lastScannedId();
  const flatListRef = useRef<FlatList>(null);
  const filteredProducts = orderPickProducts;
  const filteredProductsRef = useRef(filteredProducts);
  const lastScannedIdRef = useRef(lastScannedId);
  filteredProductsRef.current = filteredProducts;
  lastScannedIdRef.current = lastScannedId;

  const syncPickProductsFromOrderDetail = useCallback(() => {
    const itemGroups = orderDetail?.delivery?.itemGroups;
    if (itemGroups) {
      const tempArr = Object.values(itemGroups).map((item: any) => item);
      setInitOrderPickProducts([...tempArr] as never[]);
    }
  }, [orderDetail?.delivery?.itemGroups]);

  // Cache cập nhật khi đang xem đơn (pull-to-refresh / auto-refresh) → đồng bộ store.
  // Gate isFocused: màn nền refetch sẽ KHÔNG sync đè (xem giải thích ở isFocused).
  useEffect(() => {
    if (!isFocused) return;
    if (!code) return;
    syncPickProductsFromOrderDetail();
  }, [isFocused, code, syncPickProductsFromOrderDetail]);

  // Focus màn pick (mount mới / quay lại đơn cũ / noti push đơn khác lên trên):
  // reset + hydrate ATOMIC trong CÙNG một effect focus. Chỉ màn đang focus chạy →
  // không tranh chấp store global với màn nền (tránh ping-pong currentCode A↔B vô
  // hạn); và reset rồi hydrate ngay trong 1 lượt nên KHÔNG bị wipe-sau-hydrate khi
  // back lại đơn cũ (trước đây reset ở màn cha chạy sau hydrate ở con → xoá trắng).
  useFocusEffect(
    useCallback(() => {
      if (!code) return;
      if (useOrderPick.getState().currentCode !== code) {
        resetOrderPick();
        setCurrentCode(code);
      }
      syncPickProductsFromOrderDetail();
    }, [code, syncPickProductsFromOrderDetail]),
  );

  useEffect(() => {
    if (!keyword) return;

    const matchedRefBarcode = resolvePickScanBarcode(
      keyword,
      orderPickProductsFlat,
    );
    if (!matchedRefBarcode) return;

    Keyboard.dismiss();
    const indexOfCodeScanned = handleScanBarcode({
      orderPickProductsFlat,
      currentId: null,
      isEditManual: false,
      barcode: matchedRefBarcode,
    });

    if (indexOfCodeScanned === -1) return;

    const currentProduct = orderPickProductsFlat[indexOfCodeScanned];
    if (!currentProduct?.barcode) return;

    setIsPickedByManualBarcodeInput(true);
    setSuccessForBarcodeScan(currentProduct.barcode);
    setCurrentId(currentProduct.id);
    setLastScannedId(currentProduct.id ?? null);
    toggleShowAmountInput(true, currentProduct.id);
    setKeyword('');
  }, [
    keyword,
    orderPickProducts,
    orderPickProductsFlat,
    handleScanBarcode,
    setSuccessForBarcodeScan,
    setCurrentId,
    setIsPickedByManualBarcodeInput,
    setLastScannedId,
    toggleShowAmountInput,
    setKeyword,
  ]);

  // Key extractor tối ưu
  const keyExtractor = useCallback((item: any, index: number) => {
    // Ensure unique keys for all item types
    if (item.code) {
      return `${item.code}_${index}`;
    }
    if (item.id) {
      return `${item.id}_${index}`;
    }
    if (item.barcode) {
      return `${item.barcode}_${index}`;
    }
    return `item_${index}`;
  }, []);

  // Handle scroll failure with enhanced error handling
  const handleScrollToIndexFailed = useCallback(
    (info: {
      index: number;
      highestMeasuredFrameIndex: number;
      averageItemLength: number;
    }) => {
      console.warn('scrollToIndexFailed:', info);

      if (!flatListRef.current) {
        console.warn('FlatList ref not available in scrollToIndexFailed');
        return;
      }

      try {
        // Tính toán scroll offset dựa trên số liệu thống kê
        const offset = Math.max(0, info.averageItemLength * info.index);
        flatListRef.current.scrollToOffset({ offset, animated: true });

        // Thử lại sau một khoảng thời gian ngắn với error handling
        setTimeout(() => {
          const len = filteredProductsRef.current?.length ?? 0;
          if (
            flatListRef.current &&
            len > 0 &&
            info.index >= 0 &&
            info.index < len
          ) {
            try {
              flatListRef.current.scrollToIndex({
                animated: true,
                index: info.index,
                viewPosition: 0.5,
              });
            } catch (retryError) {
              console.warn('Retry scrollToIndex failed:', retryError);
              // Final fallback - use scrollToOffset with more precise calculation
              const finalOffset = Math.max(
                0,
                info.averageItemLength * info.index,
              );
              try {
                flatListRef.current.scrollToOffset({
                  offset: finalOffset,
                  animated: true,
                });
              } catch (fallbackError) {
                console.warn(
                  'Final scrollToOffset fallback failed:',
                  fallbackError,
                );
              }
            }
          }
        }, 100);
      } catch (error) {
        console.warn('Initial scrollToOffset failed:', error);
      }
    },
    [],
  );

  // Có delivery nhưng store chưa hydrate → list rỗng; vẫn hiện Empty thay vì khoảng trắng
  const listIsEmpty = !filteredProducts?.length;

  const filteredProductsLength = filteredProducts?.length ?? 0;
  const statusOrder = orderDetail?.header?.status as string | undefined;
  const prevStatusOrderRef = useRef<string | undefined>();

  // Sau bắt đầu pick: invalidate refetch xong → status CONFIRMED → STORE_PICKING → scroll lên ghi chú CS
  useEffect(() => {
    const prevStatus = prevStatusOrderRef.current;
    prevStatusOrderRef.current = statusOrder;

    if (prevStatus === 'CONFIRMED' && statusOrder === 'STORE_PICKING') {
      InteractionManager.runAfterInteractions(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      });
    }
  }, [statusOrder]);

  const listRenderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<any>) => {
      const isLast = index === filteredProductsLength - 1;

      return (
        <ProductItem statusOrder={statusOrder} item={item} isLast={isLast} />
      );
    },
    [filteredProductsLength, statusOrder],
  );

  const scrollTargetIndex = useMemo(() => {
    if (lastScannedId) {
      const idx = filteredProducts.findIndex((product: any) => {
        return product.elements?.some(
          (element: Product) => element.id === lastScannedId,
        );
      });
      if (idx !== -1) return idx;
    }

    return -1;
  }, [filteredProducts, lastScannedId]);

  useEffect(() => {
    if (scrollTargetIndex === -1) return;
    if ((filteredProducts?.length ?? 0) === 0) return;

    let cancelled = false;

    InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;
      requestAnimationFrame(() => {
        if (cancelled) return;
        const list = filteredProductsRef.current;
        const len = list?.length ?? 0;
        if (len === 0 || !flatListRef.current) return;

        const id = lastScannedIdRef.current;
        let index = -1;
        if (id) {
          index = list.findIndex((product: any) =>
            product.elements?.some((element: Product) => element.id === id),
          );
        }
        if (index < 0 || index >= len) return;

        try {
          flatListRef.current.scrollToIndex({
            animated: true,
            index,
            viewPosition: 0.5,
          });
        } catch (error) {
          if (__DEV__) {
            console.warn('scrollToIndex failed in useEffect:', error);
          }
          const estimatedOffset = Math.max(0, index * 200);
          try {
            flatListRef.current.scrollToOffset({
              offset: estimatedOffset,
              animated: true,
            });
          } catch (fallbackError) {
            if (__DEV__) {
              console.warn('scrollToOffset fallback failed:', fallbackError);
            }
          }
        }
      });
    });

    return () => {
      cancelled = true;
    };
  }, [filteredProducts, scrollTargetIndex]);

  const { height } = Dimensions.get('window');
  const itemHeight = 200;
  const visibleItems = Math.ceil(height / itemHeight);
  const initialNumToRender = Math.min(Math.max(visibleItems, 4), 10);
  const maxToRenderPerBatch = Math.min(6, initialNumToRender);

  const listFooter = useMemo(() => <View style={{ height: 20 }} />, []);

  const dismissKeyboardOnScroll = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  const isScrolledDownRef = useRef(false);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      const shouldCollapse = y > 30;
      if (shouldCollapse !== isScrolledDownRef.current) {
        isScrolledDownRef.current = shouldCollapse;
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setIsScrolledDown(shouldCollapse);
      }
    },
    [],
  );

  useEffect(() => {
    return () => {
      setIsScrolledDown(false);
    };
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <PullToRefreshFlatList
        ref={flatListRef}
        className="flex-1"
        keyboardDismissMode="on-drag"
        onScrollBeginDrag={dismissKeyboardOnScroll}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        keyExtractor={keyExtractor}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
        ListHeaderComponent={<UserNote orderDetail={orderDetail} />}
        ListFooterComponent={listFooter}
        data={filteredProducts || []}
        ListEmptyComponent={
          listIsEmpty ? <EmptyProductList /> : <View style={{ height: 20 }} />
        }
        renderItem={listRenderItem}
        onScrollToIndexFailed={handleScrollToIndexFailed}
        removeClippedSubviews={Platform.OS === 'android'}
        initialNumToRender={initialNumToRender}
        maxToRenderPerBatch={maxToRenderPerBatch}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 80 }}
        windowSize={5}
        updateCellsBatchingPeriod={50}
      />
    </View>
  );
};

// Đặt displayName để dễ debug
OrderPickProducts.displayName = 'OrderPickProducts';

export default memo(OrderPickProducts);
