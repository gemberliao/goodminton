import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { FinanceType, CollectionType, FinanceLedger, FeeCollection } from '../../types';
import { getLocalDateString, isFeeCollectionOpen } from '../../utils/dateUtils';
import { 
  Wallet, 
  PlusCircle, 
  Calculator, 
  Users, 
  CheckCircle2, 
  XCircle, 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Trash2,
  DollarSign,
  Receipt,
  Sparkles,
  Pencil,
  X,
  Clock,
  Send,
  Check,
  AlertCircle,
  Search,
  Archive
} from 'lucide-react';

export const AdminFinances: React.FC = () => {
  const { 
    finances, 
    addFinance, 
    updateFinance,
    deleteFinance, 
    feeCollections, 
    feeRecords, 
    profiles, 
    addFeeCollection, 
    updateFeeCollection,
    addUsersToFeeCollection,
    deleteFeeCollection,
    confirmFeePayment,
    rejectFeePayment,
    toggleFeePaidStatus, 
    closeFeeCollection 
  } = useAppStore();

  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const collectionIdParam = searchParams.get('collectionId');

  const [activeTab, setActiveTab] = useState<'splitter' | 'ledger' | 'projects'>(() => {
    if (tabParam === 'splitter' || tabParam === 'ledger' || tabParam === 'projects') {
      return tabParam;
    }
    return 'projects';
  });

  useEffect(() => {
    if (tabParam === 'splitter' || tabParam === 'ledger' || tabParam === 'projects') {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  // Fee Collection selection & filtering state
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>(() => {
    if (collectionIdParam && feeCollections.some(c => c.id === collectionIdParam)) {
      return collectionIdParam;
    }
    return feeCollections[0]?.id || '';
  });
  const [projectScope, setProjectScope] = useState<'active' | 'ended'>('active');

  const activeCollections = React.useMemo(
    () => feeCollections.filter(isFeeCollectionOpen),
    [feeCollections]
  );
  const endedCollections = React.useMemo(
    () => feeCollections.filter((collection) => !isFeeCollectionOpen(collection)),
    [feeCollections]
  );
  const scopedCollections = projectScope === 'active' ? activeCollections : endedCollections;

  const [feeStatusFilter, setFeeStatusFilter] = useState<'all' | 'paid' | 'pending' | 'unpaid'>('all');
  const [feeSearchTerm, setFeeSearchTerm] = useState('');

  // Keep the selected project aligned with the active/ended section.
  useEffect(() => {
    if (collectionIdParam) {
      const linkedCollection = feeCollections.find((collection) => collection.id === collectionIdParam);
      if (linkedCollection) {
        setProjectScope(isFeeCollectionOpen(linkedCollection) ? 'active' : 'ended');
        setSelectedCollectionId(collectionIdParam);
        return;
      }
    }

    if (!scopedCollections.some((collection) => collection.id === selectedCollectionId)) {
      setSelectedCollectionId(scopedCollections[0]?.id || '');
    }
  }, [collectionIdParam, feeCollections, projectScope, scopedCollections, selectedCollectionId]);

  const handleSelectCollection = (id: string) => {
    setSelectedCollectionId(id);
    setSearchParams({ tab: 'projects', collectionId: id });
  };

  const handleProjectScopeChange = (scope: 'active' | 'ended') => {
    setProjectScope(scope);
    const nextCollections = scope === 'active' ? activeCollections : endedCollections;
    const firstId = nextCollections[0]?.id || '';
    setSelectedCollectionId(firstId);
    setFeeStatusFilter('all');
    setFeeSearchTerm('');
    setSearchParams(firstId ? { tab: 'projects', collectionId: firstId } : { tab: 'projects' });
  };

  // Ledger state
  const [finTitle, setFinTitle] = useState('');
  const [finType, setFinType] = useState<FinanceType>('expense');
  const [finAmount, setFinAmount] = useState(1000);
  const [finDate, setFinDate] = useState(new Date().toISOString().split('T')[0]);
  const [finRemarks, setFinRemarks] = useState('');

  // Editing Finance Item modal state
  const [editingFinance, setEditingFinance] = useState<FinanceLedger | null>(null);

  // Editing Fee Collection modal state
  const [editingCollection, setEditingCollection] = useState<FeeCollection | null>(null);
  const [editingNewMemberIds, setEditingNewMemberIds] = useState<string[]>([]);

  const editingCollectionMemberIds = React.useMemo(
    () => new Set(
      editingCollection
        ? feeRecords
            .filter((record) => record.collection_id === editingCollection.id)
            .map((record) => record.user_id)
        : []
    ),
    [editingCollection?.id, feeRecords]
  );
  const addableEditingProfiles = React.useMemo(
    () => profiles.filter((profile) => !editingCollectionMemberIds.has(profile.id)),
    [editingCollectionMemberIds, profiles]
  );

  const handleOpenFeeCollectionEditor = (collection: FeeCollection) => {
    setEditingCollection(collection);
    setEditingNewMemberIds([]);
  };

  const handleToggleEditingMember = (userId: string) => {
    setEditingNewMemberIds((current) => (
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId]
    ));
  };

  // Splitter Engine state
  const [splitTitle, setSplitTitle] = useState('8月比賽用球與場租平分專案');
  const [splitType, setSplitType] = useState<CollectionType>('split');
  const [totalAmount, setTotalAmount] = useState(3000);
  const [amountPerPerson, setAmountPerPerson] = useState(500);
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(profiles.map(p => p.id));
  const [successNotice, setSuccessNotice] = useState('');
  const [busyItemId, setBusyItemId] = useState<string | null>(null);

  // Pending payments waiting for admin review
  const pendingRecords = feeRecords.filter((r) => !r.is_paid && r.payment_status === 'pending');

  // Calculate Ledger totals
  const totalIncome = finances.filter((f) => f.type === 'income').reduce((s, f) => s + f.amount, 0);
  const totalExpense = finances.filter((f) => f.type === 'expense').reduce((s, f) => s + f.amount, 0);
  const netBalance = totalIncome - totalExpense;

  // Split calculation helper
  const memberCount = selectedUserIds.length;
  const calculatedSplitPerPerson = splitType === 'split' && memberCount > 0
    ? Math.ceil(totalAmount / memberCount)
    : amountPerPerson;

  const handleSelectAllUsers = () => {
    if (selectedUserIds.length === profiles.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(profiles.map(p => p.id));
    }
  };

  const handleToggleUserSelection = (userId: string) => {
    if (selectedUserIds.includes(userId)) {
      setSelectedUserIds(selectedUserIds.filter(id => id !== userId));
    } else {
      setSelectedUserIds([...selectedUserIds, userId]);
    }
  };

  const showSuccessNotice = (message: string) => {
    setSuccessNotice(message);
    window.setTimeout(() => setSuccessNotice(''), 5000);
  };

  const handleAddFinanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!finTitle.trim() || finAmount <= 0) return;

    const result = await addFinance({
      title: finTitle,
      type: finType,
      amount: Number(finAmount),
      move_date: finDate,
      remarks: finRemarks
    });
    if (!result.success) return;

    setFinTitle('');
    setFinAmount(1000);
    setFinRemarks('');
    showSuccessNotice('帳務資料已儲存。');
  };

  const handleCreateSplitProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!splitTitle.trim() || selectedUserIds.length === 0) return;
    if (dueDate < getLocalDateString()) {
      setSuccessNotice('截止日期不能早於今天，請重新選擇。');
      return;
    }

    const result = await addFeeCollection(
      splitTitle,
      splitType,
      splitType === 'split'
        ? Number(totalAmount)
        : Number(calculatedSplitPerPerson) * memberCount,
      Number(calculatedSplitPerPerson),
      selectedUserIds,
      dueDate
    );
    if (!result.success) return;

    showSuccessNotice(`已成功為 ${memberCount} 位隊員發起「${splitTitle}」費用分攤專案！每人金額 $${calculatedSplitPerPerson}`);
    setActiveTab('projects');
    setProjectScope('active');
  };

  const handleDeleteFinance = async (finance: FinanceLedger) => {
    if (busyItemId) return false;
    const confirmed = window.confirm(
      `確定要永久刪除帳務「${finance.title}」嗎？\n\n刪除後無法復原。`
    );
    if (!confirmed) return false;

    setBusyItemId(finance.id);
    const result = await deleteFinance(finance.id);
    setBusyItemId(null);
    if (result.success) showSuccessNotice(`已刪除帳務「${finance.title}」。`);
    return result.success;
  };

  const handleDeleteFeeCollection = async (collection: FeeCollection) => {
    if (busyItemId) return false;
    const recordCount = feeRecords.filter((record) => record.collection_id === collection.id).length;
    const confirmed = window.confirm(
      `確定要永久刪除收費專案「${collection.title}」嗎？\n\n${recordCount} 筆隊員繳費紀錄也會一併刪除，且無法復原。`
    );
    if (!confirmed) return false;

    setBusyItemId(collection.id);
    const result = await deleteFeeCollection(collection.id);
    setBusyItemId(null);
    if (result.success) showSuccessNotice(`已刪除收費專案「${collection.title}」。`);
    return result.success;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div>
        <div className="flex items-center space-x-2.5">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">帳務控制台 & 智慧分攤引擎</h1>
        </div>
        <p className="text-sm text-slate-500 mt-1.5">
          透明管理隊務公積金流水帳，運用智慧分攤引擎一鍵對指定隊員產生分攤帳單
        </p>
      </div>

      {/* Success Notice */}
      {successNotice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-2xl flex items-center space-x-2.5 animate-in fade-in">
          <Sparkles className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-bold">{successNotice}</span>
        </div>
      )}

      {/* Pending Payment Review Alert */}
      {pendingRecords.length > 0 && (
        <div className="p-5 bg-amber-50 border border-amber-200 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 shadow-2xs animate-in fade-in">
          <div className="flex items-center space-x-3.5">
            <div className="p-2.5 rounded-2xl bg-amber-100 text-amber-700 font-bold shrink-0">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="text-sm font-bold text-amber-900 flex items-center space-x-2">
                <span>待管理員對帳審核通知</span>
                <span className="px-2.5 py-0.5 rounded-lg text-xs bg-amber-200 text-slate-800 font-bold">
                  {pendingRecords.length} 筆待確認
                </span>
              </div>
              <p className="text-xs sm:text-sm text-amber-700 mt-0.5 font-medium">
                隊員已線上標記完成匯款，請核對銀行帳戶無誤後，點選「確認對帳付清」變更為已繳。
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setActiveTab('projects');
              setSearchParams({ tab: 'projects' });
            }}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs sm:text-sm font-bold shrink-0 self-start sm:self-auto transition-all shadow-2xs"
          >
            前往審核對帳 ({pendingRecords.length})
          </button>
        </div>
      )}

      {/* Overview Stat Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
        {/* Balance Card */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-700">公積金目前結餘</span>
            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
              ${netBalance.toLocaleString()}
            </div>
          </div>
          <div className="text-xs text-slate-500 font-medium">
            目前隊費可用淨額
          </div>
        </div>

        {/* Income Card */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-700">歷史總收入</span>
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-2xl font-extrabold text-emerald-600 tracking-tight">
              ${totalIncome.toLocaleString()}
            </div>
          </div>
          <div className="text-xs text-slate-500 font-medium">
            累計所有收繳入帳
          </div>
        </div>

        {/* Expense Card */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-700">歷史總支出</span>
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-2xl font-extrabold text-rose-600 tracking-tight">
              ${totalExpense.toLocaleString()}
            </div>
          </div>
          <div className="text-xs text-slate-500 font-medium">
            累計球具租用等開銷
          </div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80 text-sm">
        <button
          onClick={() => {
            setActiveTab('splitter');
            setSearchParams({ tab: 'splitter' });
          }}
          className={`py-2.5 px-2 sm:px-4 rounded-xl font-bold flex items-center justify-center space-x-1.5 sm:space-x-2 transition-all ${
            activeTab === 'splitter'
              ? 'bg-emerald-600 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <Calculator className="w-4 h-4 shrink-0" />
          <span className="text-xs sm:text-sm tracking-tight">
            <span className="sm:hidden">智慧分攤</span>
            <span className="hidden sm:inline">智慧分攤引擎</span>
          </span>
        </button>
        <button
          onClick={() => {
            setActiveTab('projects');
            setSearchParams({ tab: 'projects' });
          }}
          className={`py-2.5 px-2 sm:px-4 rounded-xl font-bold flex items-center justify-center space-x-1.5 sm:space-x-2 transition-all ${
            activeTab === 'projects'
              ? 'bg-emerald-600 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <Receipt className="w-4 h-4 shrink-0" />
          <span className="text-xs sm:text-sm tracking-tight flex items-center space-x-1.5">
            <span className="sm:hidden">收費催繳</span>
            <span className="hidden sm:inline">收費專案與催繳紀錄</span>
            {pendingRecords.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-xs bg-amber-500 text-white font-extrabold animate-pulse">
                {pendingRecords.length}
              </span>
            )}
          </span>
        </button>
        <button
          onClick={() => {
            setActiveTab('ledger');
            setSearchParams({ tab: 'ledger' });
          }}
          className={`py-2.5 px-2 sm:px-4 rounded-xl font-bold flex items-center justify-center space-x-1.5 sm:space-x-2 transition-all ${
            activeTab === 'ledger'
              ? 'bg-emerald-600 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <Wallet className="w-4 h-4 shrink-0" />
          <span className="text-xs sm:text-sm tracking-tight">
            <span className="sm:hidden">流水帳</span>
            <span className="hidden sm:inline">公積金流水帳</span>
          </span>
        </button>
      </div>

      {/* TAB 1: 智慧分攤引擎 (Smart Expense Splitter) */}
      {activeTab === 'splitter' && (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-7 shadow-2xs space-y-6">
          <div className="flex items-center space-x-3 border-b border-slate-100 pb-4">
            <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900">智慧平分與收費發起引擎</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                輸入費用總額，選取參與分攤的隊員，系統將精確無條件進位平分金額並寫入帳單
              </p>
            </div>
          </div>

          <form onSubmit={handleCreateSplitProject} className="space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                  收費專案名稱 *
                </label>
                <input
                  type="text"
                  required
                  value={splitTitle}
                  onChange={(e) => setSplitTitle(e.target.value)}
                  placeholder="例如：8月比賽用球團購與場地租金分攤"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm sm:text-base text-slate-900 font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                  計算模式
                </label>
                <select
                  value={splitType}
                  onChange={(e) => setSplitType(e.target.value as CollectionType)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm sm:text-base text-slate-900 font-bold focus:outline-none focus:border-emerald-500 focus:bg-white transition-all cursor-pointer"
                >
                  <option value="split">自動平分 (總價 🌟 人數無條件進位平分)</option>
                  <option value="fixed">固定每人金額 (所有人收取固定數額)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {splitType === 'split' ? (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">
                    欲平分之總金額 ($)
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-lg text-emerald-700 font-black focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">
                    每人固定金額 ($)
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={amountPerPerson}
                    onChange={(e) => setAmountPerPerson(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-lg text-emerald-700 font-black focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                  繳費截止日期
                </label>
                <input
                  type="date"
                  min={getLocalDateString()}
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm sm:text-base text-slate-900 font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
                />
              </div>

              {/* Calculated Split Preview Result */}
              <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200 flex flex-col justify-center">
                <span className="text-xs text-emerald-800 font-bold">即時試算平分結果：</span>
                <div className="text-2xl font-black text-emerald-700 tracking-tight mt-0.5">
                  ${calculatedSplitPerPerson} <span className="text-xs text-slate-500 font-normal">/ 每人</span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5 font-medium">
                  共有 {memberCount} 人參與分攤
                </div>
              </div>
            </div>

            {/* Select Target Members */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-slate-800 flex items-center space-x-1.5">
                  <Users className="w-4 h-4 text-emerald-600" />
                  <span>選擇分攤對象 ({memberCount} / {profiles.length} 已選擇)</span>
                </label>
                <button
                  type="button"
                  onClick={handleSelectAllUsers}
                  className="text-xs sm:text-sm font-bold text-emerald-600 hover:underline"
                >
                  {memberCount === profiles.length ? '全不選' : '全選隊員'}
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {profiles.map((p) => {
                  const selected = selectedUserIds.includes(p.id);
                  return (
                    <div
                      key={p.id}
                      onClick={() => handleToggleUserSelection(p.id)}
                      className={`p-3 rounded-2xl border cursor-pointer select-none transition-all flex items-center space-x-2.5 ${
                        selected
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold shadow-2xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => {}}
                        className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-0 cursor-pointer"
                      />
                      <div className="truncate text-sm font-bold">{p.name}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={memberCount === 0}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl text-sm sm:text-base transition-all shadow-2xs active:scale-98 flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <Sparkles className="w-5 h-5" />
              <span>一鍵對選取隊員產生平分帳單</span>
            </button>

          </form>
        </div>
      )}

      {/* TAB 2: 收費專案與催繳紀錄 (Fee Collections & Tracking) */}
      {activeTab === 'projects' && (
        <div className="space-y-4">
          {feeCollections.length > 0 && (
            <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-slate-100 p-1.5">
              <button
                type="button"
                onClick={() => handleProjectScopeChange('active')}
                className={`rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
                  projectScope === 'active'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                進行中的專案 ({activeCollections.length})
              </button>
              <button
                type="button"
                onClick={() => handleProjectScopeChange('ended')}
                className={`rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
                  projectScope === 'ended'
                    ? 'bg-slate-700 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                已截止／已結案 ({endedCollections.length})
              </button>
            </div>
          )}

          {feeCollections.length === 0 ? (
            <div className="bg-white border border-slate-200/80 rounded-3xl p-10 text-center shadow-2xs space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <Receipt className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">目前尚無收費催繳專案</h3>
                <p className="text-sm text-slate-500 mt-1">
                  您可以透過「智慧分攤引擎」快速發起隊費、球具或比賽費用的分攤催繳專案。
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('splitter');
                  setSearchParams({ tab: 'splitter' });
                }}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm transition-all shadow-2xs inline-flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>前往發起新收費專案</span>
              </button>
            </div>
          ) : scopedCollections.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-2xs">
              <Archive className="mx-auto h-10 w-10 text-slate-300" />
              <h3 className="mt-3 text-base font-bold text-slate-800">
                {projectScope === 'active' ? '目前沒有進行中的收費專案' : '目前沒有已結束的收費專案'}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {projectScope === 'active' ? '可前往智慧分攤引擎建立新的收費專案。' : '截止或手動結案的專案會自動移到這裡。'}
              </p>
            </div>
          ) : (
            (() => {
              const currentCollection = scopedCollections.find(c => c.id === selectedCollectionId) || scopedCollections[0];
              const currentCollectionIsOpen = isFeeCollectionOpen(currentCollection);
              const records = feeRecords.filter((r) => r.collection_id === currentCollection?.id);
              const paidRecords = records.filter((r) => r.is_paid);
              const pendingRecordsCol = records.filter((r) => !r.is_paid && r.payment_status === 'pending');
              const unpaidRecordsCol = records.filter((r) => !r.is_paid && r.payment_status !== 'pending');

              const amountPerPerson = currentCollection?.amount_per_person || 0;
              const totalReceivable = records.length * amountPerPerson;
              const totalPaidAmount = paidRecords.length * amountPerPerson;
              const strictlyUnpaidAmount = unpaidRecordsCol.length * amountPerPerson;

              // Filtered list
              const filteredRecords = records.filter((r) => {
                const member = profiles.find((p) => p.id === r.user_id);
                if (feeSearchTerm.trim()) {
                  const term = feeSearchTerm.toLowerCase();
                  const nameMatch = member?.name?.toLowerCase().includes(term);
                  const userMatch = member?.username?.toLowerCase().includes(term);
                  if (!nameMatch && !userMatch) return false;
                }

                if (feeStatusFilter === 'paid') return r.is_paid;
                if (feeStatusFilter === 'pending') return !r.is_paid && r.payment_status === 'pending';
                if (feeStatusFilter === 'unpaid') return !r.is_paid && r.payment_status !== 'pending';
                return true;
              });

              return (
                <div className="space-y-4">
                  {/* Selector & Actions Bar */}
                  <div className="bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-5 shadow-2xs space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Collection Selector Dropdown */}
                      <div className="w-full md:w-auto md:min-w-[340px] flex-1">
                        <div className="relative">
                          <select
                            value={currentCollection?.id || ''}
                            onChange={(e) => handleSelectCollection(e.target.value)}
                            className="w-full pl-3.5 pr-8 py-2.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-2xl text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all cursor-pointer truncate"
                          >
                            {scopedCollections.map((col) => {
                              const colRecords = feeRecords.filter(r => r.collection_id === col.id);
                              const colPaid = colRecords.filter(r => r.is_paid).length;
                              const isAct = isFeeCollectionOpen(col);
                              return (
                                <option key={col.id} value={col.id}>
                                  {isAct ? '【進行中】' : '【已結案】'} {col.title} — ${col.amount_per_person}/人 ({colPaid}/{colRecords.length} 已繳)
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      </div>

                      {/* Actions & Metadata */}
                      <div className="flex items-center space-x-2 self-start md:self-auto flex-wrap gap-y-2">
                        <span className={`inline-flex items-center gap-1.5 py-1 text-xs font-bold ${
                          currentCollectionIsOpen ? 'text-slate-800' : 'text-slate-500'
                        }`}>
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              currentCollectionIsOpen ? 'bg-emerald-500' : 'bg-slate-400'
                            }`}
                            aria-hidden="true"
                          />
                          <span>
                            {currentCollectionIsOpen
                              ? '進行催繳中'
                              : currentCollection.status === 'closed'
                              ? '已手動結案'
                              : '已逾截止日'}
                          </span>
                        </span>

                        {currentCollectionIsOpen ? (
                          <button
                            type="button"
                            onClick={() => void closeFeeCollection(currentCollection.id)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs rounded-xl font-bold border border-slate-200 transition-colors cursor-pointer"
                          >
                            結案標記
                          </button>
                        ) : currentCollection.status === 'closed' && (!currentCollection.due_date || currentCollection.due_date >= getLocalDateString()) ? (
                          <button
                            type="button"
                            onClick={() => void updateFeeCollection(currentCollection.id, { status: 'active' })}
                            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs rounded-xl font-bold border border-emerald-200 transition-colors cursor-pointer"
                          >
                            重啟催繳
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenFeeCollectionEditor(currentCollection)}
                            className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs rounded-xl font-bold border border-amber-200 transition-colors cursor-pointer"
                          >
                            調整截止日後重啟
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleOpenFeeCollectionEditor(currentCollection)}
                          className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors border border-transparent hover:border-emerald-200 cursor-pointer"
                          title="編輯專案"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={busyItemId === currentCollection.id}
                          onClick={() => void handleDeleteFeeCollection(currentCollection)}
                          className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors border border-transparent hover:border-rose-200 cursor-pointer"
                          title="刪除專案"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* 4 Interactive Metric Filter Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3 border-t border-slate-100">
                      {/* All Targets */}
                      <button
                        type="button"
                        onClick={() => setFeeStatusFilter('all')}
                        aria-pressed={feeStatusFilter === 'all'}
                        className={`p-3.5 rounded-2xl text-center transition-colors cursor-pointer ${
                          feeStatusFilter === 'all'
                            ? 'bg-slate-100 text-slate-900'
                            : 'bg-slate-50/70 hover:bg-slate-100 text-slate-600'
                        }`}
                      >
                        <div className="text-[11px] font-bold text-slate-500">
                          應繳總人數
                        </div>
                        <div className="text-xl font-black text-slate-900 tracking-tight mt-0.5">
                          {records.length} <span className="text-xs font-normal text-slate-500">人</span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-medium mt-0.5">
                          應收 ${totalReceivable.toLocaleString()}
                        </div>
                      </button>

                      {/* Paid */}
                      <button
                        type="button"
                        onClick={() => setFeeStatusFilter('paid')}
                        aria-pressed={feeStatusFilter === 'paid'}
                        className={`p-3.5 rounded-2xl text-center transition-colors cursor-pointer ${
                          feeStatusFilter === 'paid'
                            ? 'bg-emerald-100/80 text-slate-900'
                            : 'bg-emerald-50/60 hover:bg-emerald-100/70 text-slate-600'
                        }`}
                      >
                        <div className="text-[11px] font-bold text-emerald-700/80 flex items-center justify-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>已對帳繳清</span>
                        </div>
                        <div className="text-xl font-black text-emerald-700/80 tracking-tight mt-0.5">
                          {paidRecords.length} <span className="text-xs font-normal text-emerald-700/70">人</span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                          已收 ${totalPaidAmount.toLocaleString()}
                        </div>
                      </button>

                      {/* Pending Review */}
                      <button
                        type="button"
                        onClick={() => setFeeStatusFilter('pending')}
                        aria-pressed={feeStatusFilter === 'pending'}
                        className={`p-3.5 rounded-2xl text-center transition-colors cursor-pointer ${
                          feeStatusFilter === 'pending'
                            ? 'bg-amber-100/80 text-slate-900'
                            : 'bg-amber-50/60 hover:bg-amber-100/70 text-slate-600'
                        }`}
                      >
                        <div className="text-[11px] font-bold text-amber-700/80 flex items-center justify-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          <span>待對帳審核</span>
                        </div>
                        <div className="text-xl font-black text-amber-700/80 tracking-tight mt-0.5">
                          {pendingRecordsCol.length} <span className="text-xs font-normal text-amber-700/70">人</span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                          隊員已回報匯款
                        </div>
                      </button>

                      {/* Unpaid */}
                      <button
                        type="button"
                        onClick={() => setFeeStatusFilter('unpaid')}
                        aria-pressed={feeStatusFilter === 'unpaid'}
                        className={`p-3.5 rounded-2xl text-center transition-colors cursor-pointer ${
                          feeStatusFilter === 'unpaid'
                            ? 'bg-rose-100/80 text-slate-900'
                            : 'bg-rose-50/60 hover:bg-rose-100/70 text-slate-600'
                        }`}
                      >
                        <div className="text-[11px] font-bold text-rose-700/80 flex items-center justify-center gap-1">
                          <XCircle className="w-3.5 h-3.5 text-rose-600" />
                          <span>尚未繳納</span>
                        </div>
                        <div className="text-xl font-black text-rose-700/80 tracking-tight mt-0.5">
                          {unpaidRecordsCol.length} <span className="text-xs font-normal text-rose-700/70">人</span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                          尚欠 ${strictlyUnpaidAmount.toLocaleString()}
                        </div>
                      </button>
                    </div>

                    {unpaidRecordsCol.length > 0 && (
                      <div className="rounded-2xl bg-rose-50/70 p-3.5">
                        <div className="flex items-center gap-2 text-xs font-black text-slate-800">
                          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                          <span>尚未繳交名單（{unpaidRecordsCol.length} 人）</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {unpaidRecordsCol.map((record) => {
                            const member = profiles.find((profile) => profile.id === record.user_id);
                            return (
                              <span
                                key={record.id}
                                className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-slate-800"
                              >
                                {member?.name || member?.username || '未知隊員'}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Search & Batch Controls */}
                  <div className="bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-5 shadow-2xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Active Filter Label */}
                      <div className="text-xs sm:text-sm font-bold text-slate-700 flex items-center gap-1.5">
                        <span>名單清單</span>
                        <span className="text-slate-300">·</span>
                        <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 ">
                          {feeStatusFilter === 'all' && `全部隊員 (${filteredRecords.length})`}
                          {feeStatusFilter === 'paid' && `已對帳繳清 (${filteredRecords.length})`}
                          {feeStatusFilter === 'pending' && `待審核 (${filteredRecords.length})`}
                          {feeStatusFilter === 'unpaid' && `尚未繳納 (${filteredRecords.length})`}
                        </span>
                      </div>

                      {/* Right Controls: Search */}
                      <div className="w-full sm:w-auto">
                        <div className="relative w-full sm:w-56">
                          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="搜尋隊員姓名..."
                            value={feeSearchTerm}
                            onChange={(e) => setFeeSearchTerm(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Member payment checklist cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {filteredRecords.length === 0 ? (
                        <div className="col-span-full py-8 text-center text-slate-400 text-sm font-medium">
                          沒有符合篩選條件的隊員紀錄
                        </div>
                      ) : (
                        filteredRecords.map((r) => {
                          const member = profiles.find((p) => p.id === r.user_id);
                          const isPending = !r.is_paid && r.payment_status === 'pending';

                          if (isPending) {
                            return (
                              <div
                                key={r.id}
                                className="p-4 rounded-2xl bg-amber-50/90 text-amber-950 flex flex-col justify-between gap-2.5 shadow-2xs animate-in fade-in"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <Clock className="w-4 h-4 text-amber-600 animate-pulse shrink-0" />
                                    <span className="text-sm font-extrabold">{member?.name || '隊員'}</span>
                                  </div>
                                  <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-amber-200 text-slate-800 shrink-0">
                                    隊員已回報匯款
                                  </span>
                                </div>
                                {r.reported_at && (
                                  <p className="text-xs text-amber-800 font-medium">
                                    回報時間：{new Date(r.reported_at).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                )}
                                <div className="flex items-center space-x-2 mt-1 pt-2.5 border-t border-amber-200/80">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      confirmFeePayment(r.id);
                                    }}
                                    className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-2xs flex items-center justify-center space-x-1.5 transition-all active:scale-95 cursor-pointer"
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>確認對帳付清</span>
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      rejectFeePayment(r.id, '未查收到帳戶金額');
                                    }}
                                    className="py-2 px-3 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 text-xs sm:text-sm font-bold rounded-xl flex items-center justify-center space-x-1 transition-all cursor-pointer"
                                  >
                                    <XCircle className="w-4 h-4" />
                                    <span>駁回</span>
                                  </button>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div
                              key={r.id}
                              className={`p-3.5 rounded-2xl flex items-center justify-between transition-colors ${
                                r.is_paid
                                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                                  : 'bg-rose-50/70 border-rose-200 text-rose-950'
                              }`}
                            >
                              <div className="flex items-center space-x-2.5">
                                {r.is_paid ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-rose-500" />}
                                <span className="text-sm font-bold">{member?.name || '隊員'}</span>
                              </div>
                              <button
                                onClick={() => toggleFeePaidStatus(r.id, !r.is_paid)}
                                className={`text-xs font-bold px-3 py-1.5 rounded-xl whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                                  r.is_paid 
                                    ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 '
                                    : 'bg-rose-100 hover:bg-rose-200 text-rose-800 '
                                }`}
                                title={r.is_paid ? '點擊取消已繳標記' : '點擊手動變更為已繳'}
                              >
                                {r.is_paid ? '已對帳繳清' : '尚未繳納 (手動已繳)'}
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              );
            })()
          )}
        </div>
      )}

      {/* TAB 3: 公積金流水帳 (Ledger) */}
      {activeTab === 'ledger' && (
        <div className="space-y-6">
          {/* Add Finance Item Form */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-7 shadow-2xs space-y-4">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-2">
              <PlusCircle className="w-5 h-5 text-emerald-600" />
              <span>記一筆公積金流水帳</span>
            </h2>

            <form onSubmit={handleAddFinanceSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">收支類型</label>
                <select
                  value={finType}
                  onChange={(e) => setFinType(e.target.value as FinanceType)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 font-bold focus:outline-none"
                >
                  <option value="expense">支出 (Expense)</option>
                  <option value="income">收入 (Income)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">項目名稱</label>
                <input
                  type="text"
                  required
                  placeholder="例如：購買Victor羽球5打"
                  value={finTitle}
                  onChange={(e) => setFinTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 font-medium focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">金額 ($)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={finAmount}
                  onChange={(e) => setFinAmount(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">日期</label>
                <input
                  type="date"
                  value={finDate}
                  onChange={(e) => setFinDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 font-medium focus:outline-none"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm sm:text-base transition-all shadow-2xs"
                >
                  新增流水帳
                </button>
              </div>
            </form>
          </div>

          {/* Ledger Table */}
          <div className="bg-white border border-slate-200/80 rounded-3xl shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs sm:text-sm font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                    <th className="p-4 sm:p-5">異動日期</th>
                    <th className="p-4 sm:p-5">項目名稱</th>
                    <th className="p-4 sm:p-5">類型</th>
                    <th className="p-4 sm:p-5 text-right">異動金額</th>
                    <th className="p-4 sm:p-5 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {finances.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 sm:p-5 text-slate-500 font-mono font-medium whitespace-nowrap">{item.move_date}</td>
                      <td className="p-4 sm:p-5 font-bold text-slate-900 min-w-[120px] text-sm sm:text-base">{item.title}</td>
                      <td className="p-4 sm:p-5 whitespace-nowrap">
                        <span className={`inline-block px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 ${
                          item.type === 'income' ? 'bg-emerald-50 text-emerald-700 ' : 'bg-rose-50 text-rose-700 '
                        }`}>
                          {item.type === 'income' ? '收入' : '支出'}
                        </span>
                      </td>
                      <td className={`p-4 sm:p-5 text-right font-mono font-black text-base sm:text-lg whitespace-nowrap ${
                        item.type === 'income' ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {item.type === 'income' ? '+' : '-'}${item.amount.toLocaleString()}
                      </td>
                      <td className="p-4 sm:p-5 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => setEditingFinance(item)}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 transition-colors"
                          title="編輯此筆帳務"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={busyItemId === item.id}
                          onClick={() => void handleDeleteFinance(item)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors"
                          title="刪除此筆帳務"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Editing Finance Ledger Modal */}
      {editingFinance && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 sm:p-7 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                <Pencil className="w-5 h-5 text-emerald-600" />
                <span>編輯公積金流水帳項目</span>
              </h3>
              <button
                onClick={() => setEditingFinance(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!editingFinance) return;
                const result = await updateFinance(editingFinance.id, {
                  title: editingFinance.title,
                  type: editingFinance.type,
                  amount: Number(editingFinance.amount),
                  move_date: editingFinance.move_date,
                  remarks: editingFinance.remarks
                });
                if (result.success) {
                  showSuccessNotice(`已更新帳務「${editingFinance.title}」。`);
                  setEditingFinance(null);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">收支類型</label>
                <select
                  value={editingFinance.type}
                  onChange={(e) => setEditingFinance({ ...editingFinance, type: e.target.value as FinanceType })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none"
                >
                  <option value="expense">支出 (Expense)</option>
                  <option value="income">收入 (Income)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">項目名稱 *</label>
                <input
                  type="text"
                  autoFocus
                  required
                  value={editingFinance.title}
                  onChange={(e) => setEditingFinance({ ...editingFinance, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 font-medium focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">異動金額 ($) *</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  required
                  value={editingFinance.amount}
                  onChange={(e) => setEditingFinance({ ...editingFinance, amount: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">異動日期</label>
                <input
                  type="date"
                  value={editingFinance.move_date}
                  onChange={(e) => setEditingFinance({ ...editingFinance, move_date: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 font-medium focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">備註說明</label>
                <input
                  type="text"
                  value={editingFinance.remarks || ''}
                  onChange={(e) => setEditingFinance({ ...editingFinance, remarks: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 font-medium focus:outline-none"
                />
              </div>

              <div className="pt-4 mt-2 border-t border-slate-100 flex items-center justify-between gap-2 shrink-0">
                <button
                  type="button"
                  disabled={busyItemId === editingFinance.id}
                  onClick={async () => {
                    if (!editingFinance) return;
                    const deleted = await handleDeleteFinance(editingFinance);
                    if (deleted) setEditingFinance(null);
                  }}
                  className="px-3 sm:px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs sm:text-sm flex items-center space-x-1.5 border border-rose-200 transition-colors shrink-0 cursor-pointer active:scale-95"
                >
                  <Trash2 className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>刪除</span>
                </button>

                <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditingFinance(null)}
                    className="px-3.5 sm:px-5 py-2.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer active:scale-95"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="px-4 sm:px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-xs transition-colors cursor-pointer active:scale-95"
                  >
                    儲存變更
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Editing Fee Collection Modal */}
      {editingCollection && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-5 sm:p-7 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                <Pencil className="w-5 h-5 text-emerald-600" />
                <span>編輯收費專案</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingCollection(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!editingCollection) return;
                setBusyItemId(editingCollection.id);
                const result = await updateFeeCollection(editingCollection.id, {
                  title: editingCollection.title,
                  amount_per_person: Number(editingCollection.amount_per_person),
                  due_date: editingCollection.due_date,
                  status: editingCollection.status
                });
                if (!result.success) {
                  setBusyItemId(null);
                  return;
                }

                const addMembersResult = await addUsersToFeeCollection(
                  editingCollection.id,
                  editingNewMemberIds
                );
                setBusyItemId(null);
                if (!addMembersResult.success) return;

                const addedMessage = editingNewMemberIds.length > 0
                  ? `，並新增 ${editingNewMemberIds.length} 位收費隊員`
                  : '';
                showSuccessNotice(`已更新收費專案「${editingCollection.title}」${addedMessage}。`);
                setEditingCollection(null);
                setEditingNewMemberIds([]);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">專案名稱 *</label>
                <input
                  type="text"
                  autoFocus
                  required
                  value={editingCollection.title}
                  onChange={(e) => setEditingCollection({ ...editingCollection, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 font-medium focus:outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">每人應繳額度 ($) *</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  required
                  value={editingCollection.amount_per_person}
                  onChange={(e) => setEditingCollection({ ...editingCollection, amount_per_person: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">繳費截止日</label>
                <input
                  type="date"
                  min={getLocalDateString()}
                  value={editingCollection.due_date || ''}
                  onChange={(e) => setEditingCollection({ ...editingCollection, due_date: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 font-medium focus:outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">催繳狀態</label>
                <select
                  value={editingCollection.status}
                  onChange={(e) => setEditingCollection({ ...editingCollection, status: e.target.value as 'active' | 'closed' })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white cursor-pointer"
                >
                  <option value="active">進行催繳中 (Active)</option>
                  <option value="closed">已結案 (Closed)</option>
                </select>
              </div>

              <div className="space-y-2.5 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
                      <Users className="h-4 w-4 text-emerald-600" />
                      <span>加入收費隊員</span>
                    </label>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                      已有 {editingCollectionMemberIds.size} 人；新加入者會收到一筆 ${Number(editingCollection.amount_per_person) || 0} 的未繳帳單，原有繳費紀錄不受影響。
                    </p>
                  </div>
                  {editingNewMemberIds.length > 0 && (
                    <span className="shrink-0 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white">
                      新增 {editingNewMemberIds.length} 人
                    </span>
                  )}
                </div>

                {addableEditingProfiles.length === 0 ? (
                  <div className="rounded-xl border border-emerald-100 bg-white px-3 py-2.5 text-center text-xs font-medium text-slate-500">
                    所有目前隊員都已經在這個收費專案中。
                  </div>
                ) : (
                  <div className="grid max-h-44 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
                    {addableEditingProfiles.map((profile) => {
                      const selected = editingNewMemberIds.includes(profile.id);
                      return (
                        <button
                          key={profile.id}
                          type="button"
                          onClick={() => handleToggleEditingMember(profile.id)}
                          className={`flex min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-xs font-bold transition-colors ${
                            selected
                              ? 'border-emerald-300 bg-emerald-100 text-emerald-900'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-200'
                          }`}
                        >
                          <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            selected ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300'
                          }`}>
                            {selected && <Check className="h-3 w-3" />}
                          </span>
                          <span className="truncate">{profile.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="pt-4 mt-2 border-t border-slate-100 flex items-center justify-between gap-2 shrink-0">
                <button
                  type="button"
                  disabled={busyItemId === editingCollection.id}
                  onClick={async () => {
                    if (!editingCollection) return;
                    const deleted = await handleDeleteFeeCollection(editingCollection);
                    if (deleted) setEditingCollection(null);
                  }}
                  className="px-3 sm:px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs sm:text-sm flex items-center space-x-1.5 border border-rose-200 transition-colors shrink-0 cursor-pointer active:scale-95"
                >
                  <Trash2 className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>刪除專案</span>
                </button>

                <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditingCollection(null)}
                    className="px-3.5 sm:px-5 py-2.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer active:scale-95"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={busyItemId === editingCollection.id}
                    className="px-4 sm:px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-xs transition-colors cursor-pointer active:scale-95"
                  >
                    {busyItemId === editingCollection.id ? '儲存中…' : '儲存變更'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
