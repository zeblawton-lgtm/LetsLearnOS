import {
  ArrowUpRight,
  BookMarked,
  BookOpen,
  Brain,
  Calculator,
  Check,
  Code2,
  FlaskConical,
  GitFork,
  Globe2,
  Languages,
  LockKeyhole,
  MapPinned,
  Music2,
  Palette,
  PencilLine,
  Puzzle,
  Rocket,
  Route,
  Search,
  ShieldCheck,
  Volume2,
  WifiOff,
} from "lucide-react";
import {
  ArrowLink,
  isoGuideUrl,
  parentGuideUrl,
  repositoryUrl,
  securityGuideUrl,
  SiteFooter,
  SiteHeader,
} from "./site-shell";

const modules = [
  { name: "Math", icon: Calculator, tone: "rose" },
  { name: "Spanish", icon: Languages, tone: "peach" },
  { name: "World Maps", icon: Globe2, tone: "lime" },
  { name: "3D Globe", icon: MapPinned, tone: "sky" },
  { name: "Space", icon: Rocket, tone: "lavender" },
  { name: "Science Lab", icon: FlaskConical, tone: "mint" },
  { name: "Stories", icon: BookOpen, tone: "sun" },
  { name: "Coloring & Art", icon: Palette, tone: "orchid" },
  { name: "Puzzles", icon: Puzzle, tone: "violet" },
  { name: "Memory", icon: Brain, tone: "coral" },
  { name: "Piano", icon: Music2, tone: "blue" },
  { name: "Tracing", icon: PencilLine, tone: "leaf" },
  { name: "Seek & Find", icon: Search, tone: "gold" },
  { name: "Mazes", icon: Route, tone: "aqua" },
] as const;

const guardrails = [
  {
    eyebrow: "AVAILABLE",
    title: "Offline core",
    body: "Every learning activity, map, story, and fallback voice remains useful without a network.",
    icon: WifiOff,
  },
  {
    eyebrow: "DETERMINISTIC",
    title: "Reviewed lessons",
    body: "Math, worksheets, stories, and prompts come from authored content or deterministic templates.",
    icon: ShieldCheck,
  },
  {
    eyebrow: "SUPERVISED",
    title: "Parent control",
    body: "A salted PIN protects administration. The learner account has no shell, sudo, or desktop.",
    icon: LockKeyhole,
  },
  {
    eyebrow: "OPTIONAL",
    title: "OpenAI narration",
    body: "A backend-only OpenAI key can improve speech. Browser narration remains the fallback.",
    icon: Volume2,
  },
] as const;

const moduleGroups = [
  {
    label: "FOUNDATIONS",
    title: "Read, count & communicate",
    body: "Math, Spanish, Stories, and Tracing build early confidence through short, repeatable activities.",
  },
  {
    label: "DISCOVER",
    title: "See a bigger world",
    body: "World Maps, 3D Globe, Space, and Science Lab turn curiosity into structured exploration.",
  },
  {
    label: "CREATE",
    title: "Make sound, color & memory",
    body: "Coloring & Art, Piano, and Memory offer open-ended play without feeds, ads, or scoring pressure.",
  },
  {
    label: "PLAY",
    title: "Think through the puzzle",
    body: "Puzzles, Seek & Find, and Mazes reward attention with positive-only feedback and room to retry.",
  },
] as const;

const faqs = [
  {
    question: "Does LLM OS generate lessons with a language model?",
    answer:
      "No. Here, LLM means Lets Learn More. Learning content is authored or deterministic, and there is no child-facing free chat. Optional OpenAI use is limited to narrating already-written text.",
  },
  {
    question: "What happens when the internet is unavailable?",
    answer:
      "The core kiosk keeps working. Application code, learning content, maps, fallback art, and browser speech are local. Optional OpenAI narration simply falls back to the browser voice.",
  },
  {
    question: "What does the public demo save?",
    answer:
      "No game progress. The six-experience sampler keeps temporary state only in JavaScript memory, makes no game API calls, and resets when the page reloads or closes.",
  },
  {
    question: "Can another family install it?",
    answer:
      "Yes. The source is MIT licensed, includes generic sample learners, and documents both normal development and the reproducible Ubuntu kiosk image workflow.",
  },
] as const;

