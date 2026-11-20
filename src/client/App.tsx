import { BrowserRouter } from "react-router";
import { PlaceProvider } from "./place";

export function AppRoutes() {
  return null;
}

export function App() {
  return (
    <BrowserRouter>
      <PlaceProvider>
        <AppRoutes />
      </PlaceProvider>
    </BrowserRouter>
  );
}
