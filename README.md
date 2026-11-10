# أوربت ستور — الإصدار الفعلي

## الملفات
- `server/` الموقع والـ API:
  - `auth.js` ربط ديسكورد (OAuth2) + الصلاحيات
  - `routes/store.js` المنتجات، الدفع، طلباتي
  - `routes/dashboard.js` لوحة التحكم (إدارة فقط)
  - `orders.js` قبول/رفض الطلبات وسحب المخزون
  - `db.js` تخزين JSON مع قفل الكتابة
- `bot/` بوت ديسكورد:
  - `panel.js` لوحة الشراء الذاتي (تصفح، اختيار، ابدأ، ربط)
  - `tickets.js` التذكرة، استلام الإيصال، القبول والتسليم
- `public/` واجهة المتجر (`index.html`) ولوحة التحكم (`dashboard.html`)
  - `js/` كل ميزة في ملف لحاله، و`css/theme.css` التصميم الأصلي

## الإعداد
1. في بوابة مطوري ديسكورد أنشئ تطبيق، ومن **OAuth2** أضف Redirect:
   `https://YOUR-APP/auth/discord/callback`
2. من **Bot** فعّل **Message Content Intent** وانسخ التوكن.
3. ادعُ البوت بصلاحيات: Manage Channels, View Channels, Send Messages,
   Read Message History, Attach Files, Embed Links (scopes: `bot`, `applications.commands`).
4. انسخ `.env.example` إلى `.env` وعبّي القيم.
5. `npm install` ثم `npm start`.
6. في سيرفرك اكتب `/panel` في الروم اللي تبي اللوحة فيه.

## Render
- Build: `npm install` — Start: `npm start`
- حط كل متغيرات `.env` في Environment
- إذا تبي البيانات ما تنمسح، اربط Persistent Disk وحط `DB_FILE` على مساره.

## ملاحظات
- الداتا JSON، مناسب للتشغيل الأولي. للتوسع لاحقاً نحولها لقاعدة بيانات.
- الإيصالات من الموقع تنحفظ داخل الداتا؛ الأفضل لاحقاً تخزينها على خدمة ملفات.
- الجلسات في الذاكرة، فإعادة التشغيل تطلب تسجيل الدخول مرة ثانية.
