---
name: app-pick-api-state
description: >-
  Thiết kế và sửa API hook, TanStack Query cache, mutation và Zustand state theo
  kiến trúc App Pick. Dùng khi thêm endpoint, query, mutation, query key,
  invalidation, prefetch, role-aware API, axios interceptor, auth state hoặc store
  Zustand trong repository này.
---

# API và state App Pick

## Chọn đúng nơi đặt state

- TanStack Query là nguồn sự thật cho dữ liệu server, trạng thái loading/error và
  cache.
- Zustand chỉ giữ UI/session state như modal, draft, scan progress, current item
  hoặc state cần chia sẻ ngoài Query cache.
- Không mirror response server vào Zustand nếu không có yêu cầu lifecycle rõ.
- Dùng selector được tạo bởi `createSelectors`, ví dụ `useAuth.use.status()`;
  tránh subscribe toàn store.

## Thêm hoặc sửa API hook

1. Đọc `src/api/shared/client.tsx`, query provider và ít nhất một hook cùng domain.
2. Đặt file `use-<verb>-<thing>.ts` trong domain phù hợp và đặt shared types ở
   `src/types/` khi được dùng qua nhiều feature.
3. Type payload đã unwrap: axios interceptor trả `response.data`, không trả
   `AxiosResponse` đầy đủ.
4. Backend có thể trả `{ error }` với HTTP 200. Xử lý business error theo contract
   của endpoint; không chỉ dựa vào `catch`/HTTP status.
5. API xử lý đơn dùng context `app-pick`. Query key phải chứa đầy đủ các biến
   làm thay đổi response.
6. Query phải có `enabled` khi input bắt buộc chưa sẵn sàng. Giữ key nhất quán
   giữa query, prefetch, invalidate và setQueryData.
7. Mutation chỉ cập nhật cache hoặc invalidate sau khi business operation thành
   công. Giữ callback variables nếu UI cần reconcile optimistic/local state.
8. Cross-cutting behavior như auth header, global sign-out, flash message,
   multipart và Crashlytics thuộc shared client, không nhân bản trong hook.

## An toàn và ổn định

- Không thêm token, secret hoặc dữ liệu người dùng vào log. Khi debug chỉ log
  metadata cần thiết.
- Không dùng fallback `{}`/`[]` inline nếu giá trị đi vào dependency array hoặc
  consumer cần stable reference; khai báo constant ở module scope.
- Khi sửa store, cập nhật cả interface, initial state, action và reset state.
- Kiểm tra race giữa refetch, mutation, logout và screen unmount.

## Xác minh

- Chạy `yarn type-check`.
- Kiểm tra query disabled/enabled, success, business error, network error và
  invalidate/refetch.
- Với endpoint phân quyền, kiểm tra các role được hỗ trợ hoặc mô tả rõ nhánh chưa
  thể kiểm tra.
- Chạy ESLint/Prettier theo phạm vi và báo baseline theo `AGENTS.md`.

## Nguồn sự thật

- `src/api/shared/client.tsx`
- `src/api/shared/api-provider.tsx`
- `src/api/app-pick/use-get-order-detail.ts`
- `src/core/utils/employee.ts`
- `src/core/utils/browser.ts`
