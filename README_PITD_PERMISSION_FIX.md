## Fix lỗi "permission denied for table users" (Cấp phát/Thu hồi PITD)

### Vì sao lỗi xảy ra?
Lỗi này thường xảy ra khi DB có **foreign key** trỏ sang bảng `public.users` (legacy) hoặc bảng tham chiếu khác, nhưng role client (`anon`/`authenticated`) **không có quyền REFERENCES** lên bảng tham chiếu.
Khi admin cấp phát/thu hồi, app sẽ **insert/update** vào `pitd_wallets`/`pitd_transactions` → Postgres kiểm tra FK → văng lỗi `permission denied for table users`.

### Cách xử lý triệt để (khuyến nghị)
1) Vào Supabase Dashboard → SQL Editor
2) Chạy file: `SUPABASE_SQL_FIX_PITD_GRANT_PERMISSION.sql`
3) Quay lại app, thử lại chức năng **Cấp phát / Thu hồi PITD**.

---

## A2 (P0 → A → C): Chuẩn hoá Master User (public.users.id) & FK cho PITD (khuyến nghị)

Trong DB hiện tại của bạn, `pitd_wallets.user_id` đang **chưa có foreign key** ràng buộc sang `public.users` (query FK trả về rỗng).

Nếu bạn muốn dữ liệu PITD “khóa chặt” theo `public.users.id` (master) để tránh lệch dữ liệu về sau, hãy chạy script:

- `sql/A2_USERS_MASTER_BACKFILL_AND_FK.sql`

Script này sẽ:
1) Backfill `public.users` từ `public.pi_users` (id giữ nguyên) cho những user còn thiếu.
2) Backfill minimal `public.users` cho những `user_id` đang có trong `pitd_wallets` mà chưa tồn tại trong `users`.
3) Tạo index hỗ trợ tra cứu `pi_uid` / `pi_username`.
4) (Tuỳ chọn) Thêm FK `pitd_wallets.user_id` → `public.users.id`.

### Nếu bạn muốn chuẩn hoá FK sang `pi_users`
Mình sẽ đưa script migrate FK **users → pi_users** sau khi bạn gửi kết quả query constraints (ở phần comment cuối file SQL).
