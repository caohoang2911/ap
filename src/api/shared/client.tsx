import axios, { AxiosError, AxiosResponse } from 'axios';
import { toUpper } from 'lodash';
import { showMessage } from 'react-native-flash-message';
import { signOut } from '~/src/core';
import { getToken } from '~/src/core/store/auth/utils';
import { Env } from '~/env';
import { isDevelopment } from '~/src/core/env';
import CrashlyticsService from '~/src/core/utils/crashlytics';
import { markPostEnd, markPostStart } from './http-busy';

const BLACK_LIST_SHOW_MESSAGE = [
  '/app-pick/getStoreEmployeeProfile',
  // getOrderStatus là poll nền 3s/lần của auto-refresh — không show flash khi lỗi.
  '/app-pick/getOrderStatus',
  '/app-pick/getUnseenNotiCounter',
];
const PUBLIC_AUTH_ENDPOINTS = [
  'auth/genHRVLoginURL',
  'auth/authorizeUserPassword',
  'auth/logout',
];

// Function để gọi API logout
const callLogoutAPI = async () => {
  try {
    await axiosClient.post('auth/logout');
  } catch (error) {
    // Bỏ qua lỗi API logout, vẫn sẽ clear state local
    console.log('Logout API failed:', error);
  }
};

// Biến toàn cục theo dõi trạng thái auth
const AUTH_STATE = {
  isAuthError: false,
  lastErrorTime: 0,
  COOLDOWN: 5000, // Thời gian nghỉ giữa các lần xử lý lỗi (5 giây)
};

// Xử lý lỗi xác thực
const handleAuthError = (message: string) => {
  const now = Date.now();

  // Chỉ xử lý lỗi nếu không có lỗi nào đang xử lý và đã qua thời gian cooldown
  if (
    !AUTH_STATE.isAuthError &&
    now - AUTH_STATE.lastErrorTime > AUTH_STATE.COOLDOWN
  ) {
    AUTH_STATE.isAuthError = true;
    AUTH_STATE.lastErrorTime = now;

    // Hiển thị thông báo
    showMessage({
      message: message || 'Phiên đăng nhập đã hết hạn',
      type: 'danger',
    });

    // Logout sau một khoảng thời gian ngắn
    setTimeout(async () => {
      // Gọi API logout trước
      await callLogoutAPI();

      // Sau đó clear state local
      signOut();

      // Reset trạng thái sau 1 giây
      setTimeout(() => {
        AUTH_STATE.isAuthError = false;
      }, 1000);
    }, 500);

    return true;
  }

  return false;
};

export const axiosClient = axios.create({
  baseURL: Env.API_BASE_URL,
  timeout: Env.API_TIMEOUT,
  headers: {
    accept: 'application/json',
  },
});

// Log API configuration
if (isDevelopment()) {
  console.log('🌐 API Configuration:', {
    baseURL: Env.API_BASE_URL,
    timeout: Env.API_TIMEOUT,
    environment: Env.ENVIRONMENT,
    isDevelopment: Env.IS_DEVELOPMENT,
    isProduction: Env.IS_PRODUCTION,
  });
}

