import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Editor from "./components/Editor";
import Preview from "./components/Preview";

const router = createBrowserRouter([
  { path: "/", element: <Editor /> },
  { path: "/preview", element: <Preview /> },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
