import {
  createContext,
  useContext,
  type FC,
  type PropsWithChildren,
  useState,
  useEffect,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import { z } from "zod";

// Define the types locally instead of importing from RecordingStateProvider
export type SettingDbItem = {
  setting_key: string;
  setting_value: string;
};

export const settingDbItemsZod = z.array(
  z.object({
    setting_key: z.string(),
    setting_value: z.string(),
  })
);

export const DEFAULT_SETTINGS: Settings = {
  is_dev_mode: false,
  interval: "10",
  auto_start: false,
  api_choice: "claude",
  api_key_claude: "",
  api_key_open_ai: "",
  api_key_gemini: "",
  local_endpoint_url: "http://localhost:11434", // Default Ollama endpoint
  local_model_name: "llama3.2:latest", // Default model
  vectorization_enabled: false,
  dark_mode: false,
};

type Update = {
  (settings: Settings): Promise<void>;
};

type ApiChoice = "claude" | "openai" | "gemini" | "local";
export type Settings = {
  is_dev_mode: boolean;
  interval: string;
  auto_start: boolean;
  api_choice: ApiChoice; // Kept for backward compatibility, but model selection should be used instead
  api_key_claude: string;
  api_key_open_ai: string;
  api_key_gemini: string;
  local_endpoint_url: string;
  local_model_name: string;
  vectorization_enabled: boolean;
  dark_mode: boolean;
};

type SettingsContextType = {
  settings: Settings;
  update: Update;
};

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined
);

export const SettingsProvider: FC<PropsWithChildren> = ({ children }) => {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  const getSettingOrEmpty = (
    settings: SettingDbItem[],
    settingKey: string
  ): string => {
    const filtered = settings
      .filter((setting) => setting.setting_key == settingKey)
      .map((setting) => setting.setting_value);
    if (filtered != null && filtered.length > 0) {
      return filtered[0];
    }
    return "";
  };

  const buildSettings = (response: SettingDbItem[]): Settings => {
    console.log(getSettingOrEmpty(response, "interval"));
    return {
      interval: getSettingOrEmpty(response, "interval") || "20",
      is_dev_mode: getSettingOrEmpty(response, "is_dev_mode") == "true",
      auto_start: getSettingOrEmpty(response, "auto_start") == "true",
      api_choice:
        (getSettingOrEmpty(response, "api_choice") as ApiChoice) || "claude",
      api_key_claude: getSettingOrEmpty(response, "api_key_claude") || "",
      api_key_open_ai: getSettingOrEmpty(response, "api_key_open_ai") || "",
      api_key_gemini: getSettingOrEmpty(response, "api_key_gemini") || "",
      local_endpoint_url: getSettingOrEmpty(response, "local_endpoint_url") || "http://localhost:11434",
      local_model_name: getSettingOrEmpty(response, "local_model_name") || "llama3.2:latest",
      vectorization_enabled: getSettingOrEmpty(response, "vectorization_enabled") == "true",
      dark_mode: getSettingOrEmpty(response, "dark_mode") == "true",
    };
  };

  useEffect(() => {
    invoke("get_latest_settings").then(async (response) => {
      const parsed = settingDbItemsZod.safeParse(response);
      if (parsed.success) {
        const builtSettings = buildSettings(parsed.data);
        const autoStartEnabled = await isEnabled();
        setSettings({
          ...builtSettings,
          auto_start: autoStartEnabled,
        });
      } else {
        console.error("invoke get_latest_settings Error:", parsed.error);
      }
    });
  }, []);

  const update: Update = async (newSettings) => {
    if (newSettings.auto_start !== settings.auto_start) {
      if (newSettings.auto_start) {
        await enable();
      } else {
        await disable();
      }
    }
    updateSettingsOnRust(newSettings);
    setSettings(newSettings);
    return Promise.resolve();
  };

  return (
    <SettingsContext.Provider value={{ settings, update }}>
      {children}
    </SettingsContext.Provider>
  );
};

const updateSettingsOnRust = (settings: Settings) => {
  invoke("update_settings", { settings }).then();
};

export const useGlobalSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw Error("SettingsContext must be used within a SettingsProvider");
  }
  return context;
};
