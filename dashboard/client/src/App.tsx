import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import Home from "./pages/Home";
import Documentation from "./pages/Documentation";
import TemplateEditor from "./pages/TemplateEditor";
import MemoLibrary from "./pages/MemoLibrary";
import MemoViewer from "./pages/MemoViewer";
import CompanyChat from "./pages/CompanyChat";


function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/watchlist"} component={Home} />
      <Route path={"/model-portfolio"} component={Home} />
      <Route path={"/core-portfolio"} component={Home} />
      <Route path={"/equities"} component={Home} />
      <Route path={"/crypto"} component={Home} />
      <Route path={"/list/:listId"} component={Home} />
      <Route path={"/asset/:assetId"} component={Home} />
      <Route path={"/docs"} component={Documentation} />
      <Route path={"/admin/templates"} component={TemplateEditor} />
      <Route path={"/memos"} component={MemoLibrary} />
      <Route path={"/memo/:id"} component={MemoViewer} />
      <Route path={"/chat"} component={CompanyChat} />
      <Route path={"/chat/:chatId"} component={CompanyChat} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
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
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
// Trigger deploy Thu Jan  8 14:55:21 EST 2026
