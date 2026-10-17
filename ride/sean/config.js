/* =====================================================================
   DRIVER CONFIG: the only thing you edit to clone this page.
   Both index.html and thanks.html read from here.
   ===================================================================== */

// Driver's mobile, used for the "Text" button and the saved contact card.
// Leave it EMPTY until the driver has agreed, in writing, to publish it.
// Empty = the Text button is hidden and the contact card carries no phone.
// When set, use international format: a plus sign, country code, digits only.
const DRIVER_SMS = "";

const CONFIG = {
  firstName: "Sean",              // first name only, never a last name
  city: "South Florida",          // "Your personal driver in ___"
  accent: "#D4AF37",              // brand gold; any hex color works
  sms: DRIVER_SMS,
  smsMessage: "Hi {firstName}, I have your card and I'd like to book a ride.",
  bookingUrl: "",                 // optional full URL of this page; blank = current address
  maxPassengers: 4,

  // icon: plane | bag | glass | road | star
  services: [
    { icon: "plane", title: "Airport", detail: "FLL / PBI / MIA" },
    { icon: "bag",   title: "Errands" },
    { icon: "glass", title: "Nights out" },
    { icon: "road",  title: "Long trips" }
  ],

  // Keep these honest. Never claim licensing, insurance or certification.
  trust: [
    "Same driver every time",
    "Book ahead, no surge surprises (price confirmed by text)"
  ]
};
