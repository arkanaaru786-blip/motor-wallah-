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
  Navigation,
  Phone,
  Settings2,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";
import {
  buyListingHighlights,
  fuelLabel,
  getBuyCategory,
  rupees,
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

const priceRupees = (lakh: number) => rupees(Math.round(lakh * 100000));

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
  const name = [listing.brand, listing.model, listing.variant].filter(Boolean).join(" ");
  const fullName = `${listing.year} ${name}`;
  const highlights = buyListingHighlights(listing);
  const sold = listing.status === "Sold";
  const enquiryText = `Hello MOTOR WALLAH, I am interested in the ${name} listed in ${listing.city}.`;
  const mapQuery = `${listing.city}, Madhya Pradesh`;

  const description =
    listing.description ??
    [
      `${fullName} is listed in ${listing.city}${category ? ` under ${category.label}` : ""}.`,
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

            {/* Mobile-first heading — the desktop heading lives in the right column. */}
            <div className="buy-detail-heading buy-detail-heading--mobile">
              <p className="buy-kicker">
                <span>{listing.categoryLabel}</span> {listing.brand}
              </p>
              <h1 className="buy-detail-title">{name}</h1>
              <p className="buy-detail-price">{priceRupees(listing.priceLakh)}</p>
            </div>

            {/* Mobile: keep the primary actions within reach, above the fold. */}
            <div className="buy-quick-actions">
              <button type="button" onClick={() => setContact(true)} className="buy-primary-button">
                <MessageCircle size={16} /> Contact Seller
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

            <button type="button" onClick={() => setReport(true)} className="buy-report-link">
              <Flag size={14} aria-hidden="true" /> Report this listing
            </button>
          </div>

          <aside className="buy-detail-aside">
            <div className="buy-action-panel">
              {/* Desktop heading — right column per the reference design. */}
              <div className="buy-detail-heading buy-detail-heading--aside">
                <p className="buy-kicker">
                  <span>{listing.categoryLabel}</span> {listing.brand}
                </p>
                <p className="buy-detail-title">{name}</p>
                <p className="buy-detail-price">{priceRupees(listing.priceLakh)}</p>
              </div>

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

              <div className="buy-highlights" aria-label="Vehicle highlights">
                {highlights.map((highlight) => (
                  <span key={highlight} className="buy-highlight">
                    {highlight}
                  </span>
                ))}
              </div>

              <div className="buy-specs">
                <Spec icon={<CalendarDays size={16} />} label="Year" value={String(listing.year)} />
                <Spec icon={<Fuel size={16} />} label="Fuel" value={fuelLabel(listing.fuel)} />
                <Spec
                  icon={<Car size={16} />}
                  label="Type"
                  value={listing.bodyType ?? listing.categoryLabel}
                />
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

              <section className="buy-panel buy-panel--location" aria-labelledby="buy-location-title">
                <h2 id="buy-location-title" className="buy-panel-title">
                  Location
                </h2>
                <div
                  className="buy-map"
                  role="img"
                  aria-label={`Approximate map of ${listing.city}, Madhya Pradesh`}
                >
                  <span className="buy-map-grid" aria-hidden="true" />
                  <span className="buy-map-road buy-map-road--a" aria-hidden="true" />
                  <span className="buy-map-road buy-map-road--b" aria-hidden="true" />
                  <span className="buy-map-pin" aria-hidden="true">
                    <MapPin size={18} />
                  </span>
                  <span className="buy-map-label" aria-hidden="true">
                    {listing.city}
                  </span>
                </div>
                <div className="buy-location">
                  <MapPin size={18} aria-hidden="true" />
                  <div>
                    <p className="buy-location-city">{listing.city}, Madhya Pradesh</p>
                    <p className="buy-location-area">
                      Locality / colony: {listing.locality ?? NOT_SHARED}
                    </p>
                  </div>
                </div>
                <a
                  className="buy-map-link"
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Navigation size={13} aria-hidden="true" /> View on Map
                </a>
                <p className="buy-field-hint">
                  The pin marks the listing city only — the exact address is shared by the Motor
                  Wallah team before a visit.
                </p>
              </section>

              <div className="buy-action-buttons">
                <button
                  type="button"
                  onClick={() => setContact(true)}
                  className="buy-primary-button"
                >
                  <MessageCircle size={16} /> Contact Seller
                </button>
                <button
                  type="button"
                  disabled={sold}
                  onClick={() => setTestDrive(true)}
                  className="buy-secondary-button"
                >
                  {sold ? "Vehicle sold" : "Book Test Drive"}
                </button>
                <button
                  type="button"
                  onClick={() => setOffer(true)}
                  className="buy-secondary-button buy-secondary-button--offer"
                >
                  <IndianRupee size={15} /> Make an Offer
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
                      vehicleName: fullName,
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
        subject={{ id: listing.id, name: fullName, location: listing.city }}
        leadType="test_drive"
        source="buy_detail_test_drive"
        submitLabel="Request Test Drive"
        disclaimer={`This request is for the ${fullName}. Test drives depend on seller availability — your slot is confirmed only after the Motor Wallah team contacts you.`}
        fields={[
          { name: "name", label: "Full name", required: true },
          { name: "mobile", label: "Mobile number", type: "tel", required: true },
          { name: "date", label: "Preferred date", type: "date", required: true },
          { name: "time", label: "Preferred time", type: "time", required: true },
          { name: "message", label: "Message (optional)", type: "textarea" },
        ]}
      />
    </div>
  );
}
