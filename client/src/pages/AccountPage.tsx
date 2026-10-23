import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { createDriverAccount } from '../api/auth';
import { useAuth } from '../auth/AuthProvider';

const roleCopy = {
  customer: 'Browse local stores, save favourites and place orders.',
  seller: 'Open your storefront and manage products and stock.',
  driver: 'Claim ready deliveries and share live location during a delivery.',
  admin: 'Moderate users, stores and listings, and create driver accounts.',
} as const;

export function AccountPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  if (!user) {
    return null;
  }

  async function handleLogout() {
    setLogoutError(null);
    setLoggingOut(true);
    try {
      await logout();
      navigate('/', { replace: true });
    } catch {
      setLogoutError('Could not sign out. Check the backend connection and try again.');
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="account-page">
      <div className="container account-page__inner">
        <section className="account-card" aria-labelledby="account-title">
          <p className="eyebrow eyebrow--dark">Your account</p>
          <h1 id="account-title">{user.fullName}</h1>
          <p className="account-email">{user.email}</p>

          <dl className="account-details">
            <div>
              <dt>Role</dt>
              <dd>
                <span className={`role-badge role-badge--${user.role}`}>
                  {user.role}
                </span>
              </dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{user.status}</dd>
            </div>
            <div>
              <dt>What you can do</dt>
              <dd>{roleCopy[user.role]}</dd>
            </div>
          </dl>

          <p className="account-note">
            This page is protected by the API. Opening it without a valid
            session redirects you to sign in.
          </p>

          {logoutError && (
            <p className="form-error" role="alert">
              {logoutError}
            </p>
          )}

          <div className="account-actions">
            {user.role === 'seller' && (
              <Link className="button button--primary" to="/seller">
                Open seller dashboard
              </Link>
            )}
            <Link className="button button--outline" to="/marketplace">
              Browse marketplace
            </Link>
            <button
              className="button button--outline"
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
            >
              {loggingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </section>

        {user.role === 'admin' && <CreateDriverCard />}
      </div>
    </div>
  );
}

function CreateDriverCard() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (fullName.trim().length < 2) {
      setError('Enter the driver’s full name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Temporary password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const { user: driver } = await createDriverAccount({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        ...(phone.trim() ? { phone: phone.trim() } : {}),
      });
      setSuccess(`Driver account created for ${driver.email}.`);
      setFullName('');
      setEmail('');
      setPhone('');
      setPassword('');
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(
          caught.code === 'EMAIL_EXISTS'
            ? 'An account with this email already exists.'
            : caught.message,
        );
      } else {
        setError('Could not create the driver account.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="account-card" aria-labelledby="driver-title">
      <p className="eyebrow eyebrow--dark">Admin only</p>
      <h2 id="driver-title">Create a driver account</h2>
      <p className="account-note">
        Drivers cannot register themselves. The API rejects this request from
        customer, seller and driver sessions.
      </p>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="form-field">
          <label htmlFor="driver-name">Full name</label>
          <input
            id="driver-name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Driver’s full name"
            required
          />
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="driver-email">Email</label>
            <input
              id="driver-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="driver@example.com"
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="driver-phone">
              Phone <span className="optional">(optional)</span>
            </label>
            <input
              id="driver-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+91…"
            />
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="driver-password">Temporary password</label>
          <input
            id="driver-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 8 characters"
            required
          />
          <span className="form-hint">
            Share it with the driver privately. It is stored only as a hash.
          </span>
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p className="form-success" role="status">
            {success}
          </p>
        )}

        <button
          className="button button--primary"
          type="submit"
          disabled={submitting}
        >
          {submitting ? 'Creating driver…' : 'Create driver account'}
        </button>
      </form>
    </section>
  );
}
