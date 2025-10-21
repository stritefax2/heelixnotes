import { FC, useState, useEffect } from "react";
import {
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Button,
  Flex,
  Text,
} from "@chakra-ui/react";
import { ChevronDownIcon } from "@chakra-ui/icons";
import { useGlobalSettings } from "../../../Providers/SettingsProvider";

type ModelProvider = "claude" | "openai" | "gemini" | "local";

type ModelOption = {
  id: string;
  name: string;
  provider: ModelProvider;
  description: string;
};

type ModelSelectorProps = {
  onModelChange: (modelId: string, provider: ModelProvider) => void;
  currentModel?: string;
};

export const ModelSelector: FC<ModelSelectorProps> = ({ 
  onModelChange,
  currentModel: externalCurrentModel 
}) => {
  const { settings } = useGlobalSettings();
  const [currentModel, setCurrentModel] = useState<string>("");

  const modelOptions: ModelOption[] = [
    // Claude models
    {
      id: "claude-sonnet-4-5-20250929",
      name: "Claude Sonnet 4.5",
      provider: "claude",
      description: "Latest Anthropic model"
    },
    {
      id: "claude-haiku-4-5-20251001",
      name: "Claude Haiku 4.5",
      provider: "claude",
      description: "Fast and efficient"
    },
    // OpenAI models
    {
      id: "gpt-4o",
      name: "GPT-4o",
      provider: "openai",
      description: "Most capable OpenAI model"
    },
    {
      id: "o1",
      name: "o1",
      provider: "openai",
      description: "Advanced reasoning"
    },
    // Gemini models
    {
      id: "gemini-2.0-flash-exp",
      name: "Gemini 2.0 Flash",
      provider: "gemini",
      description: "Latest Gemini model"
    },
    // Local models
    {
      id: "local-llama3.2:latest",
      name: "Llama 3.2 (Local)",
      provider: "local",
      description: "Local Ollama model"
    },
    {
      id: "local-custom",
      name: "Custom Local Model",
      provider: "local",
      description: "Use configured local model"
    }
  ];

  // Initialize with external current model, or default if not provided
  useEffect(() => {
    if (externalCurrentModel) {
      setCurrentModel(externalCurrentModel);
    } else {
      // Set default model based on provider preference in settings
      let defaultModel: string;
      
      switch (settings.api_choice) {
        case "claude":
          defaultModel = "claude-sonnet-4-5-20250929";
          break;
        case "gemini":
          defaultModel = "gemini-2.0-flash-exp";
          break;
        case "local":
          defaultModel = "local-custom";
          break;
        case "openai":
        default:
          defaultModel = "gpt-4o";
          break;
      }
        
      setCurrentModel(defaultModel);
    }
  }, [externalCurrentModel, settings.api_choice]);

  const handleModelChange = (modelId: string) => {
    setCurrentModel(modelId);
    
    // Find the selected model to get its provider
    const selectedModel = modelOptions.find(model => model.id === modelId);
    
    if (selectedModel) {
      // Call the onModelChange prop with model ID and provider
      onModelChange(modelId, selectedModel.provider);
    }
  };

  // Get the current model's display info
  const currentModelInfo = modelOptions.find(m => m.id === currentModel);

  return (
    <Flex alignItems="center">
      <Menu>
        <MenuButton 
          as={Button} 
          rightIcon={<ChevronDownIcon />}
          size="sm"
          variant="outline"
          fontWeight="normal"
          color="var(--text-default-color)"
          bg="var(--card-content-background)"
          borderColor="var(--default-border-color)"
          _hover={{ 
            bg: "var(--secondary-hover-color)",
            borderColor: "var(--active-border-color)"
          }}
          _active={{
            bg: "var(--secondary-hover-color)"
          }}
        >
          {currentModelInfo ? currentModelInfo.name : "Select Model"}
        </MenuButton>
        <MenuList
          bg="var(--card-content-background)"
          borderColor="var(--default-border-color)"
        >
          {modelOptions.map((model) => (
            <MenuItem 
              key={model.id}
              onClick={() => handleModelChange(model.id)}
              bg="var(--card-content-background)"
              _hover={{ bg: "var(--secondary-hover-color)" }}
              _focus={{ bg: "var(--secondary-hover-color)" }}
            >
              <Flex direction="column">
                <Text fontSize="sm" color="var(--text-default-color)">
                  {model.name}
                </Text>
                <Text fontSize="xs" color="var(--text-default-color)" opacity={0.7}>
                  {model.description}
                </Text>
              </Flex>
            </MenuItem>
          ))}
        </MenuList>
      </Menu>
    </Flex>
  );
};