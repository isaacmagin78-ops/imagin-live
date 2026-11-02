import type { ServiceIcon } from "./defaults.ts";

export type Role = "admin" | "partner" | "driver";
export type Plan = "none" | "starter" | "monthly";
export type RequestStatus = "requested" | "quoted" | "confirmed" | "declined" | "cancelled";
export type FeeKind = "setup" | "monthly";

export type Service = {
  icon: ServiceIcon;
  title: string;
  detail: string;
};

export type SessionUser = {
  id: string;
  email: string;
  role: Role;
  displayName: string;
  partnerId: string | null;
  driverId: string | null;
  driverSlug: string | null;
};

export type PublicDriver = {
  slug: string;
  firstName: string;
  city: string;
  accent: string;
  sms: string | null;
  smsMessage: string;
  maxPassengers: number;
  services: Service[];
  trust: string[];
  bookingUrl: string;
  active: true;
};

export type DriverProfile = {
  id: string;
  slug: string;
  firstName: string;
  city: string;
  accent: string;
  sms: string;
  smsPublish: boolean;
  smsMessage: string;
  maxPassengers: number;
  active: boolean;
  plan: Plan;
  planStartedOn: string | null;
  partnerId: string | null;
  partnerName: string | null;
  services: Service[];
  trust: string[];
  bookingUrl: string;
  sourceNote: string;
};

export type RideRequest = {
  id: string;
  code: string;
  driverId: string;
  driverFirstName: string;
  driverSlug: string;
  riderName: string;
  riderMobile: string;
  pickup: string;
  dropoff: string;
  rideDate: string;
  rideTime: string;
  passengers: number;
  notes: string;
  status: RequestStatus;
  quoteAmountCents: number | null;
  quoteNote: string | null;
  quotedPickupTime: string | null;
  quotedAt: string | null;
  confirmedAt: string | null;
  createdAt: string;
  statusUrl: string;
};

/** Rider-facing status. Omits the mobile number. */
export type PublicRequest = {
  code: string;
  driverFirstName: string;
  driverSlug: string;
  city: string;
  accent: string;
  sms: string | null;
  smsMessage: string;
  status: RequestStatus;
  pickup: string;
  dropoff: string;
  rideDate: string;
  rideTime: string;
  passengers: number;
  notes: string;
  quoteAmountCents: number | null;
  quoteNote: string | null;
  quotedPickupTime: string | null;
  bookingUrl: string;
  statusUrl: string;
};

export type FeeEvent = {
  id: string;
  driverId: string;
  driverFirstName: string;
  partnerId: string | null;
  kind: FeeKind;
  amountCents: number;
  partnerCutCents: number;
  note: string;
  recordedAt: string;
};

export type NotificationRow = {
  id: string;
  kind: string;
  toAddress: string;
  body: string;
  status: string;
  detail: string;
  relatedType: string;
  relatedId: string;
  createdAt: string;
};

export type PartnerDriverRow = {
  id: string;
  firstName: string;
  slug: string;
  city: string;
  plan: Plan;
  active: boolean;
  feeCents: number;
  cutCents: number;
};

export type PartnerOverview = {
  displayName: string;
  cutPercent: number;
  setupCents: number;
  monthlyCents: number;
  recordedCutCents: number;
  recordedFeeCents: number;
  drivers: PartnerDriverRow[];
  disclaimer: string;
};
