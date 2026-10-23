import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useCart } from '../features/cart/CartProvider';
import { HealthBadge } from './HealthBadge';

const navItems = [
  { hash: '#features', label: 'Features' },
  { hash: '#how-it-works', label: 'How it works' },
  { hash: '#roles', label: 'Roles' },
  { hash: '#roadmap', label: 'Roadmap' },
];

export function SiteHeader() {
  const { user, loading, logout } = useAuth();
  const { itemCount } = useCart();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const onLanding = pathname === '/';

  async function handleLogout() {
    try {
      await logout();
    } finally {
      navigate('/');
    }
  }

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link className="brand" to="/" aria-label="NearKart home">
          <span className="brand__mark" aria-hidden="true">
            N
          </span>
          <span className="brand__text">
            <span className="brand__name">NearKart</span>
            <span className="brand__tagline">local marketplace</span>
          </span>
        </Link>

        <nav className="site-nav" aria-label="Main navigation">
          <Link to="/marketplace">Marketplace</Link>
          {navItems.map((item) => (
            <a
              key={item.hash}
              href={onLanding ? item.hash : `/${item.hash}`}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="site-header__status">
          <HealthBadge />
          <span className="phase-chip">Phase 5</span>

          {!loading && !user && (
            <div className="header-auth">
              <Link className="header-auth__link" to="/login">
                Sign in
              </Link>
              <Link className="button button--primary header-auth__cta" to="/register">
                Get started
              </Link>
            </div>
          )}

          {!loading && user && (
            <div className="header-auth">
              {user.role === 'customer' && (
                <>
                  <Link className="header-auth__link" to="/orders">
                    Orders
                  </Link>
                  <Link
                    className="header-auth__link header-cart"
                    to="/cart"
                    aria-label={`Cart with ${itemCount} ${
                      itemCount === 1 ? 'item' : 'items'
                    }`}
                  >
                    Cart
                    {itemCount > 0 && (
                      <span className="header-cart__count">{itemCount}</span>
                    )}
                  </Link>
                </>
              )}
              {user.role === 'seller' && (
                <>
                  <Link className="header-auth__link" to="/seller/orders">
                    Orders
                  </Link>
                  <Link className="header-auth__link" to="/seller">
                    My store
                  </Link>
                </>
              )}
              <Link className="header-user" to="/account">
                <span className="header-user__avatar" aria-hidden="true">
                  {user.fullName.charAt(0).toUpperCase()}
                </span>
                <span className="header-user__name">
                  {user.fullName.split(' ')[0]}
                </span>
              </Link>
              <button
                className="header-auth__link header-auth__logout"
                type="button"
                onClick={handleLogout}
              >
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
