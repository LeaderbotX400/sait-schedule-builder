import { createApp } from "vue";
import { createPinia } from "pinia";

import "./index.css";
import App from "./App.vue";
import { persistCurrentRegStore } from "@/features/current/store";
import { persistPinnedSectionsStore } from "@/features/schedules/pinnedSections";
import { persistRulesStore } from "@/features/rules/store";
import { persistSavedSchedulesStore } from "@/features/saved/store";
import { persistSelectionStore } from "@/features/selection/store";
import { persistTermStore } from "@/features/term/store";

const app = createApp(App);
app.use(createPinia());
persistRulesStore();
persistTermStore();
persistSelectionStore();
persistCurrentRegStore();
persistSavedSchedulesStore();
persistPinnedSectionsStore();
app.mount("#app");
