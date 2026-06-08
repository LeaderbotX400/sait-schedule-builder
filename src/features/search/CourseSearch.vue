<script setup lang="ts">
/**
 * CourseSearch — tag-chip input with debounced autocomplete, term picker,
 * and per-code result breakdown. Owns all search side-effects; call it once
 * in the courses panel to let the user add courses to the catalog.
 */

import { nextTick, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { BannerAuthRequiredError } from "../../banner-sdk";
import { getSdk } from "../../lib/sdk";
import { useTermStore } from "../../stores/term";
import { useCoursesStore } from "../../stores/courses";
import { useUiStore } from "../../stores/ui";
import Spinner from "../../ui/Spinner.vue";

interface Suggestion {
  code: string;
  description: string;
}

interface PerCodeResult {
  code: string;
  count: number;
  error?: string;
}

// --- Store reads ---
const termStore = useTermStore();
const { term, termOptions } = storeToRefs(termStore);

// --- Local state ---
const tags = ref<string[]>([]);
const inputValue = ref("");
const suggestions = ref<Suggestion[]>([]);
const suggestionIndex = ref(-1);
const showSuggestions = ref(false);
const loading = ref(false);
const loadingCode = ref<string | null>(null);
const error = ref<string | null>(null);
const results = ref<PerCodeResult[] | null>(null);

const inputEl = ref<HTMLInputElement | null>(null);
const listboxId = `course-search-listbox-${Math.random().toString(36).slice(2)}`;

// --- Autocomplete ---
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

watch([inputValue, term, tags], () => {
  if (debounceTimer !== null) clearTimeout(debounceTimer);
  const trimmed = inputValue.value.trim().toUpperCase();
  if (trimmed.length < 2) {
    suggestions.value = [];
    showSuggestions.value = false;
    suggestionIndex.value = -1;
    return;
  }
  debounceTimer = setTimeout(async () => {
    try {
      const raw = await getSdk().registration.lookups.subjectCourseCombo({
        term: term.value,
        searchTerm: trimmed,
      });
      const filtered = raw.filter((s) => !tags.value.includes(s.code)).slice(0, 8);
      suggestions.value = filtered;
      showSuggestions.value = filtered.length > 0;
      suggestionIndex.value = -1;
    } catch {
      // Autocomplete is best-effort; ignore errors.
    }
  }, 280);
});

// --- Tag management ---
function commitTag(code: string): void {
  const upper = code.trim().toUpperCase();
  if (!upper || tags.value.includes(upper)) return;
  tags.value = [...tags.value, upper];
  inputValue.value = "";
  suggestions.value = [];
  showSuggestions.value = false;
  suggestionIndex.value = -1;
  nextTick(() => inputEl.value?.focus());
}

function removeTag(code: string): void {
  tags.value = tags.value.filter((t) => t !== code);
}

// --- Search ---
async function handleSearch(): Promise<void> {
  const pending = inputValue.value.trim().toUpperCase();
  const allCodes = pending ? [...tags.value, pending] : tags.value;
  const deduped = [...new Set(allCodes)];

  if (deduped.length === 0) {
    error.value = "Enter at least one course code (e.g. CPRG307).";
    return;
  }

  if (pending) {
    tags.value = deduped;
    inputValue.value = "";
  }

  loading.value = true;
  error.value = null;
  results.value = null;
  suggestions.value = [];
  showSuggestions.value = false;

  try {
    loadingCode.value = deduped[0] ?? null;
    const searchResult = await getSdk().registration.search.byCourses(deduped, term.value);
    loadingCode.value = null;
    results.value = searchResult.perCode;

    if (searchResult.response.data.length > 0) {
      useCoursesStore().loadBannerResponse(searchResult.response);
      tags.value = tags.value.filter(
        (t) => !searchResult.perCode.some((r) => r.code === t && r.count > 0),
      );
    }

    const allFailed = searchResult.perCode.every((r) => r.count === 0);
    if (allFailed) {
      const failedCodes = searchResult.perCode
        .map((r) => (r.error ? `${r.code} (${r.error})` : r.code))
        .join(", ");
      error.value =
        `No sections found for ${failedCodes} in the selected term. ` +
        `Check that the course codes are correct and sections are available.`;
    }
  } catch (e_: unknown) {
    loadingCode.value = null;
    if (e_ instanceof BannerAuthRequiredError) {
      error.value = e_.message;
      useUiStore().setAuthRequired(true);
      return;
    }
    const msg = e_ instanceof Error ? e_.message : "Search failed";
    if (msg.includes("401") || msg.includes("403")) {
      error.value = "Session expired or unauthorized. Try reconnecting to Banner.";
    } else if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
      error.value =
        "Could not reach the Banner server. Check your internet connection and that the Vite proxy is running.";
    } else {
      error.value = msg;
    }
  } finally {
    loading.value = false;
  }
}

