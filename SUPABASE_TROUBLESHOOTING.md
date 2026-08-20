# Supabase 寫入／同步排查手冊

## 最短修復流程

1. 在 Supabase Dashboard 選對專案，進入 **SQL Editor**。
2. 先執行 `supabase_diagnostics.sql`，保留結果。
3. 執行 `supabase_schema.sql`。此腳本會在單一 transaction 內建表／補欄位、移除 `profiles -> auth.users` 外鍵、補 Data API `GRANT`、重建 RLS Policy，最後刷新 PostgREST schema cache。
4. 執行 `supabase_write_probe.sql`。看到 `PASS` 代表 `anon` 對九張表的 INSERT／UPDATE／DELETE、欄位、唯一鍵及父外鍵都通過；所有測試資料最後會 rollback。
5. 回到瀏覽器重做一次原本失敗的操作，確認 Network 回應為 2xx，再重新整理 Supabase Table Editor 驗證資料確實存在。

`supabase_disable_rls_emergency.sql` 只適合短暫隔離問題。它會關閉所有資料列保護，不應當作正式環境的長期設定。

## 1. 先確認前端連到哪個專案

本專案的瀏覽器 Local Storage 設定優先於 `.env`：

- `goodminton_supabase_url`
- `goodminton_supabase_anon_key`

在瀏覽器 DevTools 的 **Application > Local Storage** 檢查 URL。Project URL 的 hostname 第一段必須和目前 Supabase Dashboard 的 project ref 相同。若先前曾貼過另一個專案的設定，請在應用程式「資料庫連線設定」清除或覆寫；不要把完整 key 貼到 issue、截圖或聊天。

連線視窗的「測試連線」只測 `profiles SELECT`。能讀取不代表有 INSERT／UPDATE 權限。

## 2. Browser Network 面板

1. 開啟 DevTools > **Network**，勾選 Preserve log。
2. 篩選 `rest/v1`，重做一次新增或修改。
3. 找到 `/rest/v1/profiles`、`events`、`finances` 等請求，檢查：
   - Request URL 的 project ref 是否正確。
   - 新增通常是 `POST`；修改通常是 `PATCH`；刪除是 `DELETE`。
   - Request Payload 的欄位是否為資料庫 snake_case 名稱，例如 `status`、`event_date`、`created_by`。
   - Response status 與 JSON body 的 `code`、`message`、`details`、`hint`。
4. 常見判讀：
   - `PGRST204` / `Could not find ... in the schema cache`：欄位不存在、連錯專案，或 PostgREST cache 過期。
   - `42501` / `permission denied for table`：缺表級 `GRANT`。
   - `42501` / `row-level security policy`：有 GRANT，但 RLS Policy 不允許該 row/action。
   - `23503`：外鍵失敗，例如 profile ID 仍強制要求存在於 `auth.users`，或子資料先於父資料寫入。
   - `23505`：主鍵／username／複合唯一鍵重複。
   - HTTP 2xx 但 UPDATE 回傳空陣列：filter 沒有匹配資料，或缺 SELECT policy 導致無法看見更新列。

## 3. Table Editor / Schema Visualizer

逐張確認 `profiles`, `events`, `attendance`, `finances`, `fee_collections`, `fee_records`, `match_surveys`, `match_lineup_configs`, `match_lineup_slots`：

- 欄位名稱與型別是否和 `supabase_diagnostics.sql` 的 expected list 一致。
- `profiles.id` 建議為 `uuid`，default 為 `gen_random_uuid()`；前端產生的自訂 ID 也是合法 UUID，因此不需要對應 `auth.users`。
- `profiles` 不應再有任何指向 `auth.users` 的 foreign key；但 `attendance.user_id`、`fee_records.user_id` 等指向 `public.profiles` 的外鍵應保留。
- `attendance(user_id,event_id)`、`fee_records(collection_id,user_id)`、`match_surveys(event_id,user_id)`、`match_lineup_configs(event_id)` 必須有 unique constraint/index，才能支援前端 `upsert(..., { onConflict })`。
- 操作後刷新 Table Editor，使用剛才送出的 UUID 搜尋，不要只看 UI 的本地 Zustand 狀態。

