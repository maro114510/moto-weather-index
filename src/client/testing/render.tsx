import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AppRoutes } from "../App";
import { PlaceProvider } from "../place";

/** Renders the whole application at a path, as a rider who opened that link. */
export function renderApp(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <PlaceProvider>
        <AppRoutes />
      </PlaceProvider>
    </MemoryRouter>,
  );
}