const resources = [
  {
    label: "START HERE",
    title: "Parent guide",
    body: "Understand learner profiles, supervision, narration, and the everyday kiosk experience.",
    href: parentGuideUrl,
    icon: BookMarked,
    art: "resource-art-guide",
  },
  {
    label: "BUILD IT",
    title: "ISO guide",
    body: "Turn the public source into the reproducible x86_64 Ubuntu kiosk image.",
    href: isoGuideUrl,
    icon: Code2,
    art: "resource-art-iso",
  },
  {
    label: "INSPECT IT",
    title: "Security model",
    body: "Review credential boundaries, parent controls, offline behavior, and the restricted learner account.",
    href: securityGuideUrl,
    icon: ShieldCheck,
    art: "resource-art-security",
  },
] as const;

export default function Home() {
  return (
    <main>
      <SiteHeader active="overview" />

      <section className="editorial-hero" id="top">
        <div className="page-shell hero-layout">
          <div className="hero-copy">
            <p className="eyebrow">LLM OS · LETS LEARN MORE · OPEN SOURCE</p>
            <h1>
              A learning computer
              <span> that stays on their side.</span>
            </h1>
            <p className="hero-summary">
              LetsLearnMoreOS is the public window into LetsLearnOS: a calm,
              touch-first kiosk for ages 3–7 with fourteen ways to learn and no
              child-facing feed, ads, or chat.
            </p>
            <div className="hero-actions">
              <ArrowLink href="/demo">Play the no-save demo</ArrowLink>
              <ArrowLink href={repositoryUrl} secondary>
                Explore the source
              </ArrowLink>
            </div>
            <p className="definition-note">
              <Check aria-hidden="true" size={17} />
              LLM means Lets Learn More—not model-generated lessons.
            </p>
          </div>

          <div
            className="learning-constellation"
            aria-label="A map of learning modules orbiting the Lets Learn More OS core"
          >
            <div className="constellation-grid" aria-hidden="true" />
            <svg
              className="constellation-lines"
              viewBox="0 0 640 620"
              aria-hidden="true"
            >
              <path d="M320 310 L118 110 M320 310 L304 65 M320 310 L520 122 M320 310 L578 308 M320 310 L504 510 M320 310 L284 558 M320 310 L90 482 M320 310 L64 282" />
              <circle cx="320" cy="310" r="178" />
              <circle cx="320" cy="310" r="248" />
            </svg>
            <div className="constellation-core">
              <small>LETS LEARN MORE</small>
              <strong>LLM</strong>
              <span>OS</span>
            </div>
            {modules.slice(0, 8).map((module, index) => {
              const Icon = module.icon;
              return (
                <span
                  className={`constellation-node node-${index + 1} tone-${module.tone}`}
                  key={module.name}
                >
                  <Icon aria-hidden="true" size={20} />
                  <b>{module.name}</b>
                </span>
              );
            })}
            <span className="constellation-caption">
              14 modules · one calm shell
            </span>
          </div>
        </div>
      </section>

      <div className="page-shell page-rule" />

      <section className="promise-section">
        <div className="page-shell promise-grid">
          <a
            className="demo-film"
            href="/demo"
            aria-label="Open the six-experience interactive demo"
          >
            <div className="film-topline">
              <span>NUMBER GARDEN</span>
              <span>ROUND 1 / 5</span>
            </div>
            <div className="film-equation">
              <b>2</b>
              <i>+</i>
              <em>?</em>
              <i>=</i>
              <b>5</b>
            </div>
            <div className="film-answers" aria-hidden="true">
              <span>1</span>
              <span>3</span>
              <span>4</span>
              <span>6</span>
            </div>
            <span className="film-play">
              <ArrowUpRight size={25} />
            </span>
            <span className="film-label">
              Try it live · nothing to sign up for
            </span>
          </a>

          <div className="promise-copy">
            <p className="section-kicker">THE PROMISE</p>
            <blockquote>
              “A learning computer should feel like a room they can explore—
              <em>not a feed they have to survive.</em>”
            </blockquote>
            <p>
              No engagement loops. No public profile. No wrong-answer shame.
              Just clear activities, generous touch targets, and a grown-up in
              control.
            </p>
          </div>
        </div>
      </section>

      <div className="page-shell page-rule" />

      <section className="manifesto-section">
        <div className="page-shell manifesto-grid">
          <div className="availability-chart" aria-hidden="true">
            <span className="chart-y">Core availability</span>
            <span className="chart-x">Network quality</span>
            <svg viewBox="0 0 560 420" preserveAspectRatio="none">
              <g>
                <line x1="0" y1="90" x2="560" y2="90" />
                <line x1="0" y1="190" x2="560" y2="190" />
                <line x1="0" y1="290" x2="560" y2="290" />
                <line x1="112" y1="0" x2="112" y2="390" />
                <line x1="280" y1="0" x2="280" y2="390" />
                <line x1="448" y1="0" x2="448" y2="390" />
              </g>
              <path d="M0 78 C 140 70, 220 78, 320 72 S 455 76, 560 66" />
            </svg>
            <strong>Learning stays available.</strong>
            <small>OFFLINE</small>
            <small>ONLINE</small>
          </div>

          <div className="manifesto-copy">
            <p>
              Most children&apos;s software asks families to trade attention,
              accounts, and a permanent connection for access. That is a design
              decision—not a law of computing.
            </p>
            <p>
              LetsLearnOS starts with the device in the room. The lessons,
              learner interface, maps, stories, progress records, and fallback
              narration live there. The network is an enhancement, never the
              floor beneath the experience.
            </p>
            <p>
              The result is deliberately ordinary in the best way: turn it on,
              choose a learner, and begin.
            </p>
          </div>
        </div>
      </section>

      <section className="architecture-section" id="architecture">
        <div className="page-shell">
          <div className="section-index">
            <span>01</span>
            <span>HOW THE SYSTEM FITS TOGETHER</span>
          </div>
          <div className="architecture-grid">
            <div className="statement-card corner-marks">
              <span>THE CONTROL MODEL</span>
              <h2>The family stays above the system.</h2>
              <p>
                Parents define profiles and controls. The kiosk owns the calm
                learner experience. Optional services stay behind a backend
                boundary.
              </p>
            </div>

            <div
              className="layer-stack"
              aria-label="LetsLearnOS architecture layers"
            >
              <div className="layer-row layer-row-split">
                <article className="system-layer">
                  <span>01 · DIRECTION</span>
                  <h3>Parent & educator</h3>
                  <p>Profiles, supervision, settings, and the final say.</p>
                </article>
                <div className="layer-mark" aria-hidden="true">
                  <span>L</span>
                  <span>L</span>
                  <span>M</span>
                </div>
              </div>
              <article className="system-layer system-layer-highlight">
                <span>02 · EXPERIENCE</span>
                <h3>LetsLearnOS kiosk</h3>
                <p>
                  Touch-first shell, local sessions, positive feedback, and
                  parent controls.
                </p>
              </article>
              <div className="service-row">
                <span>Math templates</span>
                <span>Local content</span>
                <span>SQLite progress</span>
                <span>Browser speech</span>
                <span>Optional OpenAI voice</span>
              </div>
              <article className="system-layer">
                <span>03 · FOUNDATION</span>
                <h3>The family computer</h3>
                <p>
                  Ubuntu LTS, Chromium kiosk, restricted learner account, and
                  local assets.
                </p>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="guardrail-pair-section">
        <div className="page-shell guardrail-pair">
          <article className="statement-card corner-marks">
            <span>THE CONTENT BOUNDARY</span>
            <h2>Models do not write the lesson.</h2>
            <p>
              Questions, explanations, stories, and worksheets are reviewed
              content or deterministic templates.
            </p>
          </article>
          <article className="statement-card statement-card-green corner-marks">
            <span>THE NETWORK BOUNDARY</span>
            <h2>Offline is the product, not a fallback.</h2>
            <p>
              OpenAI speech can be enabled by an administrator, but every core
              activity works without it.
            </p>
          </article>
        </div>
      </section>

      <section className="product-reveal" id="demo-preview">
        <div className="page-shell">
          <div className="kiosk-window">
            <div className="kiosk-topbar">
              <span>
                <i />
                <i />
                <i />
              </span>
              LETSLEARNOS · LEARNER HOME
              <b>OFFLINE READY</b>
            </div>
            <div className="kiosk-body">
              <aside className="kiosk-rail" aria-hidden="true">
                <span>LLM</span>
                <i>⌂</i>
                <i>◎</i>
                <i>✦</i>
                <i>?</i>
              </aside>
              <div className="kiosk-dashboard">
                <p>Good morning, Learner</p>
                <h2>What would you like to explore?</h2>
                <div className="kiosk-module-grid">
                  {modules.slice(0, 8).map((module) => {
                    const Icon = module.icon;
                    return (
                      <span className={`tone-${module.tone}`} key={module.name}>
                        <Icon aria-hidden="true" size={24} />
                        <b>{module.name}</b>
                      </span>
                    );
                  })}
                </div>
              </div>
              <aside className="kiosk-demo-panel">
                <span>LIVE SAMPLE</span>
                <h3>Find the missing number.</h3>
                <div className="kiosk-equation">
                  <b>2</b>
                  <i>+</i>
                  <em>?</em>
                  <i>=</i>
                  <b>5</b>
                </div>
                <p>
                  Six authored mini-experiences. No account. No saved progress.
                </p>
                <ArrowLink href="/demo">Open the live sampler</ArrowLink>
              </aside>
            </div>
          </div>
        </div>
      </section>

      <section className="modules-section" id="modules">
        <div className="page-shell">
          <div className="section-index">
            <span>02</span>
            <span>THE LEARNING SYSTEM</span>
          </div>
          <div className="modules-heading">
            <h2>
              One kiosk.
              <br />
              <em>Fourteen ways to learn.</em>
            </h2>
            <p>
              A compact system of foundations, discovery, creative play, and
              puzzles—designed to feel related without making every activity
              feel the same.
            </p>
          </div>

          <div className="module-system corner-marks">
            <div className="module-group-list">
              {moduleGroups.map((group) => (
                <article key={group.label}>
                  <span>{group.label}</span>
                  <h3>{group.title}</h3>
                  <p>{group.body}</p>
                </article>
              ))}
            </div>
            <div
              className="module-map"
              aria-label="All fourteen learning modules"
            >
              <div className="map-rings" aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
              <strong>
                LLM
                <br />
                <span>OS</span>
              </strong>
              <div className="map-module-list">
                {modules.map((module) => {
                  const Icon = module.icon;
                  return (
                    <span key={module.name}>
                      <Icon aria-hidden="true" size={16} />
                      {module.name}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="guardrails-section" id="guardrails">
        <div className="page-shell">
          <div className="guardrails-heading">
            <div>
              <p className="section-kicker">03 · NON-NEGOTIABLES</p>
              <h2>Calm by architecture.</h2>
            </div>
            <p>
              These are structural boundaries in the public project, not
              marketing modes that disappear after setup.
            </p>
          </div>
          <div className="guardrail-grid">
            {guardrails.map((guardrail) => {
              const Icon = guardrail.icon;
              return (
                <article key={guardrail.title}>
                  <span className="guardrail-icon">
                    <Icon aria-hidden="true" size={22} />
                  </span>
                  <small>{guardrail.eyebrow}</small>
                  <h3>{guardrail.title}</h3>
                  <p>{guardrail.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="faq-section">
        <div className="page-shell">
          <div className="section-index">
            <span>04</span>
            <span>QUESTIONS GROWN-UPS ASK</span>
          </div>
          <div className="faq-heading">
            <h2>Before you hand over the screen.</h2>
            <p>
              The short version: local first, parent controlled, deterministic
              content, and an optional server-side OpenAI voice.
            </p>
          </div>
          <div className="faq-list">
            {faqs.map((faq, index) => (
              <details key={faq.question} open={index === 0}>
                <summary>
                  {faq.question}
                  <span>+</span>
                </summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="resources-section" id="resources">
        <div className="page-shell">
          <div className="section-index">
            <span>05</span>
            <span>OPEN THE PROJECT</span>
          </div>
          <div className="resources-heading">
            <h2>Read it. Build it. Inspect it.</h2>
            <ArrowLink href={repositoryUrl} secondary>
              View all files
            </ArrowLink>
          </div>
          <div className="resource-grid">
            {resources.map((resource) => {
              const Icon = resource.icon;
              return (
                <a
                  className="resource-card corner-marks"
                  href={resource.href}
                  target="_blank"
                  rel="noreferrer"
                  key={resource.title}
                >
                  <div
                    className={`resource-art ${resource.art}`}
                    aria-hidden="true"
                  >
                    <Icon size={48} />
                    <i />
                    <i />
                    <i />
                  </div>
                  <div className="resource-copy">
                    <span>{resource.label}</span>
                    <h3>{resource.title}</h3>
                    <p>{resource.body}</p>
                    <b>
                      Open guide <ArrowUpRight size={17} />
                    </b>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      </section>

      <section className="closing-cta" id="install">
        <div className="page-shell">
          <GitFork aria-hidden="true" size={36} />
          <h2>
            Bring learning
            <br />
            <em>back offline.</em>
          </h2>
          <p>
            Free, MIT licensed, and made for the family computer that deserves a
            second life.
          </p>
          <div className="hero-actions">
            <ArrowLink href={repositoryUrl}>Clone the repository</ArrowLink>
            <ArrowLink href="/demo" secondary>
              Play the demo first
            </ArrowLink>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