截圖中 `profiles.status` 已經存在，所以若同一時間仍看到 PGRST204，優先檢查「前端連錯 project ref」與 schema cache，而不是再次盲目新增同名欄位。

## 4. RLS、Policies 與 GRANT

Data API 有兩層權限，缺一不可：

1. `GRANT` 決定 `anon` / `authenticated` 能否碰到 table。
2. RLS Policy 決定該角色能碰哪些 rows、能做哪些 actions。

`supabase_schema.sql` 會明確授予九張表 CRUD，保持 RLS enabled，移除這些表的舊 Policies，再建立 `anon, authenticated` 的 compatibility full-access policy。這符合目前不一定經過 Supabase Auth 的前端架構，但等同讓任何取得公開 anon key 的人修改全庫，正式上線前必須改成 Auth + 管理員／本人政策，或把管理寫入移到受保護的 server/Edge Function。

## 5. Supabase Logs

1. 重做失敗操作並記下精確時間、table、HTTP status 與 request ID（若有）。
2. Dashboard > **Logs > API**：只看該時間附近的 `/rest/v1/<table>` 4xx/5xx 請求，打開事件查看 response body。
3. 若是 `42501`、`23503`、`23505`，再到 **Logs > Postgres**，以同一時間與 error code 篩選，查看 database detail/hint。
4. `PGRST204` 或其他 schema-cache 錯誤則同時看 API/PostgREST 相關事件。
5. SQL Editor 的操作使用高權限 `postgres` role；「SQL Editor insert 成功」不能證明瀏覽器的 `anon` request 會成功，必須再跑 `supabase_write_probe.sql` 或實際 Network request。

## 6. Schema cache

若欄位在 Table Editor 和 diagnostics 中存在，但 API 仍說找不到，執行：

```sql
notify pgrst, 'reload schema';
select pg_notification_queue_usage();
```

等待幾秒後重送請求。若仍舊失敗，先核對 Network Request URL 的 project ref，再查看 API Logs；不要由前端吞掉錯誤或改送缺欄位 payload，否則會留下部分同步資料。

## 7. 驗收標準

- `supabase_write_probe.sql` 顯示 PASS。
- Browser Network 的實際新增／修改為 2xx，response body 無 error。
- Table Editor 能用相同 UUID 找到新增列，修改欄位值正確。
- 重新整理應用程式並「從雲端讀取」後，資料仍存在且一致。
- Logs 中同一時間不再出現 `42501`、`PGRST204`、`23503` 或 `23505`。

## 8. SQL 修好但登入頁仍顯示「找不到帳號」

1. 部署環境必須設定正確的 `VITE_SUPABASE_URL` 與 `VITE_SUPABASE_ANON_KEY`；畫面不再提供雲端連線設定按鈕。
2. 使用 `profiles.username` 與 Auth 密碼登入。帳號會在瀏覽器內轉為固定長度的雜湊 Auth email，內部 email 不會寫入 profile 或顯示在畫面。
3. 早期以真實 email 建立或曾改名的帳號，會由 `login-with-account` 在伺服器端依 `profiles.username` 找到實際登入身分，不需要在登入頁輸入 email。
4. `profiles.auth_user_id` 為空的舊隊員不能直接登入。管理員在該列按鑰匙、設定初始密碼後，Edge Function 會建立 Auth user 並自動綁定原 profile。
5. 若鑰匙操作或登入顯示 Function not found，依 `SUPABASE_AUTH_MIGRATION.md` 部署 `admin-reset-password` 與 `login-with-account`；若管理操作顯示 401/403，請重新登入並確認自己是 `approved admin`。
