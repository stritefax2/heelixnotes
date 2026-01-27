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

type ModelOption = {
  id: string;
  name: string;
  provider: "claude" | "openai" | "gemini" | "local";
  description: string;
};

type ModelSelectorProps = {
  onModelChange: (modelId: string, provider: "claude" | "openai" | "gemini" | "local") => void;
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
      id: "claude-sonnet-4-5",
      name: "Claude Sonnet 4.5",
      provider: "claude",
      description: "Latest Anthropic flagship"
    },
    {
      id: "claude-haiku-4-5",
      name: "Claude Haiku 4.5",
      provider: "claude", 
      description: "Fast & efficient"
    },
    // OpenAI models
    {
      id: "gpt-5",
      name: "GPT-5",
      provider: "openai",
      description: "Latest OpenAI flagship"
    },
    // Gemini models
    {
      id: "gemini-3-pro-preview",
      name: "Gemini 3 Pro",
      provider: "gemini",
      description: "Google's latest multimodal"
    },
    // Local models (Ollama)
    {
      id: "llama3.3:70b",
      name: "Llama 3.3 70B",
      provider: "local",
      description: "Local via Ollama"
    }
  ];

  // Initialize with external current model, or default if not provided
  useEffect(() => {
    if (externalCurrentModel) {
      setCurrentModel(externalCurrentModel);
    } else {
      // Set default model based on provider preference in settings
      const defaultModel = (() => {
        switch (settings.api_choice) {
          case "claude": return "claude-sonnet-4-5";
          case "openai": return "gpt-5";
          case "gemini": return "gemini-3-pro-preview";
          case "local": return "llama3.3:70b";
          default: return "claude-sonnet-4-5";
        }
      })();
        
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
         fontWeight="normal"  // Add this line to ensure normal font weight
        >
          {currentModelInfo ? currentModelInfo.name : "Select Model"}
        </MenuButton>
        <MenuList>
          {modelOptions.map((model) => (
            <MenuItem 
              key={model.id}
              onClick={() => handleModelChange(model.id)}
        //      fontWeight={currentModel === model.id ? "bold" : "normal"}
            >
              <Flex direction="column">
                <Text fontSize="sm">{model.name}</Text>
                <Text fontSize="xs" color="gray.500">{model.description}</Text>
              </Flex>
            </MenuItem>
          ))}
        </MenuList>
      </Menu>
    </Flex>
  );
};