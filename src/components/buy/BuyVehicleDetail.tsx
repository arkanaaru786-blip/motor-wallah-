import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  Car,
  ChevronRight,
  Flag,
  Fuel,
  Gauge,
  IndianRupee,
  MapPin,
  MessageCircle,
  Phone,
  Settings2,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";
import {
  buyListingHighlights,
  buyListingName,
  fuelLabel,
  getBuyCategory,
  lakhLabel,
  type BuyListing,
} from "@/lib/buy-catalog";
import { VehicleGallery } from "@/components/site/VehicleGallery";
import { EnquiryDialog } from "@/components/site/EnquiryDialog";
import { ContactSellerDialog } from "@/components/buy/ContactSellerDialog";
import { MakeOfferDialog } from "@/components/buy/MakeOfferDialog";
import { ReportListingDialog } from "@/components/buy/ReportListingDialog";
import { PHONE_HREF, whatsappLink } from "@/lib/site";
import { submitLead } from "@/lib/leads";

const NOT_SHARED = "Not shared by seller yet";

function Spec({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="buy-spec">
      <span className="buy-spec-icon" aria-hidden="true">
        {icon}
      </span>
      <span>
        <span className="buy-spec-label">{label}</span>
        <span className="buy-spec-value">{value}</span>
      </span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const muted = value === NOT_SHARED;
  return (
    <div className="buy-row">
      <dt>{label}</dt>
      <dd data-muted={muted || undefined}>{value}</dd>
    </div>
  );
}

export function BuyVehicleDetail({ listing }: { listing: BuyListing }) {
  const [contact, setContact] = useState(false);
  const [testDrive, setTestDrive] = useState(false);
  const [report, setReport] = useState(false);
  const [offer, setOffer] = useState(false);

  const category = getBuyCategory(listing.categoryId);
  const name = buyListingName(listing);
  const highlights = buyListingHighlights(listing);
  const sold = listing.status === "Sold";
  const enquiryText = `Hello MOTOR WALLAH, I am interested in the ${name} listed in ${listing.city}.`;

  const description =
    listing.description ??
    [
      `${name} is listed in ${listing.city}${category ? ` under ${category.label}` : ""}.`,
      `This ${listing.year} vehicle runs on ${fuelLabel(listing.fuel).toLowerCase()}${
        listing.transmission ? ` with a ${listing.transmission.toLowerCase()} transmission` : ""
      }${listing.kilometres !== null ? ` and shows ${listing.kilometres.toLocaleString("en-IN")} km` : ""}.`,
      listing.ownership ? `Ownership on record: ${listing.ownership}.` : "",
      "The seller has not added a written description for this listing yet. Specifications shown above come directly from the listing record.",
    ]
      .filter(Boolean)
      .join(" ");

  return (
    <div className="buy-detail">
      <div className="home-container">
        <nav className="buy-breadcrumb" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <ChevronRight size={13} aria-hidden="true" />
          <Link to="/buy">Buy</Link>
          {category && (
            <>
              <ChevronRight size={13} aria-hidden="true" />
              <Link to="/buy" search={{ category: category.id }}>
                {category.label}
              </Link>
            </>
          )}
          <ChevronRight size={13} aria-hidden="true" />
          <span>{listing.model}</span>
        </nav>

        <div className="buy-detail-layout">
          <div className="buy-detail-main">
            <VehicleGallery
              images={listing.images}
              alt={listing.photoAlt}
              className="buy-detail-gallery"
              overlay={
                <>
                  <span className="buy-detail-gallery-tags">
                    {listing.verified && (
                      <span className="buy-tag buy-tag--verified">
                        <BadgeCheck size={12} aria-hidden="true" /> Verified
                      </span>
                    )}
                    {listing.demo && <span className="buy-tag buy-tag--demo">Demo listing</span>}
                  </span>
                  <span className="buy-tag buy-tag--status buy-detail-status">
                    {listing.status}
                  </span>
                </>
              }
            />
            <p className="buy-photo-note">
              {listing.photoNote} Video is not uploaded for this listing.
            </p>

            <div className="buy-detail-heading">
              <p className="buy-kicker">
                <span>{listing.categoryLabel}</span> {listing.brand}
              </p>
              <h1 className="buy-detail-title">
                {listing.year} {listing.brand} {listing.model}
                {listing.variant ? ` ${listing.variant}` : ""}
              </h1>
              <p className="buy-detail-price">{lakhLabel(listing.priceLakh)}</p>
            </div>

            <div className="buy-highlights" aria-label="Vehicle highlights">
              {highlights.map((highlight) => (
                <span key={highlight} className="buy-highlight">
                  {highlight}
                </span>
              ))}
            </div>

            {/* Mobile: keep the two primary actions within reach, above the fold. */}
            <div className="buy-quick-actions">
              <button type="button" onClick={() => setContact(true)} className="buy-primary-button">
                <MessageCircle size={16} /> Enquire Now
              </button>
              <button
                type="button"
                disabled={sold}
                onClick={() => setTestDrive(true)}
                className="buy-secondary-button"
              >
                {sold ? "Sold" : "Book Test Drive"}
              </button>
              <button
                type="button"
                onClick={() => setOffer(true)}
                className="buy-secondary-button buy-secondary-button--offer"
              >
                <IndianRupee size={15} /> Make an Offer
              </button>
            </div>

            <div className="buy-specs">
              <Spec icon={<CalendarDays size={16} />} label="Year" value={String(listing.year)} />
              <Spec
                icon={<Car size={16} />}
                label="Body / type"
                value={listing.bodyType ?? listing.categoryLabel}
              />
              <Spec icon={<Fuel size={16} />} label="Fuel" value={fuelLabel(listing.fuel)} />
              {listing.transmission && (
                <Spec
                  icon={<Settings2 size={16} />}
                  label="Transmission"
                  value={listing.transmission}
                />
              )}
              {listing.kilometres !== null && (
                <Spec
                  icon={<Gauge size={16} />}
                  label="KM driven"
                  value={`${listing.kilometres.toLocaleString("en-IN")} km`}
                />
              )}
              <Spec icon={<MapPin size={16} />} label="City" value={listing.city} />
            </div>

            <section className="buy-panel" aria-labelledby="buy-description-title">
              <h2 id="buy-description-title" className="buy-panel-title">
                Vehicle description
              </h2>
              <p className="buy-description">{description}</p>
            </section>

            <section className="buy-panel" aria-labelledby="buy-history-title">
              <h2 id="buy-history-title" className="buy-panel-title">
                Ownership &amp; history
              </h2>
              <dl className="buy-rows">
                <Row label="Manufacturing year" value={String(listing.year)} />
                <Row
                  label="Registration year"
                  value={listing.registrationYear ? String(listing.registrationYear) : NOT_SHARED}
                />
                <Row label="Ownership" value={listing.ownership ?? NOT_SHARED} />
                <Row label="Insurance" value={NOT_SHARED} />
                <Row label="RC status" value={NOT_SHARED} />
                <Row label="Service history" value={NOT_SHARED} />
                <Row label="Accident history" value={NOT_SHARED} />
                <Row
                  label="Verification"
                  value={
                    listing.verified ? "Inspection completed by Motor Wallah" : "Not verified yet"
                  }
                />
              </dl>
            </section>

            <section className="buy-panel" aria-labelledby="buy-location-title">
              <h2 id="buy-location-title" className="buy-panel-title">
                Location
              </h2>
              <div className="buy-location">
                <MapPin size={18} aria-hidden="true" />
                <div>
                  <p className="buy-location-city">{listing.city}</p>
                  <p className="buy-location-area">
                    Locality / colony: {listing.locality ?? NOT_SHARED}
                  </p>
                </div>
              </div>
              <p className="buy-field-hint">
                No map is shown because this listing has no verified map coordinates yet. The exact
                address is shared by the Motor Wallah team before a visit.
              </p>
            </section>

            <button type="button" onClick={() => setReport(true)} className="buy-report-link">
              <Flag size={14} aria-hidden="true" /> Report this listing
            </button>
          </div>

          <aside className="buy-detail-aside">
            <div className="buy-action-panel">
              <p className="buy-action-price">{lakhLabel(listing.priceLakh)}</p>
              <p className="buy-action-name">
                {listing.year} {listing.brand} {listing.model}
              </p>
              {listing.verified ? (
                <p className="buy-action-verified">
                  <BadgeCheck size={15} aria-hidden="true" /> Verified by Motor Wallah
                </p>
              ) : (
                <p className="buy-action-unverified">
                  <ShieldCheck size={15} aria-hidden="true" /> Not verified yet — no inspection
                  recorded
                </p>
              )}

              <div className="buy-action-buttons">
                <button
                  type="button"
                  onClick={() => setContact(true)}
                  className="buy-primary-button"
                >
                  <MessageCircle size={16} /> Enquire Now
                </button>
                <button
                  type="button"
                  onClick={() => setOffer(true)}
                  className="buy-secondary-button buy-secondary-button--offer"
                >
                  <IndianRupee size={15} /> Make an Offer
                </button>
                <button
                  type="button"
                  disabled={sold}
                  onClick={() => setTestDrive(true)}
                  className="buy-secondary-button"
                >
                  {sold ? "Vehicle sold" : "Book Test Drive"}
                </button>
                <a href={PHONE_HREF} className="buy-secondary-button buy-secondary-button--link">
                  <Phone size={16} /> Call seller
                </a>
                <a
                  href={whatsappLink(enquiryText)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() =>
                    void submitLead({
                      type: "whatsapp_click",
                      source: "buy_detail",
                      vehicleId: listing.id,
                      vehicleName: name,
                      location: listing.city,
                    })
                  }
                  className="buy-secondary-button buy-secondary-button--link"
                >
                  <MessageCircle size={16} /> WhatsApp
                </a>
              </div>

              <p className="buy-action-note">
                Enquiries are captured in this project&apos;s lead queue (stored on this device). A
                live chat server is not connected yet.
              </p>
              <p className="buy-action-note">
                Test drive requests are requests only — a slot is confirmed after the seller
                confirms availability.
              </p>
            </div>

            <Link to="/buy" search={{ category: listing.categoryId }} className="buy-back-link">
              <ArrowLeft size={14} /> Back to {category?.label ?? "Buy"}
            </Link>
            <Link to="/sell-your-car" className="buy-sell-link">
              <ShoppingBag size={14} /> Sell your vehicle instead
            </Link>
          </aside>
        </div>
      </div>

      <ContactSellerDialog listing={listing} open={contact} onClose={() => setContact(false)} />
      <MakeOfferDialog listing={listing} open={offer} onClose={() => setOffer(false)} />
      <ReportListingDialog listing={listing} open={report} onClose={() => setReport(false)} />
      <EnquiryDialog
        open={testDrive}
        onClose={() => setTestDrive(false)}
        title="Book Test Drive"
        subject={{ id: listing.id, name, location: listing.city }}
        leadType="test_drive"
        source="buy_detail_test_drive"
        submitLabel="Request Test Drive"
        disclaimer={`This request is for the ${name}. Test drives depend on seller availability — your slot is confirmed only after the Motor Wallah team contacts you.`}
        fields={[
          { name: "name", label: "Customer name", required: true },
          { name: "mobile", label: "Mobile number", type: "tel", required: true },
          { name: "date", label: "Preferred date", type: "date", required: true },
          { name: "time", label: "Preferred time", type: "time", required: true },
          { name: "message", label: "Message (optional)", type: "textarea" },
        ]}
      />
    </div>
  );
}
