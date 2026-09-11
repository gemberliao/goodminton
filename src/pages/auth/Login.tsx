import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, CheckCircle2, UserPlus } from 'lucide-react';
import { getSupabaseConfig, supabase } from '../../lib/supabase';
import { describeSupabaseError } from '../../lib/supabaseErrors';
import { useAuthSession } from '../../auth/AuthSessionProvider';
import type { Profile, UserGender, UserLevel } from '../../types';
import { accountToInternalAuthEmail, normalizeAuthAccount } from '../../utils/authAccount';

const PROFILE_FIELDS = 'id, auth_user_id, username, name, level, role, gender, status, phone, avatar_url, created_at';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { refreshProfile } = useAuthSession();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regLevel, setRegLevel] = useState<UserLevel>('中級');
  const [regGender, setRegGender] = useState<UserGender>('male');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginSuccessName, setLoginSuccessName] = useState('');

  const resetMessages = () => {
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleLoginSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    resetMessages();

    const cleanAccount = normalizeAuthAccount(account);
    if (!cleanAccount || !password) {
      setErrorMessage('請填寫帳號與密碼。');
      return;
    }
    if (!getSupabaseConfig().isConfigured) {
      setErrorMessage('系統服務尚未完成設定，請聯絡管理員。');
      return;
    }

    setLoading(true);
    try {
      const { data: loginResult, error: loginError } = await supabase.functions.invoke('login-with-account', {
        body: {
          account: cleanAccount,
          password,
        },
      });

      if (loginError || !loginResult?.success || !loginResult.accessToken || !loginResult.refreshToken) {
        if (loginResult?.code === 'pending') {
          setErrorMessage('註冊已成功，正在等待管理員審核；核准後才能登入。');
          return;
        }
        if (loginResult?.code === 'rejected') {
          setErrorMessage('您的註冊申請未通過，請聯絡球隊管理員。');
          return;
        }
        setErrorMessage('登入失敗，請確認帳號與密碼是否正確。');
        return;
      }

      window.sessionStorage.setItem('goodminton-login-transition', String(Date.now()));
      const { data: authData, error: authError } = await supabase.auth.setSession({
        access_token: loginResult.accessToken,
        refresh_token: loginResult.refreshToken,
      });
      if (authError || !authData.user) {
        setErrorMessage('登入階段未完成，請稍後再試。');
        return;
      }

      const profileResult = await supabase
        .from('profiles')
        .select(PROFILE_FIELDS)
        .eq('auth_user_id', authData.user.id)
        .maybeSingle();

      if (profileResult.error) {
        await supabase.auth.signOut();
        setErrorMessage(describeSupabaseError('登入身分查詢', profileResult.error));
        return;
      }
      if (!profileResult.data) {
        await supabase.auth.signOut();
        setErrorMessage('此帳號尚未完成隊員資料綁定，請聯絡管理員。');
        return;
      }

      const profile = profileResult.data as Profile;
      if (profile.status !== 'approved') {
        await supabase.auth.signOut();
        setErrorMessage(
          profile.status === 'rejected'
            ? '您的註冊申請未通過，請聯絡球隊管理員。'
            : '註冊已成功，正在等待管理員審核；核准後才能登入。'
        );
        return;
      }

      const authenticatedProfile = await refreshProfile();
      if (!authenticatedProfile) {
        setErrorMessage('登入身分已建立，但系統無法完成隊員資料載入，請重新整理後再試。');
        return;
      }

      setSuccessMessage(`認證成功，歡迎回來 ${profile.name}！`);
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (!reduceMotion) {
        setLoginSuccessName(profile.name);
        await new Promise<void>((resolve) => window.setTimeout(resolve, 1750));
      }
      navigate(profile.role === 'admin' ? '/admin/dashboard' : '/member/dashboard', { replace: true });
    } catch (error: unknown) {
      setErrorMessage(describeSupabaseError('登入', error));
    } finally {
      window.sessionStorage.removeItem('goodminton-login-transition');
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    resetMessages();

    const cleanUsername = normalizeAuthAccount(regUsername);
    if (!regName.trim() || !cleanUsername || !regPassword) {
      setErrorMessage('請完整填寫姓名、帳號與密碼；欄位不能只有空白。');
      return;
    }
    if (regPassword.length < 6) {
      setErrorMessage('登入密碼至少要有 6 碼。');
      return;
    }
    if (!getSupabaseConfig().isConfigured) {
      setErrorMessage('系統服務尚未完成設定，請聯絡管理員。');
      return;
    }

    setLoading(true);
    try {
      const availability = await supabase.rpc('goodminton_username_is_available', {
        candidate: cleanUsername
      });
      if (availability.error) {
        setErrorMessage('註冊服務暫時無法使用，請聯絡管理員。');
        return;
      }
      if (!availability.data) {
        setErrorMessage('這個帳號已被使用，請換一個帳號。');
        return;
      }

      const internalEmail = await accountToInternalAuthEmail(cleanUsername);
      const { data, error } = await supabase.auth.signUp({
        email: internalEmail,
        password: regPassword,
        options: {
          data: {
            name: regName.trim(),
            username: cleanUsername,
            gender: regGender,
            level: regLevel
          }
        }
      });

      if (error) {
        setErrorMessage(/password/i.test(error.message)
          ? '註冊失敗：密碼不符合系統要求，請換一組密碼後再試。'
          : /rate limit/i.test(error.message)
            ? '註冊次數過於頻繁，請稍後再試。'
            : '註冊失敗：建立隊員資料時發生錯誤，請稍後再試或聯絡管理員。');
        return;
      }
      if (!data.user || data.user.identities?.length === 0) {
        setErrorMessage('此帳號可能已註冊，請直接登入或使用其他帳號。');
        return;
      }

      if (data.session) await supabase.auth.signOut();
      setSuccessMessage(data.session
        ? '註冊已送出！請等待管理員核准，核准後即可用帳號與密碼登入。'
        : '帳號已建立，但目前尚未完成啟用，請聯絡管理員。');
      setRegName('');
      setRegUsername('');
      setRegPassword('');
      setRegGender('male');
      setRegLevel('中級');
    } catch (error: unknown) {
      setErrorMessage(describeSupabaseError('註冊', error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-50 p-4 sm:p-6">
      {loginSuccessName && <BadmintonLoginSuccess name={loginSuccessName} />}
      <div aria-hidden="true" className="login-court-lines">
        <span className="login-court-center-line" />
        <span className="login-court-service-line login-court-service-line-left" />
        <span className="login-court-service-line login-court-service-line-right" />
      </div>
      <div className="login-card-enter relative z-10 w-full max-w-md space-y-6 rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs sm:p-9">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Goodminton</h1>
          <p className="mt-0.5 text-xs font-medium text-slate-500">羽球隊管理平台</p>
        </div>

        <div className="space-y-1.5 pt-1">
          <div className="text-xs font-black uppercase tracking-widest text-emerald-700">
            {authMode === 'login' ? 'WELCOME BACK' : 'JOIN THE TEAM'}
          </div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
            {authMode === 'login' ? '登入你的羽球帳號' : '建立你的羽球檔案'}
          </h2>
          <p className="text-xs font-normal leading-relaxed text-slate-500 sm:text-sm">
            {authMode === 'login'
              ? '使用隊內帳號與密碼登入。'
              : '不需要 Email；註冊後等待球隊管理員核准即可。'}
          </p>
        </div>

        <div className="flex rounded-2xl border border-slate-200 bg-slate-100 p-1">
          {(['login', 'register'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => {
                setAuthMode(mode);
                resetMessages();
              }}
              className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-all ${
                authMode === mode
                  ? 'border-2 border-slate-900 bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {mode === 'login' ? '登入' : '註冊'}
            </button>
          ))}
        </div>

        {errorMessage && (
          <div className="flex items-center space-x-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-sm font-semibold text-amber-900">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-700" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="flex items-center space-x-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm font-semibold text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />
            <span>{successMessage}</span>
          </div>
        )}

        {authMode === 'login' ? (
          <form onSubmit={handleLoginSubmit} className="space-y-4 pt-1">
            <Field label="使用者帳號">
              <input
                type="text"
                autoFocus
                required
                autoComplete="username"
                autoCapitalize="none"
                placeholder="輸入隊內帳號"
                value={account}
                onChange={(event) => setAccount(event.target.value)}
                className="field-input"
              />
            </Field>
            <Field label="登入密碼">
              <input
                type="password"
                required
                minLength={6}
                autoComplete="current-password"
                placeholder="輸入密碼（至少 6 碼）"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="field-input"
              />
            </Field>
            <SubmitButton loading={loading} label="登入" loadingLabel="驗證中…" icon={<ArrowRight className="h-4 w-4" />} />
          </form>
        ) : (
          <form onSubmit={handleRegisterSubmit} className="space-y-4 pt-1">
            <Field label="姓名">
              <input type="text" required autoComplete="name" placeholder="例如：林小華" value={regName} onChange={(event) => setRegName(event.target.value)} className="field-input" />
            </Field>
            <Field label="使用者帳號">
              <input type="text" required autoComplete="username" autoCapitalize="none" placeholder="可使用中文、英文、數字或符號" value={regUsername} onChange={(event) => setRegUsername(event.target.value)} className="field-input" />
            </Field>
            <Field label="設定登入密碼（至少 6 碼）">
              <input type="password" required minLength={6} autoComplete="new-password" placeholder="請輸入至少 6 碼" value={regPassword} onChange={(event) => setRegPassword(event.target.value)} className="field-input" />
              <p className="mt-2 text-xs text-slate-500">密碼至少 6 碼，不限制最長位數。</p>
            </Field>

            <Field label="性別">
              <div className="grid grid-cols-2 gap-3">
                {(['male', 'female'] as const).map((gender) => (
                  <button
                    key={gender}
                    type="button"
                    onClick={() => setRegGender(gender)}
                    className={`rounded-2xl border px-4 py-3 text-sm font-bold transition-all ${
                      regGender === gender
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {gender === 'male' ? '男' : '女'}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="羽球程度">
              <select value={regLevel} onChange={(event) => setRegLevel(event.target.value as UserLevel)} className="field-input cursor-pointer">
                {['新手', '初級', '中級', '高階', '校隊/教練'].map((level) => <option key={level} value={level}>{level}</option>)}
              </select>
            </Field>
            <SubmitButton loading={loading} label="送出註冊申請" loadingLabel="建立帳號中…" icon={<UserPlus className="h-4 w-4" />} />
          </form>
        )}
      </div>
    </div>
  );
};

const ShuttlecockGraphic: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg viewBox="0 0 220 224" className={className} role="img" aria-label="羽球">
    <defs>
      <linearGradient id="shuttle-feather" x1="0" y1="0" x2="0.9" y2="1">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="1" stopColor="#eef2f7" />
      </linearGradient>
      <linearGradient id="shuttle-cork" x1="0.15" y1="0" x2="0.85" y2="1">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="1" stopColor="#d9e0e9" />
      </linearGradient>
    </defs>

    <path d="M62 137 91 43q5-18 19-15 16 4 12 21l-43 99Z" fill="url(#shuttle-feather)" stroke="#cbd5e1" strokeWidth="3" />
    <path d="m70 143 48-91q9-17 22-10 14 8 6 23l-59 88Z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="3" />
    <path d="m78 148 67-79q12-14 24-4 12 11 1 24l-75 71Z" fill="url(#shuttle-feather)" stroke="#cbd5e1" strokeWidth="3" />
    <path d="m86 154 82-61q15-11 25 2 10 14-5 24l-89 47Z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="3" />
    <path d="m92 161 93-36q17-7 23 8 6 16-12 22l-99 19Z" fill="url(#shuttle-feather)" stroke="#cbd5e1" strokeWidth="3" />

    <g fill="none" stroke="#64748b" strokeLinecap="round" strokeLinejoin="round">
      <path d="m98 38-29 118m62-105L76 163m82-88-74 96m96-66-88 73m105-42-97 49" strokeWidth="4" />
      <path d="m62 126 47 42m-52-27 41 37m-46-20 35 31" strokeWidth="4.5" />
    </g>

    <path d="m55 145 48 37-11 15-49-39Z" fill="#2dd4a7" stroke="#e6fffa" strokeWidth="3" />
    <path d="m43 157 49 40-10 12q-14 17-34 10-21-7-25-25-3-13 7-25Z" fill="url(#shuttle-cork)" stroke="#cbd5e1" strokeWidth="3.5" />
    <path d="m35 166 47 38" fill="none" stroke="#ffffff" strokeLinecap="round" strokeWidth="4" opacity=".9" />
  </svg>
);

const BadmintonLoginSuccess: React.FC<{ name: string }> = ({ name }) => (
  <div className="login-success-overlay fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-slate-950" role="status" aria-live="assertive">
    <div aria-hidden="true" className="login-speed-line login-speed-line-one" />
    <div aria-hidden="true" className="login-speed-line login-speed-line-two" />
    <div aria-hidden="true" className="login-speed-line login-speed-line-three" />
    <div aria-hidden="true" className="login-impact-ring" />
    <div aria-hidden="true" className="login-shuttle-flight">
      <div className="login-shuttle-arc">
        <div className="login-shuttle-orientation">
          <ShuttlecockGraphic className="h-20 w-20 drop-shadow-[0_0_16px_rgba(52,211,153,0.65)] sm:h-24 sm:w-24" />
        </div>
      </div>
    </div>
    <div className="login-success-copy relative z-10 text-center">
      <div className="text-xs font-black tracking-[0.35em] text-emerald-400">SMASH!</div>
      <div className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">登入成功</div>
      <div className="mt-2 text-sm font-semibold text-slate-300">歡迎回來，{name}</div>
    </div>
  </div>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="mb-1.5 block text-sm font-bold text-slate-900">{label}</label>
    {children}
  </div>
);

const SubmitButton: React.FC<{
  loading: boolean;
  label: string;
  loadingLabel: string;
  icon: React.ReactNode;
}> = ({ loading, label, loadingLabel, icon }) => (
  <button
    type="submit"
    disabled={loading}
    className="mt-2 flex w-full items-center justify-center space-x-2 rounded-2xl bg-emerald-600 py-3.5 text-base font-bold text-white shadow-xs transition-all hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"
  >
    {icon}
    <span>{loading ? loadingLabel : label}</span>
  </button>
);
