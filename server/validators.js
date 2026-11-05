import { z } from "zod";

/**
 * Normalizes Arabic-Indic (٠-٩) and Persian (۰-۹) digits to standard ASCII (0-9)
 */
function normalizeDigits(val) {
  if (typeof val !== "string") return "";
  return val
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .trim();
}

const studentIdRule = z
  .string({ required_error: "الرقم الجامعي مطلوب" })
  .transform(normalizeDigits)
  .pipe(
    z
      .string()
      .min(3, "معرف الطالب يجب أن يتكون من 3 أحرف/أرقام على الأقل")
      .max(40, "معرف الطالب طويل جداً")
      .regex(
        /^[a-zA-Z0-9._\-@]{3,40}$/,
        "صيغة اسم المستخدم أو الرقم الجامعي غير صالحة",
      ),
  );

export const studentLoginSchema = z.object({
  studentId: studentIdRule,
  password: z
    .string()
    .max(128, "كلمة المرور يجب ألا تتجاوز 128 حرفاً")
    .optional()
    .nullable(),
  demoMode: z.boolean().optional().default(false),
  forceLive: z.boolean().optional().default(false),
});

export const studentParamSchema = z.object({
  studentId: studentIdRule,
});

export const registrationPrewarmSchema = z.object({
  studentId: studentIdRule,
  password: z
    .string()
    .max(128, "كلمة المرور يجب ألا تتجاوز 128 حرفاً")
    .optional()
    .nullable(),
  demoMode: z.boolean().optional().default(false),
});

export const registrationPortalStatusSchema = z.object({
  studentId: studentIdRule,
  password: z
    .string({ required_error: "كلمة المرور مطلوبة للتحقق من حالة البوابة" })
    .min(1, "كلمة المرور مطلوبة")
    .max(128, "كلمة المرور غير صالحة أو طويلة جداً"),
});

export const registrationExecuteSchema = z.object({
  studentId: studentIdRule,
  password: z
    .string()
    .max(128, "كلمة المرور يجب ألا تتجاوز 128 حرفاً")
    .optional()
    .nullable(),
  plans: z
    .record(z.any(), {
      required_error: "الخطط الثلاث (أ، ب، ج) مطلوبة لإتمام التسجيل",
    })
    .refine(
      (val) =>
        typeof val === "object" &&
        !Array.isArray(val) &&
        Object.keys(val).length > 0,
      {
        message: "الخطط الثلاث (أ، ب، ج) مطلوبة لإتمام التسجيل",
      },
    ),
  options: z
    .object({
      demoMode: z.boolean().optional(),
      targetPlan: z.enum(["A", "B", "C"]).optional(),
      autoFallbackOnFull: z.boolean().optional(),
      requireAllOrNothing: z.boolean().optional(),
      idempotencyKey: z.string().max(128).optional(),
    })
    .optional(),
  idempotencyKey: z.string().max(128).optional(),
});

export const registrationTestRequestSchema = z.object({
  studentId: studentIdRule,
  password: z.string().max(128).optional().nullable(),
  plan: z.record(z.any()).optional().default({}),
  demoMode: z.boolean().optional().default(false),
  semester: z
    .string()
    .regex(/^\d{4,6}$/, "رمز الفصل غير صالح (مثال: 20241)")
    .optional()
    .default("20241"),
});

export const registrationCheckSeatsSchema = z.object({
  courseCodes: z
    .array(
      z
        .string()
        .trim()
        .max(20, "رمز المساق غير صالح")
        .regex(/^[a-zA-Z0-9_\-]{2,20}$/, "رمز المساق غير صالح"),
    )
    .max(100, "لا يمكن فحص أكثر من 100 مساق في طلب واحد")
    .optional()
    .default([]),
});

export const syncPtukSchema = z.object({
  cookie: z
    .string({ required_error: "مطلوب إرسال cookie في جسم الطلب" })
    .min(1, "قيمة cookie غير صالحة")
    .max(4096, "قيمة cookie تتجاوز الحد المسموح"),
  viewState: z
    .string({ required_error: "مطلوب إرسال viewState في جسم الطلب" })
    .min(1, "قيمة viewState غير صالحة")
    .max(8192, "قيمة viewState تتجاوز الحد المسموح"),
  branch: z.string().max(10).optional().default("1"),
});

export const coursesQuerySchema = z.object({
  codes: z.string().max(500).optional(),
  search: z.string().max(200, "استعلام بحث طويل جداً.").optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional().default(500),
  offset: z.coerce.number().int().min(0).optional().default(0),
  compact: z.enum(["true", "false", "1", "0"]).optional(),
  fields: z.string().max(200).optional(),
});

export const courseCodeParamSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "رمز المساق غير صالح.")
    .max(20, "رمز المساق غير صالح.")
    .regex(/^[a-zA-Z0-9_\-]{2,20}$/, "رمز المساق غير صالح."),
});

export const majorParamSchema = z.object({
  majorId: z
    .string()
    .trim()
    .min(2, "معرف التخصص غير صالح.")
    .max(50, "معرف التخصص غير صالح.")
    .regex(/^[a-zA-Z0-9_\-]{2,50}$/, "معرف التخصص غير صالح."),
});

export const majorBodySchema = z.object({
  id: z.string().trim().min(2).max(50),
  name: z.string().trim().min(2).max(200),
  code: z.string().max(50).optional(),
  cohortYear: z.string().max(20).optional(),
  semesters: z.array(z.any()).optional(),
  categories: z.array(z.any()).optional(),
  description: z.string().max(1000).optional(),
});

/**
 * Express middleware to validate request query parameters with Zod schema.
 */
export function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      return res.status(400).json({
        error: firstIssue ? firstIssue.message : "معاملات استعلام غير صالحة.",
        details: result.error.issues,
      });
    }
    req.query = result.data;
    next();
  };
}

/**
 * Express middleware to validate request body with Zod schema.
 * Replaces req.body with parsed/sanitized result.
 */
export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      return res.status(400).json({
        error: firstIssue
          ? firstIssue.message
          : "البيانات المدخلة غير مطابقة للشروط المطلوبة.",
        details: result.error.issues,
      });
    }
    req.body = result.data;
    req.validatedBody = result.data;
    next();
  };
}

/**
 * Express middleware to validate request URL params with Zod schema.
 */
export function validateParams(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      return res.status(400).json({
        error: firstIssue ? firstIssue.message : "معرف غير صالح.",
        details: result.error.issues,
      });
    }
    req.params = result.data;
    next();
  };
}
