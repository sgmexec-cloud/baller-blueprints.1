import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

// 👉 1. Import your tRPC hook
import { trpc } from "./utils/trpc"; 

// 👉 2. Create the floating Upgrade Button
function UpgradeButton() {
  const checkoutMutation = trpc.stripe.createCheckout.useMutation({
    onSuccess: (data) => {
      // Send the user to the secure Stripe URL
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    },
    onError: (error) => {
      alert("Something went wrong: " + error.message);
    }
  });

  return (
    <button 
      // @ts-ignore - Catching both v10 and v11 React Query loading states
      onClick={() => checkoutMutation.mutate()}
      disabled={checkoutMutation.isLoading || checkoutMutation.isPending}
      style={{ 
        position: "fixed", 
        top: "20px", 
        right: "20px", 
        padding: "10px 20px", 
        backgroundColor: "#635BFF", 
        color: "white", 
        borderRadius: "8px",
        fontWeight: "bold",
        border: "none",
        cursor: "pointer",
        zIndex: 9999, // Make sure it floats above everything else
        boxShadow: "0 4px 6px rgba(0,0,0,0.1)"
      }}
    >
      {(checkoutMutation as any).isLoading || (checkoutMutation as any).isPending ? "Loading..." : "Upgrade to Premium"}
    </button>
  );
}

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster
            theme="dark"
            toastOptions={{
              style: {
                background: "oklch(0.11 0.015 240)",
                border: "1px solid oklch(0.20 0.02 240)",
                color: "oklch(0.95 0.01 240)",
              },
            }}
          />
          {/* 👉 3. Render the floating button here */}
          <UpgradeButton />
          
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
