import { maintenanceProgress, type MaintenanceProgress } from "@giroweg/shared/domain";
import type { MaintenanceEvent, MaintenanceRule } from "@giroweg/shared/schemas";
import { getStore } from "@/db/client";
import { ORG_ID } from "@/db/seed";
import { nowIso, uuidv7 } from "@/lib/id";
import { readingsRepository } from "@/features/readings/repository";

export interface MaintenanceItem {
  rule: MaintenanceRule;
  lastEvent: MaintenanceEvent | undefined;
  lastValue: number;
  nextValue: number;
  progress: MaintenanceProgress;
}

export const maintenanceRepository = {
  /** Active distance-based rules with their progress, most urgent first. */
  async listByVehicle(vehicleId: string): Promise<{ current: number; items: MaintenanceItem[] }> {
    const store = getStore();
    const current = await readingsRepository.currentValue(vehicleId);
    const events = store.table("maintenanceEvents");
    const items = store
      .table("maintenanceRules")
      .filter((rule) => rule.vehicleId === vehicleId && rule.active && rule.everyUnits !== null)
      .map((rule) => {
        const lastEvent = events
          .filter((e) => e.ruleId === rule.id)
          .sort((a, b) => b.doneAt.localeCompare(a.doneAt))[0];
        const lastValue = lastEvent?.atValue ?? 0;
        const interval = rule.everyUnits ?? 0;
        return {
          rule,
          lastEvent,
          lastValue,
          nextValue: lastValue + interval,
          progress: maintenanceProgress(current, lastValue, interval),
        };
      })
      .sort((a, b) => a.progress.remaining - b.progress.remaining);
    return { current, items };
  },

  async markDone(rule: MaintenanceRule, atValue: number): Promise<MaintenanceEvent> {
    const doneAt = nowIso();
    const event: MaintenanceEvent = {
      id: uuidv7(),
      orgId: ORG_ID,
      createdAt: doneAt,
      updatedAt: doneAt,
      syncedAt: null,
      ruleId: rule.id,
      vehicleId: rule.vehicleId,
      readingId: null,
      atValue,
      doneAt,
      note: null,
    };
    getStore().write("maintenanceEvents", event);
    return event;
  },
};
