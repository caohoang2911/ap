import { axiosClient } from '@/api/shared';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { showMessage } from 'react-native-flash-message';
import TcpSocket from 'react-native-tcp-socket';
import { Env } from '~/env';
import { setLoading } from '~/src/core/store/loading';
import { getPrinterHost } from '~/src/core/utils/printer';
import { showPrinterConnectionFailMessage } from '~/src/core/utils/printer-connection';
import { useGenXPrinterPrintData } from './use-gen-x-printer-print-data';

export type InvoiceVariables = {
  orderCode: string;
  note?: string;
};
type Response = { error: string } & {
  status: 'SUCCESS' | 'FAIL';
  data: any;
};

const TIMEOUT_CONNECT_PRINTER = 5000;
const PRINTER_PORT = 9100;
const BASE64_REGEX = /^(data:image\/[a-zA-Z]+;base64,)?[A-Za-z0-9+/=]+$/;
const INVOICE_API_URL = Env.INVOICE_API_URL;

/**
 * Message lỗi in/kết nối máy in. Dùng chung cho cả toast và `new Error(...)` vì
 * `onError` của các mutation in lại show `error.message` — nếu Error để chuỗi kỹ
 * thuật tiếng Anh thì NV sẽ thấy toast thứ 2 lệch hẳn nội dung với toast đầu.
 */
const PRINTER_ERROR_MSG = {
  notConfigured:
    'Chưa cài đặt máy in. Vui lòng cài đặt máy in trước khi xuất hóa đơn.',
  connectFail: (host: string) =>
    `Không thể kết nối với máy tạo hoá đơn tại IP: ${host}. Vui lòng kiểm tra lại.`,
  connectError: 'Lỗi khi kết nối máy in. Vui lòng thử lại.',
  invalidInvoiceImage: 'Định dạng dữ liệu hóa đơn không hợp lệ',
  genPrintDataFail: 'Không thể tạo dữ liệu in hóa đơn',
  printInvoiceFail: 'Không thể in hóa đơn',
} as const;

/** Error không enumerable → JSON.stringify(error) ra "{}". */
const getMutationErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string') return error;
  const axiosErr = error as {
    response?: { data?: { error?: string; message?: string } };
    message?: string;
  };
  return (
    axiosErr?.response?.data?.error ||
    axiosErr?.response?.data?.message ||
    axiosErr?.message ||
    fallback
  );
};

const cleanupConnection = (
  client: any,
  timer: ReturnType<typeof setTimeout> | null,
) => {
  if (timer) {
    clearTimeout(timer);
  }
  if (client) {
    client.destroy();
  }
};

const checkPrinterConnection = (): Promise<TcpSocket.Socket> => {
  return new Promise((resolve, reject) => {
    const host = getPrinterHost();

    if (!host) {
      showMessage({
        message: PRINTER_ERROR_MSG.notConfigured,
        type: 'danger',
      });
      reject(new Error(PRINTER_ERROR_MSG.notConfigured));
      return;
    }

    const options: any = {
      port: PRINTER_PORT,
      host: host,
    };

    let client: any;
    let timer: ReturnType<typeof setTimeout> | null = null;

    try {
      client = TcpSocket.createConnection(options, () => {
        cleanupConnection(null, timer);
        resolve(client);
      });

      timer = setTimeout(() => {
        cleanupConnection(client, timer);
        const failMessage = PRINTER_ERROR_MSG.connectFail(host);
        void showPrinterConnectionFailMessage(failMessage);
        reject(new Error(failMessage));
      }, TIMEOUT_CONNECT_PRINTER);

      client.on('error', () => {
        cleanupConnection(client, timer);
        const failMessage = PRINTER_ERROR_MSG.connectFail(host);
        void showPrinterConnectionFailMessage(failMessage);
        reject(new Error(failMessage));
      });
    } catch {
      cleanupConnection(client, timer);
      void showPrinterConnectionFailMessage(PRINTER_ERROR_MSG.connectError);
      reject(new Error(PRINTER_ERROR_MSG.connectError));
    }
  });
};

