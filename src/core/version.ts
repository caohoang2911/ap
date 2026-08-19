// Fallback này được tăng bởi codepush-version.js khi publish thủ công.
const CODEPUSH_VERSION_FALLBACK = '1.0.32';

// EAS Workflow truyền version tường minh để mỗi OTA có mã bất biến, thay vì
// tăng file trong checkout tạm thời rồi mất thay đổi khi worker kết thúc.
export const CODEPUSH_VERSION =
  process.env.EXPO_PUBLIC_OTA_VERSION?.trim() || CODEPUSH_VERSION_FALLBACK;