axiosClient.interceptors.response.use(
  function (
    response: AxiosResponse & { error?: string },
  ): AxiosResponse & { error?: string } {
    // Resume timer auto-refresh: POST đã có response (thành công).
    const successCfg = response.config as any;
    if (successCfg?.__postTracked) {
      successCfg.__postTracked = false;
      markPostEnd();
    }

    // Log API responses in development
    if (isDevelopment()) {
      console.log('📥 API Response:', {
        status: response.status,
        url: response.config?.url,
        method: toUpper(response.config?.method),
        hasError: !!response?.data?.error,
        error: response?.data?.error,
        dataKeys: response?.data ? Object.keys(response.data) : [],
      });
    }

    if (
      response &&
      [
        'ERROR_AUTH_TOKEN_EXPIRED',
        'ERROR_AUTH_TOKEN_REQUIRED',
        'ERROR_AUTH_TOKEN_INVALID',
      ].includes(response?.data?.error)
    ) {
      const authErrorMessage =
        response?.data?.error === 'ERROR_AUTH_TOKEN_EXPIRED'
          ? 'Phiên làm việc của bạn đã hết hạn, vui lòng đăng nhập lại'
          : 'Vui lòng đăng nhập để tiếp tục';
      handleAuthError(authErrorMessage);
    } else if (
      response?.data?.error &&
      response?.data?.error !== 'ERROR_EMPLOYEE_STORE_OUT_OF_DATE' &&
      !BLACK_LIST_SHOW_MESSAGE.includes(response.config?.url || '')
    ) {
      showMessage({
        message: response?.data?.error,
        type: 'danger',
      });
    }

    if (response && response?.data) {
      return response?.data;
    }

    return response;
  },
  (error: AxiosError) => {
    // Resume timer auto-refresh: POST đã có response (kể cả khi lỗi).
    const errorCfg = error.config as any;
    if (errorCfg?.__postTracked) {
      errorCfg.__postTracked = false;
      markPostEnd();
    }

    // Log API errors in development
    if (isDevelopment()) {
      console.log('❌ API Error:', {
        status: error.response?.status,
        url: error.config?.url,
        method: toUpper(error.config?.method),
        message: error.message,
        data: error.response?.data,
      });
    }

    // Report non-auth API errors to Crashlytics
    if (error.response?.status && error.response.status >= 500) {
      CrashlyticsService.log(
        `API Error: ${toUpper(error.config?.method)} ${error.config?.url}`,
      );
      CrashlyticsService.recordError(
        new Error(`API ${error.response.status}: ${error.config?.url}`),
        'API Error',
      );
    }

    if (error.response?.status === 401 || error.response?.status === 403) {
      handleAuthError('Phiên đăng nhập đã hết hạn');
    }
    return Promise.reject(error);
  },
);

axiosClient.interceptors.request.use(function (config: any) {
  const token = getToken();
  const requestUrl = config.url || '';
  const isPublicAuthEndpoint = PUBLIC_AUTH_ENDPOINTS.some((endpoint) =>
    requestUrl.includes(endpoint),
  );

  if (config.url === 'auth/authorizeAppPickClient') {
    return config;
  }

  const hasExplicitZas = !!config.headers?.zas;

  if (!hasExplicitZas && token) {
    config.headers.zas = token;
  } else if (!hasExplicitZas && !isPublicAuthEndpoint) {
    // Chặn mọi API không public sau khi đã logout/không còn token
    // return Promise.reject(new Error('BLOCKED_SIGNED_OUT_REQUEST'));
    config.headers.zas =
      '4kkgCYTSGyU4hc50sSNRYiCAZ2KxQPQzUClPl-cMi8EKduxy1jLs1OweKInfH7etwjBZBWE5HV7ZAbi_3J8_BA';
  }

  if (config.data instanceof FormData) {
    config.headers['Content-Type'] = 'multipart/form-data';
  }

  // Log API requests in development
  if (isDevelopment()) {
    console.log('📤 API Request:', {
      method: toUpper(config.method),
      url: config.url,
      baseURL: config.baseURL,
      fullURL: `${config.baseURL}${config.url}`,
      hasToken: !!token,
      headers: {
        'Content-Type': config.headers['Content-Type'],
        zas: config.headers.zas ? config.headers.zas : 'none',
      },
    });
  }

  // Pause timer auto-refresh khi bắt đầu một POST. Đặt ngay trước `return config`
  // để mọi nhánh return sớm phía trên không bị tính (và do đó không cần giảm lại).
  if (String(config.method || '').toLowerCase() === 'post') {
    config.__postTracked = true;
    markPostStart();
  }

  return config;
});
