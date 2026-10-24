import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import './password.css';
import './legacy.js';

const PASSWORD_HASH = import.meta.env.VITE_PASSWORD_SHA256?.trim().toLowerCase();
const SESSION_KEY = 'plc-simulator-unlocked';

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function PasswordGate() {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(SESSION_KEY) === 'true');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const legacyApp = document.getElementById('legacy-app');
    if (legacyApp) legacyApp.hidden = !unlocked;
  }, [unlocked]);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError('');
    if (!PASSWORD_HASH || !/^[a-f0-9]{64}$/.test(PASSWORD_HASH)) {
      setError('비밀번호 설정이 아직 완료되지 않았습니다. 관리자에게 문의하세요.');
      return;
    }
    setChecking(true);
    try {
      if (await sha256(password) === PASSWORD_HASH) {
        sessionStorage.setItem(SESSION_KEY, 'true');
        const legacyApp = document.getElementById('legacy-app');
        if (legacyApp) legacyApp.hidden = false;
        setUnlocked(true);
      } else {
        setError('비밀번호가 올바르지 않습니다.');
      }
    } catch {
      setError('이 브라우저에서는 보안 연결이 필요합니다. HTTPS 주소로 접속하세요.');
    } finally {
      setChecking(false);
    }
  }

  return unlocked ? null : (
    <main className="gate-screen">
      <form className="gate-card" onSubmit={submit}>
        <div className="gate-mark" aria-hidden="true">PLC</div>
        <p className="gate-eyebrow">PLC LADDER SIMULATOR</p>
        <h1>비밀번호를 입력하세요</h1>
        <p className="gate-description">계속하려면 접근 비밀번호가 필요합니다.</p>
        <label className="gate-label" htmlFor="site-password">비밀번호</label>
        <input
          autoFocus
          autoComplete="current-password"
          className="gate-input"
          id="site-password"
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          value={password}
        />
        {error && <p className="gate-error" role="alert">{error}</p>}
        <button className="gate-submit" disabled={checking} type="submit">
          {checking ? '확인 중…' : '접속하기'}
        </button>
      </form>
    </main>
  );
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('React root element #root was not found.');

createRoot(rootElement).render(<PasswordGate />);
