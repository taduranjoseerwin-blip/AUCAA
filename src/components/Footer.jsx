import { NavLink } from 'react-router-dom'

const quickLinks = [
  { to: '/highlights', label: 'Highlights' },
  { to: '/standings', label: 'Standings' },
  { to: '/bracket', label: 'Bracket' },
  { to: '/stats', label: 'Stats' },
  { to: '/teams', label: 'Teams' },
  { to: '/players', label: 'Players' }
]

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-grid">
        <div>
          <div style={{ color: 'var(--orange)', fontSize: 20, fontWeight: 800, marginBottom: 3 }}>AUCAA</div>
          <div style={{ fontSize: 12 }}>Albay Schools Athletic Corporation</div>
          <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--text-muted)', marginTop: 3 }}>Lakas ng Albayano!</div>
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Quick links</div>
          <div className="site-footer-links">
            {quickLinks.map((link) => (
              <NavLink key={link.to} to={link.to}>{link.label}</NavLink>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Contact info</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <a className="site-footer-contact" href="tel:+639452155706">
              <i className="fas fa-phone-alt" style={{ color: 'var(--orange)' }} />
              <span>0945 215 5706</span>
            </a>
            <a className="site-footer-contact" href="mailto:aucaasports@gmail.com">
              <i className="fas fa-envelope" style={{ color: 'var(--orange)' }} />
              <span>aucaasports@gmail.com</span>
            </a>
            <a
              href="https://web.facebook.com/profile.php?id=61552553588260"
              target="_blank"
              rel="noopener noreferrer"
              className="site-footer-facebook"
              aria-label="AUCAA on Facebook"
            >
              <i className="fab fa-facebook-f" />
              <span>Facebook</span>
            </a>
          </div>
        </div>
      </div>
      <div className="site-footer-bottom">© 2026 AUCAA. All rights reserved.</div>
    </footer>
  )
}