// --- Keyboard navigation ---
function handleKeyDown(e: KeyboardEvent): void {
  if (e.key === "ArrowDown") {
    e.preventDefault();
    suggestionIndex.value = Math.min(suggestionIndex.value + 1, suggestions.value.length - 1);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    suggestionIndex.value = Math.max(suggestionIndex.value - 1, -1);
  } else if (e.key === "Escape") {
    showSuggestions.value = false;
    suggestionIndex.value = -1;
  } else if (e.key === "Enter" || e.key === "," || e.key === " ") {
    e.preventDefault();
    const active = suggestions.value[suggestionIndex.value];
    if (suggestionIndex.value >= 0 && active !== undefined) {
      commitTag(active.code);
    } else if (inputValue.value.trim()) {
      commitTag(inputValue.value);
    } else if (e.key === "Enter" && tags.value.length > 0) {
      void handleSearch();
    }
  } else if (e.key === "Backspace" && !inputValue.value && tags.value.length > 0) {
    tags.value = tags.value.slice(0, -1);
  }
}

function onBlur(): void {
  setTimeout(() => {
    showSuggestions.value = false;
  }, 150);
}

function onFocus(): void {
  if (suggestions.value.length > 0) showSuggestions.value = true;
}

// Highlight the typed portion of a suggestion description.
function highlightParts(text: string, query: string): { before: string; match: string; after: string } {
  const idx = text.toUpperCase().indexOf(query.toUpperCase());
  if (idx === -1) return { before: text, match: "", after: "" };
  return {
    before: text.slice(0, idx),
    match: text.slice(idx, idx + query.length),
    after: text.slice(idx + query.length),
  };
}

function onTermChange(e: Event): void {
  termStore.setTerm((e.target as HTMLSelectElement).value);
  results.value = null;
  suggestions.value = [];
  showSuggestions.value = false;
}
</script>

