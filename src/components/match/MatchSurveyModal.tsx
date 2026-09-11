import React, { useState, useEffect } from 'react';
import { BadmintonEvent, MatchDiscipline, MatchSurveyResponse } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { isEventPast } from '../../utils/dateUtils';
import { 
  X, 
  CheckCircle2, 
  Sparkles, 
  Users, 
  Flame, 
  HelpCircle, 
  HeartHandshake, 
  FileText,
  ShieldCheck,
  AlertCircle,
  Lock
} from 'lucide-react';

interface MatchSurveyModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: BadmintonEvent;
}

const ALL_DISCIPLINES: { key: MatchDiscipline; label: string; desc: string }[] = [
  { key: '男單', label: '男單 (MS)', desc: '單打把關，體力與跑動要求高' },
  { key: '女單', label: '女單 (WS)', desc: '單打控球，穩定調動與拉吊' },
  { key: '男雙', label: '男雙 (MD)', desc: '快節奏平抽擋、後場殺球連貫' },
  { key: '女雙', label: '女雙 (WD)', desc: '多拍來回防守反擊、前場抓球' },
  { key: '混雙', label: '混雙 (XD)', desc: '女前男後、分工明確與輪轉戰術' },
];

export const MatchSurveyModal: React.FC<MatchSurveyModalProps> = ({
  isOpen,
  onClose,
  event
}) => {
  const { currentUser, attendance, matchSurveys, matchLineupConfigs, saveMatchSurvey, toggleAttendance, profiles } = useAppStore();

  // Check attendance status
  const myAttendance = attendance.find(
    a => a.event_id === event.id && a.user_id === currentUser.id
  );
  const isAttending = myAttendance?.status === 'attending';
  const isAbsent = myAttendance?.status === 'absent';

  // Find existing survey
  const existingSurvey = matchSurveys.find(
    s => s.event_id === event.id && s.user_id === currentUser.id
  );

  const isPublished = matchLineupConfigs[event.id]?.is_published ?? false;
  const isPast = isEventPast(event);
  const isLocked = isPublished || isPast;

  const [selectedDisciplines, setSelectedDisciplines] = useState<MatchDiscipline[]>([]);
  const [maxMatchesDesired, setMaxMatchesDesired] = useState<number>(1);
  const [partnerPreference, setPartnerPreference] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (existingSurvey) {
        setSelectedDisciplines(existingSurvey.preferred_disciplines || []);
        setMaxMatchesDesired(existingSurvey.max_matches_desired || 1);
        setPartnerPreference(existingSurvey.partner_preference || '');
        setNotes(existingSurvey.notes || '');
      } else {
        // Auto default according to gender
        const isFemale = currentUser.gender === 'female' || (currentUser.name && (
          currentUser.name.includes('蓉') || currentUser.name.includes('雯') || currentUser.name.includes('珊') ||
          currentUser.name.includes('婷') || currentUser.name.includes('琪') || currentUser.name.includes('雅')
        ));
        if (isFemale) {
          setSelectedDisciplines(['女雙', '混雙']);
        } else {
          setSelectedDisciplines(['男雙']);
        }
        setMaxMatchesDesired(1);
        setPartnerPreference('');
        setNotes('');
      }
      setIsSaved(false);
    }
  }, [isOpen, existingSurvey, currentUser]);

  if (!isOpen) return null;

  const toggleDiscipline = (disc: MatchDiscipline) => {
    if (isLocked || !isAttending) return;
    setSelectedDisciplines(prev => 
      prev.includes(disc) ? prev.filter(d => d !== disc) : [...prev, disc]
    );
  };

  const handleSelectAll = () => {
    if (isLocked || !isAttending) return;
    setSelectedDisciplines(['男單', '女單', '男雙', '女雙', '混雙']);
  };

  const handleClearAll = () => {
    if (isLocked || !isAttending) return;
    setSelectedDisciplines([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked || !isAttending) return;
    const result = await saveMatchSurvey({
      event_id: event.id,
      user_id: currentUser.id,
      preferred_disciplines: selectedDisciplines,
      max_matches_desired: maxMatchesDesired,
      partner_preference: partnerPreference.trim(),
      notes: notes.trim()
    });
    if (!result.success) return;
    setIsSaved(true);
    setTimeout(() => {
      onClose();
    }, 900);
  };

  // List of other approved team members for partner hint
  const otherMembers = profiles.filter(
    p => p.id !== currentUser.id && (p.status === 'approved' || !p.status)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-xl w-full shadow-2xl relative my-auto max-h-[94vh] sm:max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 sm:top-5 sm:right-5 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors z-10 cursor-pointer"
          title="關閉"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="p-4 sm:p-7 pb-3 sm:pb-4 border-b border-slate-100 shrink-0 pr-10 sm:pr-0">
          <div className="flex items-center space-x-2 mb-1 flex-wrap gap-y-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 ">
              比賽意願調查
            </span>
            <span className="text-xs text-slate-500 font-medium">5 點團體賽</span>
            {isLocked && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 flex items-center space-x-1">
                <Lock className="w-3 h-3" />
                <span>{isPast ? '活動已結束' : '已截止修改'}</span>
              </span>
            )}
          </div>
          <h2 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight line-clamp-1">
            {event.title}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {isLocked
              ? isPast
                ? '本場活動時間已過，意願調查已鎖定為僅供檢視。'
                : '本場比賽出賽名單已正式發布，意願調查已截止並鎖定。'
              : '填寫你想出賽的項目與偏好，讓教練團依公平輪替與戰術排定最佳陣容。'}
          </p>
        </div>

        {isSaved ? (
          <div className="p-8 sm:p-10 text-center space-y-3 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-200">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">意願調查已成功送出</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              教練團將依據各位隊員的填寫意願與出賽次數平衡進行排點。
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            
            {/* Scrollable Content */}
            <div className="p-4 sm:p-7 overflow-y-auto space-y-4 sm:space-y-5 flex-1">
              
              {/* Attendance Status Warning Banner */}
              {!isAttending && (
                <div className="flex items-start space-x-3 text-xs sm:text-sm font-medium text-rose-900 bg-rose-50 p-4 rounded-2xl border border-rose-200">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-2 flex-1">
                    <div>
                      <span className="font-bold block text-rose-900 mb-0.5">
                        目前狀態為【{isAbsent ? '請假' : '尚未報名'}】，無法提交出賽意願
                      </span>
                      <span className="text-rose-700 text-xs leading-relaxed">
                        球隊規定只有「已報名出席」的隊員才能填寫出賽項目意願並參與 5 點陣容排單。
                      </span>
                    </div>
                    {!isPast && (
                      <button
                        type="button"
                        onClick={() => toggleAttendance(currentUser.id, event.id, 'attending')}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 flex items-center space-x-1.5 cursor-pointer w-fit"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>立即改為「已報名出席」</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Published Lock Notice Banner */}
              {isLocked && (
                <div className="flex items-start space-x-2.5 text-xs sm:text-sm font-medium text-amber-800 bg-amber-50 p-3.5 rounded-2xl border border-amber-200">
                  <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block text-amber-900 mb-0.5">{isPast ? '活動已結束，意願已截止修改' : '名單已正式發布，意願已截止修改'}</span>
                    <span>{isPast ? '活動時間已過，目前的出賽意願設定僅供檢視。' : '教練團已完成 5 點出賽排點並正式公開，目前的出賽意願設定已鎖定僅供檢視。'}</span>
                  </div>
                </div>
              )}

              {/* Section 1: Disciplines Selection */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <label className="block text-sm font-bold text-slate-900 flex items-center gap-1">
                    <span>1. 意願出賽項目 (可多選)</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  {!isLocked && (
                    <div className="flex items-center space-x-3 text-xs">
                      <button
                        type="button"
                        onClick={handleSelectAll}
                        className="text-slate-700 font-semibold hover:underline cursor-pointer"
                      >
                        全選
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={handleClearAll}
                        className="text-slate-500 hover:text-slate-700 cursor-pointer"
                      >
                        清除
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {ALL_DISCIPLINES.map((item) => {
                    const isChecked = selectedDisciplines.includes(item.key);
                    return (
                      <div
                        key={item.key}
                        onClick={() => toggleDiscipline(item.key)}
                        className={`p-3.5 rounded-2xl border-2 transition-all flex items-center justify-between select-none ${
                          isLocked
                            ? isChecked
                              ? 'border-slate-400 bg-slate-100 cursor-default'
                              : 'border-slate-200 bg-slate-50/60 opacity-60 cursor-default'
                            : isChecked
                              ? 'border-slate-900 bg-slate-50 shadow-xs cursor-pointer'
                              : 'border-slate-200 hover:border-slate-300 bg-white cursor-pointer'
                        }`}
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <span className={`text-sm font-bold block ${
                            isChecked ? 'text-slate-900' : 'text-slate-700'
                          }`}>
                            {item.label}
                          </span>
                          <p className="text-xs text-slate-500 mt-0.5 leading-normal">
                            {item.desc}
                          </p>
                        </div>
                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                          isChecked ? 'bg-slate-900 border-slate-900 text-white' : 'border-slate-300 bg-white'
                        }`}>
                          {isChecked && <CheckCircle2 className="w-3.5 h-3.5" />}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {selectedDisciplines.length === 0 && (
                  <div className="flex items-center space-x-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl mt-2.5 border border-slate-200">
                    <AlertCircle className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>若暫無特別想打的項目，教練將依全隊調度排定或作為後備選手。</span>
                  </div>
                )}
              </div>

              {/* Section 2: Partner Preference */}
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1.5">
                  2. 雙打搭檔偏好 (選填)
                </label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={partnerPreference}
                  onChange={(e) => setPartnerPreference(e.target.value)}
                  placeholder="例如：想跟阿偉搭男雙、或配合戰術排點皆可"
                  className={`w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none text-slate-900 ${
                    isLocked
                      ? 'bg-slate-100 border border-slate-200 text-slate-600 cursor-not-allowed'
                      : 'bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-slate-900 focus:bg-white'
                  }`}
                />
                {!isLocked && otherMembers.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap mt-2">
                    <span className="text-xs text-slate-400 font-medium">快速選擇：</span>
                    {otherMembers.slice(0, 6).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          const cur = partnerPreference.trim();
                          setPartnerPreference(cur ? `${cur}、${m.name}` : `想搭 ${m.name}`);
                        }}
                        className="text-xs bg-white hover:bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg border border-slate-200 transition-colors font-medium cursor-pointer"
                      >
                        {m.name.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 3: Notes / Physical Condition */}
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1.5">
                  3. 備註與說明 (選填)
                </label>
                <textarea
                  rows={2}
                  disabled={isLocked}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="例如：右手腕微酸建議放後場、或可提早到場熱身..."
                  className={`w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none text-slate-900 ${
                    isLocked
                      ? 'bg-slate-100 border border-slate-200 text-slate-600 cursor-not-allowed'
                      : 'bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-slate-900 focus:bg-white'
                  }`}
                />
              </div>

            </div>

            {/* Fixed Footer Actions */}
            <div className="p-3.5 sm:p-6 border-t border-slate-100 bg-slate-50/50 shrink-0 flex items-center justify-end space-x-2.5">
              {isLocked ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-6 py-2.5 min-h-[44px] rounded-xl text-xs sm:text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center"
                >
                  關閉檢視
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 sm:flex-initial px-4 sm:px-5 py-2.5 min-h-[44px] rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer flex items-center justify-center"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={!isAttending || isLocked}
                    className={`flex-2 sm:flex-initial px-5 sm:px-6 py-2.5 min-h-[44px] rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition-all flex items-center justify-center space-x-1.5 ${
                      !isAttending || isLocked
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                        : 'bg-slate-900 hover:bg-slate-800 text-white cursor-pointer active:scale-95'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>
                      {!isAttending
                        ? '請先報名出席'
                        : existingSurvey
                        ? '更新意願'
                        : '送出出賽意願'}
                    </span>
                  </button>
                </>
              )}
            </div>

          </form>
        )}

      </div>
    </div>
  );
};
