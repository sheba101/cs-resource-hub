import { Injectable } from '@nestjs/common';

// ============================================================
// Bot Event Types
// ============================================================

export enum BotEventType {
  // Materials
  WAITING_MATERIAL_COURSE,
  WAITING_MATERIAL_DEPARTMENT,
  WAITING_MATERIAL_LEVEL,
  WAITING_MATERIAL_TRACK,
  WAITING_MATERIAL_TERM,
  WAITING_MATERIAL_ACADEMIC_YEAR,
  WAITING_MATERIAL_TYPE,
  WAITING_MATERIAL_DOCUMENT,
  WAITING_MATERIAL_TITLE,
  WAITING_MATERIAL_REUSE,

  // Exams
  WAITING_EXAM_DOCUMENT,
  WAITING_EXAM_TITLE,
  WAITING_EXAM_DEPARTMENT,
  WAITING_EXAM_LEVEL,
  WAITING_EXAM_TERM,
  WAITING_EXAM_TRACK,
  WAITING_EXAM_COURSE,
  WAITING_EXAM_ACADEMIC_YEAR,
  WAITING_EXAM_TYPE,
  WAITING_EXAM_REUSE,
  // ============================================================
  // External Resources
  // ============================================================

  WAITING_EXTERNAL_RESOURCE_CAPTION,

  WAITING_EXTERNAL_CATEGORY_NAME,
  WAITING_EXTERNAL_CATEGORY_PARENT,

  WAITING_EXTERNAL_RESOURCE_CATEGORY,
  WAITING_EXTERNAL_RESOURCE_DOCUMENT,

  // Users
  WAITING_DELETE_USER,
  WAITING_PROMOTE_USER,
  WAITING_DEMOTE_ADMIN,

  // Courses
  WAITING_COURSE_NAME,
  WAITING_EDIT_COURSE_NAME,
  WAITING_EDIT_COURSE_NEW_NAME,

  // Course Offering
  WAITING_COURSE_OFFERING_COURSE,
  WAITING_COURSE_OFFERING_DEPARTMENT,
  WAITING_COURSE_OFFERING_LEVEL,
  WAITING_COURSE_OFFERING_TRACK,
  WAITING_COURSE_OFFERING_TERM,
  WAITING_COURSE_OFFERING_ACADEMIC_YEAR,

  WAITING_DELETE_EXAM,

  PROCESSING,
}
// ============================================================
// Bot Event
// ============================================================

export interface BotEvent {
  // معرف مستخدم Telegram
  userId: number;

  // الحالة الحالية للعملية
  event: BotEventType;

  // معرف الرسالة التي بدأ منها الـ Event
  messageId: number;

  // معرف المحادثة
  chatId: string;

  // وقت إنشاء العملية
  createdAt: number;

  // ============================================================
  // بيانات إضافية مؤقتة
  // ============================================================
  //
  // تستخدم عندما تحتاج العملية الاحتفاظ ببيانات
  // بين أكثر من خطوة.
  //
  // مثال تعديل الكورس:
  //
  // data: {
  //   courseId: 15,
  // }
  //
  // ويمكن لاحقًا استخدامها في الملزمات والاختبارات وغيرها.
  //
  // ============================================================

  data?: Record<string, unknown>;
}

// ============================================================
// Bot Event Service
// ============================================================

@Injectable()
export class BotEventService {
  // ============================================================
  // تخزين Events في الذاكرة
  // ============================================================
  //
  // Key:
  // userId
  //
  // Value:
  // BotEvent
  //
  // ============================================================

  private readonly events = new Map<number, BotEvent>();

  // ============================================================
  // مدة صلاحية العملية
  // ============================================================
  //
  // 5 دقائق
  //
  // ============================================================

  private readonly EVENT_TIMEOUT = 5 * 60 * 1000;

  // ============================================================
  // إنشاء Event جديد
  // ============================================================

  set(data: {
    userId: number;
    event: BotEventType;
    messageId: number;
    chatId: string;

    // بيانات إضافية اختيارية
    data?: Record<string, unknown>;
  }): BotEvent {
    const event: BotEvent = {
      userId: data.userId,
      event: data.event,
      messageId: data.messageId,
      chatId: data.chatId,
      createdAt: Date.now(),

      // ==========================================================
      // حفظ البيانات الإضافية إذا تم إرسالها
      // ==========================================================

      data: data.data,
    };

    this.events.set(data.userId, event);

    return event;
  }

  // ============================================================
  // الحصول على Event
  // ============================================================

  get(userId: number): BotEvent | undefined {
    const event = this.events.get(userId);

    // ============================================================
    // لا يوجد Event
    // ============================================================

    if (!event) {
      return undefined;
    }

    // ============================================================
    // التحقق من انتهاء الصلاحية
    // ============================================================

    if (this.isExpired(event)) {
      this.delete(userId);

      return undefined;
    }

    return event;
  }

  // ============================================================
  // التحقق من وجود Event
  // ============================================================

  has(userId: number): boolean {
    return this.get(userId) !== undefined;
  }

  // ============================================================
  // تحديث Event موجود
  // ============================================================
  //
  // نستخدمه للانتقال من خطوة إلى خطوة.
  //
  // مثال:
  //
  // WAITING_EDIT_COURSE_NAME
  //
  // إلى:
  //
  // WAITING_EDIT_COURSE_NEW_NAME
  //
  // مع الاحتفاظ بـ courseId.
  //
  // ============================================================

  update(
    userId: number,
    data: {
      event?: BotEventType;
      messageId?: number;
      chatId?: string;

      // تحديث البيانات الإضافية
      data?: Record<string, unknown>;
    },
  ): BotEvent | undefined {
    const current = this.get(userId);

    // ============================================================
    // لا يوجد Event
    // ============================================================

    if (!current) {
      return undefined;
    }

    // ============================================================
    // إنشاء Event محدث
    // ============================================================

    const updated: BotEvent = {
      ...current,
      ...data,

      // ==========================================================
      // إذا لم يتم إرسال data جديدة
      // نحافظ على data القديمة.
      //
      // لأن:
      //
      // ...data
      //
      // إذا كانت data = undefined ستستبدل القديمة.
      //
      // لذلك نحددها بشكل صريح.
      // ==========================================================

      data: data.data !== undefined ? data.data : current.data,

      // ==========================================================
      // إعادة حساب وقت العملية
      // ==========================================================

      createdAt: Date.now(),
    };

    this.events.set(userId, updated);

    return updated;
  }

  // ============================================================
  // حذف Event
  // ============================================================

  delete(userId: number): void {
    this.events.delete(userId);
  }

  // ============================================================
  // حذف جميع Events
  // ============================================================

  clear(): void {
    this.events.clear();
  }

  // ============================================================
  // التحقق من انتهاء Event
  // ============================================================

  isExpired(event: BotEvent): boolean {
    return Date.now() - event.createdAt >= this.EVENT_TIMEOUT;
  }

  // ============================================================
  // تنظيف Events المنتهية
  // ============================================================
  //
  // هذه الدالة تحذف العمليات التي انتهت صلاحيتها.
  //
  // يمكنك استدعاؤها من Cron أو Interval.
  //
  // ============================================================

  cleanup(): void {
    for (const [userId, event] of this.events.entries()) {
      if (this.isExpired(event)) {
        this.events.delete(userId);
      }
    }
  }
}
