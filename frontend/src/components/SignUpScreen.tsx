import Icon from './Icons';

interface SignUpScreenProps {
  onEnter: () => void;
}

export default function SignUpScreen({ onEnter }: SignUpScreenProps) {
  const railIcons = ['edit', 'thumb', 'thumb-down', 'copy'] as const;

  return (
    <div className="sign-screen">
      <section className="sign-hero">
        <div className="sign-brand">CHAT A.I+</div>
        <div className="sign-copy">
          <h1>Learn, Discover &amp; Automate in One Place.</h1>
          <p>Create a chatbot gpt using python language what will be step for that</p>
          <span className="sign-tag">CHAT A.I+ </span>
          <div className="sign-demo-card">
            <p>
              Sure, I can help you get started with creating a chatbot using GPT in Python.
              Here are the basic steps you&apos;ll need to follow:
            </p>
            <ol>
              <li>Install the required libraries and set up your API access.</li>
              <li>Load a model that fits your speed and quality needs.</li>
              <li>Send prompts, stream answers, and store the conversation.</li>
            </ol>
            <p>
              Depending on your requirements, you may need to add more features or complexity
              to the chatbot. Good luck!
            </p>
          </div>
        </div>

        <div className="sign-rail">
          {railIcons.map((iconName) => (
            <span key={iconName} className="sign-rail-icon">
              <Icon name={iconName} />
            </span>
          ))}
        </div>

        <div className="sign-composer-preview">
          <button
            type="button"
            className="composer-ghost composer-ghost-left"
            aria-label="Composer action"
          >
            <Icon name="smile" />
          </button>
          <input value="Reply..." readOnly />
          <button
            type="button"
            className="composer-ghost composer-ghost-right"
            aria-label="Open gallery"
          >
            <Icon name="gallery" />
          </button>
          <button
            type="button"
            className="composer-send-preview"
            aria-label="Continue"
            onClick={onEnter}
          >
            <Icon name="send" />
          </button>
        </div>
      </section>

      <section className="sign-panel">
        <div className="sign-panel-inner">
          <h2>Sign up with free trail</h2>
          <p>Empower your experience, sign up for a free account today</p>
          <label className="sign-field">
            <span>Email Address*</span>
            <input type="email" placeholder="ex. email@domain.com" />
          </label>
          <label className="sign-field">
            <span>Password*</span>
            <div className="sign-password-wrap">
              <input type="password" placeholder="Enter password" />
              <button type="button" aria-label="Toggle password visibility">
                <Icon name="eye" />
              </button>
            </div>
          </label>
          <p className="sign-terms">
            By registering for an account, you are consenting to our{' '}
            <button type="button">Terms of Service</button> and confirming that you have reviewed
            and accepted the <button type="button">Global Privacy Statement</button>.
          </p>
          <button type="button" className="sign-primary-button" onClick={onEnter}>
            Get started free
          </button>
          <p className="sign-login-text">
            Already have an account?{' '}
            <button type="button" onClick={onEnter}>
              Login
            </button>
          </p>
          <div className="sign-divider">Or better yet...</div>
          <button type="button" className="social-button" onClick={onEnter}>
            <Icon name="google" />
            <span>Continue with Google</span>
          </button>
          <button type="button" className="social-button" onClick={onEnter}>
            <Icon name="apple" />
            <span>Continue with Apple</span>
          </button>
        </div>
      </section>
    </div>
  );
}
