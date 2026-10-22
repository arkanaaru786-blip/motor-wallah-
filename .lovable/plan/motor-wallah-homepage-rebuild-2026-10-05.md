# MOTOR WALLAH Homepage Rebuild

## Goal
Rebuild the existing homepage as a real responsive marketplace matching the supplied visual reference, while preserving Buy Cars, Sell, Exchange, category data, uploads, valuation logic, and all existing routes.

## What will change
- Replace the homepage composition with one cohesive marketplace flow: premium header, multi-vehicle hero, functional search, action navigation, 8-category explorer, franchise banner, compact business spotlight, mixed popular vehicles, action choices, trust points, lower franchise CTA, and footer.
- Keep MOTOR WALLAH’s black, white, and red identity, Oswald/Barlow typography, tagline, and replaceable logo treatment.
- Make all category cards and actions real links. Existing routes will be reused: Buy `/cars`, Sell/Value `/sell-your-car`, Exchange `/exchange`, Compare `/cars`, Service `/services`, Scrap `/contact`, Franchise `/franchise`.
- Keep all eight vehicle categories strictly separated and route each card to its current listing page.
- Build mixed popular listings from the existing car and category demo datasets without changing their structures.
- Make the hero search match brands, models, and vehicle types, then navigate to the appropriate existing listing page.

## Visual assets
- Create a cinematic multi-vehicle hero visual featuring car, bike, 3-wheeler, SCV, truck, bus, and tractor.
- Create cohesive realistic vehicle cutouts for the 8 category cards.
- Create a premium MOTOR WALLAH showroom image for the franchise banners and an automotive workshop image for the compact business spotlight.
- Use generated imagery only as visual content; all text, cards, buttons, navigation, and interactions remain HTML/React.

## Responsive behavior
- Compact sticky black header with accessible horizontally scrollable primary navigation on mobile.
- Prominent mobile search, horizontally scrollable action row, 2-column category and listing grids, tap-friendly controls, and no page overflow.
- Desktop uses wider multi-column marketplace grids while preserving the same content order.

## Technical details
- Add focused reusable homepage components and semantic design tokens; avoid modifying finalized workflow components.
- Preserve route metadata and update the homepage description to reflect the all-vehicle marketplace.
- Verify desktop and 360px mobile layouts, search/navigation behavior, category links, image rendering, runtime console, and the latest build status.
