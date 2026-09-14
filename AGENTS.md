# Hướng dẫn làm việc với App Pick

## Tổng quan

`seedcom-app-pick` là ứng dụng React Native dùng Expo SDK 51 cho quy trình hoàn
tất đơn hàng của Seedcom OMS: nhận và lấy hàng, chia túi, quét barcode/QR, in hóa
đơn hoặc tem túi, rồi bàn giao cho đơn vị vận chuyển.

Đây là dự án Expo bare/dev-client; thư mục `ios/` và `android/` được commit. Ứng
dụng không chạy đầy đủ bằng Expo Go. Phần lớn nội dung nghiệp vụ và comment trong
code dùng tiếng Việt.

## Nguồn sự thật và lệnh thường dùng

- Node được ghim ở `22.9.0` trong `.tool-versions`; package manager là Yarn 1.
- Luôn đối chiếu script với `package.json`, profile build với `eas.json`, và cấu
  hình runtime với `app.config.ts` + `env.ts` trước khi chạy lệnh.
- `app.config.ts` mặc định về profile `dev` nếu không có `EAS_BUILD_PROFILE`,
  nhưng nên truyền profile tường minh để tránh dùng nhầm API hoặc bundle ID.

```bash
# Metro/dev client
EAS_BUILD_PROFILE=dev yarn expo start --dev-client
yarn start:prod

# Chạy trên thiết bị đã kết nối
EAS_BUILD_PROFILE=dev yarn expo run:android --device
EAS_BUILD_PROFILE=dev yarn expo run:ios --device
yarn android:prod
yarn ios:prod

# Quality gates
yarn type-check
yarn lint:eslint
yarn lint

# EAS build (tác vụ bên ngoài, chỉ chạy khi được yêu cầu rõ)
eas build --platform android --profile dev
eas build --platform ios --profile dev
yarn build:android:prod
yarn build:ios:prod

# OTA/expo-updates (publish ra bên ngoài, chỉ chạy khi được yêu cầu rõ)
node scripts/codepush-dev.js
yarn codepush:prod
```

Không có test runner tự động. Với thay đổi code, tối thiểu chạy `yarn
type-check`, ESLint và Prettier; sau đó kiểm tra luồng liên quan trên development
build và thiết bị thật khi có camera, PDA, notification hoặc printer.

Nếu quality gate đã lỗi trước khi làm việc, ghi lại baseline, chỉ sửa lỗi thuộc
phạm vi yêu cầu và báo rõ lỗi còn lại. Không dùng `lint:fix` hoặc formatter trên
toàn repo nếu việc đó làm thay đổi file không liên quan.

`expo prebuild --clean`, các script clean/reset, EAS build và OTA publish có thể
ghi đè native state hoặc tạo tác động bên ngoài. Chỉ chạy khi nhiệm vụ yêu cầu;
kiểm tra `git status` và đúng profile trước khi chạy.

## Kiến trúc chính

### Routing

Expo Router dùng file routes trong `src/app/`. Root layout ở
`src/app/_layout.tsx`, phần ứng dụng chính nằm trong group `(drawer)`, và các màn
đơn hàng nằm dưới `src/app/(drawer)/orders/`.

Không hardcode route. Dùng `ROUTES` và các builder trong
`src/core/constants/routes.ts`, hoặc helper trong `src/core/utils/navigation.ts`.
Group `(drawer)` không tạo URL segment.

### Luồng hoàn tất đơn

Các màn `[code].tsx` có component và Zustand store tương ứng:

- `order-pick`: lấy và xác nhận số lượng sản phẩm.
- `order-bags`: chia sản phẩm vào túi, lưu số lượng và nhãn.
- `order-invoice` + `print-preview`: tạo/in hóa đơn và tem túi.
- `order-scan-to-delivery`: quét túi để bàn giao.
- `store-start-order-scan-to-delivery` và
  `store-complete-order-scan-to-delivery`: bàn giao group-shipping tại cửa hàng.

Khi thay đổi một luồng, lần theo toàn bộ route → screen → component → API/query
→ Zustand store → navigation tiếp theo; kiểm tra cả reset state khi đổi mã đơn
hoặc rời màn.

### State

- TanStack Query quản lý server state. Query client ở
  `src/api/shared/api-provider.tsx` có `staleTime` 30 giây, `retry: 1` và không
  refetch khi focus window.
- Zustand chỉ giữ client/UI/session state. Store được bọc bằng
  `createSelectors`; ưu tiên selector như `useAuth.use.status()` thay vì subscribe
  cả store.