const fetchBase64ImageByInvoiceURL = async (
  orderCode: string,
): Promise<{ data: string }> => {
  return await axios.get(`${INVOICE_API_URL}?orderCode=${orderCode}`);
};

const useFetchBase64ImageByInvoiceURL = (
  cb?: (base64Image: string) => void,
) => {
  return useMutation({
    mutationFn: (orderCode: string): Promise<{ data: string }> =>
      fetchBase64ImageByInvoiceURL(orderCode),
    onSuccess: (data: { data: string }) => {
      if (data) {
        cb?.(data.data);
      } else {
        setLoading(false);
        showMessage({
          message: 'không thể tải dữ liệu hóa đơn',
          type: 'danger',
        });
      }
    },
  });
};

const createInvoice = async (params: InvoiceVariables): Promise<Response> => {
  return await axiosClient.post('app-pick/createInvoice', params);
};

export const useCreateInvoice = () => {
  return useMutation({
    mutationFn: (params: InvoiceVariables) => createInvoice(params),
  });
};

type RunCreateOrPrintInvoiceOptions = {
  orderCode: string;
  existingInvoiceCode?: string | null;
  printExistingInvoice: (invoiceCode: string) => void | Promise<void>;
  createMissingInvoice: (variables: InvoiceVariables) => void;
  note?: string;
};

/**
 * Luồng dùng chung cho action "Tạo lại hóa đơn": có mã HĐ thì in ngay; chưa có
 * thì tạo với note rồi caller tiếp tục in trong callback onSuccess của mutation.
 */
export const runCreateOrPrintInvoice = ({
  orderCode,
  existingInvoiceCode,
  printExistingInvoice,
  createMissingInvoice,
  note = 'In lại hóa đơn',
}: RunCreateOrPrintInvoiceOptions) => {
  const normalizedInvoiceCode = existingInvoiceCode?.trim();

  if (normalizedInvoiceCode) {
    // mutateAsync reject khi lỗi máy in/network; mutation đã tự show lỗi và tắt
    // loading, helper chỉ cần consume rejection để không tạo unhandled promise.
    void Promise.resolve()
      .then(() => printExistingInvoice(normalizedInvoiceCode))
      .catch(() => undefined);
    return;
  }

  createMissingInvoice({ orderCode, note });
};

/**
 * Khoá chống double-submit tạo hóa đơn theo orderCode (module-level → dùng chung
 * mọi màn). Chặn được cả double-tap nút, auto-trigger sau khi scan túi (đơn PICK
 * UP) lẫn dialog confirm bị stack — khi một request createInvoice cho cùng đơn
 * đang chạy thì lần gọi thứ 2 bị bỏ qua, KHÔNG tắt loading của request đầu.
 */
const inFlightCreateInvoice = new Set<string>();

/** Ném ra khi phát hiện lần tạo hóa đơn trùng đang chạy → onError bỏ qua lặng lẽ. */
class DuplicateCreateInvoiceError extends Error {
  constructor() {
    super('DUPLICATE_CREATE_INVOICE');
    this.name = 'DuplicateCreateInvoiceError';
  }
}

export type CreateInvoiceResponse = Response;

export type UseCreateInvoiceFlowOptions = {
  /**
   * Gọi khi tạo hóa đơn thành công (vd: gọi in nếu không COD).
   * `response` là payload createInvoice — chứa `invoiceCode`, và cũng có thể là
   * `status: 'FAIL'` (FAIL vẫn đi vào nhánh này để giữ nguyên flow cũ).
   */
  onSuccess?: (
    orderCode: string,
    response?: CreateInvoiceResponse,
  ) => void | Promise<void>;
  onError?: (error: unknown) => void;
};

const CREATE_INVOICE_MSG = {
  success: 'Tạo hóa đơn thành công',
  fail: 'Tạo hóa đơn thất bại, vui lòng liên hệ CS',
} as const;

