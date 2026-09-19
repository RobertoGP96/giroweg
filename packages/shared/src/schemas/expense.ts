import { z } from "zod";
import { auditFields, idSchema, timestampSchema } from "./common";

export const expenseTypeSchema = z.enum(["fuel", "toll", "other"]);
export type ExpenseType = z.infer<typeof expenseTypeSchema>;

export const expenseSchema = z.object({
  ...auditFields,
  vehicleId: idSchema,
  type: expenseTypeSchema,
  amount: z.number().min(0),
  currency: z.string().length(3),
  litres: z.number().min(0).nullable(),
  readingId: idSchema.nullable(),
  receiptPath: z.string().nullable(),
  note: z.string().trim().max(300).nullable(),
  occurredAt: timestampSchema,
});
export type Expense = z.infer<typeof expenseSchema>;

export const expenseInputSchema = expenseSchema.pick({
  vehicleId: true,
  type: true,
  amount: true,
  currency: true,
  litres: true,
  readingId: true,
  note: true,
  occurredAt: true,
});
export type ExpenseInput = z.infer<typeof expenseInputSchema>;
