import { mountApp } from "./app";

const app = document.querySelector<HTMLElement>("#app");

if (!app) {
  throw new Error("App root element not found.");
}

mountApp(app);