<template>
  <div class="space-y-2">
    <!-- Header row: label + term picker -->
    <div class="flex flex-wrap items-baseline justify-between gap-2">
      <h3 class="text-xs font-semibold uppercase tracking-widest text-fg-faint">Search</h3>
      <select
        :value="term"
        class="rounded-md bg-input border border-edge px-2 py-0.5 text-xs text-fg focus:outline-none focus:ring-2 focus:ring-ring"
        @change="onTermChange"
      >
        <option v-for="t in termOptions" :key="t.code" :value="t.code">
          {{ t.description }}
        </option>
        <!-- Fallback for a persisted term not in the live list -->
        <option
          v-if="!termOptions.some((t) => t.code === term)"
          :key="term"
          :value="term"
        >
          {{ term }}
        </option>
      </select>
    </div>

    <!-- Tag-chip input with autocomplete dropdown -->
    <div>
      <div class="relative">
        <div
          class="min-h-[2.5rem] w-full rounded-lg bg-input border border-edge px-2 py-1.5 flex flex-wrap gap-1.5 items-center cursor-text focus-within:ring-2 focus-within:ring-ring focus-within:border-transparent"
          @click="inputEl?.focus()"
        >
          <span
            v-for="tag in tags"
            :key="tag"
            class="inline-flex items-center gap-1 rounded bg-tint-primary border border-tint-primary-bd px-2 py-0.5 text-xs font-mono text-tint-primary-fg"
          >
            {{ tag }}
            <button
              type="button"
              class="text-primary hover:text-fg leading-none"
              :aria-label="`Remove ${tag}`"
              @click.stop="removeTag(tag)"
            >
              &times;
            </button>
          </span>

          <input
            ref="inputEl"
            v-model="inputValue"
            :placeholder="tags.length === 0 ? 'CPRG306, CPRG307…' : ''"
            class="flex-1 min-w-[8rem] bg-transparent text-sm text-fg placeholder-fg-faint font-mono outline-none"
            autocomplete="off"
            spellcheck="false"
            role="combobox"
            :aria-expanded="showSuggestions"
            :aria-controls="listboxId"
            :aria-activedescendant="suggestionIndex >= 0 ? `${listboxId}-${suggestionIndex}` : undefined"
            @keydown="handleKeyDown"
            @blur="onBlur"
            @focus="onFocus"
            @input="() => { error = null; results = null; }"
          />
        </div>

        <!-- Autocomplete dropdown -->
        <ul
          v-if="showSuggestions && suggestions.length > 0"
          :id="listboxId"
          role="listbox"
          class="absolute z-20 mt-1 w-full rounded-lg bg-input border border-edge shadow-lg overflow-hidden"
        >
          <li
            v-for="(s, i) in suggestions"
            :id="`${listboxId}-${i}`"
            :key="s.code"
            role="option"
            :aria-selected="i === suggestionIndex"
            class="px-3 py-2 text-sm cursor-pointer flex items-baseline gap-2"
            :class="
              i === suggestionIndex
                ? 'bg-primary/40 text-fg'
                : 'text-fg-muted hover:bg-surface-hover'
            "
            @mousedown="commitTag(s.code)"
            @mouseenter="suggestionIndex = i"
          >
            <span class="font-mono text-xs text-fg-muted shrink-0">{{ s.code }}</span>
            <span class="text-xs text-fg-faint truncate">
              <template v-if="highlightParts(s.description.replace(s.code, '').trim(), inputValue.trim()).match">
                {{ highlightParts(s.description.replace(s.code, '').trim(), inputValue.trim()).before
                }}<span class="text-fg font-medium">{{
                  highlightParts(s.description.replace(s.code, '').trim(), inputValue.trim()).match
                }}</span>{{ highlightParts(s.description.replace(s.code, '').trim(), inputValue.trim()).after }}
              </template>
              <template v-else>
                {{ s.description.replace(s.code, '').trim() }}
              </template>
            </span>
          </li>
        </ul>
      </div>
    </div>

    <!-- Error message -->
    <div
      v-if="error"
      class="rounded-lg bg-tint-danger border border-tint-danger-bd px-3 py-2 text-xs text-tint-danger-fg"
    >
      {{ error }}
    </div>

    <!-- Per-code results breakdown -->
    <div
      v-if="results"
      class="rounded-lg bg-input/50 border border-edge px-3 py-2 space-y-0.5"
    >
      <div
        v-for="r in results"
        :key="r.code"
        class="flex items-center gap-2 text-xs"
      >
        <span v-if="r.count > 0" class="text-success">&#x2713;</span>
        <span v-else class="text-destructive">&#x2717;</span>
        <span class="font-mono text-fg-muted">{{ r.code }}</span>
        <span v-if="r.count > 0" class="text-fg-faint">
          {{ r.count }} section{{ r.count !== 1 ? "s" : "" }}
        </span>
        <span v-else class="text-destructive/70">{{ r.error ?? "no sections found" }}</span>
      </div>
    </div>

    <!-- Search button -->
    <button
      type="button"
      :disabled="loading || (tags.length === 0 && !inputValue.trim())"
      class="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      @click="handleSearch"
    >
      <span v-if="loading" class="flex items-center justify-center gap-2">
        <Spinner size="md" color="text-primary-fg" />
        {{ loadingCode ? `Fetching ${loadingCode}…` : "Searching…" }}
      </span>
      <span v-else>Search Banner</span>
    </button>
  </div>
</template>
