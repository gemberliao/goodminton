import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { UserLevel, UserGender } from '../../types';
import { User, Key, Award, Shield, Check, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export const MemberProfile: React.FC = () => {
  const { currentUser, updateProfile } = useAppStore();

  const [name, setName] = useState(currentUser.name);
  const [level, setLevel] = useState<UserLevel>(currentUser.level);
  const [gender, setGender] = useState<UserGender>(currentUser.gender || 'male');
  const [newPassword, setNewPassword] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await updateProfile(currentUser.id, {
      name,
      level,
      gender
    });
    if (result?.success === false) return;
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) {
      setPasswordMessage('新密碼不能空白。');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMessage('新密碼至少要有 6 碼。');
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordMessage(error ? '密碼更新失敗，請換一組密碼後再試。' : '登入密碼已成功更新。');
    if (!error) setNewPassword('');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div>
        <div className="flex items-center space-x-2.5">
          <span className="px-3 py-1 rounded-full text-xs sm:text-sm font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap shrink-0 inline-block">
            隊員專區
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">個人資料與羽球技術分級</h1>
        </div>
        <p className="text-sm text-slate-500 mt-1.5">
          更新您的隊員顯示名稱、登入密碼與羽球戰力分級
        </p>
      </div>

      {/* Save Success Alert */}
      {saveSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-base font-semibold rounded-2xl flex items-center space-x-2.5 animate-in fade-in">
          <Check className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>個人資料已成功更新！</span>
        </div>
      )}

      {/* Form Card */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-2xs space-y-6">
        
        {/* Profile Avatar Card */}
        <div className="flex items-center space-x-4 sm:space-x-5 bg-slate-50 p-5 sm:p-6 rounded-2xl border border-slate-200/80">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-emerald-600 text-white font-black text-2xl sm:text-3xl flex items-center justify-center shadow-xs shrink-0">
            {currentUser.name.substring(0, 1)}
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center space-x-3 flex-wrap gap-y-1.5">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-tight">
                {currentUser.name}
              </h2>
              <span className="px-3 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap shrink-0">
                {currentUser.role === 'admin' ? '球隊幹部 / 管理員' : '正式隊員'}
              </span>
            </div>
            <div className="text-sm sm:text-base text-slate-500 font-medium tracking-tight">
              @{currentUser.username}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div>
            <label className="block text-sm sm:text-base font-bold text-slate-800 mb-2">
              隊員顯示名稱 / 暱稱 *
            </label>
            <div className="relative">
              <User className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-400" />
              <input
                type="text"
                autoFocus
                required
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-base text-slate-900 font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm sm:text-base font-bold text-slate-800 mb-2">
              性別 *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setGender('male')}
                className={`py-3 px-4 rounded-xl text-base font-bold border transition-all flex items-center justify-center ${
                  gender === 'male'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                男
              </button>

              <button
                type="button"
                onClick={() => setGender('female')}
                className={`py-3 px-4 rounded-xl text-base font-bold border transition-all flex items-center justify-center ${
                  gender === 'female'
                    ? 'bg-pink-600 text-white border-pink-600 shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                女
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm sm:text-base font-bold text-slate-800 mb-2">
              羽球戰力等級分級 *
            </label>
            <div className="relative">
              <Award className="w-5 h-5 absolute left-3.5 top-3.5 text-emerald-600" />
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as UserLevel)}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-base text-slate-900 font-bold focus:outline-none focus:border-emerald-500 focus:bg-white cursor-pointer transition-all"
              >
                <option value="新手">新手 (初學基本發球與擊球)</option>
                <option value="初級">初級 (熟悉基礎雙打跑位)</option>
                <option value="中級">中級 (具備長球/殺球/平球連貫攻防)</option>
                <option value="高階">高階 (精通多變球路與隊伍核心戰術)</option>
                <option value="校隊/教練">校隊 / 專業教練級</option>
              </select>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-2 flex items-center gap-1.5">
              <span>💡</span>
              <span>提示：分級將提供幹部安排隊內賽與混雙排點參考</span>
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <button
              type="submit"
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-base transition-all shadow-2xs active:scale-98 flex items-center justify-center space-x-2"
            >
              <Sparkles className="w-5 h-5" />
              <span>儲存個人資料變更</span>
            </button>
          </div>

        </form>

        <form onSubmit={handlePasswordChange} className="pt-6 border-t border-slate-100 space-y-3">
          <div>
            <label className="block text-sm sm:text-base font-bold text-slate-800 mb-2">變更登入密碼（至少 6 碼）</label>
            <div className="relative">
              <Key className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-400" />
              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="請輸入至少 6 碼"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-base text-slate-900 font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">密碼至少 6 碼，不限制最長位數。</p>
          </div>
          {passwordMessage && <p className="text-sm font-semibold text-slate-700">{passwordMessage}</p>}
          <button type="submit" className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl flex items-center justify-center gap-2">
            <Shield className="w-4 h-4" />安全更新密碼
          </button>
        </form>

      </div>

    </div>
  );
};
