import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import { NotepadProvider } from "./contexts/NoteContext";
import FloatingNotepad from "./components/FloatingNotepad";
import { PageLoader } from "./components/PageLoader";
import LazyErrorBoundary from "./components/LazyErrorBoundary";
import { AuthCallback } from "./pages/AuthCallback";
import FeedbackButton from "./components/FeedbackButton";
import { VersionCheck } from "./components/VersionCheck";
import { StaleAuthHandler } from "./components/StaleAuthHandler";

// Critical path - load immediately (most visited pages)
import Home from "./pages/Home";

// Lazy load less frequently accessed pages
// These will be loaded on-demand when the user navigates to them
const Documentation = lazy(() => import("./pages/Documentation"));
const TemplateEditor = lazy(() => import("./pages/TemplateEditor"));
const MemoLibrary = lazy(() => import("./pages/MemoLibrary"));
const MemoViewer = lazy(() => import("./pages/MemoViewer"));
const CompanyChat = lazy(() => import("./pages/CompanyChat"));
const TodoList = lazy(() => import("./pages/TodoList"));
const StratosBrain = lazy(() => import("./pages/StratosBrain"));
const InvestorWatchlist = lazy(() => import("./pages/InvestorWatchlist"));
const ResearchNotes = lazy(() => import("./pages/ResearchNotes"));

// Wrapper component for lazy-loaded pages with error boundary
function LazyPage({ component: Component }: { component: React.ComponentType }) {
  return (
    <LazyErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Component />
      </Suspense>
    </LazyErrorBoundary>
  );
}

function Router() {
  return (
    <Switch>
      {/* Critical path routes - Home component handles all dashboard views */}
      <Route path={"/"} component={Home} />
      <Route path={"/watchlist"} component={Home} />
      <Route path={"/model-portfolio"} component={Home} />
      <Route path={"/core-portfolio"} component={Home} />
      <Route path={"/equities"} component={Home} />
      <Route path={"/crypto"} component={Home} />
      <Route path={"/etfs"} component={Home} />
      <Route path={"/indices"} component={Home} />
      <Route path={"/commodities"} component={Home} />
      <Route path={"/list/:listId"} component={Home} />
      <Route path={"/asset/:assetId"} component={Home} />
      
      {/* Auth callback - needs to be fast */}
      <Route path={"/auth/callback"} component={AuthCallback} />
      
      {/* Lazy-loaded routes */}
      <Route path={"/docs"}>
        <LazyPage component={Documentation} />
      </Route>
      <Route path={"/admin/templates"}>
        <LazyPage component={TemplateEditor} />
      </Route>
      <Route path={"/memos"}>
        <LazyPage component={MemoLibrary} />
      </Route>
      <Route path={"/memo/:id"}>
        {(params) => (
          <LazyErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <MemoViewer />
            </Suspense>
          </LazyErrorBoundary>
        )}
      </Route>
      <Route path={"/chat"}>
        <LazyPage component={CompanyChat} />
      </Route>
      <Route path={"/chat/:chatId"}>
        {(params) => (
          <LazyErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <CompanyChat />
            </Suspense>
          </LazyErrorBoundary>
        )}
      </Route>
      <Route path={"/brain"}>
        <LazyPage component={StratosBrain} />
      </Route>
      <Route path={"/smart-money"}>
        <LazyPage component={InvestorWatchlist} />
      </Route>
      <Route path={"/todo"}>
        <LazyPage component={TodoList} />
      </Route>
      <Route path={"/notes"}>
        <LazyPage component={ResearchNotes} />
      </Route>
      
      {/* 404 routes */}
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <AuthProvider>
          <NotepadProvider>
            <TooltipProvider>
              <Toaster />
              <Router />
              <FeedbackButton />
              <FloatingNotepad />
              <VersionCheck />
              <StaleAuthHandler />
            </TooltipProvider>
          </NotepadProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
