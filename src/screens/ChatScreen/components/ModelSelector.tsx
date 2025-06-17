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

type ModelProvider = "claude" | "openai" | "gemini";

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
      id: "claude-sonnet-4-20250514",
      name: "Claude 4 Sonnet",
      provider: "claude",
      description: "Main Anthropic model"
    },
    {
      id: "claude-3-5-haiku-20241022",
      name: "Claude 3.5 Haiku",
      provider: "claude", 
      description: "Latest Haiku model"
    },
    // OpenAI models
    {
      id: "gpt-4o",
      name: "GPT-4o",
      provider: "openai",
      description: "Latest OpenAI model"
    },
    {
      id: "o1",
      name: "O1",
      provider: "openai",
      description: "Advanced reasoning"
    },
    {
      id: "o4-mini",
      name: "O4-mini",
      provider: "openai",
      description: "Efficient reasoning"
    },
    // Gemini models
    {
      id: "gemini-2.0-flash",
      name: "Gemini 2.0 flash",
      provider: "gemini",
      description: "Latest Google model"
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
          defaultModel = "claude-sonnet-4-20250514";
          break;
        case "gemini":
          defaultModel = "gemini-2.0-flash";
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