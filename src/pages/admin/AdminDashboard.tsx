import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { formatTimeRange, isEventPast, formatEventDateTimeCN, formatFullDateCN } from '../../utils/dateUtils';
import { EventSessionCard } from '../../components/common/EventSessionCard';
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  AlertTriangle, 
  Users, 
  ArrowRight, 
  PlusCircle, 
  UserCheck, 
  Receipt,
  CheckCircle2,
  Clock,
  MapPin,
  DollarSign
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { finances, events, attendance, feeCollections, feeRecords, profiles } = useAppStore();

  // 1. Calculate Fund Ledger Balance
  const totalIncome = finances
    .filter((f) => f.type === 'income')
    .reduce((sum, f) => sum + f.amount, 0);

  const totalExpense = finances
    .filter((f) => f.type === 'expense')
    .reduce((sum, f) => sum + f.amount, 0);

  const netBalance = totalIncome - totalExpense;

  // 2. Filter Active Uncollected Fee Projects Warnings & Pending Payments
  const pendingPaymentsCount = feeRecords.filter((r) => !r.is_paid && r.payment_status === 'pending').length;

  const rawActiveCollections = feeCollections
    .filter((c) => c.status === 'active')
    .map((c) => {
      const records = feeRecords.filter((r) => r.collection_id === c.id);
      const paidCount = records.filter((r) => r.is_paid).length;
      const totalCount = records.length;
      const unpaidCount = totalCount - paidCount;
      const uncollectedAmount = unpaidCount * c.amount_per_person;

      return {
        ...c,
        paidCount,
        totalCount,
        unpaidCount,
        uncollectedAmount
      };
    });

  const activeCollectionsWithStatus = rawActiveCollections.filter((c, idx, arr) => 
    arr.findIndex(item => item.id === c.id) === idx
  );

  // 3. Upcoming Events (Filter out past events)
  const rawUpcomingEvents = events
    .filter((e) => !isEventPast(e))
    .sort((a, b) => a.event_date.localeCompare(b.event_date));

  const upcomingEvents = rawUpcomingEvents.filter((e, idx, arr) => 
    arr.findIndex(item => item.id === e.id) === idx
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Page Title & Quick Actions Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
              總覽控制台
            </span>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">球隊行政智慧總覽</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            即時統計公積金、近期待辦活動與隊員費用催繳動態
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => navigate('/admin/events')}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs flex items-center space-x-1.5 transition-all shadow-xs active:scale-98"
          >
            <PlusCircle className="w-4 h-4" />
            <span>發起新活動</span>
          </button>
          <button
            onClick={() => navigate('/admin/finances?tab=splitter')}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs flex items-center space-x-1.5 transition-colors shadow-xs"
          >
            <Wallet className="w-4 h-4 text-emerald-400" />
            <span>智慧平分引擎</span>
          </button>
        </div>
      </div>

      {/* Pending Payments Alert Banner */}
      {pendingPaymentsCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-amber-100 text-amber-700 shrink-0">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="text-xs font-bold text-amber-900 flex items-center space-x-2">
                <span>待處理對帳回報</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-200 text-amber-900 font-extrabold">
                  {pendingPaymentsCount} 筆待審核
                </span>
              </div>
              <p className="text-[11px] text-amber-700 mt-0.5">
                有隊員已於線上標記完成匯款，請前往對帳審核確認款項入帳。
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/admin/finances?tab=projects')}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 transition-all shrink-0 shadow-2xs self-start sm:self-auto"
          >
            <span>立即審核對帳</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        
        {/* Card 1: 球隊公積金餘額 */}
        <div 
          onClick={() => navigate('/admin/finances')}
          className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors">
              球隊公積金餘額
            </span>
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-100 transition-colors shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
              ${netBalance.toLocaleString()}
            </div>
          </div>
          <div className="text-xs text-slate-500 font-normal truncate">
            收入 ${totalIncome.toLocaleString()} ‧ 支出 ${totalExpense.toLocaleString()}
          </div>
        </div>

        {/* Card 2: 球隊總人數 */}
        <div 
          onClick={() => navigate('/admin/members')}
          className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors">
              球隊總人數
            </span>
            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center group-hover:bg-slate-200 transition-colors shrink-0">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-baseline gap-1">
              <span>{profiles.length}</span>
              <span className="text-lg font-bold text-slate-800">人</span>
            </div>
          </div>
          <div className="text-xs text-slate-500 font-normal truncate">
            高階 {profiles.filter(p=>p.level==='高階'||p.level==='校隊/教練').length} 人 ‧ 中初級 {profiles.filter(p=>p.level==='初級'||p.level==='中級'||p.level==='新手').length} 人
          </div>
        </div>

        {/* Card 3: 近期活動 */}
        <div 
          onClick={() => navigate('/admin/events')}
          className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors">
              近期活動
            </span>
            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center group-hover:bg-slate-200 transition-colors shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-baseline gap-1">
              <span>{upcomingEvents.length}</span>
              <span className="text-lg font-bold text-slate-800">場</span>
            </div>
          </div>
          <div className="text-xs text-slate-500 font-normal truncate">
            最近：{upcomingEvents[0] ? formatEventDateTimeCN(upcomingEvents[0].event_date, upcomingEvents[0].start_time) : '尚無排定活動'}
          </div>
        </div>

        {/* Card 4: 待確認繳費 / 未收齊費用 */}
        <div 
          onClick={() => navigate('/admin/finances?tab=projects')}
          className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition-all cursor-pointer group flex flex-col justify-between"
        >
          {(() => {
            const totalUncollected = activeCollectionsWithStatus.reduce((s,c)=>s+c.uncollectedAmount, 0);
            const totalUnpaidCount = activeCollectionsWithStatus.reduce((s,c)=>s+c.unpaidCount, 0);
            return (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors">
                    待確認繳費
                  </span>
                  <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center group-hover:bg-slate-200 transition-colors shrink-0">
                    <DollarSign className="w-5 h-5" />
                  </div>
                </div>
                <div className="my-2.5">
                  <div className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-baseline gap-1">
                    <span>{totalUnpaidCount}</span>
                    <span className="text-lg font-bold text-slate-800">筆</span>
                  </div>
                </div>
                <div className="text-xs text-slate-500 font-normal truncate">
                  合計 ${totalUncollected.toLocaleString()}
                </div>
              </>
            );
          })()}
        </div>

      </div>

      {/* Main Content Grid: Upcoming Events & Fee Project Warnings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (7 cols): Upcoming Events Cards */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span>近期球隊活動</span>
            </h2>
            <button
              onClick={() => navigate('/admin/events')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center space-x-1 transition-colors"
            >
              <span>管理全部活動</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3.5">
            {upcomingEvents.length === 0 ? (
              <div className="bg-white border border-slate-200/80 rounded-2xl p-8 text-center text-slate-400 text-xs shadow-2xs space-y-2">
                <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
                <div className="font-semibold text-slate-600">目前沒有即將到來的隊務活動</div>
                <p className="text-[11px] text-slate-400">所有過往活動皆已結束，可點擊「管理全部活動」或發起新活動。</p>
              </div>
            ) : (
              upcomingEvents.map((evt, idx) => {
                const eventAtts = attendance.filter((a) => a.event_id === evt.id);
                const attendingAtts = eventAtts.filter((a) => a.status === 'attending');
                const attendingCount = attendingAtts.length;

                return (
                  <EventSessionCard
                    key={evt.id}
                    event={evt}
                    attendingCount={attendingCount}
                    maxParticipants={evt.max_participants || profiles.length}
                    isNext={idx === 0}
                    isAdmin={true}
                    onAdminClick={() => navigate(`/admin/attendance?eventId=${evt.id}`)}
                  />
                );
              })
            )}
          </div>
        </div>

        {/* Right Column (5 cols): Uncollected Fee Warnings */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              <span>未收齊專案催繳</span>
            </h2>
            <button
              onClick={() => navigate('/admin/finances?tab=projects')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center space-x-1 transition-colors"
            >
              <span>公積金與帳務</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3.5">
            {activeCollectionsWithStatus.length === 0 ? (
              <div className="bg-white border border-slate-200/80 rounded-2xl p-8 text-center text-slate-400 text-xs shadow-2xs space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <div className="font-semibold text-slate-700 text-sm">目前無待催繳專案</div>
                <p className="text-[11px] text-slate-400">所有費用專案均已收齊或尚無收費專案。</p>
              </div>
            ) : (
              activeCollectionsWithStatus.map((col) => {
                const progressPercent = Math.round((col.paidCount / col.totalCount) * 100) || 0;
                const totalTargetAmount = col.total_amount || (col.amount_per_person * col.totalCount);
                const collectedAmount = col.paidCount * col.amount_per_person;

                return (
                  <div
                    key={col.id}
                    className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3.5 shadow-2xs hover:border-slate-300 transition-all"
                  >
                    {/* Top Row: Type Pill Badge (Left) & Total Target Amount (Right) */}
                    <div className="flex items-center justify-between">
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100/90 text-slate-700">
                        {col.c_type === 'split' ? '出席均分' : '固定項目'}
                      </span>
                      <div className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                        ${totalTargetAmount.toLocaleString()}
                      </div>
                    </div>

                    {/* Middle: Title & Due Date */}
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 tracking-tight">{col.title}</h3>
                      <p className="text-xs text-slate-500 mt-1 font-normal">
                        繳費期限 {formatFullDateCN(col.due_date) || '無期限'}
                      </p>
                    </div>

                    {/* Progress bar with website signature emerald accent */}
                    <div className="space-y-2 pt-0.5">
                      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-xs sm:text-sm text-slate-600 font-medium">
                        <span>已收 ${collectedAmount.toLocaleString()}</span>
                        <span className="text-slate-500">{col.paidCount} / {col.totalCount} 人完成</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

    </div>
  );
};

