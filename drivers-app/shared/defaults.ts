/** Facts copied from ride/sean/config.js and the booking-page copy.
 *  New drivers start from the template titles. Sean's airport detail is his. */

export const SERVICE_ICONS = ["plane", "bag", "glass", "road", "star"] as const;
export type ServiceIcon = (typeof SERVICE_ICONS)[number];

export type ServiceInput = {
  icon: ServiceIcon;
  title: string;
  detail: string;
};

export const DEFAULT_ACCENT = "#D4AF37";
export const DEFAULT_CITY = "";
export const DEFAULT_MAX_PASSENGERS = 4;
export const DEFAULT_SMS_MESSAGE = "Hi {firstName}, I have your card and I'd like to book a ride.";

export const DEFAULT_TRUST = [
  "Same driver every time",
  "Book ahead, no surge surprises (price confirmed by text)",
];

export const TEMPLATE_SERVICES: ServiceInput[] = [
  { icon: "plane", title: "Airport", detail: "" },
  { icon: "bag", title: "Errands", detail: "" },
  { icon: "glass", title: "Nights out", detail: "" },
  { icon: "road", title: "Long trips", detail: "" },
];

/** Sean's services, from ride/sean/config.js. Do not copy the airport detail onto other drivers. */
export const SEAN_SERVICES: ServiceInput[] = [
  { icon: "plane", title: "Airport", detail: "FLL / PBI / MIA" },
  { icon: "bag", title: "Errands", detail: "" },
  { icon: "glass", title: "Nights out", detail: "" },
  { icon: "road", title: "Long trips", detail: "" },
];

export const SEAN_CITY = "South Florida";
export const SEAN_FIRST_NAME = "Sean";
