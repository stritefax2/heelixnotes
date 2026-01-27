import { useEffect, useState } from "react";
import {
  Box,
  Flex,
  Text,
  Switch,
  Select,
  VStack,
  Input,
  Button,
  useToast,
} from "@chakra-ui/react";
import { useGlobalSettings } from "../Providers/SettingsProvider";

type LocalSettings = {
  autoStart: boolean;
  apiChoice: "claude" | "openai" | "gemini" | "local";
  apiKeyOpenAi: string;
  apiKeyClaude: string;
  apiKeyGemini: string;
  localModelUrl: string;
  vectorizationEnabled: boolean;
  ragTopK: number;
};
export const GeneralSettings = () => {
  const toast = useToast();
  const { settings, update } = useGlobalSettings();
  const [localSettings, setLocalSettings] = useState<LocalSettings>({
    autoStart: settings.auto_start,
    apiChoice: settings.api_choice,
    apiKeyOpenAi: settings.api_key_open_ai,
    apiKeyClaude: settings.api_key_claude,
    apiKeyGemini: settings.api_key_gemini,
    localModelUrl: settings.local_model_url,
    vectorizationEnabled: settings.vectorization_enabled,
    ragTopK: settings.rag_top_k,
  });

  useEffect(() => {
    setLocalSettings({
      autoStart: settings.auto_start,
      apiChoice: settings.api_choice,
      apiKeyOpenAi: settings.api_key_open_ai,
      apiKeyClaude: settings.api_key_claude,
      apiKeyGemini: settings.api_key_gemini,
      localModelUrl: settings.local_model_url,
      vectorizationEnabled: settings.vectorization_enabled,
      ragTopK: settings.rag_top_k,
    });
  }, [settings]);

  const savedSuccessfullyToast = () => {
    toast({
      title: "Setttings saved sucessfully",
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

  type ApiChoice = "claude" | "openai" | "gemini" | "local";
  const handleApiChoiceChange = async (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const apiChoice = event.target.value as ApiChoice;
    setLocalSettings((prevState) => ({ ...prevState, apiChoice }));
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
  const onChangeLocalModelUrl = (event: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSettings((prevState) => ({
      ...prevState,
      localModelUrl: event.target.value,
    }));
  };

  const onSave = () => {
    update({
      ...settings,
      auto_start: localSettings.autoStart,
      api_choice: localSettings.apiChoice,
      api_key_open_ai: localSettings.apiKeyOpenAi,
      api_key_claude: localSettings.apiKeyClaude,
      api_key_gemini: localSettings.apiKeyGemini,
      local_model_url: localSettings.localModelUrl,
      vectorization_enabled: localSettings.vectorizationEnabled,
      rag_top_k: localSettings.ragTopK,
    });
    savedSuccessfullyToast();
  };

  const onChangeRagTopK = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value) || 20;
    setLocalSettings((prevState) => ({
      ...prevState,
      ragTopK: Math.max(1, Math.min(50, value)), // Clamp between 1 and 50
    }));
  };

  const handleVectorizationChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSettings((prevState) => ({
      ...prevState,
      vectorizationEnabled: event.target.checked,
    }));
  };
  return (
    <Box>
      <VStack spacing={8} align="stretch">
        <Box>
          <Flex alignItems="center" mb={2}>
            <Text fontSize="md" mr={4}>
              Autostart Heelix:
            </Text>
            <Switch
              size="md"
              isChecked={localSettings.autoStart}
              onChange={handleAutoStartChange}
            />
          </Flex>
          <Text fontSize="sm" color="gray.500">
            Enable this option to automatically start the application on system
            startup.
          </Text>
        </Box>

        <Box>
          <Flex alignItems="center" mb={2}>
            <Flex flex={1}>
              <Text fontSize="md" mr={4}>
                API Choice:
              </Text>
            </Flex>
            <Flex flex={2}>
              <Select
                size="md"
                value={localSettings.apiChoice}
                onChange={handleApiChoiceChange}
              >
                <option value="claude">Claude</option>
                <option value="openai">OpenAI</option>
                <option value="gemini">Gemini</option>
                <option value="local">Local (Ollama)</option>
              </Select>
            </Flex>
          </Flex>
          <Flex alignItems="center" mb={2}>
            <Flex flex={1}>
              <Text fontSize="md" mr={4}>
                OpenAI API Key:
              </Text>
            </Flex>
            <Flex flex={2}>
              <Input
                value={localSettings.apiKeyOpenAi}
                onChange={onChangeOpenAiApiKey}
                placeholder="sk-..."
              />
            </Flex>
          </Flex>
          <Flex alignItems="center" mb={2}>
            <Flex flex={1}>
              <Text fontSize="md" mr={4}>
                Claude API Key:
              </Text>
            </Flex>
            <Flex flex={2}>
              <Input
                value={localSettings.apiKeyClaude}
                onChange={onChangeClaueApiKey}
                placeholder="sk-ant-..."
              />
            </Flex>
          </Flex>
          <Flex alignItems="center" mb={2}>
            <Flex flex={1}>
              <Text fontSize="md" mr={4}>
                Gemini API Key:
              </Text>
            </Flex>
            <Flex flex={2}>
              <Input
                value={localSettings.apiKeyGemini}
                onChange={onChangeGeminiApiKey}
                placeholder="AIza..."
              />
            </Flex>
          </Flex>
          <Flex alignItems="center" mb={2}>
            <Flex flex={1}>
              <Text fontSize="md" mr={4}>
                Local Model URL:
              </Text>
            </Flex>
            <Flex flex={2}>
              <Input
                value={localSettings.localModelUrl}
                onChange={onChangeLocalModelUrl}
                placeholder="http://localhost:11434"
              />
            </Flex>
          </Flex>
          <Text fontSize="sm" color="gray.500">
            Select the API to use for natural language processing tasks. For local models, use Ollama (default: http://localhost:11434).
          </Text>
        </Box>

        <Box>
          <Flex alignItems="center" mb={2}>
            <Text fontSize="md" mr={4}>
              Enable Document Indexing:
            </Text>
            <Switch
              size="md"
              isChecked={localSettings.vectorizationEnabled}
              onChange={handleVectorizationChange}
            />
          </Flex>
          <Text fontSize="sm" color="gray.500">
            When enabled, documents added to projects are automatically indexed using OpenAI embeddings.
            The AI will search within the selected project's documents to find relevant context for your questions.
            Requires OpenAI API key. When disabled, only explicitly selected documents are used as context.
          </Text>
        </Box>

        <Box>
          <Flex alignItems="center" mb={2}>
            <Flex flex={1}>
              <Text fontSize="md" mr={4}>
                RAG Context Chunks:
              </Text>
            </Flex>
            <Flex flex={2}>
              <Input
                type="number"
                value={localSettings.ragTopK}
                onChange={onChangeRagTopK}
                min={1}
                max={50}
                width="100px"
              />
            </Flex>
          </Flex>
          <Text fontSize="sm" color="gray.500">
            Number of document chunks to retrieve when searching for relevant context (1-50).
            Higher values provide more context but use more tokens. Default: 20.
          </Text>
        </Box>

        <Flex flex={1} justifyContent="flex-end">
          <Button colorScheme="blue" size="md" onClick={onSave}>
            Save
          </Button>
        </Flex>
      </VStack>
    </Box>
  );
};
