import { MarketplaceView } from './marketplace'

// The separate Services page (client feedback #7, 2026-10-04): services only, with "Sell a service"
// in place of the marketplace's "Become a seller".
export default function Services() {
  return <MarketplaceView servicesOnly />
}
