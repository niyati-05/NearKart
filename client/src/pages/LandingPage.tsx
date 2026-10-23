import { Link } from 'react-router-dom';
import { HealthBadge } from '../components/HealthBadge';
import { Icon, type IconName } from '../components/Icon';

const principles: Array<{ icon: IconName; title: string; text: string }> = [
  {
    icon: 'shield',
    title: 'Server-side truth',
    text: 'Prices, delivery fees and stock changes will always be recalculated by the API, never trusted from the browser.',
  },
  {
    icon: 'users',
    title: 'Roles with boundaries',
    text: 'Customers, sellers, drivers and admins each get only the data and actions their role allows.',
  },
  {
    icon: 'check',
    title: 'No pretend features',
    text: 'Maps, GPS and road-distance quotes appear only after the real keys are configured and tested.',
  },
];

const features: Array<{
  icon: IconName;
  title: string;
  text: string;
  tag: string;
}> = [
  {
    icon: 'store',
    title: 'Local storefronts',
    text: 'Small businesses create a shop, describe what they sell and appear in the marketplace.',
    tag: 'Phase 4',
  },
  {
    icon: 'box',
    title: 'Products and stock',
    text: 'Sellers add products, update prices and quantities, and pause listings without losing history.',
    tag: 'Phase 4',
  },
  {
    icon: 'search',
    title: 'Search and filters',
    text: 'Customers search by name and narrow results by category, price range and availability.',
    tag: 'Phase 4',
  },
  {
    icon: 'cart',
    title: 'Cart and checkout',
    text: 'A server-priced cart, saved addresses and an order that cannot oversell the last unit.',
    tag: 'Phase 5',
  },
  {
    icon: 'route',
    title: 'Real road distance',
    text: 'Delivery quotes based on actual driving distance from the Google Routes API — not straight-line guesses.',
    tag: 'Phase 6',
  },
  {
    icon: 'pulse',
    title: 'Live order updates',
    text: 'Status changes and the assigned driver’s real GPS position streamed to the customer over Socket.IO.',
    tag: 'Phases 7–8',
  },
];

const roles: Array<{
  icon: IconName;
  name: string;
  text: string;
}> = [
  {
    icon: 'search',
    name: 'Customers',
    text: 'Discover neighbourhood shops, compare products, save favourites and follow an order from placed to delivered.',
  },
  {
    icon: 'store',
    name: 'Sellers',
    text: 'Run a storefront, manage inventory, accept orders and watch sales and low-stock warnings in one dashboard.',
  },
  {
    icon: 'route',
    name: 'Drivers',
    text: 'Claim a ready delivery, update its status and share live location only while the delivery is active.',
  },
  {
    icon: 'shield',
    name: 'Admins',
    text: 'Moderate users, stores and listings, reassign deliveries and review an audit trail of sensitive actions.',
  },
];

const roadmap: Array<{
  phase: string;
  title: string;
  detail: string;
  state: 'done' | 'current' | 'next';
}> = [
  {
    phase: 'Phase 0–1',
    title: 'Foundation',
    detail: 'Repo structure, Express health endpoint, React landing page, build and type-check scripts.',
    state: 'done',
  },
  {
    phase: 'Phase 2',
    title: 'Database',
    detail: 'Local MongoDB connection, collection indexes and health reporting through the official driver.',
    state: 'done',
  },
  {
    phase: 'Phase 3',
    title: 'Accounts and roles',
    detail: 'Customer and seller registration, sessions, role checks and admin-created driver accounts.',
    state: 'done',
  },
  {
    phase: 'Phase 4',
    title: 'Stores, products and marketplace',
    detail: 'Seller storefront and product management, plus public search, category, price and availability filters.',
    state: 'done',
  },
  {
    phase: 'Phase 5',
    title: 'Cart and checkout',
    detail: 'Server-priced cart, addresses, transactional order creation and cash-on-delivery checkout.',
    state: 'next',
  },
  {
    phase: 'Phase 6',
    title: 'Delivery quoting',
    detail: 'Google Routes API integration with quote expiry and re-validation on the server.',
    state: 'next',
  },
  {
    phase: 'Phase 7–8',
    title: 'Realtime and GPS',
    detail: 'Socket.IO status rooms, driver assignment and live map tracking from a real device.',
    state: 'next',
  },
];

const steps = [
  {
    number: '01',
    title: 'Discover nearby shops',
    text: 'Browse local sellers, compare products and check what is actually in stock today.',
  },
  {
    number: '02',
    title: 'Order with confidence',
    text: 'The API recalculates the subtotal, delivery fee and stock before an order is created.',
  },
  {
    number: '03',
    title: 'Follow the delivery',
    text: 'Watch the order move through each status and, when assigned, follow the driver on the map.',
  },
];

