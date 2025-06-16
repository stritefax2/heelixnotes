import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider } from "styled-components";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ChakraProvider } from "@chakra-ui/react";
import { extendTheme } from "@chakra-ui/react";
import { attachConsole } from "@tauri-apps/plugin-log";
import "@heelix-app/design/index.css";
import { App } from "./App";
import { theme } from "./theme";
import { SettingsProvider } from "./Providers/SettingsProvider";
import { useGlobalSettings } from "./Providers/SettingsProvider";

const queryClient = new QueryClient();
const chakraTheme = extendTheme(theme);

attachConsole();

// Wrapper component to set color mode based on settings
const ThemedApp = () => {
  return (
    <SettingsProvider>
      <AppWithTheme />
    </SettingsProvider>
  );
}

// Component that applies theme from settings
const AppWithTheme = () => {
  const { settings } = useGlobalSettings();

  useEffect(() => {
    // Apply theme to document root based on settings
    if (settings.dark_mode) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [settings.dark_mode]);

  return (
    <App />
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <ChakraProvider theme={chakraTheme}>
          <ThemedApp />
        </ChakraProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
