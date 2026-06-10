import { createPinia } from "pinia";
import { createApp } from "vue";

import "./index.css";
import App from "./App.vue";
import { createPersistencePlugin } from "./plugins/persistence";

createApp(App).use(createPinia().use(createPersistencePlugin())).mount("#app");
