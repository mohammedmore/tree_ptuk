import { z } from "zod";

export const studentLoginSchema = z.object({
  studentId: z
    .string()
    .trim()
    .regex(/^\d{9}$/, "رقم الطالب الجامعي يجب أن يتكون من 9 أرقام بالضبط"),
  password: z.string().min(1, "كلمة المرور مطلوبة"),
  demoMode: z.boolean().optional().default(false),
});

export const registrationPrewarmSchema = z.object({
  studentId: z
    .string()
    .trim()
    .regex(/^\d{9}$/, "رقم الطالب الجامعي غير صالح"),
  password: z.string().optional(),
  demoMode: z.boolean().optional().default(false),
});

export const registrationExecuteSchema = z.object({
  studentId: z
    .string()
    .trim()
    .regex(/^\d{9}$/, "رقم الطالب الجامعي غير صالح"),
  password: z.string().optional(),
  plans: z.object({
    A: z.any().optional(),
    B: z.any().optional(),
    C: z.any().optional(),
  }),
  options: z
    .object({
      demoMode: z.boolean().optional(),
      targetPlan: z.enum(["A", "B", "C"]).optional(),
      autoFallbackOnFull: z.boolean().optional(),
      requireAllOrNothing: z.boolean().optional(),
      idempotencyKey: z.string().optional(),
    })
    .optional(),
});

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
    req.validatedBody = result.data;
    next();
  };
}
