import { useEffect, useState } from "react";
import {
  Box,
  Flex,
  Text,
  Switch,
  VStack,
  Input,
  Button,
  useToast,
} from "@chakra-ui/react";
import { useGlobalSettings } from "../Providers/SettingsProvider";

type LocalSettings = {
  autoStart: boolean;
  apiKeyOpenAi: string;
  apiKeyClaude: string;
  apiKeyGemini: string;
  localEndpointUrl: string;
  localModelName: string;
  vectorizationEnabled: boolean;
  darkMode: boolean;
};
export const GeneralSettings = () => {
  const toast = useToast();
  const { settings, update } = useGlobalSettings();
  const [localSettings, setLocalSettings] = useState<LocalSettings>({
    autoStart: settings.auto_start,
    apiKeyOpenAi: settings.api_key_open_ai,
    apiKeyClaude: settings.api_key_claude,
    apiKeyGemini: settings.api_key_gemini,
    localEndpointUrl: settings.local_endpoint_url,
    localModelName: settings.local_model_name,
    vectorizationEnabled: settings.vectorization_enabled,
    darkMode: settings.dark_mode,
  });

  useEffect(() => {
    setLocalSettings({
      autoStart: settings.auto_start,
      apiKeyOpenAi: settings.api_key_open_ai,
      apiKeyClaude: settings.api_key_claude,
      apiKeyGemini: settings.api_key_gemini,
      localEndpointUrl: settings.local_endpoint_url,
      localModelName: settings.local_model_name,
      vectorizationEnabled: settings.vectorization_enabled,
      darkMode: settings.dark_mode,
    });
  }, [settings]);

  const savedSuccessfullyToast = () => {
    toast({
      title: "Settings saved successfully",
      status: "success",
      duration: 2000,
      isClosable: true,
    });
  };

  const handleAutoStartChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const isChecked = event.target.checked;
    await update({ ...settings, auto_start: isChecked });
  };

  const handleVectorizationToggle = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const isChecked = event.target.checked;
    setLocalSettings((prevState) => ({
      ...prevState,
      vectorizationEnabled: isChecked,
    }));
  };

  const handleDarkModeToggle = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const isChecked = event.target.checked;
    setLocalSettings((prevState) => ({
      ...prevState,
      darkMode: isChecked,
    }));
  };

  const onChangeOpenAiApiKey = (event: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSettings((prevState) => ({
      ...prevState,
      apiKeyOpenAi: event.target.value,
    }));
  };
  
  const onChangeClaueApiKey = (event: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSettings((prevState) => ({
      ...prevState,
      apiKeyClaude: event.target.value,
    }));
  };

  const onChangeGeminiApiKey = (event: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSettings((prevState) => ({
      ...prevState,
      apiKeyGemini: event.target.value,
    }));
  };

  const onChangeLocalEndpointUrl = (event: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSettings((prevState) => ({
      ...prevState,
      localEndpointUrl: event.target.value,
    }));
  };

  const onChangeLocalModelName = (event: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSettings((prevState) => ({
      ...prevState,
      localModelName: event.target.value,
    }));
  };

  const onSave = () => {
    update({
      ...settings,
      auto_start: localSettings.autoStart,
      api_key_open_ai: localSettings.apiKeyOpenAi,
      api_key_claude: localSettings.apiKeyClaude,
      api_key_gemini: localSettings.apiKeyGemini,
      local_endpoint_url: localSettings.localEndpointUrl,
      local_model_name: localSettings.localModelName,
      vectorization_enabled: localSettings.vectorizationEnabled,
      dark_mode: localSettings.darkMode,
    });
    savedSuccessfullyToast();
  };
  return (
    <Box color="var(--text-default-color)">
      <VStack spacing={8} align="stretch">
        <Box>
          <Flex alignItems="center" mb={2}>
            <Text fontSize="md" mr={4} color="var(--text-default-color)">
              Autostart Heelix:
            </Text>
            <Switch
              size="md"
              isChecked={localSettings.autoStart}
              onChange={handleAutoStartChange}
              colorScheme="blue"
            />
          </Flex>
          <Text fontSize="sm" color="var(--text-default-color)" opacity={0.7}>
            Enable this option to automatically start the application on system
            startup.
          </Text>
        </Box>

        <Box>
          <Flex alignItems="center" mb={2}>
            <Flex flex={1}>
              <Text fontSize="md" mr={4} color="var(--text-default-color)">
                OpenAI API Key:
              </Text>
            </Flex>
            <Flex flex={2}>
              <Input
                value={localSettings.apiKeyOpenAi}
                onChange={onChangeOpenAiApiKey}
                bg="var(--card-content-background)"
                color="var(--text-default-color)"
                borderColor="var(--default-border-color)"
                _hover={{ borderColor: "var(--active-border-color)" }}
                _focus={{ borderColor: "var(--active-border-color)" }}
              />
            </Flex>
          </Flex>
          <Flex alignItems="center" mb={2}>
            <Flex flex={1}>
              <Text fontSize="md" mr={4} color="var(--text-default-color)">
                Claude API Key:
              </Text>
            </Flex>
            <Flex flex={2}>
              <Input
                value={localSettings.apiKeyClaude}
                onChange={onChangeClaueApiKey}
                bg="var(--card-content-background)"
                color="var(--text-default-color)"
                borderColor="var(--default-border-color)"
                _hover={{ borderColor: "var(--active-border-color)" }}
                _focus={{ borderColor: "var(--active-border-color)" }}
              />
            </Flex>
          </Flex>
          <Flex alignItems="center" mb={2}>
            <Flex flex={1}>
              <Text fontSize="md" mr={4} color="var(--text-default-color)">
                Gemini API Key:
              </Text>
            </Flex>
            <Flex flex={2}>
              <Input
                value={localSettings.apiKeyGemini}
                onChange={onChangeGeminiApiKey}
                bg="var(--card-content-background)"
                color="var(--text-default-color)"
                borderColor="var(--default-border-color)"
                _hover={{ borderColor: "var(--active-border-color)" }}
                _focus={{ borderColor: "var(--active-border-color)" }}
              />
            </Flex>
          </Flex>
          
          <Box mb={4} p={4} borderRadius="md" bg="var(--card-content-background)" border="1px solid var(--default-border-color)">
            <Text fontSize="lg" fontWeight="bold" mb={3} color="var(--text-default-color)">
              Local Model Settings
            </Text>
            <Flex alignItems="center" mb={2}>
              <Flex flex={1}>
                <Text fontSize="md" mr={4} color="var(--text-default-color)">
                  Endpoint URL:
                </Text>
              </Flex>
              <Flex flex={2}>
                <Input
                  value={localSettings.localEndpointUrl}
                  onChange={onChangeLocalEndpointUrl}
                  placeholder="http://localhost:11434"
                  bg="var(--card-content-background)"
                  color="var(--text-default-color)"
                  borderColor="var(--default-border-color)"
                  _hover={{ borderColor: "var(--active-border-color)" }}
                  _focus={{ borderColor: "var(--active-border-color)" }}
                />
              </Flex>
            </Flex>
            <Flex alignItems="center" mb={2}>
              <Flex flex={1}>
                <Text fontSize="md" mr={4} color="var(--text-default-color)">
                  Model Name:
                </Text>
              </Flex>
              <Flex flex={2}>
                <Input
                  value={localSettings.localModelName}
                  onChange={onChangeLocalModelName}
                  placeholder="llama3.2:latest"
                  bg="var(--card-content-background)"
                  color="var(--text-default-color)"
                  borderColor="var(--default-border-color)"
                  _hover={{ borderColor: "var(--active-border-color)" }}
                  _focus={{ borderColor: "var(--active-border-color)" }}
                />
              </Flex>
            </Flex>
            <Text fontSize="sm" color="var(--text-default-color)" opacity={0.7}>
              Configure your local model endpoint (e.g., Ollama, llama.cpp, LocalAI). Default is Ollama on localhost:11434.
            </Text>
          </Box>
          
          <Text fontSize="sm" color="var(--text-default-color)" opacity={0.7}>
            API keys are required for their respective models. Add the keys you plan to use.
          </Text>

          <Flex alignItems="center" mt={4} mb={2}>
            <Text fontSize="md" mr={4} color="var(--text-default-color)">
              Enable Local Document Indexing:
            </Text>
            <Switch
              size="md"
              isChecked={localSettings.vectorizationEnabled}
              onChange={handleVectorizationToggle}
              colorScheme="blue"
            />
          </Flex>
          <Text fontSize="sm" color="var(--text-default-color)" opacity={0.7}>
            When enabled, new documents will be indexed and used to augment queries when no project or attached text is selected. OpenAI API key is required to create embeddings. Disable if you prefer not to augment queries or index your documents.
          </Text>

          <Flex alignItems="center" mt={4} mb={2}>
            <Text fontSize="md" mr={4} color="var(--text-default-color)">
              Dark Mode:
            </Text>
            <Switch
              size="md"
              isChecked={localSettings.darkMode}
              onChange={handleDarkModeToggle}
              colorScheme="blue"
            />
          </Flex>
          <Text fontSize="sm" color="var(--text-default-color)" opacity={0.7}>
            Enable dark mode for a more comfortable viewing experience in low-light environments.
          </Text>

          <Flex flex={1} justifyContent="flex-end" mt={4}>
            <Button 
              colorScheme="blue" 
              size="md" 
              onClick={onSave}
            >
              Save
            </Button>
          </Flex>
        </Box>
      </VStack>
    </Box>
  );
};
