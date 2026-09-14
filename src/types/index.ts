export type UserLevel = '新手' | '初級' | '中級' | '高階' | '校隊/教練';
export type UserRole = 'admin' | 'member';
export type UserGender = 'male' | 'female';

export interface Profile {
  id: string;
  auth_user_id?: string;
  username: string;
  name: string;
  level: UserLevel;
  role: UserRole;
  gender?: UserGender;
  status?: 'approved' | 'pending' | 'rejected';
  phone?: string;
  avatar_url?: string;
  created_at: string;
}

export type EventType = '練球' | '暢打' | '隊聚' | '團聚' | '比賽' | '體訓';

export interface BadmintonEvent {
  id: string;
  title: string;
  event_date: string; // YYYY-MM-DD
  start_time?: string;
  end_time?: string;
  event_type: EventType;
  location: string;
  court_number?: string;
  fee?: number;
  max_participants?: number;
  notes?: string;
  created_at: string;
}

export type AttendanceStatus = 'attending' | 'absent' | 'pending';

export interface Announcement {
  id: string;
  body: string;
  updated_at: string;
}

export interface AttendanceRecord {
  id: string;
  user_id: string;
  event_id: string;
  status: AttendanceStatus;
  remarks?: string;
  created_at: string;
}

export type MatchDiscipline = '男單' | '女單' | '男雙' | '女雙' | '混雙';

export interface MatchSurveyResponse {
  id: string;
  event_id: string;
  user_id: string;
  preferred_disciplines: MatchDiscipline[]; // e.g. ['男雙', '混雙']
  max_matches_desired?: number; // 1, 2, 3...
  partner_preference?: string; // 搭檔偏好備註
  notes?: string; // 其他備註 (體能、打法、時間限制)
  updated_at: string;
}

export interface MatchPointSlot {
  id: string;
  event_id: string;
  point_index: number; // 1, 2, 3, 4, 5
  point_name: string; // e.g. "第 1 點 男單", "第 2 點 女單", "第 3 點 男雙", "第 4 點 女雙", "第 5 點 混雙"
  discipline: MatchDiscipline;
  player_ids: string[]; // 1 player for singles, 2 players for doubles
  opponent_info?: string; // 對手選手/隊伍
  score?: string; // 比分
}

export interface MatchLineupConfig {
  event_id: string;
  is_published: boolean; // 是否已發布給隊員檢視
  notes?: string;
  updated_at: string;
}

export type ShuttleGameResultType = 'win' | 'loss';

export interface ShuttleGameResult {
  id: string;
  user_id: string;
  result: ShuttleGameResultType;
  player_score: number;
  cpu_score: number;
  played_at: string;
}

export interface CoinWallet {
  user_id: string;
  balance: number;
  updated_at: string;
}

export interface ShopPurchase {
  id: string;
  user_id: string;
  item_id: string;
  price: number;
  purchased_at: string;
}

export type RacketStyle = 'classic' | 'emerald' | 'sunset' | 'gold';
export type ShuttleStyle = 'classic' | 'sky' | 'rose' | 'neon';

export interface GameLoadout {
  user_id: string;
  racket_style: RacketStyle;
  shuttle_style: ShuttleStyle;
  updated_at: string;
}

export type FinanceType = 'income' | 'expense';

export interface FinanceLedger {
  id: string;
  move_date: string;
  title: string;
  type: FinanceType;
  amount: number;
  remarks?: string;
  created_by?: string;
  created_at: string;
}

export type CollectionType = 'fixed' | 'split';
export type CollectionStatus = 'active' | 'closed';

export interface FeeCollection {
  id: string;
  title: string;
  c_type: CollectionType;
  total_amount: number;
  amount_per_person: number;
  status: CollectionStatus;
  due_date?: string;
  created_at: string;
}

export type PaymentStatus = 'unpaid' | 'pending' | 'paid';

export interface FeeRecord {
  id: string;
  collection_id: string;
  user_id: string;
  is_paid: boolean;
  payment_status?: PaymentStatus;
  reported_at?: string;
  paid_at?: string;
  notes?: string;
  created_at: string;
}

export interface AttendanceMatrixRow {
  member: Profile;
  statuses: Record<string, AttendanceStatus>; // event_id -> status
  attendingCount: number;
  ratePercent: number;
}
