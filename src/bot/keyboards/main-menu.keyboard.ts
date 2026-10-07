import { Markup } from 'telegraf';

const SUPER_USER_IDS = [837535368, 8521015752];

export function mainMenuKeyboard(isAdmin: boolean = false, userId?: number) {
  // أزرار المستخدم العادي
  const userButtons = [
    [
      Markup.button.callback('📚 الملازم والمقررات', 'sm'),
      Markup.button.callback('📝 الاختبارات', 'se'),
    ],
    [
      Markup.button.callback('🔗 المصادر', 'er'),
      Markup.button.callback('ℹ️ عن البوت', 'ab'),
    ],
  ];

  // أزرار إدارة الـ Admin
  const adminButtons = [
    [
      Markup.button.callback('📂 إدارة الملازم', 'admin_materials'),
      Markup.button.callback('📝 إدارة الامتحانات', 'admin_exams'),
    ],
  ];

  // أزرار إدارة الـ Super User فقط
  const superUserButtons = [
    [
      Markup.button.callback('📖 إدارة الكورسات', 'admin_courses'),
      Markup.button.callback('👥 إدارة المستخدمين', 'admin_users'),
    ],
    [Markup.button.callback('🔗 إدارة المصادر الخارجية', 'admin_sources')],
  ];

  const isSuperUser = userId !== undefined && SUPER_USER_IDS.includes(userId);

  const finalButtons = [
    ...(isAdmin ? adminButtons : []),
    ...(isSuperUser ? superUserButtons : []),
    ...userButtons,
  ];

  return Markup.inlineKeyboard(finalButtons);
}
