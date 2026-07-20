import type { Metadata } from "next";
import {
  ArrowLeft,
  Calculator,
  Check,
  Flame,
  Globe2,
  MapPinned,
  Rocket,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Sun,
} from "lucide-react";
import { SiteFooter, SiteHeader } from "../site-shell";

export const metadata: Metadata = {
  title: "Interactive demo | LetsLearnMoreOS",
  description:
    "Try six deterministic LetsLearnOS activities with no account, API calls, or saved game progress.",
};

const experiences = [
  { id: "math", label: "Math Garden", note: "Numbers", icon: Calculator },
  { id: "planets", label: "Planets", note: "Space", icon: Sun },
  { id: "rocket", label: "Rocket Launch", note: "Countdown", icon: Rocket },
  { id: "globe", label: "Globe", note: "Continents", icon: Globe2 },
  { id: "safety", label: "Fire Safety", note: "Science", icon: Flame },
  { id: "countries", label: "Countries", note: "Maps", icon: MapPinned },
] as const;

const planets = [
  ["sun", "Sun"],
  ["mercury", "Mercury"],
  ["venus", "Venus"],
  ["earth", "Earth"],
  ["mars", "Mars"],
  ["jupiter", "Jupiter"],
  ["saturn", "Saturn"],
  ["uranus", "Uranus"],
  ["neptune", "Neptune"],
] as const;

const continents = [
  ["north-america", "North America"],
  ["south-america", "South America"],
  ["europe", "Europe"],
  ["africa", "Africa"],
  ["asia", "Asia"],
  ["oceania", "Oceania"],
] as const;

const countries = [
  ["united-states", "United States", "US", 170, 150],
  ["canada", "Canada", "CA", 174, 98],
  ["mexico", "Mexico", "MX", 210, 210],
  ["france", "France", "FR", 475, 130],
  ["kenya", "Kenya", "KE", 505, 275],
  ["japan", "Japan", "JP", 762, 155],
] as const;

