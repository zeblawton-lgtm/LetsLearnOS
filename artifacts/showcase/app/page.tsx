import {
  BookOpen,
  Brain,
  Calculator,
  Check,
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
  Sparkles,
  Volume2,
  WifiOff,
} from "lucide-react";
import {
  ArrowLink,
  isoGuideUrl,
  parentGuideUrl,
  repositoryUrl,
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

const principles = [
  {
    title: "Offline by default",
    body: "Every core activity runs without a network. Local narration keeps the experience available anywhere.",
    icon: WifiOff,
  },
  {
    title: "No child-facing AI",
    body: "Lessons, math, stories, and worksheets are reviewed content or deterministic templates—not model output.",
    icon: ShieldCheck,
  },
  {
    title: "Parent controlled",
    body: "A salted PIN protects settings and session controls. The learner account has no shell or desktop.",
    icon: LockKeyhole,
  },
  {
    title: "Optional narration",
    body: "Administrators can enable OpenAI text-to-speech from the backend. Browser speech remains the fallback.",
    icon: Volume2,
  },
  {
    title: "Built for touch",
    body: "Large targets, calm layouts, high contrast, and positive-only feedback meet young learners where they are.",
    icon: Sparkles,
  },
  {
    title: "Open by design",
    body: "MIT-licensed source, reproducible kiosk tooling, and neutral public assets make the whole system inspectable.",
    icon: GitFork,
  },
] as const;

export default function Home() {
  return (
    <main>
      <SiteHeader active="overview" />

      <section className="hero" id="top">
        <div className="signal-line signal-line-one" aria-hidden="true" />
        <div className="signal-line signal-line-two" aria-hidden="true" />
        <div className="hero-copy">
          <p className="eyebrow">
            <span>LLM OS · Lets Learn More</span> · Open-source learning kiosk
          </p>
          <h1>
            Playful learning,
            <span> offline first.</span>
          </h1>
          <p className="hero-summary">
            LetsLearnMoreOS is a public window into LetsLearnOS: a calm,
            touch-first learning space for ages 3–7 without ads, accounts,
            trackers, or child-facing chat.
          </p>
          <div className="hero-actions">
            <ArrowLink href="/demo">Play the no-save demo</ArrowLink>
            <ArrowLink href={repositoryUrl} secondary>
              Explore the source
            </ArrowLink>
          </div>
          <p className="adult-note">
            <Check aria-hidden="true" size={17} />
            <span>
              Here, LLM means Lets Learn More—not model-generated lessons.
            </span>
          </p>
        </div>

        <div
          className="hero-visual"
          aria-label="Layered green learning cards with the Lets Learn More monogram and a module preview"
        >
          <div className="visual-glow" aria-hidden="true" />
          <div className="monogram-panel" aria-hidden="true">
            <p>LETS LEARN MORE</p>
            <strong>LLM</strong>
            <span>OS</span>
            <div className="growth-bars">
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>
          <div className="signal-card signal-card-one" aria-hidden="true">
            READ
          </div>
          <div className="signal-card signal-card-two" aria-hidden="true">
            MAKE
          </div>
          <div className="preview-panel">
            <div className="preview-bar">
              <span />
              <span />
              <span />
              <b>LEARNER HOME</b>
            </div>
            <div className="preview-grid">
              {modules.slice(0, 6).map((module) => {
                const Icon = module.icon;
                return (
                  <span
                    className={"preview-card tone-" + module.tone}
                    key={module.name}
                  >
                    <Icon aria-hidden="true" size={21} strokeWidth={2.2} />
                    <small>{module.name}</small>
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <div className="fact-strip" aria-label="Project highlights">
        <span>
          <i /> Ages 3–7
        </span>
        <span>
          <i /> 14 learning modules
        </span>
        <span>
          <i /> Offline by default
        </span>
        <span>
          <i /> Parent controlled
        </span>
        <span>
          <i /> MIT licensed
        </span>
      </div>

      <section className="modules section-shell" id="modules">
        <div className="section-heading split-heading">
          <div>
            <p className="section-number">01 · MODULES</p>
            <h2>
              Fourteen ways to learn.
              <br />
              One calm system.
            </h2>
          </div>
          <p>
            Every module is content-reviewed and deterministic. Math and
            worksheets are never generated by an AI model.
          </p>
        </div>
        <div className="module-grid">
          {modules.map((module, index) => {
            const Icon = module.icon;
            return (
              <article
                className={"module-card tone-" + module.tone}
                key={module.name}
              >
                <span className="module-index">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <Icon aria-hidden="true" size={34} strokeWidth={2.15} />
                <h3>{module.name}</h3>
              </article>
            );
          })}
        </div>
      </section>

      <section className="principles" id="principles">
        <div className="principles-inner">
          <div className="section-heading">
            <p className="section-number section-number-lime">
              02 · GUARDRAILS
            </p>
            <h2>
              Built for tiny hands.
              <br />
              <span>Reviewed by grown-ups.</span>
            </h2>
          </div>
          <div className="principle-grid">
            {principles.map((principle) => {
              const Icon = principle.icon;
              return (
                <article className="principle-card" key={principle.title}>
                  <span className="principle-icon">
                    <Icon aria-hidden="true" size={22} />
                  </span>
                  <h3>{principle.title}</h3>
                  <p>{principle.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section
        className="demo-invite section-shell"
        aria-labelledby="demo-invite-title"
      >
        <div className="demo-invite-card">
          <p className="section-number">03 · TRY IT</p>
          <h2 id="demo-invite-title">A real activity. Zero saved data.</h2>
          <p>
            Open Number Garden, play five deterministic rounds, then refresh.
            Everything resets because the demo never creates a profile or writes
            to browser storage.
          </p>
          <ArrowLink href="/demo">Open the live demo</ArrowLink>
        </div>
      </section>

      <section className="learners section-shell" id="learners">
        <div className="section-heading">
          <p className="section-number">04 · LEARNING LANES</p>
          <h2>
            Two profiles. One promise:
            <br />
            meet them where they are.
          </h2>
        </div>
        <div className="learner-grid">
          <article className="learner-card learner-card-young">
            <div className="learner-topline">
              <strong>3</strong>
              <span>LEARNER TWO · AGE 3</span>
            </div>
            <h3>Gentle & giant.</h3>
            <p>
              Fewer choices on each screen. Bigger visuals. Softer tracing.
              Positive-only feedback and room to explore.
            </p>
            <ul>
              <li>
                <Check size={17} /> Extra-large targets
              </li>
              <li>
                <Check size={17} /> Short, visual activities
              </li>
              <li>
                <Check size={17} /> No streaks or negative framing
              </li>
            </ul>
          </article>
          <article className="learner-card learner-card-older">
            <div className="learner-topline">
              <strong>5+</strong>
              <span>LEARNER ONE · AGE 5+</span>
            </div>
            <h3>Denser & braver.</h3>
            <p>
              More arithmetic, patterns, word problems, layered puzzles, longer
              stories, and printable worksheets.
            </p>
            <ul>
              <li>
                <Check size={17} /> Richer problem sets
              </li>
              <li>
                <Check size={17} /> More puzzle pieces
              </li>
              <li>
                <Check size={17} /> Local progress records
              </li>
            </ul>
          </article>
        </div>
      </section>

      <section className="install section-shell" id="install">
        <div className="install-card">
          <div className="install-pattern" aria-hidden="true" />
          <p className="section-number section-number-lime">05 · OPEN SOURCE</p>
          <h2>
            Bring learning back
            <br />
            offline.
          </h2>
          <p className="install-copy">
            Free, MIT-licensed, and made for the family laptop that has been
            gathering dust. No accounts. No trackers. Just a kid, a screen, and
            a whole lot to explore.
          </p>
          <div className="hero-actions">
            <ArrowLink href={repositoryUrl}>Clone the repository</ArrowLink>
            <ArrowLink href={parentGuideUrl} secondary>
              Read the parent guide
            </ArrowLink>
            <a
              className="text-link"
              href={isoGuideUrl}
              target="_blank"
              rel="noreferrer"
            >
              ISO build guide
            </a>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
