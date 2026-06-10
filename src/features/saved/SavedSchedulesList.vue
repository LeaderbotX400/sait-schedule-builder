<script setup lang="ts">
import UiButton from "@/ui/Button.vue";
import { ref } from "vue";
import { loadSavedSchedule } from "@/features/planner/actions";
import { useSavedStore } from "./store";

const savedStore = useSavedStore();

const editingId = ref<string | null>(null);
const editingName = ref("");
const loadingId = ref<string | null>(null);

function startRename(id: string, currentName: string | undefined, index: number): void {
  editingId.value = id;
  editingName.value = currentName ?? `Schedule #${index + 1}`;
}

function commitRename(id: string): void {
  const name = editingName.value.trim();
  if (name) {
    savedStore.renameSaved(id, name);
  }
  editingId.value = null;
}

function cancelRename(): void {
  editingId.value = null;
}

function handleRenameKeydown(event: KeyboardEvent, id: string): void {
  if (event.key === "Enter") {
    commitRename(id);
  } else if (event.key === "Escape") {
    cancelRename();
  }
}

async function load(id: string): Promise<void> {
  const entry = savedStore.savedSchedules.find((s) => s.id === id);
  if (!entry) return;
  loadingId.value = id;
  try {
    await loadSavedSchedule(entry);
  } finally {
    loadingId.value = null;
  }
}
</script>

<template>
  <div v-if="savedStore.savedSchedules.length > 0" class="space-y-2 mb-2">
    <p class="text-[0.625rem] font-semibold uppercase tracking-widest text-fg-faint mb-2">
      Saved Schedules
    </p>
    <div
      v-for="(entry, index) in savedStore.savedSchedules"
      :key="entry.id"
      class="rounded-lg bg-input/50 border border-edge px-3 py-2 flex items-center gap-3"
    >
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <input
            v-if="editingId === entry.id"
            v-model="editingName"
            class="text-sm font-medium text-fg bg-transparent border-b border-primary outline-none w-full"
            @blur="commitRename(entry.id)"
            @keydown="handleRenameKeydown($event, entry.id)"
          />
          <button
            v-else
            type="button"
            class="text-sm font-medium text-fg hover:text-primary truncate text-left"
            @click="startRename(entry.id, entry.name, index)"
          >
            {{ entry.name ?? `Schedule #${index + 1}` }}
          </button>
        </div>
        <div class="flex items-center gap-2 mt-0.5">
          <span class="text-xs text-fg-faint">
            {{ new Date(entry.savedAt).toLocaleDateString() }}
          </span>
          <span class="text-xs text-fg-faint">&middot;</span>
          <span class="text-xs text-fg-faint">
            {{ entry.picks.length + " course" + (entry.picks.length !== 1 ? "s" : "") }}
          </span>
        </div>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <UiButton
          variant="primary"
          size="sm"
          :disabled="loadingId === entry.id"
          @click="load(entry.id)"
        >
          {{ loadingId === entry.id ? "Loading…" : "Load" }}
        </UiButton>
        <UiButton
          variant="ghost"
          size="sm"
          :disabled="loadingId === entry.id"
          @click="savedStore.removeSaved(entry.id)"
        >
          Delete
        </UiButton>
      </div>
    </div>
  </div>
</template>
