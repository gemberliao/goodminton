import React, { useEffect, useState } from 'react';
import { Megaphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { useAnnouncementStore } from '../../store/useAnnouncementStore';

function AnnouncementEditor() {
  const navigate = useNavigate();
  const { announcement, error, isLoading, hasLoaded, saveAnnouncement } = useAnnouncementStore();
  const [body, setBody] = useState(announcement?.body || '');
  const [dirty, setDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (hasLoaded && !dirty && !isSaving) setBody(announcement?.body || '');
  }, [announcement, hasLoaded, dirty, isSaving]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setMessage('');
    const result = await saveAnnouncement(body);
    setIsSaving(false);
    if (result.success) setDirty(false);
    setMessage(result.success ? '公告已儲存。' : result.message || '儲存失敗，請再試一次。');
  };

  return (
    <form onSubmit={save} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
      <label htmlFor="announcement-body" className="block text-sm font-bold text-slate-700">公告內容</label>
      <textarea
        id="announcement-body"
        value={body}
        onChange={event => { setBody(event.target.value); setDirty(true); setMessage(''); }}
        disabled={isSaving}
        maxLength={5000}
        rows={10}
        placeholder={'例如：\n星期三晚上 7 點練球。\n本週裁判：小明、小華，請提早 10 分鐘到場。'}
        className="field-input resize-y leading-7 disabled:opacity-60"
      />
      <p className="text-xs leading-5 text-slate-500">直接輸入文字，可換行。清空後儲存即可移除公告。</p>
      {(message || error) && <p role="status" className="text-sm leading-6 text-slate-600">{message || error}</p>}
      <div className="flex justify-end gap-2.5">
        <button
          type="button"
          onClick={() => navigate('/admin/dashboard')}
          disabled={isSaving}
          className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900 disabled:opacity-50"
        >
          取消
        </button>
        <button type="submit" disabled={isSaving || !hasLoaded || !!error || (!dirty && isLoading)}
          className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50">
          {isSaving ? '儲存中…' : '儲存公告'}
        </button>
      </div>
    </form>
  );
}

export function AdminAnnouncements() {
  const userId = useAppStore(state => state.currentUser.id);
  const updatedAt = useAnnouncementStore(state => state.announcement?.updated_at);
  const markAnnouncementAsViewed = useAppStore(state => state.markAnnouncementAsViewed);

  useEffect(() => {
    if (userId && updatedAt) markAnnouncementAsViewed(userId, updatedAt);
  }, [markAnnouncementAsViewed, updatedAt, userId]);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900"><Megaphone className="h-6 w-6 text-amber-700" />球隊公告</h1>
        <p className="mt-2 text-sm text-slate-500">寫下要告訴隊員的事，儲存後顯示在隊員首頁。</p>
      </header>
      <AnnouncementEditor key={userId} />
    </div>
  );
}
