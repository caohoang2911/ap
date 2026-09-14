import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import { getOrderStatus } from '~/src/api/app-pick/get-order-status';
import { queryClient } from '~/src/api/shared';
import {
  shouldDiscardStatusPollResult,
  shouldSkipStatusPoll,
} from '~/src/api/shared/http-busy';
import { hideAlert, showAlert } from '~/src/core/store/alert-dialog';
import { OrderDetail } from '~/src/types/order-pick';

/** Worker chạy mỗi 3s (theo yêu cầu). */
const POLL_INTERVAL_MS = 3000;
/** stackId để alert "đơn thay đổi" chỉ tồn tại một bản trong queue. */
const STATUS_CHANGED_ALERT_STACK_ID = 'order-status-changed';
/** Sau khi user bấm cập nhật, chờ refetch xong rồi mới poll lại. */
const MANUAL_SYNC_COOLDOWN_MS = 3000;

type OrderDetailCache = { data?: OrderDetail } | undefined;

type Options = {
  /** Tắt auto-refresh (mặc định bật). */
  enabled?: boolean;
};

/**
 * Auto-refresh theo order status.
 *
 * Cứ mỗi {@link POLL_INTERVAL_MS} gọi `getOrderStatus(orderCode)`, so sánh với
 * status đang hiển thị ở FE (đọc từ cache React Query `['orderDetail', code]`).
 * Nếu khác nhau → show popup "Đơn hàng có thay đổi, vui lòng cập nhật lại".
 * Bấm xác nhận → refetch order detail tại chỗ.
 *
 * Quy tắc:
 * - Chỉ chạy khi màn đang focus (dùng `useFocusEffect`) → tránh nhiều màn trong
 *   stack cùng poll một đơn.
 * - BE trả null/empty → BỎ QUA, không so sánh.
 * - GET đã gửi trước POST nhưng response về sau → bỏ qua (xem
 *   `shouldDiscardStatusPollResult`).
 * - Toàn bộ tick bọc try/catch → timer không bao giờ chết vĩnh viễn.
 * - Sau khi đã show popup thì ngừng poll cho tới khi user bấm cập nhật (tránh
 *   hỏi lại liên tục mỗi 3s).
 */
export const useOrderStatusAutoRefresh = (
  orderCode?: string,
  options?: Options,
) => {
  const enabled = options?.enabled ?? true;

  // Tránh chồng request và tránh show popup nhiều lần.
  const isCheckingRef = useRef(false);
  const hasShownRef = useRef(false);
  const manualSyncUntilRef = useRef(0);

  useFocusEffect(
    useCallback(() => {
      if (!enabled || !orderCode) return;

      // Re-arm mỗi khi focus lại / đổi đơn.
      hasShownRef.current = false;
      isCheckingRef.current = false;
      manualSyncUntilRef.current = 0;

      let cancelled = false;

      const getFeStatus = () => {
        const cached = queryClient.getQueryData<OrderDetailCache>([
          'orderDetail',
          orderCode,
        ]);
        return cached?.data?.header?.status;
      };

      const showStatusChangedAlert = () => {
        hasShownRef.current = true;
        showAlert({
          title: 'Đơn hàng có thay đổi!',
          confirmText: 'Cập nhật lại',
          isHideCancelButton: true,
          blockDismiss: true,
          stackId: STATUS_CHANGED_ALERT_STACK_ID,
          onConfirm: () => {
            hideAlert();
            manualSyncUntilRef.current = Date.now() + MANUAL_SYNC_COOLDOWN_MS;
            void queryClient
              .refetchQueries({
                queryKey: ['orderDetail', orderCode],
                exact: true,
              })
              .finally(() => {
                hasShownRef.current = false;
              });
          },
        });
      };

      const tick = async () => {
        if (cancelled) return;
        if (isCheckingRef.current) return;
        if (hasShownRef.current) return;
        if (Date.now() < manualSyncUntilRef.current) return;
        if (shouldSkipStatusPoll()) return;

        const pollStartedAt = Date.now();

        isCheckingRef.current = true;
        try {
          const beStatus = await getOrderStatus(orderCode);
          if (cancelled) return;
          if (shouldDiscardStatusPollResult(pollStartedAt)) return;
          if (Date.now() < manualSyncUntilRef.current) return;

          const feStatus = getFeStatus();
          if (!feStatus || !beStatus) return;
          if (beStatus !== feStatus) {
            showStatusChangedAlert();
          }
        } catch {
          // Nuốt lỗi để timer không dừng vĩnh viễn.
        } finally {
          isCheckingRef.current = false;
        }
      };

      const intervalId = setInterval(() => {
        void tick();
      }, POLL_INTERVAL_MS);

      return () => {
        cancelled = true;
        clearInterval(intervalId);
      };
    }, [enabled, orderCode]),
  );
};
