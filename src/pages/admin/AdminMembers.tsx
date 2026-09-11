import React, { useMemo, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { UserGender, UserLevel, UserRole } from '../../types';
import { supabase } from '../../lib/supabase';
import { normalizeAuthAccount } from '../../utils/authAccount';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  KeyRound,
  Pencil,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';

export const AdminMembers: React.FC = () => {
  const { profiles, currentUser, updateProfile, deleteProfile } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending'>('all');
  const [message, setMessage] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [isRenamingAccount, setIsRenamingAccount] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [editingAccount, setEditingAccount] = useState<{
    id: string;
    name: string;
    username: string;
  } | null>(null);
  const [resettingProfile, setResettingProfile] = useState<{
    profileId: string;
    authUserId?: string;
    name: string;
    username: string;
  } | null>(null);
  const [deletingProfile, setDeletingProfile] = useState<{
    id: string;
    name: string;
    username?: string;
    hasAuthAccount: boolean;
  } | null>(null);

  const uniqueProfiles = useMemo(() => {
    const seen = new Set<string>();
    return profiles.filter((profile) => {
      if (!profile?.id || seen.has(profile.id)) return false;
      seen.add(profile.id);
      return true;
    });
  }, [profiles]);

  const pendingProfiles = uniqueProfiles.filter((profile) => profile.status === 'pending');
  const approvedProfiles = uniqueProfiles.filter((profile) => profile.status === 'approved');
  const filtered = uniqueProfiles.filter((profile) => {
    const keyword = searchTerm.trim().toLowerCase();
    const matchesSearch = !keyword
      || profile.name.toLowerCase().includes(keyword)
      || profile.username.toLowerCase().includes(keyword);
    if (!matchesSearch) return false;
    if (statusFilter === 'approved') return profile.status === 'approved';
    if (statusFilter === 'pending') return profile.status === 'pending';
    return true;
  });

  const notify = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 6000);
  };

  const handleApprove = async (id: string, name: string, username?: string) => {
    const result = await updateProfile(id, { status: 'approved' }, username);
    notify(result?.success === false
      ? `核准失敗：${result.message}`
      : `已核准「${name}」，該隊員現在可以登入。`);
  };

  const handleReject = async (id: string, name: string, username?: string) => {
    const result = await updateProfile(id, { status: 'rejected' }, username);
    notify(result?.success === false
      ? `退回失敗：${result.message}`
      : `已退回「${name}」的註冊申請。`);
  };

  const handleProfileChange = async (
    id: string,
    changes: Partial<{ gender: UserGender; level: UserLevel; role: UserRole }>,
    username?: string,
  ) => {
    const result = await updateProfile(id, changes, username);
    if (result?.success === false) notify(`更新失敗：${result.message}`);
  };

  const handleConfirmDelete = async () => {
    if (!deletingProfile) return;
    setIsDeleting(true);
    const target = deletingProfile;
    const { data, error } = await supabase.functions.invoke('admin-reset-password', {
      body: { action: 'delete_member', profileId: target.id },
    });

    if (error || !data?.success) {
      let detail = data?.error || '管理服務暫時無法使用，請稍後再試。';
      const errorContext = (error as { context?: Response } | null)?.context;
      if (errorContext) {
        try {
          const responseBody = await errorContext.clone().json();
          if (responseBody?.error) detail = responseBody.error;
        } catch {
          // Keep the generic message when the response body is unavailable.
        }
      }
      setIsDeleting(false);
      notify(`刪除失敗：${detail}`);
      return;
    }

    // The management service already removed the account and member rows.
    // Reuse the store action to clear related local state immediately.
    const localResult = await deleteProfile(target.id, target.username);
    setIsDeleting(false);
    setDeletingProfile(null);
    notify(localResult?.success === false
      ? `登入帳號已刪除，清單重新整理後會更新：${localResult.message}`
      : `已永久刪除「${target.name}」的登入帳號與隊員資料。`);
  };

  const closePasswordReset = () => {
    if (isResettingPassword) return;
    setResettingProfile(null);
    setNewPassword('');
  };

  const closeAccountEditor = () => {
    if (isRenamingAccount) return;
    setEditingAccount(null);
    setNewUsername('');
  };

  const handleAccountRename = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingAccount) return;
    const normalizedUsername = normalizeAuthAccount(newUsername);
    if (!normalizedUsername) {
      notify('新帳號不能空白。');
      return;
    }
    if (normalizedUsername === normalizeAuthAccount(editingAccount.username)) {
      closeAccountEditor();
      return;
    }

    setIsRenamingAccount(true);
    const { data, error } = await supabase.functions.invoke('admin-reset-password', {
      body: {
        action: 'rename_account',
        profileId: editingAccount.id,
        newUsername: normalizedUsername,
      },
    });

    if (error || !data?.success) {
      let detail = data?.error || '管理服務暫時無法使用，請稍後再試。';
      const errorContext = (error as { context?: Response } | null)?.context;
      if (errorContext) {
        try {
          const responseBody = await errorContext.clone().json();
          if (responseBody?.error) detail = responseBody.error;
        } catch {
          // Keep the generic message when the response body is unavailable.
        }
      }
      setIsRenamingAccount(false);
      notify(`帳號修改失敗：${detail}`);
      return;
    }

    const target = editingAccount;
    const finalUsername = data.username || normalizedUsername;
    const localResult = await updateProfile(target.id, { username: finalUsername }, target.username);
    setIsRenamingAccount(false);
    setEditingAccount(null);
    setNewUsername('');
    notify(localResult?.success === false
      ? `登入帳號已改為「${finalUsername}」，重新同步後清單會更新。`
      : `已將「${target.name}」的登入帳號改為「${finalUsername}」。`);
  };

  const handlePasswordReset = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!resettingProfile || !newPassword) {
      notify('新密碼不能空白。');
      return;
    }
    if (newPassword.length < 6) {
      notify('新密碼至少要有 6 碼。');
      return;
    }

    setIsResettingPassword(true);
    const { data, error } = await supabase.functions.invoke('admin-reset-password', {
      body: {
        profileId: resettingProfile.profileId,
        newPassword,
      },
    });
    setIsResettingPassword(false);

    if (error || !data?.success) {
      let detail = data?.error || '管理服務暫時無法使用，請稍後再試。';
      const errorContext = (error as { context?: Response } | null)?.context;
      if (errorContext) {
        try {
          const responseBody = await errorContext.clone().json();
          if (responseBody?.error) detail = responseBody.error;
        } catch {
          // Keep the client message when the response body is unavailable.
        }
      }
      notify(`密碼重設失敗：${detail}`);
      return;
    }

    const targetName = resettingProfile.name;
    const hadAuthAccount = Boolean(resettingProfile.authUserId);
    setResettingProfile(null);
    setNewPassword('');
    notify(`${hadAuthAccount ? '已安全重設' : '已建立'}「${targetName}」的登入帳號與密碼；請私下通知本人。`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">隊員與權限管理</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1.5">任何人都可在登入頁送出註冊；管理員在這裡核准、退回、重設密碼或完整刪除帳號。</p>
        </div>
        <div className="relative w-full lg:w-80">
          <Search className="w-4.5 h-4.5 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="search"
            placeholder="搜尋姓名或帳號..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
          />
        </div>
      </div>

      <div className="p-4 bg-sky-50 border border-sky-200 rounded-2xl flex items-start gap-3 text-sm text-sky-950">
        <ShieldCheck className="w-5 h-5 text-sky-700 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold">簡易帳號管理</p>
          <p className="mt-1 text-sky-800">註冊、核准、重設與刪除都在網站內完成。鑰匙可建立／重設密碼，垃圾桶會同時清除登入帳號與隊員資料，不必再另外操作。</p>
        </div>
      </div>

      {pendingProfiles.length > 0 && (
        <div className="p-5 bg-amber-500/10 border border-amber-500/30 rounded-3xl space-y-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Clock className="w-5 h-5 text-amber-600 animate-pulse" />
              <h3 className="font-bold text-amber-900 text-sm sm:text-base">有 {pendingProfiles.length} 位新隊員等待審核</h3>
            </div>
            <button onClick={() => setStatusFilter('pending')} className="text-xs sm:text-sm font-bold text-amber-700 hover:underline">查看全部 →</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {pendingProfiles.map((profile) => (
              <div key={profile.id} className="p-3.5 bg-white border border-amber-200 rounded-2xl flex items-center justify-between gap-3 shadow-2xs">
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 text-sm truncate">{profile.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5 truncate">@{profile.username} · {profile.level}</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => handleApprove(profile.id, profile.name, profile.username)} className="px-3 py-1.5 bg-emerald-600 text-white font-bold rounded-xl text-xs flex items-center gap-1"><UserCheck className="w-3.5 h-3.5" />同意</button>
                  <button onClick={() => handleReject(profile.id, profile.name, profile.username)} className="p-1.5 bg-rose-50 text-rose-600 rounded-xl border border-rose-200" title="退回申請"><UserX className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80 text-sm">
        {([
          ['all', `全部 (${uniqueProfiles.length})`],
          ['approved', `已核准 (${approvedProfiles.length})`],
          ['pending', `待審核 (${pendingProfiles.length})`],
        ] as const).map(([value, label]) => (
          <button key={value} onClick={() => setStatusFilter(value)} className={`px-3.5 py-2 rounded-xl font-bold transition-all ${statusFilter === value ? 'bg-white text-slate-900 shadow-2xs border border-slate-200' : 'text-slate-600'}`}>{label}</button>
        ))}
      </div>

      {message && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm rounded-2xl flex items-center gap-2 font-bold"><Check className="w-4 h-4 text-emerald-600 shrink-0" /><span>{message}</span></div>
      )}

      <div className="bg-white border border-slate-200/80 rounded-3xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200/80 text-xs font-bold text-slate-600 uppercase tracking-wider">
                <th className="p-4 sm:p-5">隊員</th><th className="p-4 sm:p-5">狀態</th><th className="p-4 sm:p-5">性別</th><th className="p-4 sm:p-5">等級</th><th className="p-4 sm:p-5">權限</th><th className="p-4 sm:p-5">登入</th><th className="p-4 sm:p-5 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-slate-400">目前沒有符合條件的隊員。</td></tr>
              ) : filtered.map((member) => {
                const isSelf = member.id === currentUser?.id;
                return (
                  <tr key={member.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4 sm:p-5"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 font-black flex items-center justify-center">{member.name.substring(0, 1)}</div><div><div className="font-bold text-slate-900">{member.name}{isSelf ? '（你）' : ''}</div><div className="text-xs text-slate-400">@{member.username}</div></div></div></td>
                    <td className="p-4 sm:p-5 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5 ${member.status === 'approved' ? 'bg-emerald-100 text-emerald-800 ' : member.status === 'pending' ? 'bg-amber-100 text-amber-800 ' : 'bg-rose-100 text-rose-800 '}`}>
                        {member.status === 'approved' ? <CheckCircle2 className="w-3.5 h-3.5" /> : member.status === 'pending' ? <Clock className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}{member.status === 'approved' ? '已核准' : member.status === 'pending' ? '待審核' : '已退回'}
                      </span>
                    </td>
                    <td className="p-4 sm:p-5"><select value={member.gender || 'male'} onChange={(event) => handleProfileChange(member.id, { gender: event.target.value as UserGender }, member.username)} className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"><option value="male">男</option><option value="female">女</option></select></td>
                    <td className="p-4 sm:p-5"><select value={member.level} onChange={(event) => handleProfileChange(member.id, { level: event.target.value as UserLevel }, member.username)} className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold">{['新手', '初級', '中級', '高階', '校隊/教練'].map((level) => <option key={level} value={level}>{level}</option>)}</select></td>
                    <td className="p-4 sm:p-5"><select value={member.role} disabled={isSelf} onChange={(event) => handleProfileChange(member.id, { role: event.target.value as UserRole }, member.username)} className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold disabled:opacity-60" title={isSelf ? '不能變更自己的管理員權限' : '設定隊員或管理員'}><option value="member">隊員</option><option value="admin">管理員</option></select></td>
                    <td className="p-4 sm:p-5 whitespace-nowrap"><span className={`text-xs font-bold ${member.auth_user_id ? 'text-emerald-700' : 'text-amber-700'}`}>{member.auth_user_id ? '可登入' : '待建立'}</span></td>
                    <td className="p-4 sm:p-5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {member.status === 'pending' && <><button onClick={() => handleApprove(member.id, member.name, member.username)} className="px-3 py-2 bg-emerald-600 text-white font-bold rounded-xl text-xs">核准</button><button onClick={() => handleReject(member.id, member.name, member.username)} className="px-3 py-2 bg-rose-50 text-rose-700 font-bold rounded-xl text-xs border border-rose-200">退回</button></>}
                        <button
                          onClick={() => {
                            setEditingAccount({ id: member.id, name: member.name, username: member.username });
                            setNewUsername(member.username);
                          }}
                          className="p-2 bg-amber-50 text-amber-700 rounded-xl border border-amber-200"
                          title="修改登入帳號"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setResettingProfile({ profileId: member.id, authUserId: member.auth_user_id, name: member.name, username: member.username })}
                          className="p-2 bg-sky-50 text-sky-700 rounded-xl border border-sky-200 disabled:opacity-30"
                          title={member.auth_user_id ? '重設登入密碼' : '建立登入帳號'}
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>
                        <button disabled={isSelf} onClick={() => setDeletingProfile({ id: member.id, name: member.name, username: member.username, hasAuthAccount: Boolean(member.auth_user_id) })} className="p-2 bg-rose-50 text-rose-700 rounded-xl border border-rose-200 disabled:opacity-30" title={isSelf ? '不能刪除目前登入的管理員' : '刪除隊員資料'}><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editingAccount && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleAccountRename} className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2"><Pencil className="w-5 h-5 text-amber-700" /><h3 className="text-lg font-bold text-slate-900">修改登入帳號</h3></div>
              <button type="button" onClick={closeAccountEditor} disabled={isRenamingAccount} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg disabled:opacity-50" aria-label="關閉"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-sm text-slate-600 mt-3">正在修改「<span className="font-bold text-slate-900">{editingAccount.name}</span>」的登入帳號。</p>
            <label className="block text-sm font-bold text-slate-800 mt-5 mb-2" htmlFor="new-login-username">新帳號</label>
            <input
              id="new-login-username"
              type="text"
              required
              autoFocus
              autoComplete="off"
              value={newUsername}
              onChange={(event) => setNewUsername(event.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-base text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white"
            />
            <p className="text-xs text-slate-500 mt-2">儲存後，下次登入必須使用新帳號；密碼不會改變。</p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button type="button" onClick={closeAccountEditor} disabled={isRenamingAccount} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl disabled:opacity-50">取消</button>
              <button type="submit" disabled={isRenamingAccount || !newUsername.trim()} className="px-4 py-2 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl flex items-center gap-1.5 disabled:opacity-50">
                {isRenamingAccount && <RefreshCw className="w-4 h-4 animate-spin" />}
                <span>{isRenamingAccount ? '正在修改…' : '儲存新帳號'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {resettingProfile && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handlePasswordReset} className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2"><KeyRound className="w-5 h-5 text-sky-700" /><h3 className="text-lg font-bold text-slate-900">{resettingProfile.authUserId ? '重設登入密碼' : '建立登入帳號'}</h3></div>
              <button type="button" onClick={closePasswordReset} disabled={isResettingPassword} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg disabled:opacity-50" aria-label="關閉"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-sm text-slate-600 mt-3 leading-relaxed">
              正在替「<span className="font-bold text-slate-900">{resettingProfile.name}</span>」
              （@{resettingProfile.username}）{resettingProfile.authUserId ? '設定新的登入密碼' : '建立登入帳號與初始密碼'}。
            </p>
            <label className="block text-sm font-bold text-slate-800 mt-5 mb-2" htmlFor="admin-reset-password">新密碼（至少 6 碼）</label>
            <input
              id="admin-reset-password"
              type="password"
              required
              minLength={6}
              autoFocus
              autoComplete="new-password"
              placeholder="請輸入至少 6 碼"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-base text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white"
            />
            <p className="mt-2 text-xs text-slate-500">密碼至少 6 碼，不限制最長位數。</p>
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3 mt-3">{resettingProfile.authUserId ? '儲存後會立即套用新密碼。' : '建立完成後，這位隊員即可使用隊內帳號登入。'}請私下通知本人，並請本人登入後再自行更換密碼。</p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button type="button" onClick={closePasswordReset} disabled={isResettingPassword} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl disabled:opacity-50">取消</button>
              <button type="submit" disabled={isResettingPassword || newPassword.length < 6} className="px-4 py-2 text-sm font-bold text-white bg-sky-700 hover:bg-sky-800 rounded-xl flex items-center gap-1.5 disabled:opacity-50">
                {isResettingPassword && <RefreshCw className="w-4 h-4 animate-spin" />}
                <span>{isResettingPassword ? '正在重設…' : '確認重設'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {deletingProfile && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-rose-600" /><h3 className="text-lg font-bold text-slate-900">確認刪除隊員</h3></div>
            <p className="text-sm text-slate-600 mt-3 leading-relaxed">確定要移除「<span className="font-bold text-slate-900">{deletingProfile.name}</span>」的隊員資料嗎？</p>
            <p className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-xl p-3 mt-3">這會同時刪除登入帳號、隊員資料，以及該隊員的出席、繳費與問卷紀錄，無法復原。</p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button onClick={() => setDeletingProfile(null)} disabled={isDeleting} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl disabled:opacity-50">取消</button>
              <button onClick={handleConfirmDelete} disabled={isDeleting} className="px-4 py-2 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl flex items-center gap-1.5 disabled:opacity-50">{isDeleting && <RefreshCw className="w-4 h-4 animate-spin" />}<span>{isDeleting ? '正在刪除...' : '確認刪除'}</span></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
