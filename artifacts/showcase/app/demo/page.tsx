import type { Metadata } from "next";
import {
  ArrowLeft,
  Check,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { SiteFooter, SiteHeader } from "../site-shell";

export const metadata: Metadata = {
  title: "Number Garden demo | LetsLearnMoreOS",
  description:
    "Try a deterministic LetsLearnOS math activity with no account and no saved data.",
};

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
            <span>LIVE DEMO</span> · NUMBER GARDEN
          </p>
          <h1>
            Try the game.
            <span> Leave no progress behind.</span>
          </h1>
          <p className="hero-summary">
            This is a real, deterministic activity from the LetsLearnOS design
            language. It runs entirely in this tab and forgets everything when
            you reload or leave.
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

      <section className="game-shell" data-demo-game data-testid="demo-game">
        <div className="game-topbar">
          <div>
            <p>NUMBER GARDEN</p>
            <span>Find the missing number</span>
          </div>
          <div className="game-stats" aria-label="Game progress">
            <span>
              Round <b data-round>1</b> / 5
            </span>
            <span>
              Stars <b data-stars>0</b>
            </span>
          </div>
        </div>

        <div className="game-stage">
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
        </div>
      </section>

      <p className="demo-disclaimer">
        Sample activity only. The full kiosk keeps progress locally under parent
        control; this public demo intentionally does not.
      </p>

      <SiteFooter />
    </main>
  );
}
