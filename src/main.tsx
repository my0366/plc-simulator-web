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
      primary: { main: prefersDark ? '#83b1ff' : '#3182f6' },
      success: { main: prefersDark ? '#3bd18a' : '#19a974' },
      warning: { main: prefersDark ? '#ffc85a' : '#ee9b16' },
      error: { main: prefersDark ? '#ff8585' : '#b83232' },
      background: {
        default: prefersDark ? '#101318' : '#f7f8fa',
        paper: prefersDark ? '#191d24' : '#ffffff',
      },
      text: {
        primary: prefersDark ? '#f0f2f5' : '#191f28',
        secondary: prefersDark ? '#a6adb8' : '#6b7684',
      },
      divider: prefersDark ? '#30343d' : '#e5e8eb',
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
        '.app': { maxWidth: 1480, gap: 1, paddingBlock: '32px 56px' },
        '.top': { alignItems: 'center', gap: '20px 28px' },
        '.brand h1': { fontSize: 30, letterSpacing: '-.02em' },
        '.brand p': { fontSize: 14, marginTop: 7 },
        '.quickstart': { alignItems: 'center', backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 2, boxShadow: theme.shadows[1], display: 'flex', flexWrap: 'wrap', gap: '12px 22px', padding: '18px 22px' },
        '.quickstart strong': { color: theme.palette.text.primary, marginRight: 4 },
        '.quickstart span': { alignItems: 'center', color: theme.palette.text.secondary, display: 'inline-flex', fontSize: 13, gap: 8 },
        '.quickstart b': { alignItems: 'center', backgroundColor: theme.palette.primary.main, borderRadius: '50%', color: theme.palette.primary.contrastText, display: 'inline-flex', fontSize: 10, height: 18, justifyContent: 'center', width: 18 },
        '.panel, .help': { backgroundColor: theme.palette.background.paper, borderColor: theme.palette.divider, borderRadius: 2.5, boxShadow: theme.palette.mode === 'dark' ? '0 12px 32px rgba(0,0,0,.24)' : '0 10px 28px rgba(25,42,62,.08)' },
        '.grid': { gap: 1 },
        '.memory-grid': { gap: 1 },
        '.ph': { backgroundColor: theme.palette.action.hover, borderColor: theme.palette.divider, borderRadius: '20px 20px 0 0', gap: '14px 18px', padding: '18px 22px' },
        '.ph h2': { fontSize: 15 },
        '.editor': { backgroundColor: theme.palette.action.hover, borderColor: theme.palette.divider, gap: '10px 14px', padding: '14px 20px' },
        '.curline': { backgroundColor: theme.palette.action.hover, borderColor: theme.palette.divider, lineHeight: 1.65, padding: '12px 20px' },
        '.io': { padding: 0 },
        '.io .sec': { backgroundColor: 'transparent', border: 0, borderRadius: 0, margin: 0, padding: '18px 18px 20px' },
        '.lbl': { marginBottom: 14 },
        '.tiles': { gap: '14px 10px' },
        '.xin': { backgroundColor: theme.palette.action.hover, borderRadius: 1.5, gap: 8, padding: '12px 8px 10px' },
        '.mode': { borderRadius: 1, height: 26, marginTop: 2, paddingInline: 8 },
        '.lamp': { gap: 8, padding: '10px 6px' },
        '.rung-h': { gap: '8px 10px', padding: '14px 20px 0' },
        '.rung-b': { padding: '8px 20px 18px' },
        '.help': { paddingInline: 20 },
        '.help summary': { paddingBlock: 14 },
        '.help ul': { gap: 8, lineHeight: 1.65, paddingBottom: 18 },
        '.scenario': { gap: 8, padding: '16px 20px' },
        '.scenario-row': { borderRadius: 1.5, gap: 8, padding: '9px 12px' },
        '.scenario-head': { gap: 8, paddingInline: 12 },
        '.scenario-row select, .scenario-row input': { borderRadius: 1, height: 36, paddingInline: 10 },
        '.scenario-label': { gap: '10px 16px', lineHeight: 1.6, padding: '14px 20px 0' },
        '.cwrap': { padding: '12px 20px 18px' },
        '.legend.foot': { gap: '10px 18px', padding: '0 20px 18px' },
        '.app > .ctl[aria-label="프로그램 저장"]': { backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 1.75, boxShadow: theme.shadows[1], padding: '10px 14px' },
        '.app > .ctl[aria-label="프로그램 저장"] .savestate': { flex: '1 1 200px' },
        '.btn, .pick, .mode, .fld select, .fld input, #cmd, .rung-h .note': {
          borderColor: theme.palette.divider,
          borderRadius: 1.25,
          color: theme.palette.text.primary,
        },
        '.btn, .pick': { backgroundColor: theme.palette.background.paper, minHeight: 40, paddingInline: 14 },
        '.btn:hover:not(:disabled), .pick:hover, .mode:hover': { backgroundColor: theme.palette.action.hover, borderColor: theme.palette.text.secondary },
        '.btn.sm': { minHeight: 34, paddingInline: 10 },
        '.btn.pri': { backgroundColor: theme.palette.primary.main, borderColor: theme.palette.primary.main, color: theme.palette.primary.contrastText },
        '.btn.pri:hover:not(:disabled)': { backgroundColor: theme.palette.primary.dark, borderColor: theme.palette.primary.dark, opacity: 1 },
        '.seg': { backgroundColor: theme.palette.background.paper, borderColor: theme.palette.divider, borderRadius: 1.25, padding: 3 },
        '.seg button': { height: 36, borderRadius: 1, paddingInline: 16 },
        '.seg button[aria-pressed="true"]': { backgroundColor: theme.palette.primary.main, color: theme.palette.primary.contrastText },
        '.xin.on': { borderColor: theme.palette.primary.main },
        '.rung, .io .sec': { borderColor: theme.palette.divider },
        '.rung-h .note:focus, .fld select:focus, .fld input:focus, #cmd:focus': { borderColor: theme.palette.primary.main, outlineColor: theme.palette.primary.main },
        'dialog': { backgroundColor: theme.palette.background.paper, borderColor: theme.palette.divider, borderRadius: 2, boxShadow: theme.shadows[12] },
        'dialog::backdrop': { backgroundColor: 'rgba(8, 14, 20, .58)' },
        '@media (max-width: 600px)': {
          '.app': { paddingTop: 18, paddingBottom: 32, gap: 18 },
          '.brand h1': { fontSize: 26 },
          '.ph': { padding: '15px 17px' },
          '.io': { padding: 0 },
          '.io .sec, .editor': { padding: '15px 16px' },
          '.rung-h': { paddingInline: 16 },
          '.rung-b': { paddingInline: 16 },
          '.scenario, .scenario-label': { paddingInline: 16 },
          '.cwrap': { paddingInline: 16 },
          '.legend.foot': { paddingInline: 16 },
          '.help': { paddingInline: 16 },
        },
      }} />
      <PasswordGate />
    </ThemeProvider>
  );
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('React root element #root was not found.');

createRoot(rootElement).render(<App />);
