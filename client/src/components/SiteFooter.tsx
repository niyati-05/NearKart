const team = ['Shalina Maniyar', 'Niyati Gogri', 'Vaibhavi Prabhu', 'Abhijith'];

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container site-footer__inner">
        <div>
          <p className="site-footer__brand">NearKart</p>
          <p className="site-footer__note">
            Phase 4: real stores, products and marketplace search. Cart and
            checkout are next.
          </p>
        </div>

        <div>
          <p className="site-footer__label">Built by CodeBreakers</p>
          <ul className="site-footer__team">
            {team.map((member) => (
              <li key={member}>{member}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="container site-footer__legal">
        <span>© {new Date().getFullYear()} NearKart</span>
        <span>Navy · Teal · White</span>
      </div>
    </footer>
  );
}