export function LandingPage() {
  return (
    <>
      <section className="hero" id="top">
        <div className="hero__glow" aria-hidden="true" />
        <div className="container hero__inner">
          <div className="hero__copy">
            <p className="eyebrow">
              <span className="eyebrow__dot" aria-hidden="true" />
              CodeBreakers · hackathon build
            </p>

            <h1>
              Your neighbourhood market,
              <span className="hero__accent"> online.</span>
            </h1>

            <p className="hero__lead">
              NearKart helps small businesses put their shelves on the web and
              helps customers buy from stores close to home — with honest stock,
              real delivery estimates and live order updates.
            </p>

            <div className="hero__actions">
              <Link className="button button--primary" to="/marketplace">
                Browse the marketplace
                <Icon name="arrow" className="button__icon" />
              </Link>
              <a className="button button--ghost" href="#roadmap">
                View the build roadmap
              </a>
            </div>

            <p className="hero__note">
              Phase 4 is complete: sellers can open a store and manage real
              listings. Customers can search the live catalogue. Cart and
              checkout are next.
            </p>
          </div>

          <aside className="status-card" aria-label="Build status">
            <div className="status-card__top">
              <span className="status-card__title">Build status</span>
              <HealthBadge />
            </div>

            <ul className="status-list">
              <li>
                <span className="status-list__label">Frontend</span>
                <span className="status-list__value">React + Vite</span>
                <span className="pill pill--done">Ready</span>
              </li>
              <li>
                <span className="status-list__label">Backend</span>
                <span className="status-list__value">Express + TS</span>
                <span className="pill pill--done">Ready</span>
              </li>
              <li>
                <span className="status-list__label">Database</span>
                <span className="status-list__value">MongoDB (local)</span>
                <span className="pill pill--done">Ready</span>
              </li>
              <li>
                <span className="status-list__label">Accounts</span>
                <span className="status-list__value">Sessions + roles</span>
                <span className="pill pill--done">Ready</span>
              </li>
              <li>
                <span className="status-list__label">Marketplace</span>
                <span className="status-list__value">Stores + products</span>
                <span className="pill pill--done">Ready</span>
              </li>
            </ul>

            <div className="status-card__endpoint">
              <span className="status-card__endpoint-label">Live endpoint</span>
              <code>GET /api/health</code>
            </div>

            <p className="status-card__footnote">
              The badge above is a real request to the Express server. If the
              backend is stopped, it turns red instead of faking success.
            </p>
          </aside>
        </div>
      </section>

      <section className="principles" aria-label="Project design rules">
        <div className="container principles__grid">
          {principles.map((item) => (
            <article className="principle" key={item.title}>
              <span className="principle__icon">
                <Icon name={item.icon} />
              </span>
              <div>
                <h2>{item.title}</h2>
                <p>{item.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section" id="features">
        <div className="container">
          <div className="section__head">
            <p className="eyebrow eyebrow--dark">Platform features</p>
            <h2>Everything a local marketplace needs</h2>
            <p>
              Each capability is released in a tested phase. The tag on every
              card shows where it sits in the plan.
            </p>
          </div>

          <div className="feature-grid">
            {features.map((feature) => (
              <article className="feature-card" key={feature.title}>
                <div className="feature-card__top">
                  <span className="feature-card__icon">
                    <Icon name={feature.icon} />
                  </span>
                  <span className="pill pill--phase">{feature.tag}</span>
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--tint" id="how-it-works">
        <div className="container">
          <div className="section__head">
            <p className="eyebrow eyebrow--dark">How it works</p>
            <h2>From shelf to doorstep</h2>
            <p>
              Three steps for the customer. Under the hood, every price and stock
              change is checked by the server.
            </p>
          </div>

          <ol className="steps">
            {steps.map((step) => (
              <li className="step" key={step.number}>
                <span className="step__number">{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section" id="roles">
        <div className="container">
          <div className="section__head">
            <p className="eyebrow eyebrow--dark">One platform, four roles</p>
            <h2>Everyone gets their own view</h2>
            <p>
              Permissions are enforced by the API, not by hiding buttons in the
              browser.
            </p>
          </div>

          <div className="role-grid">
            {roles.map((role) => (
              <article className="role-card" key={role.name}>
                <span className="role-card__icon">
                  <Icon name={role.icon} />
                </span>
                <h3>{role.name}</h3>
                <p>{role.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--dark" id="roadmap">
        <div className="container">
          <div className="section__head section__head--light">
            <p className="eyebrow">Build roadmap</p>
            <h2>Shipped in small, tested phases</h2>
            <p>
              Phases 1–4 are done: the foundation, local MongoDB, secure accounts,
              and the seller/marketplace product flow. Cart and checkout come
              next; nothing beyond that is built yet.
            </p>
          </div>

          <ol className="timeline">
            {roadmap.map((item) => (
              <li className={`timeline__item timeline__item--${item.state}`} key={item.phase}>
                <span className="timeline__marker" aria-hidden="true" />
                <div className="timeline__body">
                  <div className="timeline__meta">
                    <span className="timeline__phase">{item.phase}</span>
                    {item.state === 'done' && <span className="pill pill--done">Done</span>}
                    {item.state === 'current' && (
                      <span className="pill pill--current">Next</span>
                    )}
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.detail}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="roadmap-note">
            <Icon name="shield" />
            <p>
              Delivery estimates need a Google Cloud billing account. Until that
              key exists, NearKart will say the estimate is unavailable rather
              than invent a distance.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
