import type { ReactNode } from "react";
import { ArrowRight, GitFork } from "lucide-react";

export const repositoryUrl = "https://github.com/zeblawton-lgtm/LetsLearnOS";
export const parentGuideUrl = repositoryUrl + "/blob/main/docs/parent-guide.md";
export const isoGuideUrl = repositoryUrl + "/blob/main/iso/README.md";
export const securityGuideUrl =
  repositoryUrl + "/blob/main/docs/security/security-report.md";

export function LearningMark() {
  return (
    <span className="learning-mark" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

export function SiteHeader({ active }: { active: "overview" | "demo" }) {
  return (
    <header className="site-header">
      <div className="header-shell">
        <nav
          className="nav-pill nav-pill-links"
          aria-label="Primary navigation"
        >
          <a href="/#architecture">System</a>
          <a href="/#modules">Modules</a>
          <a href="/#resources">Guides</a>
        </nav>

        <a
          className="nav-pill brand brand-pill"
          href="/"
          aria-label="LetsLearnMoreOS home"
        >
          <LearningMark />
          <span>LetsLearnMore</span>
          <span className="brand-os">OS</span>
        </a>

        <div className="nav-pill nav-pill-actions">
          <a
            className="nav-source"
            href={repositoryUrl}
            target="_blank"
            rel="noreferrer"
          >
            <GitFork aria-hidden="true" size={16} />
            Source
          </a>
          <a
            className={active === "demo" ? "nav-demo nav-active" : "nav-demo"}
            href="/demo"
            aria-current={active === "demo" ? "page" : undefined}
          >
            Live demo
          </a>
        </div>
      </div>
    </header>
  );
}

export function ArrowLink({
  href,
  children,
  secondary = false,
}: {
  href: string;
  children: ReactNode;
  secondary?: boolean;
}) {
  const external = href.startsWith("https://");

  return (
    <a
      className={
        secondary ? "button button-secondary" : "button button-primary"
      }
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
    >
      {children}
      <ArrowRight aria-hidden="true" size={18} strokeWidth={2.4} />
    </a>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div className="footer-intro">
          <a className="brand" href="/">
            <LearningMark />
            <span>LetsLearnMore</span>
            <span className="brand-os">OS</span>
          </a>
          <p>A calmer, inspectable learning computer for families.</p>
        </div>

        <div className="footer-column">
          <span>Explore</span>
          <a href="/demo">Live demo</a>
          <a href="/#modules">Modules</a>
          <a href="/#architecture">System map</a>
        </div>

        <div className="footer-column">
          <span>Build</span>
          <a href={parentGuideUrl} target="_blank" rel="noreferrer">
            Parent guide
          </a>
          <a href={isoGuideUrl} target="_blank" rel="noreferrer">
            ISO guide
          </a>
          <a href={securityGuideUrl} target="_blank" rel="noreferrer">
            Security
          </a>
        </div>

        <div className="footer-status">
          <span className="status-chip">
            <i /> Public source available
          </span>
          <strong>
            Offline core.
            <br />
            Optional OpenAI voice.
          </strong>
          <p>No child-facing chat or model-generated lessons.</p>
        </div>
      </div>

      <div className="footer-note">
        <span>
          MIT licensed · Made for grown-ups building calmer learning spaces.
        </span>
        <span>
          LLM OS means Lets Learn More OS. Not affiliated with or endorsed by
          OpenAI.
        </span>
      </div>
    </footer>
  );
}
