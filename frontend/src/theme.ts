// Urban Intel design tokens
export const COLORS = {
  bg: "#F8F9FA",
  surface: "#FFFFFF",
  surfaceAlt: "#F1F5F9",
  text: "#111827",
  textSecondary: "#475569",
  textMuted: "#94A3B8",
  brand: "#0F172A",
  brandHover: "#1E293B",
  border: "#E2E8F0",
  // Severity
  critical: "#EF4444",
  criticalLight: "#FEE2E2",
  warning: "#F59E0B",
  warningLight: "#FEF3C7",
  info: "#3B82F6",
  infoLight: "#DBEAFE",
  success: "#10B981",
  successLight: "#D1FAE5",
};

export const SEVERITY_COLOR: Record<string, { bg: string; fg: string }> = {
  Low: { bg: COLORS.successLight, fg: "#047857" },
  Medium: { bg: COLORS.warningLight, fg: "#92400E" },
  High: { bg: COLORS.criticalLight, fg: "#B91C1C" },
};

export const STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  New: { bg: COLORS.criticalLight, fg: "#B91C1C" },
  Acknowledged: { bg: COLORS.infoLight, fg: "#1D4ED8" },
  EnRoute: { bg: COLORS.warningLight, fg: "#92400E" },
  OnScene: { bg: COLORS.warningLight, fg: "#92400E" },
  Resolved: { bg: COLORS.successLight, fg: "#047857" },
};

export const SERVICE_ICON: Record<string, string> = {
  Ambulance: "medkit",
  Fire: "flame",
  Police: "shield-checkmark",
};