export default function DemoPage() {
  return (
    <main className="demo-page">
      <SiteHeader active="demo" />

      <section className="demo-hero">
        <div>
          <a className="back-link" href="/">
            <ArrowLeft aria-hidden="true" size={17} /> Back to overview
          </a>
          <p className="eyebrow">
            <span>LIVE DEMO</span> · SIX CORE EXPERIENCES
          </p>
          <h1>
            Try the system.
            <span> Leave no progress behind.</span>
          </h1>
          <p className="hero-summary">
            Explore the range of LetsLearnOS through six compact, authored
            activities. Everything runs in this tab and resets when you reload
            or leave.
          </p>
        </div>

        <aside className="privacy-card" aria-label="Demo privacy facts">
          <ShieldCheck aria-hidden="true" size={30} />
          <strong>No game progress is saved.</strong>
          <ul>
            <li>
              <Check size={16} /> No login or profile
            </li>
            <li>
              <Check size={16} /> No game cookies or browser storage
            </li>
            <li>
              <Check size={16} /> No analytics, game API calls, or AI
            </li>
          </ul>
        </aside>
      </section>

      <section
        className="demo-sampler"
        data-demo-sampler
        data-testid="demo-sampler"
      >
        <div className="sampler-heading">
          <div>
            <p>CHOOSE AN EXPERIENCE</p>
            <h2>A small tour of the real system.</h2>
          </div>
          <span>6 authored demos · zero saved state</span>
        </div>

        <div
          className="experience-switcher"
          role="tablist"
          aria-label="Demo experiences"
        >
          {experiences.map(({ id, label, note, icon: Icon }, index) => (
            <button
              type="button"
              role="tab"
              aria-selected={index === 0}
              aria-controls={`experience-${id}`}
              id={`experience-tab-${id}`}
              data-experience-tab={id}
              className={index === 0 ? "is-active" : undefined}
              key={id}
            >
              <Icon aria-hidden="true" size={24} />
              <span>
                <small>{note}</small>
                <b>{label}</b>
              </span>
            </button>
          ))}
        </div>

        <div className="experience-shell">
          <div className="experience-topbar">
            <div>
              <p data-experience-kicker>NUMBER GARDEN</p>
              <strong data-experience-title>Find the missing number</strong>
            </div>
            <div className="experience-status" aria-label="Sampler progress">
              <span>
                Experience <b data-experience-number>1</b> / 6
              </span>
              <span>In memory only</span>
            </div>
          </div>

          <div className="experience-stage">
            <section
              className="experience-panel math-demo"
              id="experience-math"
              role="tabpanel"
              aria-labelledby="experience-tab-math"
              data-experience-panel="math"
              data-demo-game
              data-testid="demo-game"
            >
              <div className="math-progress" aria-label="Math progress">
                <span>
                  Round <b data-round>1</b> / 5
                </span>
                <span>
                  Stars <b data-stars>0</b>
                </span>
              </div>
              <div className="garden-sparkles" aria-hidden="true">
                <Sparkles size={26} />
                <Sparkles size={18} />
                <Sparkles size={22} />
              </div>
              <p className="game-prompt" data-prompt>
                What number completes the garden?
              </p>
              <div
                className="equation"
                aria-label="Two plus a missing number equals five"
              >
                <span data-left>2</span>
                <i>+</i>
                <span className="equation-blank">?</span>
                <i>=</i>
                <span data-total>5</span>
              </div>

              <div className="answer-grid" aria-label="Answer choices">
                {[1, 3, 4, 6].map((answer) => (
                  <button type="button" data-answer={answer} key={answer}>
                    {answer}
                  </button>
                ))}
              </div>

              <div className="game-feedback" data-feedback aria-live="polite">
                Choose the number that makes the equation complete.
              </div>

              <div className="game-actions">
                <button className="game-next" type="button" data-next hidden>
                  Next garden
                </button>
                <button className="game-reset" type="button" data-reset>
                  <RotateCcw aria-hidden="true" size={18} /> Start over
                </button>
              </div>
            </section>

            <section
              className="experience-panel planets-demo"
              id="experience-planets"
              role="tabpanel"
              aria-labelledby="experience-tab-planets"
              data-experience-panel="planets"
              hidden
            >
              <div className="planet-demo-layout">
                <div
                  className="planet-system"
                  aria-label="Stylized solar system"
                >
                  <div className="demo-sun" />
                  <i className="planet-orbit orbit-one" />
                  <i className="planet-orbit orbit-two" />
                  <i className="planet-orbit orbit-three" />
                  <i className="planet-orbit orbit-four" />
                  {planets.slice(1).map(([id]) => (
                    <span
                      className={`orbit-body orbit-${id}${id === "earth" ? " is-selected" : ""}`}
                      data-planet-dot={id}
                      key={id}
                    />
                  ))}
                </div>
                <aside className="space-fact-card">
                  <p data-planet-kicker>BLUE WORLD</p>
                  <h3 data-planet-name>Earth</h3>
                  <p data-planet-fact>
                    Earth is our home and the only known world with oceans of
                    liquid water on its surface.
                  </p>
                  <span data-planet-detail>Third planet from the Sun</span>
                </aside>
              </div>
              <div className="planet-picker" aria-label="Choose a planet">
                {planets.map(([id, label]) => (
                  <button
                    type="button"
                    data-planet={id}
                    className={id === "earth" ? "is-selected" : undefined}
                    aria-pressed={id === "earth"}
                    key={id}
                  >
                    <i className={`planet-swatch swatch-${id}`} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </section>

            <section
              className="experience-panel rocket-demo"
              id="experience-rocket"
              role="tabpanel"
              aria-labelledby="experience-tab-rocket"
              data-experience-panel="rocket"
              hidden
            >
              <div
                className="rocket-demo-stage"
                data-rocket-stage
                data-state="ready"
              >
                <div className="rocket-stars" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
                <div className="launch-cloud cloud-one" aria-hidden="true" />
                <div className="launch-cloud cloud-two" aria-hidden="true" />
                <div className="launch-tower" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
                <div
                  className="rocket-vehicle"
                  aria-label="Rocket on its launchpad"
                >
                  <span className="rocket-nose" />
                  <span className="rocket-body" />
                  <span className="rocket-window" />
                  <span className="rocket-fin rocket-fin-left" />
                  <span className="rocket-fin rocket-fin-right" />
                  <span className="rocket-flame" />
                </div>
                <strong
                  className="rocket-countdown"
                  data-rocket-countdown
                  aria-live="polite"
                >
                  Ready
                </strong>
                <div className="launch-ground" aria-hidden="true" />
              </div>
              <div className="rocket-control-panel">
                <div>
                  <p>LAUNCH STATUS</p>
                  <strong data-rocket-status>
                    Rocket checked. Launch when ready.
                  </strong>
                </div>
                <button
                  type="button"
                  className="rocket-launch"
                  data-rocket-launch
                >
                  <Rocket aria-hidden="true" size={24} /> Launch
                </button>
                <button
                  type="button"
                  className="rocket-reset"
                  data-rocket-reset
                >
                  <RotateCcw aria-hidden="true" size={20} /> Reset
                </button>
              </div>
            </section>

            <section
              className="experience-panel globe-demo"
              id="experience-globe"
              role="tabpanel"
              aria-labelledby="experience-tab-globe"
              data-experience-panel="globe"
              hidden
            >
              <div className="globe-demo-layout">
                <div className="demo-globe" data-demo-globe>
                  <svg
                    viewBox="0 0 600 600"
                    role="img"
                    aria-label="Interactive globe with six continents"
                  >
                    <defs>
                      <clipPath id="demo-globe-clip">
                        <circle cx="300" cy="300" r="268" />
                      </clipPath>
                      <radialGradient id="demo-ocean" cx="35%" cy="25%">
                        <stop offset="0" stopColor="#66d8d4" />
                        <stop offset="0.68" stopColor="#1688a5" />
                        <stop offset="1" stopColor="#07526e" />
                      </radialGradient>
                    </defs>
                    <circle cx="300" cy="300" r="272" fill="url(#demo-ocean)" />
                    <g className="globe-grid" clipPath="url(#demo-globe-clip)">
                      <ellipse cx="300" cy="300" rx="270" ry="90" />
                      <ellipse cx="300" cy="300" rx="270" ry="180" />
                      <ellipse cx="300" cy="300" rx="95" ry="270" />
                      <ellipse cx="300" cy="300" rx="190" ry="270" />
                    </g>
                    <g className="globe-land" clipPath="url(#demo-globe-clip)">
                      <path
                        data-continent-shape="north-america"
                        d="M78 176 138 108 230 92 275 135 248 190 206 202 188 250 130 236 104 205Z"
                      />
                      <path
                        data-continent-shape="south-america"
                        d="M217 260 274 251 304 300 282 353 266 432 234 493 213 414 228 347 199 301Z"
                      />
                      <path
                        data-continent-shape="europe"
                        d="M307 168 349 143 391 160 382 199 350 213 318 197Z"
                      />
                      <path
                        data-continent-shape="africa"
                        d="M324 220 391 211 425 267 397 354 359 401 326 341 302 278Z"
                      />
                      <path
                        data-continent-shape="asia"
                        d="M382 133 506 112 552 187 505 254 447 238 409 202 363 176Z"
                      />
                      <path
                        data-continent-shape="oceania"
                        d="M462 352 519 342 549 386 501 421 459 399Z"
                      />
                    </g>
                    <circle
                      className="globe-marker"
                      data-globe-marker
                      cx="178"
                      cy="177"
                      r="38"
                    />
                  </svg>
                </div>
                <aside className="globe-fact-card">
                  <p>GLOBE EXPLORER</p>
                  <h3 data-continent-name>North America</h3>
                  <p data-continent-fact>
                    North America has Arctic ice, forests, deserts, mountains,
                    farms, and warm beaches.
                  </p>
                  <div data-continent-countries>
                    <span>United States</span>
                    <span>Canada</span>
                    <span>Mexico</span>
                  </div>
                </aside>
              </div>
              <div className="continent-picker" aria-label="Choose a continent">
                {continents.map(([id, label], index) => (
                  <button
                    type="button"
                    data-continent={id}
                    className={index === 0 ? "is-selected" : undefined}
                    aria-pressed={index === 0}
                    key={id}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </section>

            <section
              className="experience-panel safety-demo"
              id="experience-safety"
              role="tabpanel"
              aria-labelledby="experience-tab-safety"
              data-experience-panel="safety"
              hidden
            >
              <div className="safety-demo-layout">
                <div className="fire-scene" data-fire-scene>
                  <div className="fire-window" aria-hidden="true">
                    <i />
                    <i />
                  </div>
                  <div className="fire-counter" aria-hidden="true" />
                  <div className="fire-stove" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </div>
                  <div className="fire-pan" aria-hidden="true" />
                  <div className="pan-flames" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </div>
                  <div className="fire-safe-badge" data-fire-safe-badge hidden>
                    <ShieldCheck size={38} /> Grown-up alerted
                  </div>
                </div>
                <div className="safety-question">
                  <p>FIRE SAFETY · STEP 1</p>
                  <h3>A pan is smoking. What is the safest first move?</h3>
                  <div className="safety-choices">
                    <button type="button" data-safety-choice="grown-up">
                      Step back and tell a grown-up
                    </button>
                    <button type="button" data-safety-choice="water">
                      Pour water on the pan
                    </button>
                    <button type="button" data-safety-choice="touch">
                      Pick up the hot pan
                    </button>
                  </div>
                  <p
                    className="safety-feedback"
                    data-safety-feedback
                    aria-live="polite"
                  >
                    Choose the move that keeps you safely away from heat.
                  </p>
                  <button
                    type="button"
                    className="safety-reset"
                    data-safety-reset
                  >
                    <RotateCcw aria-hidden="true" size={18} /> Try again
                  </button>
                </div>
              </div>
            </section>

            <section
              className="experience-panel countries-demo"
              id="experience-countries"
              role="tabpanel"
              aria-labelledby="experience-tab-countries"
              data-experience-panel="countries"
              hidden
            >
              <div className="country-demo-layout">
                <div className="country-map">
                  <svg
                    viewBox="0 0 900 480"
                    role="img"
                    aria-label="World map with selectable countries"
                  >
                    <path
                      className="flat-land"
                      d="M46 145 92 84 188 58 255 92 280 140 238 181 175 183 149 229 86 212ZM245 228 301 215 332 252 313 307 295 397 260 436 238 351 249 292 222 254ZM421 106 475 83 519 107 503 139 465 148 441 136ZM441 160 522 151 556 218 527 318 476 358 439 293 409 214ZM508 77 678 52 790 102 830 177 762 235 677 222 625 180 550 150ZM721 304 793 293 839 337 783 379 722 358Z"
                    />
                    {countries.map(([id, label, code, x, y]) => (
                      <g
                        className={`country-pin${id === "united-states" ? " is-selected" : ""}`}
                        data-country-pin={id}
                        transform={`translate(${x} ${y})`}
                        key={id}
                      >
                        <circle r="24" />
                        <text textAnchor="middle" dominantBaseline="central">
                          {code}
                        </text>
                        <title>{label}</title>
                      </g>
                    ))}
                  </svg>
                </div>
                <aside className="country-fact-card">
                  <p>MAP &amp; COUNTRIES</p>
                  <h3 data-country-name>United States</h3>
                  <strong data-country-capital>
                    Capital: Washington, D.C.
                  </strong>
                  <p data-country-fact>
                    The United States has 50 states and landscapes ranging from
                    Arctic Alaska to tropical Hawaii.
                  </p>
                </aside>
              </div>
              <div className="country-picker" aria-label="Choose a country">
                {countries.map(([id, label, code], index) => (
                  <button
                    type="button"
                    data-country={id}
                    className={index === 0 ? "is-selected" : undefined}
                    aria-pressed={index === 0}
                    key={id}
                  >
                    <b>{code}</b>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>
      </section>

      <p className="demo-disclaimer">
        Public sampler only. These lightweight, code-native scenes demonstrate
        the kiosk&apos;s core ideas; the full offline installation includes the
        hardware-accelerated 3D modules and keeps progress locally under parent
        control.
      </p>

      <SiteFooter />
    </main>
  );
}
