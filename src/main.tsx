import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  CssBaseline,
  GlobalStyles,
  Paper,
  TextField,
  ThemeProvider,
  Typography,
  createTheme,
  useMediaQuery,
} from '@mui/material';
import { useMemo } from 'react';
import './legacy';

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
    <Box
      component="main"
      className="gate-screen"
      sx={{ alignItems: 'center', display: 'flex', inset: 0, justifyContent: 'center', minHeight: '100dvh', p: 3, position: 'fixed', zIndex: 1300 }}
    >
      <Paper
        component="form"
        elevation={6}
        onSubmit={submit}
        sx={{ border: 1, borderColor: 'divider', borderRadius: 2, maxWidth: 420, p: { xs: 3, sm: 4 }, width: '100%' }}
      >
        <Box sx={{ alignItems: 'center', bgcolor: 'primary.main', borderRadius: 1.5, color: 'primary.contrastText', display: 'flex', fontFamily: 'Chakra Petch, sans-serif', fontSize: 16, fontWeight: 700, height: 44, justifyContent: 'center', letterSpacing: '.08em', width: 58 }} aria-hidden="true">
          PLC
        </Box>
        <Typography color="text.secondary" sx={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 10, fontWeight: 600, letterSpacing: '.12em', mt: 3 }}>
          PLC LADDER SIMULATOR
        </Typography>
        <Typography component="h1" sx={{ fontSize: 23, fontWeight: 700, mt: 1 }} variant="h5">
          비밀번호를 입력하세요
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3, mt: 1 }} variant="body2">
          계속하려면 접근 비밀번호가 필요합니다.
        </Typography>
        <TextField
          autoComplete="current-password"
          autoFocus
          fullWidth
          id="site-password"
          label="비밀번호"
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          value={password}
          variant="outlined"
        />
        {error && <Alert role="alert" severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        <Button disabled={checking} fullWidth size="large" sx={{ mt: 2 }} type="submit" variant="contained">
          {checking ? <CircularProgress color="inherit" size={20} /> : '접속하기'}
        </Button>
      </Paper>
    </Box>
  );
}

function App() {
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const theme = useMemo(() => createTheme({
    palette: {
      mode: prefersDark ? 'dark' : 'light',
      primary: { main: prefersDark ? '#78a3ff' : '#2b6ae8' },
      success: { main: prefersDark ? '#39c77a' : '#16854a' },
      warning: { main: prefersDark ? '#ffc247' : '#a86b00' },
      error: { main: prefersDark ? '#ff8585' : '#b83232' },
      background: {
        default: prefersDark ? '#0e1318' : '#f0f3f6',
        paper: prefersDark ? '#171e26' : '#ffffff',
      },
      text: {
        primary: prefersDark ? '#e5ebf1' : '#142030',
        secondary: prefersDark ? '#9aa8b6' : '#526170',
      },
      divider: prefersDark ? '#303d4a' : '#d3dbe3',
    },
    shape: { borderRadius: 8 },
    typography: {
      fontFamily: "'IBM Plex Sans KR', system-ui, -apple-system, 'Segoe UI', sans-serif",
      button: { fontWeight: 600, textTransform: 'none' },
    },
    components: {
      MuiButton: { styleOverrides: { root: { borderRadius: 8, boxShadow: 'none', minHeight: 40 } } },
      MuiPaper: { styleOverrides: { rounded: { backgroundImage: 'none' } } },
      MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 8 } } },
    },
  }), [prefersDark]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <GlobalStyles styles={{
        ':root': {
          colorScheme: theme.palette.mode,
          '--bg': theme.palette.background.default,
          '--panel': theme.palette.background.paper,
          '--panel-2': theme.palette.action.hover,
          '--ink': theme.palette.text.primary,
          '--ink-2': theme.palette.text.secondary,
          '--line': theme.palette.divider,
          '--wire': theme.palette.text.disabled,
          '--live': theme.palette.success.main,
          '--live-tint': theme.palette.success.main + '26',
          '--run-bg': theme.palette.success.dark,
          '--lamp': theme.palette.warning.main,
          '--lamp-glow': theme.palette.warning.main + '66',
          '--in': theme.palette.primary.main,
          '--sel': theme.palette.primary.main,
          '--sel-bg': theme.palette.primary.main + '1c',
          '--warn': theme.palette.warning.main,
          '--danger': theme.palette.error.main,
          '--sans': theme.typography.fontFamily,
          '--mono': "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
        },
        'body, .gate-screen': { backgroundColor: theme.palette.background.default, color: theme.palette.text.primary },
        '.app': { maxWidth: 1440, gap: 2 },
        '.quickstart': { alignItems: 'center', backgroundColor: theme.palette.action.hover, border: `1px solid ${theme.palette.divider}`, borderRadius: 1.5, display: 'flex', flexWrap: 'wrap', gap: 1, padding: '10px 14px' },
        '.quickstart strong': { color: theme.palette.text.primary, marginRight: 4 },
        '.quickstart span': { alignItems: 'center', color: theme.palette.text.secondary, display: 'inline-flex', fontSize: 12, gap: 6 },
        '.quickstart b': { alignItems: 'center', backgroundColor: theme.palette.primary.main, borderRadius: '50%', color: theme.palette.primary.contrastText, display: 'inline-flex', fontSize: 10, height: 18, justifyContent: 'center', width: 18 },
        '.panel, .help': { backgroundColor: theme.palette.background.paper, borderColor: theme.palette.divider, borderRadius: 1.5, boxShadow: theme.shadows[1] },
        '.ph': { borderColor: theme.palette.divider },
        '.editor, .curline': { backgroundColor: theme.palette.action.hover, borderColor: theme.palette.divider },
        '.btn, .pick, .mode, .fld select, .fld input, #cmd, .rung-h .note': {
          borderColor: theme.palette.divider,
          borderRadius: 1,
          color: theme.palette.text.primary,
        },
        '.btn, .pick': { backgroundColor: theme.palette.background.paper, minHeight: 36 },
        '.btn:hover:not(:disabled), .pick:hover, .mode:hover': { backgroundColor: theme.palette.action.hover, borderColor: theme.palette.text.secondary },
        '.btn.sm': { minHeight: 32 },
        '.btn.pri': { backgroundColor: theme.palette.primary.main, borderColor: theme.palette.primary.main, color: theme.palette.primary.contrastText },
        '.btn.pri:hover:not(:disabled)': { backgroundColor: theme.palette.primary.dark, borderColor: theme.palette.primary.dark, opacity: 1 },
        '.seg': { backgroundColor: theme.palette.background.paper, borderColor: theme.palette.divider, borderRadius: 1 },
        '.seg button[aria-pressed="true"]': { backgroundColor: theme.palette.primary.main, color: theme.palette.primary.contrastText },
        '.xin': { backgroundColor: theme.palette.action.hover, borderRadius: 1 },
        '.xin.on': { borderColor: theme.palette.primary.main },
        '.rung, .io .sec': { borderColor: theme.palette.divider },
        '.rung-h .note:focus, .fld select:focus, .fld input:focus, #cmd:focus': { borderColor: theme.palette.primary.main, outlineColor: theme.palette.primary.main },
        'dialog': { backgroundColor: theme.palette.background.paper, borderColor: theme.palette.divider, borderRadius: 2, boxShadow: theme.shadows[12] },
        'dialog::backdrop': { backgroundColor: 'rgba(8, 14, 20, .58)' },
      }} />
      <PasswordGate />
    </ThemeProvider>
  );
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('React root element #root was not found.');

createRoot(rootElement).render(<App />);
