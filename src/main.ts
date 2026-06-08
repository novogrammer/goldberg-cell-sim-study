import { mountApp } from "./app";

type ImportMetaWithHot = ImportMeta & {
  hot?: {
    dispose: (callback: () => void) => void;
  };
};

const app = document.querySelector<HTMLElement>("#app");

if (!app) {
  throw new Error("App root element not found.");
}

const dispose = mountApp(app);
const hot = (import.meta as ImportMetaWithHot).hot;

if (hot) {
  hot.dispose(() => {
    dispose();
  });
}
