import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface AuthLayoutProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

export function AuthLayout({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: AuthLayoutProps) {
  return (
    <div className="auth-page">
      <div className="auth-main">
        <div className="auth-card">
          <Link className="auth-back" to="/">
            ← Back to NearKart
          </Link>
          <p className="eyebrow eyebrow--dark">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="auth-subtitle">{subtitle}</p>
          {children}
          <p className="auth-footer">{footer}</p>
        </div>
      </div>

      <aside className="auth-aside" aria-label="NearKart roles">
        <div>
          <span className="auth-aside__mark" aria-hidden="true">
            N
          </span>
          <h2>One account, the right view.</h2>
          <p>
            Every request is checked on the server. Registering as a customer
            cannot grant seller, driver or admin access.
          </p>
        </div>

        <ul className="auth-aside__roles">
          <li>
            <strong>Customer</strong>
            <span>Browse, favourite and order from local stores.</span>
          </li>
          <li>
            <strong>Seller</strong>
            <span>Run a storefront and manage products and stock.</span>
          </li>
          <li>
            <strong>Driver</strong>
            <span>Created by an admin. Claim and deliver orders.</span>
          </li>
          <li>
            <strong>Admin</strong>
            <span>Seeded separately. Moderates users and stores.</span>
          </li>
        </ul>

        <p className="auth-aside__note">
          Passwords are hashed with bcrypt. Sessions use an httpOnly cookie, so
          browser JavaScript cannot read the token.
        </p>
      </aside>
    </div>
  );
}
