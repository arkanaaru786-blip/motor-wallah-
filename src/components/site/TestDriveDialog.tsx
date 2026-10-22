import { LOCATIONS, type Vehicle } from "@/lib/cars-data";
import { EnquiryDialog } from "@/components/site/EnquiryDialog";

export function TestDriveDialog({
  vehicle,
  open,
  onClose,
}: {
  vehicle: Vehicle;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <EnquiryDialog
      open={open}
      onClose={onClose}
      title="Book Test Drive"
      vehicle={vehicle}
      leadType="test_drive"
      source="test_drive_form"
      submitLabel="Request Test Drive"
      fields={[
        { name: "name", label: "Name", required: true },
        { name: "mobile", label: "Mobile Number", type: "tel", required: true },
        { name: "date", label: "Preferred Date", type: "date", required: true },
        { name: "time", label: "Preferred Time", type: "time", required: true },
        { name: "city", label: "City", type: "select", options: LOCATIONS, defaultValue: vehicle.location },
        { name: "message", label: "Message", type: "textarea" },
      ]}
    />
  );
}