/** Flow tạo hóa đơn: gọi API createInvoice, show message cố định (không dùng nội dung lỗi từ server). */
export const useCreateInvoiceFlow = (options?: UseCreateInvoiceFlowOptions) => {
  return useMutation({
    mutationFn: async (params: InvoiceVariables): Promise<Response> => {
      // Chặn tạo hóa đơn trùng: nếu đơn này đang có request createInvoice chạy
      // dở thì bỏ qua lần gọi thứ 2 (giữ nguyên loading của request đầu).
      if (inFlightCreateInvoice.has(params.orderCode)) {
        throw new DuplicateCreateInvoiceError();
      }
      inFlightCreateInvoice.add(params.orderCode);

      try {
        // Kiểm tra kết nối máy in trước khi tạo hóa đơn
        const probe = await checkPrinterConnection();
        try {
          probe.destroy();
        } catch {
          /* ignore */
        }

        const result = await createInvoice(params);
        const isFail = result?.status === 'FAIL';

        if (result?.error && !isFail) {
          showMessage({
            message: result.error,
            type: 'danger',
          });
          throw new Error(result.error);
        }

        if (isFail) {
          showMessage({
            message: CREATE_INVOICE_MSG.fail,
            type: 'warning',
          });

          return result;
        }

        showMessage({
          message: CREATE_INVOICE_MSG.success,
          type: 'success',
        });

        return result;
      } finally {
        inFlightCreateInvoice.delete(params.orderCode);
      }
    },
    onSuccess: async (data, variables) => {
      try {
        await options?.onSuccess?.(variables.orderCode, data);
      } catch (error) {
        // Callback thường tiếp tục sang mutation in hóa đơn. Mutation con đã tự
        // hiển thị lỗi; tại đây consume rejection và báo caller reset local mode.
        setLoading(false);
        options?.onError?.(error);
      }
    },
    onError: (error) => {
      // Request trùng bị chặn: không tắt loading (request đầu vẫn đang chạy).
      if (error instanceof DuplicateCreateInvoiceError) return;
      setLoading(false);
      options?.onError?.(error);
    },
  });
};

const validateBase64Image = (base64Image: string): string => {
  const trimmedBase64 = base64Image.trim();

  if (!BASE64_REGEX.test(trimmedBase64)) {
    setLoading(false);
    showMessage({
      message: PRINTER_ERROR_MSG.invalidInvoiceImage,
      type: 'danger',
    });
    throw new Error(PRINTER_ERROR_MSG.invalidInvoiceImage);
  }

  return trimmedBase64;
};

const sendToPrinter = async (
  client: TcpSocket.Socket,
  printerBuffer: Uint8Array,
) => {
  client.write(printerBuffer);
  await new Promise((resolve) => setTimeout(resolve, 100));
};

export type UseCreateInvoiceProcessOptions = {
  onSuccess?: () => void | Promise<void>;
  onError?: (error: unknown) => void;
  successMessage?: string;
  loadingMessage?: string;
  keepLoadingOnSuccess?: boolean;
};

