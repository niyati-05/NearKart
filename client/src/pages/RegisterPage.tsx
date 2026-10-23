import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { AuthLayout } from '../components/AuthLayout';

type RegistrationRole = 'customer' | 'seller';

export function RegisterPage() {
  const { user, loading, register } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<RegistrationRole>('customer');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to="/account" replace />;
  }

  function validate(): string | null {
    if (fullName.trim().length < 2) {
      return 'Enter your full name.';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return 'Enter a valid email address.';
    }
    if (password.length < 8) {
      return 'Password must be at least 8 characters.';
    }
    if (password !== confirmPassword) {
      return 'Passwords do not match.';
    }
    if (phone.trim() && (phone.trim().length < 7 || phone.trim().length > 20)) {
      return 'Phone number must be between 7 and 20 characters.';
    }
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      await register(
        {
          fullName: fullName.trim(),
          email: email.trim(),
          password,
          ...(phone.trim() ? { phone: phone.trim() } : {}),
        },
        role,
      );
      navigate('/account', { replace: true });
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(
          caught.code === 'EMAIL_EXISTS'
            ? 'An account with this email already exists. Try signing in instead.'
            : caught.message,
        );
      } else {
        setError('Could not create the account. Check that the backend is running.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Join NearKart"
      title="Create your account"
      subtitle="Customers shop local stores. Sellers open a storefront. Driver and admin accounts are created separately."
      footer={
        <>
          Already registered? <Link to="/login">Sign in</Link>
        </>
      }
    >
      <div className="role-switch" role="group" aria-label="Account type">
        <button
          type="button"
          className={role === 'customer' ? 'role-switch__option is-active' : 'role-switch__option'}
          aria-pressed={role === 'customer'}
          onClick={() => setRole('customer')}
        >
          Customer
        </button>
        <button
          type="button"
          className={role === 'seller' ? 'role-switch__option is-active' : 'role-switch__option'}
          aria-pressed={role === 'seller'}
          onClick={() => setRole('seller')}
        >
          Seller
        </button>
      </div>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="form-field">
          <label htmlFor="register-name">Full name</label>
          <input
            id="register-name"
            name="fullName"
            autoComplete="name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Your full name"
            required
          />
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="register-email">Email</label>
            <input
              id="register-email"
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="register-phone">
              Phone <span className="optional">(optional)</span>
            </label>
            <input
              id="register-phone"
              name="phone"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+91…"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="register-password">Password</label>
            <input
              id="register-password"
              type="password"
              name="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="register-confirm">Confirm password</label>
            <input
              id="register-confirm"
              type="password"
              name="confirmPassword"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Repeat password"
              required
            />
          </div>
        </div>

        <p className="form-hint">
          You are creating a <strong>{role}</strong> account. This cannot be
          changed later.
        </p>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button
          className="button button--primary auth-submit"
          type="submit"
          disabled={submitting}
        >
          {submitting ? 'Creating account…' : `Create ${role} account`}
        </button>
      </form>
    </AuthLayout>
  );
}
