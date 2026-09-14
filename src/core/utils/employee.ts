import { EmployeeRole } from '~/src/types/employee';

const APP_PICK_ALLOWED_ROLES: EmployeeRole[] = [
  EmployeeRole.STORE,
  EmployeeRole.STORE_FULLTIME_PICKER,
  EmployeeRole.STORE_MANAGER,
  EmployeeRole.ADMIN,
  EmployeeRole.STORE_SHIFT_SUPERVISOR,
];

/** Role được phép tạo hoặc khôi phục session App Pick. */
export const isAllowedAppPickRole = (role?: string): boolean =>
  !!role &&
  (APP_PICK_ALLOWED_ROLES.includes(role as EmployeeRole) ||
    role.startsWith('STORE'));

/**
 * Bỏ mã nhân viên khỏi cuối tên (vd. "KFM - Delivery - Sang Nguyễn - SC009226"
 * + code SC009226 → "KFM - Delivery - Sang Nguyễn"), và cắt luôn dấu `-` thừa.
 */
export const stripEmployeeCodeFromName = (
  fullName?: string,
  employeeCode?: string,
): string => {
  let result = fullName?.trim() ?? '';
  if (!result) return '';

  const code = employeeCode?.trim();
  if (code) {
    const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result
      .replace(new RegExp(`\\s*-\\s*${escaped}\\s*$`, 'i'), '')
      .trim();
    result = result.replace(new RegExp(`\\s+${escaped}\\s*$`, 'i'), '').trim();
  }

  // Cắt dấu `-` / khoảng trắng thừa ở cuối sau khi bỏ mã.
  result = result.replace(/[\s-]+$/g, '').trim();
  return result;
};

/** Tên gọi đại diện — lấy từ cuối chuỗi họ tên (vd. "Võ Thị Anh Thy" → "Thy"). */
export const getRepresentativeFirstName = (fullName?: string) => {
  const trimmed = fullName?.trim();
  if (!trimmed) return '';
  const parts = trimmed.split(/\s+/);
  return parts[parts.length - 1] ?? trimmed;
};

const PICKER_SHIFT_MANAGEMENT_ROLES: EmployeeRole[] = [
  EmployeeRole.ADMIN,
  EmployeeRole.STORE,
  EmployeeRole.STORE_MANAGER,
  EmployeeRole.STORE_SHIFT_SUPERVISOR,
];

/** Quản lý ca Picker — ADMIN, STORE, STORE_MANAGER, STORE_SHIFT_SUPERVISOR. */
export const canManagePickerShift = (role?: string): boolean => {
  if (!role) return false;
  return (PICKER_SHIFT_MANAGEMENT_ROLES as string[]).includes(role);
};

const STORE_EMPLOYEE_MANAGEMENT_ROLES: EmployeeRole[] = [
  EmployeeRole.ADMIN,
  EmployeeRole.STORE_MANAGER,
  EmployeeRole.STORE_SHIFT_SUPERVISOR,
];

/** Quản lý nhân viên siêu thị — chỉ ADMIN, STORE_MANAGER, STORE_SHIFT_SUPERVISOR (loại STORE). */
export const canManageStoreEmployees = (role?: string): boolean => {
  if (!role) return false;
  return (STORE_EMPLOYEE_MANAGEMENT_ROLES as string[]).includes(role);
};

/** Quản lý nhóm Tele siêu thị — chỉ ADMIN, SM (STORE_MANAGER), TC (STORE_SHIFT_SUPERVISOR). */
export const canManageStoreTeleGroup = (role?: string): boolean => {
  if (!role) return false;
  return (STORE_EMPLOYEE_MANAGEMENT_ROLES as string[]).includes(role);
};
