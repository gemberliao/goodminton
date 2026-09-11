import React from 'react';
import { Link } from 'react-router-dom';
import { Megaphone, Pencil } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useAnnouncementStore } from '../../store/useAnnouncementStore';

export function AnnouncementText({ body }: { body: string }) {
  return <p className="whitespace-pre-wrap text-base font-bold leading-7 text-slate-900 sm:text-lg sm:leading-8 [overflow-wrap:anywhere]">{body}</p>;
}

export function AnnouncementBoard() {
  const { announcement, isLoading, error } = useAnnouncementStore();
  const currentUserId = useAppStore(state => state.currentUser.id);
  const isAdmin = useAppStore(state => state.currentUser.role === 'admin');
  const markAnnouncementAsViewed = useAppStore(state => state.markAnnouncementAsViewed);

  React.useEffect(() => {
    if (currentUserId && announcement?.updated_at) {
      markAnnouncementAsViewed(currentUserId, announcement.updated_at);
    }
  }, [announcement?.updated_at, currentUserId, markAnnouncementAsViewed]);

  return (
    <section aria-label="球隊公告" className="-mx-3.5 -mt-3.5 border-b border-slate-200/80 bg-white sm:-mx-6 sm:-mt-6 lg:-mx-8 lg:-mt-8">
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-900 px-3.5 py-4 sm:px-6 lg:px-8">
        <h2 className="flex items-center gap-2 text-base font-bold text-white"><Megaphone className="h-5 w-5 text-amber-400" />球隊公告</h2>
        {isAdmin && <Link to="/admin/announcements" className="inline-flex items-center gap-1.5 text-sm font-bold text-amber-300 hover:text-amber-200"><Pencil className="h-4 w-4" />編輯</Link>}
      </div>
      <div className="px-3.5 py-4 sm:px-6 lg:px-8">
        {error ? <p role="status" className="text-sm leading-6 text-slate-500">{isAdmin ? error : '公告暫時無法載入。'}</p>
          : announcement?.body ? <AnnouncementText body={announcement.body} />
          : <p className="text-sm text-slate-500">{isLoading ? '載入中…' : '目前沒有公告。'}</p>}
      </div>
    </section>
  );
}
