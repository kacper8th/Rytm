import { createBrowserRouter, type RouteObject } from "react-router";
import { App } from "./App";
import { MODULES, MORE_ITEM, type AppModule } from "./modules";
import { MoreScreen } from "../features/more/MoreScreen";
import { ComingSoon } from "../shared/ui/ComingSoon";

/** Builds the route of one module from the registry. */
function moduleRoute(module: AppModule): RouteObject {
  const { Screen } = module;

  if (module.path === "/") {
    return { index: true, element: <Screen /> };
  }

  const path = module.path.replace(/^\//, "");

  if (module.subRoutes?.length) {
    return { path, children: [{ index: true, element: <Screen /> }, ...module.subRoutes] };
  }

  return { path, element: <Screen /> };
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      ...MODULES.map(moduleRoute),
      { path: MORE_ITEM.path.replace(/^\//, ""), element: <MoreScreen /> },
      {
        path: "*",
        element: <ComingSoon icon="🧭" title="Nie ma takiej strony" text="Wybierz moduł z menu." />,
      },
    ],
  },
]);
