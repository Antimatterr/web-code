import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Editor from "./components/Editor";
import Preview from "./components/Preview";
import { Analytics } from "@vercel/analytics/react";

const router = createBrowserRouter([
  { path: "/", element: <Editor /> },
  { path: "/preview", element: <Preview /> },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Analytics/>
    <RouterProvider router={router} />
  </StrictMode>,
);