export const useCreateInvoiceProcess = (
  options?: UseCreateInvoiceProcessOptions,
) => {
  const {
    onSuccess,
    onError,
    successMessage,
    loadingMessage,
    keepLoadingOnSuccess = false,
  } = options ?? {};
  const { mutateAsync: genXPrinterPrintDataAsync } = useGenXPrinterPrintData();
  const { mutateAsync: fetchBase64ImageByInvoiceURLAsync } =
    useFetchBase64ImageByInvoiceURL();

  return useMutation({
    mutationFn: async (params: { orderCode: string }): Promise<any> => {
      setLoading(true, loadingMessage);
      let client: TcpSocket.Socket | null = null;
      try {
        client = await checkPrinterConnection();

        const base64Image = await fetchBase64ImageByInvoiceURLAsync(
          params.orderCode,
        );
        const fullBase64 = validateBase64Image(base64Image.data);

        const {
          data: printerBuffers,
          error,
          hasError,
        } = await genXPrinterPrintDataAsync({
          base64Image: fullBase64,
        });

        if (hasError && error) {
          setLoading(false);
          throw new Error(error || PRINTER_ERROR_MSG.genPrintDataFail);
        }

        if (!error && printerBuffers?.length > 0 && client) {
          for (const printerBuffer of printerBuffers) {
            await sendToPrinter(client, printerBuffer as unknown as Uint8Array);
          }

          if (client) {
            client.destroy();
            client = null;
          }

          if (successMessage) {
            showMessage({
              message: successMessage,
              type: 'success',
            });
          }
        } else {
          if (client) {
            client.destroy();
            client = null;
          }
          throw new Error(
            error?.toString() || PRINTER_ERROR_MSG.printInvoiceFail,
          );
        }

        return { error: null, data: null };
      } catch (error) {
        if (client) {
          client.destroy();
          client = null;
        }
        setLoading(false);
        throw error;
      }
    },
    onSuccess: async (data: any) => {
      if (!keepLoadingOnSuccess) {
        setLoading(false);
      }
      if (data && !data.error) {
        try {
          await onSuccess?.();
        } catch (error) {
          // Continuation thường invalidate/navigate. Reset local state tại hook,
          // rồi rethrow để mutateAsync caller biết tiến trình chưa hoàn tất và
          // không tiếp tục sang COD capture.
          setLoading(false);
          onError?.(error);
          throw error;
        }
      }
    },
    onError: (error: unknown) => {
      const message = getMutationErrorMessage(
        error,
        PRINTER_ERROR_MSG.printInvoiceFail,
      );
      showMessage({
        message,
        type: 'danger',
      });
      setLoading(false);
      onError?.(error);
    },
  });
};

export type UsePrintCodReceiptProcessOptions = {
  onSuccess?: () => void | Promise<void>;
  /** Gọi khi kết thúc tiến trình (thành công hoặc thất bại). */
  onSettled?: () => void | Promise<void>;
  successMessage?: string;
};

/** Flow in riêng phiếu thu COD (sau khi đã có ảnh chụp). */
export const usePrintCodReceiptProcess = (
  options?: UsePrintCodReceiptProcessOptions,
) => {
  const { onSuccess, onSettled, successMessage } = options ?? {};
  const { mutateAsync: genXPrinterPrintDataAsync } = useGenXPrinterPrintData();

  return useMutation({
    mutationFn: async (params: {
      codReceiptBase64String: string;
    }): Promise<any> => {
      setLoading(true, 'Đang in phiếu thu COD...');
      let client: TcpSocket.Socket | null = null;
      try {
        client = await checkPrinterConnection();

        const trimmedBase64 = params.codReceiptBase64String.trim();
        if (!BASE64_REGEX.test(trimmedBase64)) {
          setLoading(false);
          throw new Error('Định dạng dữ liệu phiếu thu COD không hợp lệ');
        }

        const {
          data: printerBuffers,
          error,
          hasError,
        } = await genXPrinterPrintDataAsync({
          base64Image: trimmedBase64,
        });

        if (hasError && error) {
          setLoading(false);
          throw new Error(error);
        }

        if (!error && printerBuffers?.length > 0 && client) {
          for (const printerBuffer of printerBuffers) {
            await sendToPrinter(client, printerBuffer as unknown as Uint8Array);
          }
          if (client) {
            client.destroy();
            client = null;
          }
          if (successMessage) {
            showMessage({
              message: successMessage,
              type: 'success',
            });
          }
          return { error: null, data: null };
        }

        if (client) {
          client.destroy();
          client = null;
        }
        throw new Error(error?.toString() || 'Không thể in phiếu thu COD');
      } finally {
        setLoading(false);
      }
    },
    onSuccess: async (data: any) => {
      if (data && !data.error) {
        try {
          await onSuccess?.();
        } catch {
          setLoading(false);
        }
      }
    },
    onError: (error: any) => {
      setLoading(false);
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'In phiếu thu COD thất bại. Vui lòng thử lại.';
      showMessage({
        message,
        type: 'danger',
      });
    },
    onSettled: async () => {
      try {
        await onSettled?.();
      } catch {
        setLoading(false);
      }
    },
  });
};
