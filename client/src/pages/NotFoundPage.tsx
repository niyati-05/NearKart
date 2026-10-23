import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="container page-loading">
      <div>
        <p className="eyebrow eyebrow--dark">404</p>
        <h1>Page not found</h1>
        <p className="auth-subtitle">
          The page you requested does not exist yet.
        </p>
        <Link className="button button--primary" to="/">
          Back to NearKart
        </Link>
      </div>
    </div>
  );
}
