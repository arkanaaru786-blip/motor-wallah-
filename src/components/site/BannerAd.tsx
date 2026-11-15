import type { Banner, BannerSection } from "@/lib/banners";
import {
  activeBanner,
  bannerHref,
  opensInNewTab,
  trackBannerClick,
  useBanners,
} from "@/lib/banners";
import { useAdLeadDialog } from "@/components/site/AdLeadDialog";

/**
 * The ad slots the marketing team controls from the control room.
 *
 * A slot renders nothing at all until a row exists, is Active and has an image,
 * so an unused slot never shifts the layout. Every slot is one <a> around the
 * artwork: the click opens the target in a new tab and is counted in the
 * database (see track_banner_click in supabase/banners.sql).
 */

/** The artwork itself — an <img>, or an autoplaying muted MP4. */
export function BannerMedia({
  banner,
  className,
  width,
  height,
}: {
  banner: Banner;
  className?: string;
  width?: number;
  height?: number;
}) {
  if (banner.mediaType === "video") {
    return (
      <video
        className={className}
        src={banner.imageUrl}
        autoPlay
        muted
        loop
        playsInline
        aria-label={banner.title || "Advertisement"}
      />
    );
  }
  return (
    <img
      className={className}
      src={banner.imageUrl}
      alt={banner.title || "Advertisement"}
      loading="lazy"
      {...(width ? { width } : {})}
      {...(height ? { height } : {})}
    />
  );
}

/**
 * Anchor props for a banner: href plus the click counter. Returns null when the
 * row has no usable link and no enquiry form is attached, which is how a slot
 * stays un-clickable rather than linking nowhere.
 *
 * When `onCapture` is supplied a click no longer leaves the page: it opens the
 * ad enquiry form instead. The target is kept on the anchor for middle-click
 * and for the “Continue to advertiser” action after the form is sent.
 */
export function bannerLinkProps(banner: Banner, onCapture?: (banner: Banner) => void) {
  const href = bannerHref(banner);
  if (!href && !onCapture) return null;
  return {
    href: href ?? "#",
    onClick: (event: React.MouseEvent<HTMLAnchorElement>) => {
      if (onCapture) {
        event.preventDefault();
        onCapture(banner);
      }
      void trackBannerClick(banner.section);
    },
    ...(href && opensInNewTab(href)
      ? { target: "_blank", rel: "noopener noreferrer sponsored" }
      : { rel: "sponsored" }),
    ...(onCapture ? { "aria-haspopup": "dialog" as const } : {}),
  };
}

/** A standalone ad block: the whole artwork is a link when a target URL is set. */
export function BannerAd({
  section,
  className = "",
  label = "Advertisement",
}: {
  section: BannerSection;
  className?: string;
  label?: string;
}) {
  const { banners } = useBanners();
  const banner = activeBanner(section, banners);
  const { captureAdLead, adLeadDialog } = useAdLeadDialog();
  if (!banner) return null;
  const link = bannerLinkProps(banner, captureAdLead);

  const content = (
    <>
      <BannerMedia banner={banner} className="mw-ad-media" />
      {banner.title ? <span className="mw-ad-title">{banner.title}</span> : null}
    </>
  );

  return (
    <section
      className={`mw-ad ${className}`.trim()}
      aria-label={label}
      data-testid={`ad-${section}`}
    >
      <span className="mw-ad-tag">{label}</span>
      {link ? (
        <a className="mw-ad-link" {...link}>
          {content}
        </a>
      ) : (
        <div className="mw-ad-link">{content}</div>
      )}
      {adLeadDialog}
    </section>
  );
}
