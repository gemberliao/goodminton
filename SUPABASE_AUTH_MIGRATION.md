# GOODMINTON：隊內帳號＋Supabase Auth 安全上線步驟

畫面只顯示「帳號＋密碼」，不要求隊員提供真實 Email。前端會將標準化帳號做 SHA-256，轉成固定長度的內部 Auth email；`profiles` 只保留 `username`，完全不保存密碼或內部 email。真正密碼由 Supabase Auth 雜湊保存，資料權限由 Auth JWT 與 RLS 判斷 `profiles.auth_user_id`、`role`、`status`。

## 重要：請依序執行

1. 先備份資料庫，並執行 `supabase_diagnostics.sql` 保存結果。
2. 在 Supabase Dashboard → Authentication → Sign In / Providers → Email，確認 Email provider 已開啟，並把 **Confirm email 關閉**。這裡的 Email provider 只作為 Supabase 的帳密引擎，隊員不會看到或填寫 Email。
3. 若目前已有能登入的 Auth 管理員可跳過；否則在 Authentication → Users 建立第一位管理員 Auth user，記下 UUID。這位過渡管理員可以先用真實 email 登入，之後透過管理員頁的鑰匙按鈕遷移成隊內帳號登入。
4. 在 SQL Editor 執行 `supabase_schema.sql`。執行後 `anon` 對九張業務表會立即失去讀寫權限，只有已登入且已綁定的使用者能使用系統。
5. 立刻執行下方「第一位管理員綁定」SQL，將 `<AUTH_USER_UUID>` 與 `<舊管理員帳號>` 換成真實值。
6. 再執行 `supabase_diagnostics.sql`。`linked_approved_admins` 必須至少是 `1`，`unsafe_password_column_still_exists` 必須是 `false`。
7. 至少建立／綁定一位一般隊員後，執行 `supabase_write_probe.sql`。看到 `PASS` 代表 anon 阻擋、管理員 CRUD、隊員分權與逾期鎖定都通過；測試資料會 rollback。
8. 部署下方 Edge Function 與新版前端，再使用隊內帳號／密碼登入；在瀏覽器 Network 確認 Auth、REST、Functions 請求為 2xx。

## 部署管理員帳號／密碼管理 Function

專案已包含 `supabase/functions/admin-reset-password/index.ts`。它會先驗證呼叫者是 `approved admin`，再用只存在伺服器端的 `SUPABASE_SERVICE_ROLE_KEY` 執行以下工作：

- 已綁定 Auth 的隊員：重設密碼，並將舊 email 登入遷移成隊內帳號登入。
- 尚未綁定 Auth 的舊隊員：建立 Auth user、清理 trigger 暫存 profile、綁回原 profile。
- 永久刪除：確認呼叫者是管理員、禁止刪除自己／最後一位管理員，再一次刪除 Auth user、profile 與 cascade 關聯紀錄。

使用 Supabase CLI 部署：

```bash
npx supabase login
npx supabase link --project-ref <你的_PROJECT_REF>
npx supabase functions deploy admin-reset-password
npx supabase functions deploy login-with-account --no-verify-jwt
```

`supabase/config.toml` 已設定 `verify_jwt = true`。Hosted Edge Functions 會自動提供 `SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`；不要把 service role key 放進 `.env.local`、Vite 或瀏覽器。

部署後，以管理員登入 → 隊員與權限管理 → 按隊員列右側的鑰匙：

- 顯示「已綁定」：輸入新密碼即重設。
- 顯示「待綁定」：輸入初始密碼即建立並綁定 Auth 帳號。
- 管理員也可對自己的列操作。早期仍用真實 Email 登入的管理員，對自己重設一次後，登出並改用 `profiles.username` 登入。

## 第一位管理員綁定

```sql
begin;

-- Auth 建立使用者時可能由 trigger 產生一筆暫時 profile；若它不是要保留
-- 的舊管理員資料，先移除它。SQL Editor 以 postgres 執行，不受 RLS 阻擋。
delete from public.profiles
where id = '<AUTH_USER_UUID>'::uuid
  and username <> '<舊管理員帳號>';

update public.profiles
set auth_user_id = '<AUTH_USER_UUID>'::uuid,
    role = 'admin',
    status = 'approved'
where username = '<舊管理員帳號>';

-- 必須得到 1 row；若是 0，代表 username 填錯或舊 profile 不存在。
select id, auth_user_id, username, role, status
from public.profiles
where username = '<舊管理員帳號>';

commit;
```

如果沒有舊管理員 profile，可改用：

```sql
insert into public.profiles (
  id, auth_user_id, username, name, level, role, gender, status
) values (
  '<AUTH_USER_UUID>'::uuid,
  '<AUTH_USER_UUID>'::uuid,
  '<管理員帳號>',
  '<管理員姓名>',
  '高階',
  'admin',
  'male',
  'approved'
)
on conflict (id) do update set
  auth_user_id = excluded.auth_user_id,
  role = 'admin',
  status = 'approved';
```

## 綁定既有隊員

每位舊隊員先在 Authentication → Users 建立／邀請一個 Auth 使用者，再執行：

```sql
begin;

delete from public.profiles
where id = '<隊員_AUTH_USER_UUID>'::uuid
  and username <> '<舊隊員帳號>';

update public.profiles
set auth_user_id = '<隊員_AUTH_USER_UUID>'::uuid,
    role = 'member',
    status = 'approved'
where username = '<舊隊員帳號>';

commit;
```

全新隊員直接在 GOODMINTON 登入頁按「註冊」，只填姓名、帳號、密碼、性別與程度。Auth trigger 會建立 `role=member`、`status=pending` 的 profile；任何註冊 metadata 都不能把自己升成管理員。管理員核准後才可登入。

帳號採 Unicode NFKC、去頭尾空白、不分大小寫；前端沒有 `minLength` 或 `maxLength`，資料庫使用 `text` 並以 `lower(username)` 防止重複。密碼前端同樣不設固定長度，只禁止空字串；若 Supabase 專案設定了最短密碼、弱密碼或外洩密碼規則，仍會以 Auth 的安全規則為準。這表示「系統不另外限位數」，不是保證瀏覽器與 Supabase 能接受無限大的字串。

## 多位管理員

第一位管理員登入後，可在「隊員與權限管理」把其他已綁定、已核准隊員的權限改成「管理員」。資料庫 trigger 會阻止刪除或降級自己的權限，也會阻止系統失去最後一位可登入的管理員。

## 安全注意事項

- 前端只可放 Project URL 與公開 `anon key`；絕不可把 `service_role key` 放入 Vite/React 環境變數或瀏覽器。
- 管理員看不到舊密碼，只能設定新密碼；Edge Function 不記錄或回傳密碼。
- 不要再執行 `supabase_disable_rls_emergency.sql`；它只適合短暫診斷，會破壞本次分權。
- 將活動日期或繳費截止日改回未來，只能由管理員操作。隊員是否可提交由資料庫依台北時區再次判定。
- 刪除 `profiles` 不會自動刪除 `auth.users`。若要永久刪除登入帳號，需到 Authentication → Users 操作。
