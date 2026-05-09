import { useEffect, useMemo, useRef, useState } from 'react';
import { sendLandingAgentMessage } from '../services/api';
import { message } from '../services/message';
import type { LandingAgentMessage } from '../types';
import Icon from './Icons';

interface SignUpScreenProps {
  onSubmit: (mode: 'signup' | 'login', email: string, password: string) => Promise<void>;
  isSubmitting: boolean;
  errorMessage: string;
}

export default function SignUpScreen({
  onSubmit,
  isSubmitting,
  errorMessage,
}: SignUpScreenProps) {
  const railIcons = ['sparkles', 'search', 'history', 'security'] as const;
  const starterPrompts = [
    '这个网站现在已经支持哪些功能？',
    '上传图片和文件之后可以做什么？',
    '登录之后我的聊天记录会怎么保存？',
  ] as const;
  const [mode, setMode] = useState<'signup' | 'login'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const [agentMessages, setAgentMessages] = useState<LandingAgentMessage[]>([
    {
      role: 'assistant',
      content:
        '你好，我是 CHAT A.I+ 的导览 agent。你可以先问我这个网站能做什么、支持哪些上传能力，或者登录后你的对话会如何保存。',
    },
  ]);
  const [agentInput, setAgentInput] = useState('');
  const [agentError, setAgentError] = useState('');
  const [isAgentLoading, setIsAgentLoading] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const agentAbortRef = useRef<AbortController | null>(null);
  const lastErrorRef = useRef('');

  const heading = useMemo(
    () => (mode === 'signup' ? 'Create your account' : 'Welcome back'),
    [mode]
  );
  const subheading = useMemo(
    () =>
      mode === 'signup'
        ? 'Register with your email to keep your chat history and settings.'
        : 'Sign in to continue your conversations and saved context.',
    [mode]
  );

  useEffect(() => {
    const thread = threadRef.current;
    if (!thread) {
      return;
    }

    thread.scrollTo({
      top: thread.scrollHeight,
      behavior: 'smooth',
    });
  }, [agentMessages, isAgentLoading]);

  useEffect(() => {
    return () => {
      agentAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const nextError = localError || errorMessage;
    if (!nextError) {
      lastErrorRef.current = '';
      return;
    }

    if (lastErrorRef.current === nextError) {
      return;
    }

    lastErrorRef.current = nextError;
    message.error(nextError);
  }, [errorMessage, localError]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim();

    if (!normalizedEmail || !password) {
      setLocalError('Email and password are required');
      return;
    }

    if (mode === 'signup' && password.length < 8) {
      setLocalError('Password must be at least 8 characters');
      return;
    }

    setLocalError('');
    await onSubmit(mode, normalizedEmail, password);
  };

  const handleAgentSend = async (draft?: string) => {
    const content = (draft ?? agentInput).trim();
    if (!content || isAgentLoading) {
      return;
    }

    const userMessage: LandingAgentMessage = { role: 'user', content };
    const assistantPlaceholder: LandingAgentMessage = { role: 'assistant', content: '' };
    const history = agentMessages.slice(-6);

    agentAbortRef.current?.abort();
    const controller = new AbortController();
    agentAbortRef.current = controller;

    setAgentError('');
    setAgentInput('');
    setIsAgentLoading(true);
    setAgentMessages((current) => [...current, userMessage, assistantPlaceholder]);

    let receivedChunk = false;

    try {
      await sendLandingAgentMessage(
        content,
        history,
        (chunk) => {
          receivedChunk = true;
          setAgentMessages((current) => {
            const next = [...current];
            const lastMessage = next[next.length - 1];
            if (lastMessage?.role === 'assistant') {
              next[next.length - 1] = {
                ...lastMessage,
                content: lastMessage.content + chunk,
              };
            }
            return next;
          });
        },
        (nextError) => {
          setAgentError(nextError);
        },
        controller.signal
      );
    } catch (err) {
      if (!(err instanceof Error && err.name === 'AbortError')) {
        setAgentError(err instanceof Error ? err.message : 'Guide agent is unavailable');
      }
    } finally {
      setIsAgentLoading(false);
      agentAbortRef.current = null;
      setAgentMessages((current) => {
        const next = [...current];
        const lastMessage = next[next.length - 1];

        if (lastMessage?.role !== 'assistant') {
          return next;
        }

        if (lastMessage.content.trim()) {
          return next;
        }

        next[next.length - 1] = {
          role: 'assistant',
          content: receivedChunk ? lastMessage.content : '我这会儿没有成功回复，你可以再问我一次。',
        };
        return next;
      });
    }
  };

  const handleSocialLogin = () => {
    message.info('功能暂未实现');
  };

  return (
    <div className="sign-screen">
      <section className="sign-hero">
        <div className="sign-brand">CHAT A.I+</div>
        <div className="sign-copy">
          <h1>先和网站导览 Agent 聊聊，再决定怎么开始。</h1>
          <p>你可以直接问它功能、上传能力、记忆方式，或者登录后会发生什么。</p>

          <div className="sign-starter-prompts">
            {starterPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="sign-starter-chip"
                disabled={isAgentLoading}
                onClick={() => {
                  void handleAgentSend(prompt);
                }}
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="sign-agent-shell">
            <div className="sign-agent-head">
              <div className="sign-agent-meta">
                <span className="sign-agent-avatar" aria-hidden="true">
                  <Icon name="sparkles" />
                </span>
                <span className="sign-agent-name">Navigator</span>
              </div>
            </div>

            <div className="sign-agent-thread" ref={threadRef}>
              {agentMessages.map((entry, index) => (
                <div
                  key={`${entry.role}-${index}`}
                  className={`sign-agent-row ${entry.role === 'user' ? 'is-user' : ''}`}
                >
                  <div
                    className={`sign-agent-bubble ${entry.role === 'user' ? 'is-user' : ''} ${
                      !entry.content.trim() ? 'is-empty' : ''
                    }`}
                  >
                    {entry.content.trim() || '正在输入...'}
                  </div>
                </div>
              ))}
            </div>

            {agentError ? (
              <div className="sign-agent-error" role="alert">
                {agentError}
              </div>
            ) : null}

            <form
              className="sign-agent-composer"
              onSubmit={(event) => {
                event.preventDefault();
                void handleAgentSend();
              }}
            >
              <input
                type="text"
                value={agentInput}
                placeholder="问问它：这个网站现在能做什么？"
                onChange={(event) => {
                  setAgentInput(event.target.value);
                  if (agentError) {
                    setAgentError('');
                  }
                }}
              />
              <button type="submit" disabled={!agentInput.trim() || isAgentLoading}>
                <Icon name="send" />
              </button>
            </form>
          </div>
        </div>

        <div className="sign-rail">
          {railIcons.map((iconName) => (
            <span key={iconName} className="sign-rail-icon">
              <Icon name={iconName} />
            </span>
          ))}
        </div>
      </section>

      <section className="sign-panel">
        <div className="sign-panel-inner">
          <h2>{heading}</h2>
          <p>{subheading}</p>

          <form onSubmit={handleSubmit}>
            <label className="sign-field">
              <span>Email Address*</span>
              <input
                type="email"
                placeholder="ex. email@domain.com"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (localError) {
                    setLocalError('');
                  }
                }}
                autoComplete="email"
              />
            </label>
            <label className="sign-field">
              <span>Password*</span>
              <div className="sign-password-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (localError) {
                      setLocalError('');
                    }
                  }}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  <Icon name={showPassword ? 'eye-close' : 'eye'} />
                </button>
              </div>
            </label>

            <p className="sign-terms">
              By continuing, you agree to the{' '}
              <button type="button">Terms of Service</button> and acknowledge the{' '}
              <button type="button">Privacy Statement</button>.
            </p>
            <button type="submit" className="sign-primary-button" disabled={isSubmitting}>
              {isSubmitting
                ? mode === 'signup'
                  ? 'Creating account...'
                  : 'Signing in...'
                : mode === 'signup'
                  ? 'Get started free'
                  : 'Login'}
            </button>
          </form>

          <p className="sign-login-text">
            {mode === 'signup' ? 'Already have an account? ' : "Don't have an account? "}
            <button
              type="button"
              onClick={() => {
                setMode((current) => (current === 'signup' ? 'login' : 'signup'));
                setLocalError('');
              }}
            >
              {mode === 'signup' ? 'Login' : 'Create one'}
            </button>
          </p>
          <div className="sign-divider">Social login coming soon</div>
          <button type="button" className="social-button" onClick={handleSocialLogin}>
            <Icon name="google" />
            <span>Continue with Google</span>
          </button>
          <button type="button" className="social-button" onClick={handleSocialLogin}>
            <Icon name="apple" />
            <span>Continue with Apple</span>
          </button>
        </div>
      </section>
    </div>
  );
}
