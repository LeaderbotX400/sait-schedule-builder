import { createApp } from "vue";
import { createPinia } from "pinia";

import "./index.css";
import App from "./App.vue";
import { installStorePersistence } from "./stores";

const app = createApp(App);
app.use(createPinia());
installStorePersistence();
app.mount("#app");
