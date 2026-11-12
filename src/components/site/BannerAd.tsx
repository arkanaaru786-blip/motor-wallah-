import type { Banner, BannerSection } from "@/lib/banners";
import {
  activeBanner,
  bannerHref,
  opensInNewTab,
  trackBannerClick,
  useBanners,
} from "@/lib/banners";

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
 * row has no usable link, which is how a slot stays un-clickable rather than
 * linking nowhere.
 */
export function bannerLinkProps(banner: Banner) {
  const href = bannerHref(banner);
  if (!href) return null;
  return {
    href,
    onClick: () => {
      void trackBannerClick(banner.section);
    },
    ...(opensInNewTab(href)
      ? { target: "_blank", rel: "noopener noreferrer sponsored" }
      : { rel: "sponsored" }),
  };
}

/** A standalone ad block: the whole artwork is one link. */
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
  if (!banner) return null;
  const link = bannerLinkProps(banner);
  if (!link) return null;

  return (
    <section className={`mw-ad ${className}`.trim()} aria-label={label} data-testid={`ad-${section}`}>
      <span className="mw-ad-tag">{label}</span>
      <a className="mw-ad-link" {...link}>
        <BannerMedia banner={banner} className="mw-ad-media" />
        {banner.title ? <span className="mw-ad-title">{banner.title}</span> : null}
      </a>
    </section>
  );
}
