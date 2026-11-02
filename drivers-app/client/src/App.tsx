import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AuthProvider } from "./auth";
import { AdminDriver, AdminDrivers, AdminHome, AdminOutbox, AdminRequests } from "./pages/Admin";
import { Book } from "./pages/Book";
import { DriverCard, DriverHome, DriverProfile, DriverRequest } from "./pages/Driver";
import { Login } from "./pages/Login";
import { PartnerHome } from "./pages/Partner";
import { Status } from "./pages/Status";
import { HomeRedirect, RequireAuth, Role, Shell } from "./ui";

const router = createBrowserRouter([
  { path: "/", element: <Login /> },
  { path: "/d/:slug", element: <Book /> },
  { path: "/d/:slug/r/:code", element: <Status /> },
  {
    path: "/app",
    element: <RequireAuth />,
    children: [
      {
        element: <Shell />,
        children: [
          { index: true, element: <HomeRedirect /> },
          {
            path: "requests",
            element: (
              <Role role="driver">
                <DriverHome />
              </Role>
            ),
          },
          {
            path: "requests/:id",
            element: (
              <Role role="driver">
                <DriverRequest />
              </Role>
            ),
          },
          {
            path: "profile",
            element: (
              <Role role="driver">
                <DriverProfile />
              </Role>
            ),
          },
          {
            path: "card",
            element: (
              <Role role="driver">
                <DriverCard />
              </Role>
            ),
          },
          {
            path: "partner",
            element: (
              <Role role="partner">
                <PartnerHome />
              </Role>
            ),
          },
          {
            path: "admin",
            element: (
              <Role role="admin">
                <AdminHome />
              </Role>
            ),
          },
          {
            path: "admin/drivers",
            element: (
              <Role role="admin">
                <AdminDrivers />
              </Role>
            ),
          },
          {
            path: "admin/drivers/:id",
            element: (
              <Role role="admin">
                <AdminDriver />
              </Role>
            ),
          },
          {
            path: "admin/requests",
            element: (
              <Role role="admin">
                <AdminRequests />
              </Role>
            ),
          },
          {
            path: "admin/outbox",
            element: (
              <Role role="admin">
                <AdminOutbox />
              </Role>
            ),
          },
        ],
      },
    ],
  },
  { path: "*", element: <Login missing /> },
]);

export function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
