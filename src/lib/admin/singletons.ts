// Form fields for the two single records: the profile and each role.
import { KOI_VARIETIES } from "@/content/schema";
import type { FieldSpec } from "./resources";

export const PROFILE_FIELDS: FieldSpec[] = [
  { name: "name", label: "Họ tên", kind: "text" },
  { name: "location", label: "Địa điểm", kind: "text" },
  { name: "email", label: "Email liên hệ", kind: "text" },
  { name: "linkedin", label: "LinkedIn", kind: "url" },
  { name: "github", label: "GitHub", kind: "url" },
  { name: "avatarUrl", label: "Ảnh đại diện", kind: "upload", upload: "image" },
  { name: "openToWork", label: "Đang tìm việc (Open to work)", kind: "boolean" },
  { name: "availabilityNote", label: "Ghi chú thời gian sẵn sàng", kind: "i18n" },
  { name: "bookingUrl", label: "Link đặt lịch", kind: "url", nullable: true },
  { name: "summaries.fullstack", label: "Giới thiệu: Developer", kind: "i18n", multiline: true },
  { name: "summaries.techlead", label: "Giới thiệu: Tech Lead", kind: "i18n", multiline: true },
  { name: "summaries.pm", label: "Giới thiệu: Technical PM", kind: "i18n", multiline: true },
];

export const ROLE_FIELDS: FieldSpec[] = [
  { name: "title", label: "Chức danh", kind: "i18n" },
  { name: "koiVariety", label: "Giống cá koi", kind: "select", options: KOI_VARIETIES },
  { name: "cvFileUrl", label: "CV (PDF)", kind: "upload", upload: "pdf", required: true },
  { name: "experienceOrder", label: "Thứ tự kinh nghiệm", kind: "order", source: "experiences" },
  { name: "skillGroupOrder", label: "Thứ tự nhóm kỹ năng", kind: "order", source: "skillGroups" },
];
