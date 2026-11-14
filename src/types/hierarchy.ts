import { z } from 'zod';

// ============================================================================
// DOMAIN ENUMS
// ============================================================================

export const BranchTierEnum = z.enum([
  'CENTRAL',
  'PROVINCE_HUB',
  'DISTRICT_HUB',
  'MUNICIPALITY_BRANCH',
  'WARD_BRANCH',
]);
export type BranchTier = z.infer<typeof BranchTierEnum>;

export const BranchModelTypeEnum = z.enum(['OWNED', 'FRANCHISE']);
export type BranchModelType = z.infer<typeof BranchModelTypeEnum>;

export const CompensationTypeEnum = z.enum(['SALARY', 'COMMISSION', 'HYBRID']);
export type CompensationType = z.infer<typeof CompensationTypeEnum>;

export const VehicleTypeEnum = z.enum([
  'BICYCLE',
  'MOTORCYCLE',
  'SCOOTER',
  'ELECTRIC_CARGO',
  'VAN',
  'ON_FOOT',
]);
export type VehicleType = z.infer<typeof VehicleTypeEnum>;

export const DutyStatusEnum = z.enum(['AVAILABLE', 'ON_DELIVERY', 'OFF_DUTY', 'ON_LEAVE']);
export type DutyStatus = z.infer<typeof DutyStatusEnum>;

export const StatusEnum = z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']);
export type OperationalStatus = z.infer<typeof StatusEnum>;

// ============================================================================
// ZOD VALIDATION SCHEMAS (API Requests)
// ============================================================================

export const CreateBranchSchema = z.object({
  branch_code: z.string().min(3).max(20).toUpperCase(),
  name: z.string().min(3).max(100),
  name_np: z.string().max(100).optional(),
  parent_branch_id: z.number().int().positive().nullable(),
  tier: BranchTierEnum,
  model_type: BranchModelTypeEnum.default('OWNED'),
  province_id: z.number().int().min(1).max(7),
  district_id: z.number().int().positive().optional(),
  local_level_id: z.number().int().positive().optional(),
  ward_number: z.number().int().min(1).max(35).optional(),
  manager_name: z.string().min(2).max(100).optional(),
  phone: z.string().regex(/^(98|97|0\d)\d{7,8}$/, 'Valid Nepal mobile or landline number required'),
  alternate_phone: z.string().optional(),
  email: z.string().email().optional(),
  landmark_address: z.string().max(200).optional(),
  latitude: z.number().min(26.0).max(31.0).optional(),
  longitude: z.number().min(80.0).max(89.0).optional(),
  password: z.string().min(6),
});
export type CreateBranchInput = z.infer<typeof CreateBranchSchema>;

export const CreateRiderSchema = z.object({
  branch_id: z.number().int().positive(),
  rider_code: z.string().min(2).max(15).toUpperCase(),
  name: z.string().min(2).max(100),
  phone: z.string().regex(/^9[78]\d{8}$/, 'Valid Nepal 10-digit mobile number required'),
  email: z.string().email().optional(),
  password: z.string().min(6),
  vehicle_type: VehicleTypeEnum.default('MOTORCYCLE'),
  vehicle_plate_number: z.string().max(20).optional(),
  driving_license_number: z.string().max(30).optional(),
  compensation_type: CompensationTypeEnum.default('COMMISSION'),
  base_salary: z.number().nonnegative().default(0),
  commission_rate: z.number().nonnegative().default(0),
});
export type CreateRiderInput = z.infer<typeof CreateRiderSchema>;

export const CreateVendorSchema = z.object({
  branch_id: z.number().int().positive(),
  vendor_code: z.string().min(3).max(15).toUpperCase().optional(),
  business_name: z.string().min(2).max(150),
  trade_name: z.string().max(150).optional(),
  phone: z.string().regex(/^9[78]\d{8}$/, 'Valid Nepal 10-digit mobile number required'),
  alternate_phone: z.string().optional(),
  email: z.string().email().optional(),
  password: z.string().min(6),
  contact_person: z.string().min(2).max(100),
  pan_vat_number: z.string().regex(/^\d{9}$/, 'Nepal PAN must be exactly 9 digits').optional(),
  is_vat_registered: z.boolean().default(false),
  province_id: z.number().int().min(1).max(7).optional(),
  district_id: z.number().int().positive().optional(),
  local_level_id: z.number().int().positive().optional(),
  ward_number: z.number().int().optional(),
  address_line: z.string().max(200).optional(),
  bank_name: z.string().min(2).max(100).optional(),
  bank_branch: z.string().max(100).optional(),
  bank_account_holder: z.string().max(150).optional(),
  bank_account_number: z.string().max(40).optional(),
  cod_payout_schedule: z.enum(['DAILY', 'WEEKLY', 'BI_WEEKLY', 'MONTHLY']).default('BI_WEEKLY'),
});
export type CreateVendorInput = z.infer<typeof CreateVendorSchema>;

// ============================================================================
// READ MODELS / RECURSIVE TREE TYPES
// ============================================================================

export interface BranchNode {
  id: number;
  branch_code: string;
  name: string;
  name_np: string | null;
  parent_branch_id: number | null;
  tier: BranchTier;
  model_type: BranchModelType;
  province_id: number | null;
  district_id: number | null;
  local_level_id: number | null;
  ward_number: number | null;
  manager_name: string | null;
  phone: string;
  status: OperationalStatus;
  depth?: number;
  children?: BranchNode[];
}

export interface RiderRecord {
  id: number;
  branch_id: number;
  branch_name?: string;
  rider_code: string;
  name: string;
  phone: string;
  vehicle_type: VehicleType;
  compensation_type: CompensationType;
  base_salary: number;
  commission_rate: number;
  duty_status: DutyStatus;
  status: OperationalStatus;
}

export interface VendorRecord {
  id: number;
  branch_id: number;
  branch_name?: string;
  vendor_code: string;
  business_name: string;
  contact_person: string;
  phone: string;
  pan_vat_number: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  status: OperationalStatus;
}

export interface GeoProvince {
  id: number;
  name_en: string;
  name_np: string;
  code: string;
}

export interface GeoDistrict {
  id: number;
  province_id: number;
  name_en: string;
  name_np: string;
  code: string;
}

export interface GeoLocalLevel {
  id: number;
  district_id: number;
  name_en: string;
  name_np: string;
  type: string;
  total_wards: number;
}
