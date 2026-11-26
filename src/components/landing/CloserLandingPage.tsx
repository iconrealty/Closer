import React from 'react';
import {
  Home,
  ArrowRight,
  MessageCircle,
  Check,
  ArrowDownRight,
} from 'lucide-react';

interface CloserLandingPageProps {
  onSignIn: () => void;
  onSignUp: () => void;
}

export const CloserLandingPage: React.FC<CloserLandingPageProps> = ({
  onSignIn,
  onSignUp,
}) => {
  return (
    <main className="landing min-h-[100dvh]">
      {/* 1. Navigation Header */}
      <header className="landing-nav">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="closer-brand"
        >
          <span className="closer-brand-mark">
            <Home size={20} />
          </span>
          <span>
            closer<span className="closer-brand-dot">.</span>
          </span>
        </a>

        <nav aria-label="Landing navigation">
          <a href="#approach">Our approach</a>
          <a href="#features">What matters</a>
        </nav>

        <div className="landing-actions">
          <button
            type="button"
            onClick={onSignIn}
            className="text-link"
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={onSignUp}
            className="landing-btn button-dark"
          >
            Start with Closer <ArrowRight size={16} />
          </button>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="eyebrow-line" />
            RELATIONSHIPS, NOT RECORDS
          </div>

          <h1>
            Every move
            <br />
            starts <em>with a story.</em>
          </h1>

          <p>
            Closer gives your real estate relationships the attention they
            deserve — from the first &ldquo;just looking&rdquo; to the keys in
            hand.
          </p>

          <div className="hero-actions">
            <button
              type="button"
              onClick={onSignUp}
              className="landing-btn button-dark"
            >
              Meet your new CRM <ArrowRight size={17} />
            </button>
            <span className="micro-copy">
              <span className="tiny-spark">✦</span> Built for the follow-through
            </span>
          </div>

          <div className="hero-proof">
            <div className="stacked-avatars">
              <i>JM</i>
              <i>AR</i>
              <i>KC</i>
            </div>
            <span>
              More thoughtful days.
              <br />
              <b>Better client experiences.</b>
            </span>
          </div>
        </div>

        <div className="hero-visual">
          <div className="sun-disc" />
          <div className="arch-window">
            <div className="arch-sky">
              <div className="sun" />
              <div className="hills hill-back" />
              <div className="hills hill-front" />
            </div>
            <div className="house-illustration">
              <div className="roof" />
              <div className="house-body">
                <div className="window window-left" />
                <div className="door" />
                <div className="window window-right" />
              </div>
              <div className="plant plant-left" />
              <div className="plant plant-right" />
            </div>
          </div>

          <div className="floating-note note-top">
            <span className="note-icon">
              <MessageCircle size={15} />
            </span>
            <div>
              <b>Remember the why</b>
              <small>Space for a growing family</small>
            </div>
          </div>

          <div className="floating-note note-bottom">
            <span className="check-ring">
              <Check size={14} />
            </span>
            <div>
              <b>Follow-up, right on time</b>
              <small>Alex · Today at 10:30 am</small>
            </div>
          </div>

          <div className="visual-caption">
            <span>01 / THE CLOSER WAY</span>
            <span>Make room for what matters.</span>
          </div>
        </div>
      </section>

      {/* 3. Manifesto Band */}
      <section className="manifesto" id="approach">
        <div className="section-kicker">A LITTLE MORE HUMAN</div>
        <h2>
          People aren&rsquo;t a pipeline.
          <br />
          <span>They&rsquo;re planning a life.</span>
        </h2>
        <p>
          Behind every search is a reason. A new job. A little more room. A
          fresh start. Closer helps you keep that reason in view — and the next
          step within reach.
        </p>
      </section>

      {/* 4. Feature Band */}
      <section className="feature-band" id="features">
        <div className="feature-heading">
          <div className="section-kicker">THE DETAILS THAT MAKE THE DIFFERENCE</div>
          <h2>
            Good follow-through
            <br />
            feels personal.
          </h2>
        </div>

        <div className="feature-list">
          <article>
            <span>01</span>
            <div>
              <h3>Start with their story</h3>
              <p>
                Capture what&rsquo;s prompting the move, what home needs to feel
                like, and the little details they don&rsquo;t want to repeat.
              </p>
            </div>
            <ArrowDownRight size={18} />
          </article>

          <article>
            <span>02</span>
            <div>
              <h3>Keep the next step clear</h3>
              <p>
                A gentle reminder at the right moment beats another dashboard
                full of numbers. Your day starts with what needs you.
              </p>
            </div>
            <ArrowDownRight size={18} />
          </article>

          <article>
            <span>03</span>
            <div>
              <h3>Make every touchpoint count</h3>
              <p>
                Calls, notes, and conversations live alongside the relationship
                — so each check-in picks up where you left off.
              </p>
            </div>
            <ArrowDownRight size={18} />
          </article>
        </div>
      </section>

      {/* 5. Bottom CTA Band */}
      <section className="landing-cta">
        <div>
          <div className="section-kicker">A BETTER WAY TO STAY CLOSE</div>
          <h2>
            Make the next move
            <br />
            <em>feel like theirs.</em>
          </h2>
        </div>
        <button
          type="button"
          onClick={onSignUp}
          className="landing-btn button-cream"
        >
          Get started with Closer <ArrowRight size={17} />
        </button>
      </section>

      {/* 6. Footer */}
      <footer className="landing-footer">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="closer-brand"
        >
          <span className="closer-brand-mark">
            <Home size={18} />
          </span>
          <span>
            closer<span className="closer-brand-dot">.</span>
          </span>
        </a>
        <span>Made for the people behind the move.</span>
        <span>© 2026 Closer CRM</span>
      </footer>
    </main>
  );
};
