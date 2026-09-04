"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createRuntimeDatabase } from "@/db/client";
import { AvailabilityRepository } from "@/db/repositories/availability-repository";
import {
  blockAvailabilitySlot,
  createAvailabilitySlot
} from "@/modules/availability/application/manage-availability";
import { getOwnerWorkspace } from "@/server/auth/owner-workspace";

async function ownerStore() {
  const owner = await getOwnerWorkspace();
  if (!owner) redirect("/owner/login");
  return { owner, repository: new AvailabilityRepository(createRuntimeDatabase()) };
}

export async function createSlotAction(formData: FormData) {
  const { owner, repository } = await ownerStore();
  const startsAt = new Date(String(formData.get("startsAt") ?? ""));
  const endsAt = new Date(String(formData.get("endsAt") ?? ""));
  await createAvailabilitySlot(repository, { workspaceId: owner.workspaceId, startsAt, endsAt });
  revalidatePath("/owner/availability");
}

export async function blockSlotAction(formData: FormData) {
  const { owner, repository } = await ownerStore();
  await blockAvailabilitySlot(repository, {
    workspaceId: owner.workspaceId,
    slotId: String(formData.get("slotId") ?? "")
  });
  revalidatePath("/owner/availability");
}
