import type { ReactNode } from "react";
import { ArrowRight, GitFork } from "lucide-react";

export const repositoryUrl = "https://github.com/zeblawton-lgtm/LetsLearnOS";
export const parentGuideUrl = repositoryUrl + "/blob/main/docs/parent-guide.md";
export const isoGuideUrl = repositoryUrl + "/blob/main/iso/README.md";

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
      <a className="brand" href="/" aria-label="LetsLearnMoreOS home">
        <LearningMark />
        <span>LetsLearnMore</span>
        <span className="brand-os">OS</span>
      </a>
      <nav aria-label="Primary navigation">
        <a href="/#modules">Modules</a>
        <a href="/#principles">Guardrails</a>
        <a
          className={active === "demo" ? "nav-active" : undefined}
          href="/demo"
          aria-current={active === "demo" ? "page" : undefined}
        >
          Live demo
        </a>
        <a href="/#install">Install</a>
      </nav>
      <a
        className="header-github"
        href={repositoryUrl}
        target="_blank"
        rel="noreferrer"
      >
        <GitFork aria-hidden="true" size={18} />
        GitHub
      </a>
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
    <footer>
      <a className="brand" href="/">
        <LearningMark />
        <span>LetsLearnMore</span>
        <span className="brand-os">OS</span>
      </a>
      <p>Made for grown-ups building calmer learning spaces.</p>
      <p className="legal">
        LLM OS means Lets Learn More OS. Not affiliated with or endorsed by
        OpenAI. OpenAI is an optional API provider.
      </p>
    </footer>
  );
}
