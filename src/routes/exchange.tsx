import { createFileRoute } from "@tanstack/react-router";
import { VehicleJourney, type JourneyField } from "@/components/site/VehicleJourney";

const TITLE = "Exchange Your Car | Motor Wallah";
const DESCRIPTION =
  "Share your current car details and upgrade to your next certified pre-owned car.";

export const Route = createFileRoute("/exchange")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

const FIELDS: JourneyField[] = [
  { name: "registration", label: "Current Vehicle Registration Number", required: true, placeholder: "MP09 AB 1234" },
  {
    name: "ownership",
    label: "Ownership Status",
    type: "select",
    options: ["First Owner", "Second Owner", "Third Owner", "Fourth Owner or more"],
    required: true,
  },
  {
    name: "condition",
    label: "Vehicle Condition",
    type: "select",
    options: ["Excellent", "Good", "Average", "Needs Work"],
    required: true,
  },
  {
    name: "accidentHistory",
    label: "Accident History",
    type: "select",
    options: ["No Accident", "Minor Repair", "Major Repair", "Not Sure"],
    required: true,
  },
  {
    name: "insuranceStatus",
    label: "Insurance Status",
    type: "select",
    options: ["Valid Comprehensive", "Valid Third Party", "Expired", "Not Sure"],
    required: true,
  },
  {
    name: "serviceHistory",
    label: "Service History",
    type: "select",
    options: ["Full Authorised Service", "Partial Records", "Local Workshop", "No Records"],
    required: true,
  },
  { name: "currentKm", label: "Current Kilometres", type: "number", required: true, placeholder: "e.g. 45000" },
  {
    name: "desiredVehicle",
    label: "Desired Replacement Vehicle",
    required: true,
    placeholder: "e.g. Hyundai Creta",
  },
  {
    name: "preferredBudget",
    label: "Preferred Budget",
    type: "select",
    options: ["Under ₹5 Lakh", "₹5–10 Lakh", "₹10–20 Lakh", "₹20 Lakh+"],
    required: true,
  },
  { name: "name", label: "Your Name", required: true },
  { name: "mobile", label: "Mobile Number", type: "tel", required: true, placeholder: "10-digit mobile" },
  { name: "whatsapp", label: "WhatsApp Number", type: "tel", placeholder: "If different" },
  {
    name: "preferredContact",
    label: "Preferred Contact Method",
    type: "select",
    options: ["Call", "WhatsApp", "Either"],
    required: true,
  },
];

function Page() {
  return (
    <VehicleJourney
      title="Exchange Your Car"
      highlight="and Upgrade Easily"
      description="Select your current car details and get an exchange value towards your next certified pre-owned car."
      ctaLabel="Get Exchange Value"
      formTitle="Your Current Car & Exchange Preference"
      fields={FIELDS}
      leadType="exchange_car"
      source="exchange"
      whatsappMessage="Hi Motor Wallah, I want an exchange value for my car."
    />
  );
}
