import { isStringeeCallPush } from '@/core/services/stringee/register-background-call-handler';
import { registerForPushNotificationsAsync } from '@/core/utils/notification';
import messaging from '@react-native-firebase/messaging';
import { useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { router, usePathname } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  InteractionManager,
  PermissionsAndroid,
  Platform,
} from 'react-native';

export enum TargetScreen {
  ORDER_PICK = 'ORDER-PICK',
  ORDER_INVOICE = 'ORDER-INVOICE',
  ORDER_LISTING = 'ORDER-LISTING',
}

// Set notification handler outside component for global configuration
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const usePushNotifications: any = () => {
  const queryClient = useQueryClient();
  const [token, setToken] = useState('');
  const [channels, setChannels] = useState<Notifications.NotificationChannel[]>(
    [],
  );
  const appState = useRef(AppState.currentState);
  const navigationInProgress = useRef(false);
  const pathname = usePathname();
  const lastNavigationKeyRef = useRef<string | null>(null);
  const lastNavigationAtRef = useRef(0);

  // Create Android notification channel with sound
  const createAndroidChannel = async () => {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default_channel_id', {
        name: 'Default Channel',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        sound: 'ding.mp3', // This references the sound file in res/raw directory
      });
    }
  };

  const handleGoScreen = useCallback(
    (remoteMessage: any) => {
      const { orderCode, targetScr } = remoteMessage || {};
      if (!orderCode || !targetScr) return;

      const targetPath =
        targetScr === TargetScreen.ORDER_PICK
          ? `/orders/order-pick/${orderCode}`
          : targetScr === TargetScreen.ORDER_INVOICE
            ? `/orders/order-invoice/${orderCode}`
            : null;

      if (!targetPath) return;

      if (pathname === targetPath) {
        return;
      }

      const dedupeKey = `${targetScr}:${orderCode}`;
      const now = Date.now();
      if (
        lastNavigationKeyRef.current === dedupeKey &&
        now - lastNavigationAtRef.current < 1800
      ) {
        console.log('Duplicate notification navigation skipped:', dedupeKey);
        return;
      }
      lastNavigationKeyRef.current = dedupeKey;
      lastNavigationAtRef.current = now;

      // Kiểm tra nếu đang trong quá trình chuyển hướng thì bỏ qua
      if (navigationInProgress.current) {
        console.log('Navigation already in progress, skipping...');
        return;
      }

      // Đánh dấu đang trong quá trình chuyển hướng
      navigationInProgress.current = true;

      // Sử dụng InteractionManager để đảm bảo các tác vụ UI hoàn tất trước khi chuyển hướng
      InteractionManager.runAfterInteractions(() => {
        try {
          router.push(targetPath);

          setTimeout(() => {
            navigationInProgress.current = false;
          }, 500);
        } catch (error) {
          setTimeout(() => {
            navigationInProgress.current = false;
          }, 500);
        }
      });
    },
    [router, pathname],
  );

  useEffect(() => {
    // Theo dõi trạng thái ứng dụng để xử lý đúng khi chuyển từ background sang foreground
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App vừa được mở lại từ background, reset cờ navigation
        navigationInProgress.current = false;
      }
      appState.current = nextAppState;
    });

    // Configure Android notification channel
    createAndroidChannel();

    // Chỉ cấu hình đặc biệt cho iOS
    const configureIOS = async () => {
      if (Platform.OS === 'ios') {
        // Cần thiết cho thông báo nền iOS có âm thanh
        await messaging().setAutoInitEnabled(true);

        // Yêu cầu quyền iOS với âm thanh được bật
        const authStatus = await messaging().requestPermission({
          alert: true,
          badge: true,
          sound: true,
          announcement: false,
          provisional: false,
        });

        console.log('iOS permission status:', authStatus);
      }
    };

    const fetchToken = async () => {
      const token = await registerForPushNotificationsAsync();
      if (token) {
        setToken(token);
      }
    };

    // Chạy thiết lập
    fetchToken();

    // Chỉ cấu hình iOS riêng
    if (Platform.OS === 'ios') {
      configureIOS();
    } else if (Platform.OS === 'android') {
      // Android 13+ (API 33): xin quyền POST_NOTIFICATIONS để hiển thị thông báo
      // và màn hình cuộc gọi đến từ trạng thái nền/kill.
      if (typeof Platform.Version === 'number' && Platform.Version >= 33) {
        PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        ).catch(() => {});
      }
      // Giữ nguyên logic Android hiện tại
      Notifications.getNotificationChannelsAsync().then((value) =>
        setChannels(value ?? []),
      );
    }

    // Handle user clicking on a notification and open the screen
    const handleNotificationClick = async (response: any) => {
      const data = response?.notification?.request?.content?.data || {};
      try {
        handleGoScreen(data);
      } catch (error) {
        console.log('Error handling notification click:', error);
      }
    };

    const notificationClickSubscription =
      Notifications.addNotificationResponseReceivedListener(
        async (data: any) => {
          handleNotificationClick(data);
        },
      );

    // Handle user opening the app from a notification (when the app is in the background)
    const unsubscribeOpenApp = messaging().onNotificationOpenedApp(
      (remoteMessage: any) => {
        console.log(
          'Notification caused app to open from background state:',
          remoteMessage.data,
        );

        handleGoScreen(remoteMessage?.data);
      },
    );

    // Check if the app was opened from a notification (when the app was completely quit)
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) {
          console.log(
            'Notification caused app to open from quit state:',
            remoteMessage,
          );
          handleGoScreen(remoteMessage?.data);
        }
      });

    // NOTE: Handler FCM background/quit được đăng ký 1 lần duy nhất ở entry point
    // (`index.js` → `registerBackgroundCallHandler`) để chạy được cả khi app bị
    // kill và để hiển thị cuộc gọi Stringee đến. Không đăng ký lại ở đây vì
    // FirebaseMessaging chỉ cho phép 1 background handler (cái đăng ký sau ghi đè).

    // Handle push notifications when the app is in the foreground
    const handlePushNotification = async (remoteMessage: any) => {
      try {
        // Push CUỘC GỌI Stringee khi foreground: cuộc gọi đã đổ qua socket
        // (onIncomingCall2) → không hiện notification "ding" cho nó.
        if (isStringeeCallPush(remoteMessage?.data || {})) {
          return;
        }

        // Handle foreground notifications by setting params like background clicks
        console.log(remoteMessage, 'remoteMessage');

        queryClient.resetQueries({ queryKey: ['searchOrders'] });
        queryClient.resetQueries({ queryKey: ['getOrderStatusCounters'] });
        queryClient.resetQueries({
          queryKey: ['getOrderDeliveryTypeCounters'],
        });

        // Xử lý riêng cho iOS và Android
        if (Platform.OS === 'ios') {
          // iOS foreground notifications có cấu trúc đặc biệt
          await Notifications.scheduleNotificationAsync({
            content: {
              title: remoteMessage.notification?.title || '',
              body: remoteMessage.notification?.body || '',
              data: {
                ...remoteMessage.data,
                // Cấu hình âm thanh iOS
                aps: {
                  sound: 'ding.mp3',
                  badge: 1,
                  'content-available': 1,
                },
              },
              sound: 'ding.mp3', // Use custom sound instead of default
            },
            trigger: null,
          });
        } else {
          // Android foreground notification with sound
          const notification = {
            title: remoteMessage.notification?.title || '',
            body: remoteMessage.notification?.body || '',
            data: remoteMessage.data || {},
            sound: 'ding.mp3', // Reference to sound file in res/raw
            channelId: 'default_channel_id',
          };
          await Notifications.scheduleNotificationAsync({
            content: notification,
            trigger: null,
          });
        }
      } catch (error) {
        console.log('Error handling foreground notification:', error);
      }
    };

    // Listen for push notifications when the app is in the foreground
    const unsubscribe = messaging().onMessage(handlePushNotification);

    // Clean up the event listeners
    return () => {
      unsubscribe();
      unsubscribeOpenApp();
      notificationClickSubscription.remove();
      subscription.remove();
    };
  }, [handleGoScreen, queryClient]);

  return {
    token,
    channels,
  };
};
