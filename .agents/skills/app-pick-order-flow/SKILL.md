---
name: app-pick-order-flow
description: >-
  Phân tích và triển khai các thay đổi trong luồng xử lý đơn của App Pick, gồm
  picking, chia túi, hóa đơn, in tem và bàn giao giao vận. Dùng khi yêu cầu nhắc
  đến order flow, order-pick, order-bags, order-invoice, scan-to-delivery,
  group-shipping, chuyển màn đơn hàng hoặc trạng thái xử lý đơn.
---

# Luồng xử lý đơn App Pick

## Quy trình

1. Xác định bước nghiệp vụ và actor liên quan: picker hoặc store.
2. Lần theo route builder → screen `[code].tsx` → component → API/query →
   Zustand store → navigation tiếp theo. Đọc implementation gần nhất trước khi
   tạo pattern mới.
3. Dùng `ROUTES.APP.*` hoặc helper trong `src/core/utils/navigation.ts`; không
   hardcode route string hay thêm `(drawer)` vào URL.
4. Giữ server state trong TanStack Query. Chỉ đặt state tương tác, draft, scan
   progress hoặc modal trong store riêng của flow.
5. Khi flow phụ thuộc `code`, kiểm tra initialization, thay đổi code, remount,
   back navigation và hàm reset. Không để state đơn cũ rò sang đơn mới.
6. API của luồng xử lý đơn dùng context `app-pick`; action theo quyền phải được
   gate ở UI và data layer phù hợp.
7. Nếu screen quét mã, dùng cùng một handler cho camera và
   `usePdaScanTarget`. Gọi hook trước mọi early return.
8. Giữ stable references trong effect, list, Portal và selector. Với update
   collection, chỉ tạo reference mới cho phần tử thực sự thay đổi khi pattern
   hiện tại dựa vào memoization.

## Tình huống phải kiểm tra

- Mở trực tiếp bằng deep link hoặc notification và có nhiều screen `[code]`
  cùng mount.
- Scan trùng, scan nhanh, nhập barcode thủ công và API trả business error.
- Rời màn trong lúc mutation, print hoặc handover đang chạy.
- Picker và store cùng mã đơn nhưng có thể có action khác nhau.
- Group-shipping bắt đầu, tiếp tục và hoàn tất với progress store đúng.
- Quay lại danh sách đơn: cache, counter và trạng thái hiển thị được cập nhật.

## Xác minh

- Chạy `yarn type-check` và quality gate theo `AGENTS.md`.
- Kiểm tra thủ công happy path, business error, back/re-enter và đổi mã đơn.
- Với camera/PDA/printer, dùng development build trên thiết bị thật; không kết
  luận từ Expo Go hoặc web.

## Nguồn sự thật

- `src/core/constants/routes.ts`
- `src/core/utils/navigation.ts`
- `src/app/(drawer)/orders/`
- `src/core/store/`
- `src/api/app-pick/`
