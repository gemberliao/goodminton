import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { CheckCircle2, Clock, DollarSign, Receipt, Send, RotateCcw, Calendar, Lock, Archive } from 'lucide-react';
import { isFeeCollectionOpen } from '../../utils/dateUtils';

export const MemberFinances: React.FC = () => {
  const { 
    currentUser, 
    feeRecords, 
    feeCollections, 
    reportFeePayment, 
    toggleFeePaidStatus, 
    markFinancesAsViewed 
  } = useAppStore();
  const [activeTab, setActiveTab] = useState<'active' | 'ended' | 'paid'>('active');
  const [noticeMessage, setNoticeMessage] = useState<string>('');
  const [submittingRecordId, setSubmittingRecordId] = useState<string | null>(null);

  // Mark all member fees as viewed when viewing finances
  React.useEffect(() => {
    if (currentUser?.id) {
      markFinancesAsViewed(currentUser.id);
    }
  }, [currentUser?.id, feeRecords.length, markFinancesAsViewed]);

  // Filter member fee records (deduplicated)
  const myRecords = feeRecords
    .filter((r) => r.user_id === currentUser.id)
    .filter((r, idx, arr) => arr.findIndex(item => item.id === r.id) === idx);

  const unpaidRecords = myRecords.filter((r) => !r.is_paid);
  const paidRecords = myRecords.filter((r) => r.is_paid);
  const activeUnpaidRecords = unpaidRecords.filter((record) =>
    isFeeCollectionOpen(feeCollections.find((collection) => collection.id === record.collection_id))
  );
  const endedUnpaidRecords = unpaidRecords.filter((record) =>
    !isFeeCollectionOpen(feeCollections.find((collection) => collection.id === record.collection_id))
  );

  const pendingRecords = activeUnpaidRecords.filter((r) => r.payment_status === 'pending');
  const strictlyUnpaidRecords = activeUnpaidRecords.filter((r) => r.payment_status !== 'pending');

  const totalUnpaidAmount = activeUnpaidRecords.reduce((sum, r) => {
    const col = feeCollections.find((c) => c.id === r.collection_id);
    return sum + (col?.amount_per_person || 0);
  }, 0);

  const handleMarkAsPaid = async (recordId: string, title: string) => {
    setSubmittingRecordId(recordId);
    const result = await reportFeePayment(recordId, '隊員已於線上標記完成匯款，請管理員對帳');
    setSubmittingRecordId(null);
    setNoticeMessage(
      result.success
        ? `已同步匯款通知！「${title}」目前進入「待對帳審核」狀態，管理員會立即看到紅點提醒。`
        : `匯款通知未成功同步：${result.message || '請檢查網路後再試一次'}`
    );
    setTimeout(() => setNoticeMessage(''), 6000);
  };

  const handleCancelReport = async (recordId: string) => {
    setSubmittingRecordId(recordId);
    const result = await toggleFeePaidStatus(recordId, false);
    setSubmittingRecordId(null);
    setNoticeMessage(
      result.success
        ? '已同步取消匯款回報。'
        : `取消回報未成功同步：${result.message || '請檢查網路後再試一次'}`
    );
    setTimeout(() => setNoticeMessage(''), 4000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">個人帳單與繳費紀錄</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1.5">
            透明查看智慧分攤專案明細，自主核對與回報已繳費狀態
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="grid w-full grid-cols-3 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80 text-xs sm:w-auto sm:text-sm sm:self-auto shrink-0">
          <button
            onClick={() => setActiveTab('active')}
            className={`min-w-0 px-1 py-2.5 sm:px-4 rounded-xl font-bold flex items-center justify-center gap-1 sm:gap-2 transition-all whitespace-nowrap ${
              activeTab === 'active'
                ? 'bg-rose-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span>進行中 ({activeUnpaidRecords.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('ended')}
            className={`min-w-0 px-1 py-2.5 sm:px-4 rounded-xl font-bold flex items-center justify-center gap-1 sm:gap-2 transition-all whitespace-nowrap ${
              activeTab === 'ended'
                ? 'bg-slate-700 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Archive className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span>已截止 ({endedUnpaidRecords.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('paid')}
            className={`min-w-0 px-1 py-2.5 sm:px-4 rounded-xl font-bold flex items-center justify-center gap-1 sm:gap-2 transition-all whitespace-nowrap ${
              activeTab === 'paid'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="sm:hidden">已繳 ({paidRecords.length})</span>
            <span className="hidden sm:inline">歷史已繳紀錄 ({paidRecords.length})</span>
          </button>
        </div>
      </div>

      {/* Global Toast Notice */}
      {noticeMessage && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-slate-800 text-sm font-medium rounded-2xl flex items-center space-x-2.5 animate-in fade-in shadow-2xs">
          <Send className="w-5 h-5 text-amber-600 shrink-0" />
          <span>{noticeMessage}</span>
        </div>
      )}

      {/* Summary Stat Banner */}
      <div className="bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-[0_2px_10px_rgba(0,0,0,0.03)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-900 flex items-center justify-center shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-700">待確認繳費總額</div>
            <div className="text-2xl sm:text-3xl font-extrabold mt-0.5 tracking-tight text-slate-900">
              ${totalUnpaidAmount.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:items-end gap-2 pt-2.5 sm:pt-0 border-t sm:border-t-0 border-slate-100">
          <div className="flex items-center space-x-2 text-xs">
            <span className={`px-2.5 py-1 rounded-lg font-semibold ${
              strictlyUnpaidRecords.length > 0
                ? 'bg-rose-50 text-rose-700/80'
                : 'bg-slate-100 text-slate-500'
            }`}>
              <span className="font-bold">
                {strictlyUnpaidRecords.length}
              </span> 筆未繳
            </span>
            <span className={`px-2.5 py-1 rounded-lg font-semibold ${
              pendingRecords.length > 0
                ? 'bg-amber-50 text-amber-700/80'
                : 'bg-slate-100 text-slate-500'
            }`}>
              <span className="font-bold">
                {pendingRecords.length}
              </span> 筆待審核對帳
            </span>
          </div>
          <div className="text-xs text-slate-500 font-medium">
            點選「標記已匯款付清」通知管理員核對帳款
          </div>
        </div>
      </div>

      {/* Active / ended unpaid projects */}
      {(activeTab === 'active' || activeTab === 'ended') && (
        <div className="space-y-4">
          {(activeTab === 'active' ? activeUnpaidRecords : endedUnpaidRecords).length === 0 ? (
            <div className="bg-white border border-slate-200/80 rounded-3xl p-10 text-center text-slate-500 text-base font-medium shadow-2xs">
              {activeTab === 'active'
                ? '目前沒有進行中的待繳專案。'
                : '目前沒有已截止但尚未繳清的專案。'}
            </div>
          ) : (
            (activeTab === 'active' ? activeUnpaidRecords : endedUnpaidRecords).map((r) => {
              const collection = feeCollections.find((c) => c.id === r.collection_id);
              if (!collection) return null;

              const isPending = r.payment_status === 'pending';
              const isLocked = !isFeeCollectionOpen(collection);

              return (
                <div 
                  key={r.id} 
                  className={`bg-white border rounded-3xl p-6 sm:p-7 shadow-2xs transition-all ${
                    isLocked
                      ? 'border-slate-300 bg-slate-50/70'
                      : 'border-slate-200/80 hover:border-slate-300'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Info Section */}
                    <div className="space-y-2.5">
                      <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
                        <span className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${
                          isLocked
                            ? 'bg-slate-200 text-slate-600'
                            : isPending
                            ? 'bg-amber-100 text-amber-700/80'
                            : 'bg-rose-50 text-rose-700/80'
                        }`}>
                          {isLocked ? '已截止未繳' : isPending ? '待對帳審核' : '未繳款'}
                        </span>
                        <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">{collection.title}</h3>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-slate-500">
                        <span className="flex items-center space-x-1.5 font-medium">
                          <Receipt className="w-4 h-4 text-slate-400 shrink-0" />
                          <span>計費：{collection.c_type === 'split' ? '智慧全隊平分' : '固定金額'}</span>
                        </span>
                        {collection.due_date && (
                          <span className="flex items-center space-x-1.5 font-medium">
                            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                            <span>截止：{collection.due_date}</span>
                          </span>
                        )}
                      </div>

                      {isLocked && (
                        <div className="text-xs sm:text-sm text-slate-700 font-bold bg-slate-100 p-3 rounded-2xl flex items-center space-x-2 mt-2">
                          <Lock className="w-4 h-4 text-slate-500 shrink-0" />
                          <span>本專案已截止或結案，無法再送出或取消匯款回報，請直接聯絡管理員處理。</span>
                        </div>
                      )}

                      {isPending && !isLocked && (
                        <div className="text-xs sm:text-sm text-slate-800 font-bold bg-slate-100 p-3 rounded-2xl flex items-center space-x-2 mt-2">
                          <Send className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>已發送匯款回報，等待管理員核對入帳中</span>
                        </div>
                      )}
                    </div>

                    {/* Amount & Action Button Section */}
                    <div className="flex items-center justify-between sm:justify-end space-x-4 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                      <div className="text-left sm:text-right">
                        <div className="text-xs sm:text-sm text-slate-400 font-medium">應繳金額</div>
                        <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                          ${collection.amount_per_person}
                        </div>
                      </div>

                      {isPending ? (
                        <div className="flex items-center space-x-2">
                          <span className="px-4 py-2.5 bg-slate-100 text-slate-800 font-bold rounded-xl text-xs sm:text-sm flex items-center space-x-1.5">
                            <Clock className="w-4 h-4 text-amber-600 animate-pulse shrink-0" />
                            <span className="whitespace-nowrap">待對帳中</span>
                          </span>
                          {!isLocked && (
                            <button
                              onClick={() => handleCancelReport(r.id)}
                              disabled={submittingRecordId === r.id}
                              className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors border border-transparent hover:border-rose-200 disabled:cursor-wait disabled:opacity-50"
                              title="取消回報"
                            >
                              <RotateCcw className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      ) : isLocked ? (
                        <button
                          type="button"
                          disabled
                          className="px-5 py-3 bg-slate-200 text-slate-500 font-bold rounded-2xl text-sm sm:text-base flex items-center space-x-2 whitespace-nowrap shrink-0 cursor-not-allowed"
                        >
                          <Lock className="w-5 h-5 shrink-0" />
                          <span>已截止</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleMarkAsPaid(r.id, collection.title)}
                          disabled={submittingRecordId === r.id}
                          className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl text-sm sm:text-base flex items-center space-x-2 shadow-2xs active:scale-95 transition-all whitespace-nowrap shrink-0 disabled:cursor-wait disabled:opacity-60"
                        >
                          <CheckCircle2 className="w-5 h-5 shrink-0" />
                          <span>{submittingRecordId === r.id ? '同步中…' : '標記已匯款付清'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Paid Tab */}
      {activeTab === 'paid' && (
        <div className="space-y-4">
          {paidRecords.length === 0 ? (
            <div className="bg-white border border-slate-200/80 rounded-3xl p-10 text-center text-slate-500 text-base font-medium shadow-2xs">
              尚未有已完成對帳的付清紀錄。
            </div>
          ) : (
            paidRecords.map((r) => {
              const collection = feeCollections.find((c) => c.id === r.collection_id);
              if (!collection) return null;

              return (
                <div key={r.id} className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-7 shadow-2xs flex items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center space-x-2.5">
                      <span className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700/80 whitespace-nowrap shrink-0">
                        已對帳付清
                      </span>
                      <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">{collection.title}</h3>
                    </div>
                    <div className="text-xs sm:text-sm text-slate-500 font-medium">
                      付清時間：{r.paid_at ? new Date(r.paid_at).toLocaleDateString('zh-TW') : '之前的紀錄'}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs sm:text-sm text-slate-400 font-medium">已繳金額</div>
                    <div className="text-xl sm:text-2xl font-black text-emerald-700">${collection.amount_per_person}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

    </div>
  );
};
