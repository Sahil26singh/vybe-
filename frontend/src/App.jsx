import ChatPage from "./components/ChatPage";
import EditProfile from "./components/EditProfile";
import Home from "./components/Home";
import Login from "./components/Login";
import MainLayout from "./components/MainLayout";
import Profile from "./components/Profile";
import Signup from "./components/Signup";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import ProtectedRoutes from "./components/ProtectedRoutes";
import Bookmarks from "./components/Bookmarks";
import Search from "./components/Search";
import Likes from "./components/Likes";
import FollowersPage from "./components/Followers";
import FollowingPage from "./components/Following";
import Notification from "./components/Notification";

const browserRouter = createBrowserRouter([
  {
    path: "/",
    element: (
      <ProtectedRoutes>
        <MainLayout />
      </ProtectedRoutes>
    ),
    children: [
      {
        path: "/",
        element: (
          <ProtectedRoutes>
            <Home />
          </ProtectedRoutes>
        ),
      },
      {
        path: "/search",
        element: (
          <ProtectedRoutes>
            <Search />
          </ProtectedRoutes>
        ),
      },
      {
        path: "/likes",
        element: (
          <ProtectedRoutes>
            <Likes />
          </ProtectedRoutes>
        ),
      },
      {
        path: "/notification",
        element: (
          <ProtectedRoutes>
            <Notification />
          </ProtectedRoutes>
        ),
      },
      {
        path: "/bookmarks",
        element: (
          <ProtectedRoutes>
            <Bookmarks />
          </ProtectedRoutes>
        ),
      },
      {
        path: "/profile/:id",
        element: (
          <ProtectedRoutes>
            <Profile />
          </ProtectedRoutes>
        ),
      },
      {
        path: "/profile/:id/followers",
        element: (
          <ProtectedRoutes>
            <FollowersPage />
          </ProtectedRoutes>
        ),
      },
      {
        path: "/profile/:id/following",
        element: (
          <ProtectedRoutes>
            <FollowingPage />
          </ProtectedRoutes>
        ),
      },
      {
        path: "/account/edit",
        element: (
          <ProtectedRoutes>
            <EditProfile />
          </ProtectedRoutes>
        ),
      },
      {
        path: "/chat",
        element: (
          <ProtectedRoutes>
            <ChatPage key="chat-root" />
          </ProtectedRoutes>
        ),
      },
      {
        path: "/chat/:id",
        element: (
          <ProtectedRoutes>
            <ChatPage key="chat-with" />
          </ProtectedRoutes>
        ),
      },
    ],
  },
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/signup",
    element: <Signup />,
  },
]);

function App() {
  return <RouterProvider router={browserRouter} />;
}

export default App;
