import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  MessageCircle,
  Minus,
  Phone,
  Plus,
  ShoppingBag,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { StickyActions } from "@/components/site/StickyActions";
import { BrandArt } from "@/components/buy/BrandArt";
import {
  BUY_CATEGORY_LIST,
  brandTilesFor,
  catalogModelsFor,
  getBuyCategory,
  type BuyCategoryId,
} from "@/lib/buy-catalog";
import { submitLead } from "@/lib/leads";
import {
  PART_CATEGORY_LIST,
  buildProducts,
  cartCount,
  cartTotal,
  getPartCategory,
  newOrderId,
  readCart,
  rupees,
  writeCart,
  type CartLine,
} from "@/lib/parts-store";
import { PHONE_DISPLAY, PHONE_HREF, whatsappLink } from "@/lib/site";

const TITLE = "Auto Parts Store — Car & Bike Parts Online | Motor Wallah";
const DESCRIPTION =
  "Pick your vehicle, brand and model, choose a parts category and shop from a Flipkart-style grid of parts — prepaid checkout with delivery across India from Motor Wallah.";

export const Route = createFileRoute("/accessories")({
  validateSearch: (search: Record<string, unknown>): PartsSearch => {
    const step = search["step"];
    const cat = search["cat"];
    return {
      step:
        step === "brand" ||
        step === "model" ||
        step === "parts" ||
        step === "shop" ||
        step === "checkout" ||
        step === "done"
          ? step
          : undefined,
      cat: isCategoryId(cat) ? cat : undefined,
      brand: typeof search["brand"] === "string" ? search["brand"] : undefined,
      model: typeof search["model"] === "string" ? search["model"] : undefined,
      part: typeof search["part"] === "string" ? search["part"] : undefined,
    };
  },
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

type PartsSearch = {
  /** URL-driven e-commerce steps: /accessories = vehicle grid, then brand,
   *  model, parts, shop, checkout, done — always in that order. */
  step?: "brand" | "model" | "parts" | "shop" | "checkout" | "done" | undefined;
  cat?: BuyCategoryId | undefined;
  brand?: string | undefined;
  model?: string | undefined;
  part?: string | undefined;
};

const isCategoryId = (value: unknown): value is BuyCategoryId =>
  typeof value === "string" && BUY_CATEGORY_LIST.some((c) => c.id === value);

const STEP_STRIP = [
  "Vehicle",
  "Brand & Model",
  "Part Category",
  "Products",
  "Order",
] as const;

type Step = "vehicle" | "brand" | "model" | "parts" | "shop" | "checkout" | "done";

type Order = { id: string; name: string; mobile: string; total: number; items: number };

function Page() {
  const navigate = useNavigate();
  const { step, cat, brand, model, part } = Route.useSearch();

  const [cart, setCart] = useState<CartLine[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [condition, setCondition] = useState<"all" | "New" | "Used">("all");
  const [sort, setSort] = useState<"price" | "discount">("price");
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const pendingScroll = useRef<string | null>(null);

  // Cart survives step navigation (per device).
  useEffect(() => setCart(readCart()), []);
  const updateCart = (lines: CartLine[]) => {
    setCart(lines);
    writeCart(lines);
  };

  const vehicle = getBuyCategory(cat) ?? null;
  // Without an explicit step the first screen is ALWAYS the vehicle grid.
  const activeStep: Step = step ?? "vehicle";

  const brands = vehicle ? brandTilesFor(vehicle.id) : [];
  const brandOk = Boolean(vehicle && brand && brands.some((b) => b.brand === brand));
  const models = vehicle && brandOk ? catalogModelsFor(vehicle.id, brand!) : [];
  const modelOk = Boolean(model && models.includes(model));
  const partCat = getPartCategory(part);
  const products = useMemo(
    () => (activeStep === "shop" && partCat && brandOk && modelOk ? buildProducts(partCat.id, brand!, model!) : []),
    [activeStep, partCat, brandOk, modelOk, brand, model],
  );

  // Step strip index for the hero progress bar.
  const stepIndex =
    activeStep === "vehicle"
      ? 0
      : activeStep === "brand" || activeStep === "model"
        ? 1
        : activeStep === "parts"
          ? 2
          : activeStep === "shop"
            ? 3
            : 4;

  // Deferred scroll: runs only after the step change has actually rendered.
  useEffect(() => {
    const id = pendingScroll.current;
    if (!id) return;
    pendingScroll.current = null;
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activeStep, cat, brand, model, part]);

  // Defensive fallback — every step requires the previous selections, and the
  // checkout/done steps require something to exist. Always returns to the grid.
  useEffect(() => {
    const invalid =
      (activeStep === "brand" && !vehicle) ||
      (activeStep === "model" && (!vehicle || !brandOk)) ||
      (activeStep === "parts" && (!vehicle || !brandOk || !modelOk)) ||
      (activeStep === "shop" && (!vehicle || !brandOk || !modelOk || !partCat)) ||
      (activeStep === "checkout" && cart.length === 0 && !order) ||
      (activeStep === "done" && !order);
    if (!invalid) return;
    const timer = window.setTimeout(() => {
      navigate({ to: "/accessories", search: {}, replace: true });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [activeStep, vehicle, brandOk, modelOk, partCat, cart.length, order, navigate]);

  const go = (search: PartsSearch) => {
    setError(null);
    navigate({ to: "/accessories", search });
  };

  const pickVehicle = (id: BuyCategoryId) => {
    pendingScroll.current = "parts-step";
    go({ step: "brand", cat: id });
  };
  const pickBrand = (value: string) => {
    pendingScroll.current = "parts-step";
    go({ step: "model", cat: cat!, brand: value });
  };
  const pickModel = (value: string) => {
    pendingScroll.current = "parts-step";
    go({ step: "parts", cat: cat!, brand: brand!, model: value });
  };
  const pickPart = (id: string) => {
    pendingScroll.current = "parts-step";
    setCondition("all");
    setSort("price");
    go({ step: "shop", cat: cat!, brand: brand!, model: model!, part: id });
  };

  const addLine = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product || !partCat) return;
    const key = `${partCat.id}:${product.id}`;
    const existing = cart.find((l) => l.key === key);
    const lines = existing
      ? cart.map((l) => (l.key === key ? { ...l, qty: Math.min(9, l.qty + 1) } : l))
      : [
          ...cart,
          {
            key,
            productId: product.id,
            name: product.name,
            price: product.price,
            qty: 1,
            partLabel: partCat.label,
          },
        ];
    updateCart(lines);
    setError(null);
  };

  const setQty = (key: string, delta: number) =>
    updateCart(
      cart
        .map((l) => (l.key === key ? { ...l, qty: Math.max(0, Math.min(9, l.qty + delta)) } : l))
        .filter((l) => l.qty > 0),
    );

  const buyNow = (productId: string) => {
    addLine(productId);
    pendingScroll.current = "parts-step";
    go({ step: "checkout", cat: cat!, brand: brand!, model: model!, part: part! });
  };

  const openCheckout = () => {
    pendingScroll.current = "parts-step";
    go({ step: "checkout", cat: cat!, brand: brand!, model: model!, part: part! });
  };

  const placeOrder = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value = (key: string) => String(data.get(key) ?? "").trim().slice(0, 500);
    const name = value("name");
    const mobile = value("mobile");
    const city = value("city");

    if (!name || !city) return setError("Please fill in your name and delivery city.");
    if (!/^[0-9+ ]{10,15}$/.test(mobile)) return setError("Please enter a valid 10-digit mobile number.");
    if (cart.length === 0) return setError("Your cart is empty.");

    const total = cartTotal(cart);
    const id = newOrderId();

    // Saved to the project's lead queue (and CRM endpoint when configured).
    await submitLead({
      type: "parts_enquiry",
      source: "accessories_checkout",
      vehicleName: `${brand ?? ""} ${model ?? ""}`.trim() || undefined,
      name,
      mobile,
      fields: {
        orderId: id,
        payment: "Prepaid only (UPI / Card / Net Banking)",
        vehicleCategory: vehicle?.label ?? "",
        brand: brand ?? "",
        model: model ?? "",
        city,
        total: String(total),
        items: cart.map((l) => `${l.name} x${l.qty} (${rupees(l.price)})`).join("; "),
        itemLines: String(cartCount(cart)),
      },
    });

    setOrder({ id, name, mobile, total, items: cartCount(cart) });
    updateCart([]);
    pendingScroll.current = "parts-step";
    go({ step: "done", cat: cat!, brand: brand!, model: model! });
  };

  const whatsapp = whatsappLink("Hi Motor Wallah, I want to order vehicle parts.");
  const shownProducts = products
    .filter((p) => condition === "all" || p.condition === condition)
    .sort((a, b) =>
      sort === "price" ? a.price - b.price : b.discount - a.discount,
    );
  const count = cartCount(cart);

  return (
    <div id="top" className="mw-sell mw-parts min-h-screen pb-14 md:pb-0">
      <SiteHeader />
      <main>
        {/* ---------------- Hero + step strip ---------------- */}
        <section className="mw-sell-hero">
          <div className="home-container">
            <p className="mw-sell-hero-kicker">
              <span aria-hidden="true" /> Auto Parts Store · Motor Wallah marketplace
            </p>
            <h1 className="mw-sell-hero-title">
              Parts & <em>Accessories</em>
            </h1>
            <p className="mw-sell-hero-text">
              Choose your vehicle, brand and model — see only the parts that fit it. Prepaid
              checkout with fast delivery, backed by the Motor Wallah team.
            </p>
            <div className="mw-sell-hero-actions">
              <a className="mw-sell-ghost-btn" href={whatsapp} target="_blank" rel="noopener noreferrer">
                <MessageCircle size={14} /> WhatsApp Us
              </a>
              <a className="mw-sell-ghost-btn" href={PHONE_HREF}>
                <Phone size={14} /> Call {PHONE_DISPLAY}
              </a>
            </div>
            <div className="mw-sell-steps" aria-label="Shopping flow steps">
              {STEP_STRIP.map((label, i) => (
                <span
                  key={label}
                  className={`mw-sell-step${i === stepIndex ? " mw-sell-step--active" : ""}`}
                >
                  {i + 1}. {label}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Floating glass cart button — visible across every step. */}
        <button
          type="button"
          data-testid="cart-button"
          className="mw-parts-cartbtn"
          onClick={() => setDrawerOpen(true)}
          aria-label={`Open cart, ${count} item${count === 1 ? "" : "s"}`}
        >
          <ShoppingCart size={17} aria-hidden="true" />
          <span>Cart</span>
          <strong data-testid="cart-count">{count}</strong>
        </button>

        {/* ---------------- Step 1: vehicle category grid (FIRST screen) ---------------- */}
        {activeStep === "vehicle" && (
          <section id="parts-step" className="mw-sell-section" aria-labelledby="parts-vehicle-title">
            <div className="home-container">
              <p className="mw-sell-kicker">
                <span aria-hidden="true" /> Step 1 · Choose your vehicle
              </p>
              <h2 id="parts-vehicle-title" className="mw-sell-title">
                What do you need <span>parts for?</span>
              </h2>
              <p className="mw-sell-text">
                Pick a vehicle category first — we then show brands and models so you only see
                parts that actually fit.
              </p>

              <div className="mw-sell-grid">
                {BUY_CATEGORY_LIST.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    data-category={item.id}
                    className="mw-sell-cat"
                    onClick={() => pickVehicle(item.id)}
                    aria-label={`Shop parts for ${item.label}`}
                  >
                    <span className="mw-sell-cat-media">
                      <img
                        src={item.image}
                        alt={`${item.label} illustrative vehicle photograph`}
                        width={720}
                        height={450}
                        loading="lazy"
                      />
                    </span>
                    <span className="mw-sell-cat-body">
                      <span className="mw-sell-cat-name">{item.label}</span>
                      <span className="mw-sell-cat-blurb">{item.blurb}</span>
                    </span>
                    <span className="mw-sell-cat-arrow" aria-hidden="true">
                      <ArrowRight size={15} />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ---------------- Step 2a: brand selection with logos ---------------- */}
        {activeStep === "brand" && vehicle && (
          <section id="parts-step" className="mw-sell-section" aria-labelledby="parts-brand-title">
            <div className="home-container">
              <div className="mw-sell-form-head">
                <button type="button" className="mw-sell-back" onClick={() => go({})}>
                  <ArrowLeft size={14} /> Change vehicle
                </button>
                <span className="mw-sell-chip">
                  <ShoppingBag size={15} aria-hidden="true" />
                  <span>
                    Shopping for <small>{vehicle.label}</small>
                  </span>
                </span>
              </div>

              <p className="mw-sell-kicker">
                <span aria-hidden="true" /> Step 2 · Choose your brand
              </p>
              <h2 id="parts-brand-title" className="mw-sell-title">
                Select a <span>brand</span>
              </h2>
              <p className="mw-sell-text">
                Brands for {vehicle.label} — pick one to choose its models.
              </p>

              <div className="mw-parts-brands">
                {brands.map((item) => (
                  <button
                    key={item.brand}
                    type="button"
                    data-testid="brand-card"
                    className="mw-parts-brand"
                    onClick={() => pickBrand(item.brand)}
                  >
                    <span className="mw-parts-brand-logo">
                      <BrandArt brand={item.brand} />
                    </span>
                    <span className="mw-parts-brand-name">{item.brand.replace(/\s*\(.*?\)\s*/g, "")}</span>
                    <span className="mw-parts-brand-count">
                      {item.count} listing{item.count === 1 ? "" : "s"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ---------------- Step 2b: model selection ---------------- */}
        {activeStep === "model" && vehicle && brandOk && (
          <section id="parts-step" className="mw-sell-section" aria-labelledby="parts-model-title">
            <div className="home-container">
              <div className="mw-sell-form-head">
                <button type="button" className="mw-sell-back" onClick={() => go({ step: "brand", cat: cat! })}>
                  <ArrowLeft size={14} /> Change brand
                </button>
                <span className="mw-sell-chip">
                  <ShoppingBag size={15} aria-hidden="true" />
                  <span>
                    {brand} <small>{vehicle.label}</small>
                  </span>
                </span>
              </div>

              <p className="mw-sell-kicker">
                <span aria-hidden="true" /> Step 2 · Choose your model
              </p>
              <h2 id="parts-model-title" className="mw-sell-title">
                Select a <span>model</span>
              </h2>
              <p className="mw-sell-text">
                Only parts listed for {brand} models will be shown.
              </p>

              <div className="mw-parts-models" data-testid="model-list">
                {models.map((m) => (
                  <button
                    key={m}
                    type="button"
                    data-testid="model-chip"
                    className="mw-parts-model"
                    onClick={() => pickModel(m)}
                  >
                    {m} <ChevronRight size={14} aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ---------------- Step 3: parts category grid ---------------- */}
        {activeStep === "parts" && vehicle && brandOk && modelOk && (
          <section id="parts-step" className="mw-sell-section" aria-labelledby="parts-cat-title">
            <div className="home-container">
              <div className="mw-sell-form-head">
                <button
                  type="button"
                  className="mw-sell-back"
                  onClick={() => go({ step: "model", cat: cat!, brand: brand! })}
                >
                  <ArrowLeft size={14} /> Change model
                </button>
                <span className="mw-sell-chip">
                  <ShoppingBag size={15} aria-hidden="true" />
                  <span>
                    {brand} {model} <small>{vehicle.label}</small>
                  </span>
                </span>
              </div>

              <p className="mw-sell-kicker">
                <span aria-hidden="true" /> Step 3 · Choose a parts category
              </p>
              <h2 id="parts-cat-title" className="mw-sell-title">
                What does your <span>{model}</span> need?
              </h2>
              <p className="mw-sell-text">
                Every category opens a storefront of parts made for {brand} {model}.
              </p>

              <div className="mw-parts-cats">
                {PART_CATEGORY_LIST.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-testid="part-card"
                      className="mw-parts-cat"
                      onClick={() => pickPart(item.id)}
                    >
                      <span className="mw-parts-cat-icon">
                        <Icon size={30} strokeWidth={1.5} aria-hidden="true" />
                      </span>
                      <span className="mw-parts-cat-name">{item.label}</span>
                      <span className="mw-parts-cat-blurb">{item.blurb}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* ---------------- Step 4: product listing (storefront) ---------------- */}
        {activeStep === "shop" && vehicle && brandOk && modelOk && partCat && (
          <section id="parts-step" className="mw-sell-section" aria-labelledby="parts-shop-title">
            <div className="home-container">
              {/* Glass breadcrumb — every earlier step is one click away. */}
              <nav className="mw-parts-crumbs" aria-label="Store path">
                <button type="button" onClick={() => go({})}>Vehicle</button>
                <ChevronRight size={13} aria-hidden="true" />
                <button type="button" onClick={() => go({ step: "brand", cat: cat! })}>
                  {vehicle.label}
                </button>
                <ChevronRight size={13} aria-hidden="true" />
                <button type="button" onClick={() => go({ step: "model", cat: cat!, brand: brand! })}>
                  {brand}
                </button>
                <ChevronRight size={13} aria-hidden="true" />
                <button
                  type="button"
                  onClick={() =>
                    go({ step: "parts", cat: cat!, brand: brand!, model: model! })
                  }
                >
                  {model}
                </button>
                <ChevronRight size={13} aria-hidden="true" />
                <span aria-current="page">{partCat.label}</span>
              </nav>

              <p className="mw-sell-kicker">
                <span aria-hidden="true" /> Step 4 · {partCat.label}
              </p>
              <h2 id="parts-shop-title" className="mw-sell-title">
                {partCat.label} <span>for {model}</span>
              </h2>

              {/* Glass filter bar */}
              <div className="mw-parts-filters">
                <div className="mw-parts-filter-group" role="group" aria-label="Condition">
                  <span>Condition</span>
                  {(["all", "New", "Used"] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={condition === c ? "is-active" : ""}
                      onClick={() => setCondition(c)}
                    >
                      {c === "all" ? "All" : c}
                    </button>
                  ))}
                </div>
                <div className="mw-parts-filter-group" role="group" aria-label="Sort">
                  <span>Sort</span>
                  <button
                    type="button"
                    className={sort === "price" ? "is-active" : ""}
                    onClick={() => setSort("price")}
                  >
                    Price ↑
                  </button>
                  <button
                    type="button"
                    className={sort === "discount" ? "is-active" : ""}
                    onClick={() => setSort("discount")}
                  >
                    Discount ↓
                  </button>
                </div>
                <span className="mw-parts-filter-count">
                  {shownProducts.length} part{shownProducts.length === 1 ? "" : "s"}
                </span>
              </div>

              {shownProducts.length === 0 ? (
                <p className="mw-parts-empty">
                  No {condition.toLowerCase()} parts in this category — try "All".
                </p>
              ) : (
                <div className="mw-parts-products">
                  {shownProducts.map((product) => {
                    const Icon = partCat.icon;
                    return (
                      <article key={product.id} className="mw-parts-product" data-testid="product-card">
                        <div className="mw-parts-product-media" aria-hidden="true">
                          <Icon size={54} strokeWidth={1.2} />
                          <span className={`mw-parts-badge${product.condition === "Used" ? " is-used" : ""}`}>
                            {product.condition}
                          </span>
                        </div>
                        <div className="mw-parts-product-body">
                          <h3 className="mw-parts-product-name">{product.name}</h3>
                          <p className="mw-parts-product-meta">
                            <span className="mw-parts-rating">
                              ★ {product.rating} ★ <small>({product.reviews})</small>
                            </span>
                            {product.assured && (
                              <span className="mw-parts-assured">Motor Wallah Assured</span>
                            )}
                          </p>
                          <p className="mw-parts-product-price">
                            <strong>{rupees(product.price)}</strong>
                            <del>{rupees(product.mrp)}</del>
                            <em>{product.discount}% off</em>
                          </p>
                          <p className="mw-parts-product-eta">
                            Free delivery by{" "}
                            {new Date(
                              Date.now() + product.etaDays * 86400000,
                            ).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          </p>
                          <div className="mw-parts-product-actions">
                            <button
                              type="button"
                              data-testid="add-to-cart"
                              className="mw-parts-addcart"
                              onClick={() => addLine(product.id)}
                            >
                              <ShoppingCart size={14} /> Add to Cart
                            </button>
                            <button
                              type="button"
                              data-testid="buy-now"
                              className="mw-parts-buynow"
                              onClick={() => buyNow(product.id)}
                            >
                              Buy Now
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              <p className="mw-parts-prepaid-note" data-testid="prepaid-notice">
                Prepaid only — UPI, Card or Net Banking. Cash on Delivery is not available.
              </p>
            </div>
          </section>
        )}

        {/* ---------------- Step 5: prepaid checkout ---------------- */}
        {activeStep === "checkout" && cart.length > 0 && (
          <section id="parts-step" className="mw-sell-form-section" aria-labelledby="parts-checkout-title">
            <div className="home-container">
              <div className="mw-sell-form-head">
                <button
                  type="button"
                  className="mw-sell-back"
                  onClick={() =>
                    go({ step: "shop", cat: cat!, brand: brand!, model: model!, part: part! })
                  }
                >
                  <ArrowLeft size={14} /> Back to products
                </button>
                <span className="mw-sell-chip">
                  <ShoppingBag size={15} aria-hidden="true" />
                  <span>
                    Checkout <small>{count} item{count === 1 ? "" : "s"}</small>
                  </span>
                </span>
              </div>

              <form className="mw-sell-form mw-parts-checkout" onSubmit={placeOrder}>
                <h2 id="parts-checkout-title" className="mw-sell-form-title">
                  Prepaid <span>Checkout</span>
                </h2>
                <p className="mw-sell-form-sub">
                  {brand} {model} · {vehicle?.label} parts. Fields marked * are required.
                </p>

                <ul className="mw-parts-orderlines">
                  {cart.map((line) => (
                    <li key={line.key}>
                      <span className="mw-parts-orderline-name">{line.name}</span>
                      <span className="mw-parts-qty">
                        <button
                          type="button"
                          aria-label={`Reduce quantity of ${line.name}`}
                          onClick={() => setQty(line.key, -1)}
                        >
                          <Minus size={12} />
                        </button>
                        <b>{line.qty}</b>
                        <button
                          type="button"
                          aria-label={`Increase quantity of ${line.name}`}
                          onClick={() => setQty(line.key, 1)}
                        >
                          <Plus size={12} />
                        </button>
                      </span>
                      <span className="mw-parts-orderline-price">{rupees(line.price * line.qty)}</span>
                      <button
                        type="button"
                        className="mw-parts-orderline-remove"
                        aria-label={`Remove ${line.name}`}
                        onClick={() => setQty(line.key, -line.qty)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </li>
                  ))}
                  <li className="mw-parts-orderline-total">
                    <span>Order Total</span>
                    <strong>{rupees(cartTotal(cart))}</strong>
                  </li>
                </ul>

                <div className="mw-parts-payment" data-testid="prepaid-notice">
                  <strong>Payment: Prepaid only</strong>
                  <p>
                    Pay online with UPI, Card or Net Banking. Cash on Delivery is not available
                    for parts orders. Your parts are dispatched after payment is confirmed.
                  </p>
                </div>

                <div className="mw-sell-fields">
                  <label className="mw-sell-field">
                    <span className="mw-sell-field-label">Customer Name *</span>
                    <input
                      className="mw-sell-input"
                      type="text"
                      name="name"
                      required
                      maxLength={80}
                      placeholder="Your full name"
                    />
                  </label>
                  <label className="mw-sell-field">
                    <span className="mw-sell-field-label">Mobile Number *</span>
                    <input
                      className="mw-sell-input"
                      type="tel"
                      name="mobile"
                      required
                      maxLength={15}
                      pattern="[0-9+ ]{10,15}"
                      placeholder="10-digit mobile"
                    />
                  </label>
                  <label className="mw-sell-field mw-sell-field--full">
                    <span className="mw-sell-field-label">
                      Delivery city / address <small>*</small>
                    </span>
                    <input
                      className="mw-sell-input"
                      type="text"
                      name="city"
                      required
                      maxLength={140}
                      placeholder="City or full delivery address"
                    />
                  </label>
                </div>

                {error && (
                  <p className="mw-sell-error" role="alert">
                    {error}
                  </p>
                )}

                <div className="mw-sell-form-foot">
                  <button type="submit" className="mw-sell-submit" data-testid="place-order">
                    Place Prepaid Order · {rupees(cartTotal(cart))}
                  </button>
                  <p className="mw-sell-form-sub">
                    Your order is saved to Motor Wallah's lead queue — the team confirms
                    fitment, stock and the prepaid payment link with you on your mobile.
                  </p>
                </div>
              </form>
            </div>
          </section>
        )}

        {/* ---------------- Order success ---------------- */}
        {activeStep === "done" && order && (
          <section id="parts-step" className="home-container">
            <div className="mw-sell-done">
              <CheckCircle2
                className="mw-sell-done-icon"
                size={44}
                strokeWidth={1.6}
                aria-hidden="true"
              />
              <h2 className="mw-sell-done-title">
                Order Placed! Our team will confirm fitment and share the prepaid payment link.
              </h2>
              <p className="mw-sell-done-text">
                Thanks {order.name} — order <strong>{order.id}</strong> for {order.items}{" "}
                item{order.items === 1 ? "" : "s"} ({rupees(order.total)}) is saved with the
                Motor Wallah team. We will contact you on {order.mobile}. Prepaid only — no
                Cash on Delivery.
              </p>
              <div className="mw-parts-orderid" data-testid="order-id">
                <span>Order ID</span>
                <strong>{order.id}</strong>
              </div>
              <div className="mw-sell-done-actions">
                <button
                  type="button"
                  className="mw-sell-submit"
                  onClick={() => {
                    setOrder(null);
                    go({});
                  }}
                >
                  Continue Shopping
                </button>
                <a className="mw-sell-ghost-btn" href={whatsapp} target="_blank" rel="noopener noreferrer">
                  <MessageCircle size={14} /> WhatsApp
                </a>
                <a className="mw-sell-ghost-btn" href={PHONE_HREF}>
                  <Phone size={14} /> Call {PHONE_DISPLAY}
                </a>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* ---------------- Glass cart drawer ---------------- */}
      {drawerOpen && (
        <div className="mw-parts-overlay" role="presentation" onClick={() => setDrawerOpen(false)}>
          <aside
            className="mw-parts-drawer"
            role="dialog"
            aria-label="Shopping cart"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="mw-parts-drawer-head">
              <h2>
                <ShoppingCart size={17} aria-hidden="true" /> Your Cart{" "}
                <small>({count} item{count === 1 ? "" : "s"})</small>
              </h2>
              <button type="button" aria-label="Close cart" onClick={() => setDrawerOpen(false)}>
                <X size={17} />
              </button>
            </header>

            {cart.length === 0 ? (
              <div className="mw-parts-drawer-empty">
                <ShoppingBag size={34} strokeWidth={1.4} aria-hidden="true" />
                <p>Your cart is empty.</p>
                <button
                  type="button"
                  className="mw-parts-buynow"
                  onClick={() => {
                    setDrawerOpen(false);
                    navigate({ to: "/accessories", search: {} });
                  }}
                >
                  Start Shopping
                </button>
              </div>
            ) : (
              <>
                <ul className="mw-parts-drawer-lines">
                  {cart.map((line) => (
                    <li key={line.key}>
                      <div>
                        <p>{line.name}</p>
                        <small>
                          {line.partLabel} · {rupees(line.price)}
                        </small>
                      </div>
                      <span className="mw-parts-qty">
                        <button
                          type="button"
                          aria-label={`Reduce quantity of ${line.name}`}
                          onClick={() => setQty(line.key, -1)}
                        >
                          <Minus size={12} />
                        </button>
                        <b>{line.qty}</b>
                        <button
                          type="button"
                          aria-label={`Increase quantity of ${line.name}`}
                          onClick={() => setQty(line.key, 1)}
                        >
                          <Plus size={12} />
                        </button>
                      </span>
                      <strong>{rupees(line.price * line.qty)}</strong>
                      <button
                        type="button"
                        className="mw-parts-orderline-remove"
                        aria-label={`Remove ${line.name}`}
                        onClick={() => setQty(line.key, -line.qty)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </li>
                  ))}
                </ul>

                <div className="mw-parts-drawer-foot">
                  <p className="mw-parts-drawer-total">
                    <span>Total payable</span>
                    <strong>{rupees(cartTotal(cart))}</strong>
                  </p>
                  <p className="mw-parts-drawer-prepaid" data-testid="prepaid-notice">
                    Prepaid only — no Cash on Delivery.
                  </p>
                  <button
                    type="button"
                    className="mw-sell-submit"
                    onClick={() => {
                      setDrawerOpen(false);
                      openCheckout();
                    }}
                  >
                    Proceed to Buy
                  </button>
                </div>
              </>
            )}
          </aside>
        </div>
      )}

      <SiteFooter />
      <StickyActions />
    </div>
  );
}
