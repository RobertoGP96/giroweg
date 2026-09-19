import { expenseInputSchema, type Expense, type ExpenseInput } from "@giroweg/shared/schemas";
import { getStore } from "@/db/client";
import { ORG_ID } from "@/db/seed";
import { nowIso, uuidv7 } from "@/lib/id";

export const expensesRepository = {
  async listByVehicle(vehicleId: string): Promise<Expense[]> {
    return getStore()
      .table("expenses")
      .filter((e) => e.vehicleId === vehicleId)
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  },

  async add(raw: ExpenseInput): Promise<Expense> {
    const input = expenseInputSchema.parse(raw);
    const createdAt = nowIso();
    const expense: Expense = {
      id: uuidv7(),
      orgId: ORG_ID,
      createdAt,
      updatedAt: createdAt,
      syncedAt: null,
      receiptPath: null,
      ...input,
    };
    getStore().write("expenses", expense);
    return expense;
  },
};