- Auth/config được hydrate ở module load trong root layout; auth được persist qua
  MMKV trong `src/core/storage.tsx`.
- Không sao chép server state vào Zustand nếu Query cache đã là nguồn sự thật.

Stable reference là yêu cầu correctness, không chỉ là tối ưu. Giữ module-level
fallback constants, memoized objects và stable style objects khi chúng được dùng
trong dependency array, Portal hoặc external store. Không thay bằng `{}`/`[]`
inline nếu có thể gây effect loop hoặc remount.

### API

Tất cả request dùng axios instance ở `src/api/shared/client.tsx`:

- Response interceptor trả trực tiếp `response.data`; hook không nhận full
  `AxiosResponse`.
- Backend có thể trả `{ error: string }` với HTTP 200. Mutation/query phải xử lý
  business error theo pattern của endpoint lân cận.
- Auth header, global sign-out, flash message và Crashlytics là cross-cutting
  concern của shared client; không lặp lại theo từng endpoint.
- Endpoint của luồng xử lý đơn dùng context `app-pick/`.
- Không thêm hoặc log token/credential mới. Không đưa giá trị nhạy cảm vào tài
  liệu, test fixture hay output debug.

API hook đặt trong `src/api/<domain>/`, thường theo tên `use-<verb>-<thing>.ts`.
Shared domain types đặt trong `src/types/`.

### UI và native integrations

- Styling dùng NativeWind v4; dùng token trong `src/ui/colors.ts` và `cn` trong
  `src/lib/utils.ts` theo pattern lân cận.
- Camera dùng Vision Camera. Tôn trọng platform split như `useCarmera.tsx` và
  `useCarmera.android.tsx`; không tự sửa spelling của public filename nếu chưa
  cập nhật mọi import.
- PDA scanner Android là local Expo module trong `modules/pda-scanner/`. Listener
  global mount một lần ở `AuthWrapper`; screen nhận scan qua `usePdaScanTarget`
  và dùng chung handler với camera. Xem `docs/pda-scanner.md`.
- Printer dùng TCP socket và print-data generator Rongta/X-Printer. Phải xử lý
  timeout/disconnect, thứ tự queue và lifecycle trước khi navigate khỏi màn.
- Firebase cung cấp auth, FCM và Crashlytics. Native config bền vững qua
  `app.config.ts`, config plugins hoặc local Expo module; tránh sửa generated
  native file nếu thay đổi sẽ mất sau prebuild.

## Environment, build và updates

`EAS_BUILD_PROFILE` được chuẩn hóa thành `dev` hoặc `prod` trong
`app.config.ts`, rồi truyền qua `extra.env` cho `env.ts`. Dev/prod dùng API,
application name, scheme, Android package, iOS bundle ID và Google Services file
khác nhau. Giữ các giá trị này khớp với Firebase config.

Startup có hai lớp update theo thứ tự bắt buộc:

1. `useCodepush` kiểm tra/fetch `expo-updates` OTA.
2. `useAutoUpdate` mới kiểm tra native release qua GitHub khi OTA đã hoàn tất và
   không còn modal/pending restart.

Không publish OTA cho thay đổi cần native module/config mới. Trước build hoặc
release, xác nhận platform, profile, channel/branch, runtime version và loại thay
đổi (JS-only hay native). Không thay đổi version trong `app.json` ngoài phạm vi.

## Conventions

- TypeScript strict mode và `checkJs` đang bật.
- Giữ alias đồng bộ giữa `tsconfig.json` và `babel.config.js`: `@/*` trỏ vào
  `src/*`, `~/*` trỏ repo root, `@env` trỏ `env.ts`.
- Match naming convention của thư mục đang sửa; API hook thường kebab-case,
  core hook thường camelCase.
- Không sửa trực tiếp `node_modules`; dependency patches nằm trong `patches/`.
- Giữ thay đổi nhỏ, không format hoặc refactor file ngoài phạm vi, và luôn xem
  `git diff` trước khi bàn giao.

## Project skills

Các workflow chi tiết nằm trong `.cursor/skills/` và tự kích hoạt theo ngữ cảnh:

- `app-pick-order-flow`: thay đổi các bước xử lý đơn hàng.
- `app-pick-api-state`: API hook, TanStack Query và Zustand.
- `app-pick-device-io`: camera, PDA, notification và printer.
- `app-pick-build-update`: environment, prebuild, EAS, OTA và native release.
