import {
  type FC,
  type ChangeEvent,
  type KeyboardEvent,
  useRef,
  useEffect,
  useState,
} from "react";
import {
  Text,
  Textarea,
  Button,
  Flex,
  IconButton,
  Tooltip,
  Box,
} from "@chakra-ui/react";
import { PaperclipIcon } from "lucide-react";
import { ProjectBadge } from "../../../features/ProjectBadge";
import { ModelSelector } from "./ModelSelector";
import { useGlobalSettings } from "../../../Providers/SettingsProvider";

// Define a type for the model provider
type ModelProvider = "claude" | "openai" | "gemini";

type ChatInputProps = {
  value: string;
  onSubmit: (modelId?: string) => void; // Updated to accept modelId
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onActivityHistoryToggle: () => void;
  isLoading: boolean;
  isGenerating: boolean;
};

export const ChatInput: FC<ChatInputProps> = ({
  value,
  onSubmit,
  onChange,
  onKeyDown,
  onActivityHistoryToggle,
  isLoading,
  isGenerating,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { settings } = useGlobalSettings();
  
  // Initialize with default model based on provider preference
  const defaultModel = settings.api_choice === "claude" 
            ? "claude-sonnet-4-20250514" // Default Claude model is 4 Sonnet
    : settings.api_choice === "gemini"
      ? "gemini-2.0-flash" // Default Gemini model is 2.0 Flash
      : "gpt-4o";    // Default OpenAI model is GPT-4o
  
  const [currentModel, setCurrentModel] = useState(defaultModel);
  const [currentProvider, setCurrentProvider] = useState<ModelProvider>(settings.api_choice as ModelProvider);

  const handleInput = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "40px"; // Reset to initial height
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height =
        scrollHeight > 40 ? `${scrollHeight}px` : "40px";
    }
  };

  useEffect(() => {
    handleInput();
  }, [value]);

  const handleSubmit = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "40px"; // Reset the height to the initial value
    }
    onSubmit(currentModel); // Pass the currently selected model to parent
  };

  const handleModelChange = (modelId: string, provider: ModelProvider) => {
    setCurrentModel(modelId);
    setCurrentProvider(provider);
  };

  return (
    <Box width="100%" maxWidth="var(--breakpoint-medium)" mx="auto" p={4}>
      <Flex justifyContent="space-between" alignItems="center" mb={2}>
        <Box>
          <ProjectBadge />
        </Box>
        <Box ml="auto">
          <ModelSelector 
            onModelChange={handleModelChange}
            currentModel={currentModel}
          />
        </Box>
      </Flex>
      
      <Flex
        as="form"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        flexDirection={"column"}
        alignItems={"flex-start"}
        width="100%"
        gap={"4px"}
      >
        <Flex alignItems="flex-end" width="100%">
          <Textarea
            value={value}
            ref={textareaRef}
            onChange={(e) => {
              onChange(e);
              handleInput();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              } else {
                onKeyDown(e);
              }
            }}
            placeholder="Type your message here..."
            resize="none"
            rows={1}
            mr={2}
            flex={1}
            disabled={isGenerating}
            height="40px"
            overflow="hidden"
            bg="var(--card-content-background)"
            color="var(--text-default-color)"
            borderColor="var(--default-border-color)"
            _hover={{ borderColor: "var(--active-border-color)" }}
            _focus={{ borderColor: "var(--active-border-color)" }}
          />
         <Tooltip label="Add document content to prompt" placement="top">
            <IconButton
              icon={<PaperclipIcon size={20} />}
              aria-label="Add document content"
              onClick={onActivityHistoryToggle}
              mr={2}
              variant="ghost"
              isRound
              color="var(--text-default-color)"
              _hover={{ bg: "var(--secondary-hover-color)" }}
            />
          </Tooltip>
          <Button
            type="submit"
            isLoading={isLoading || isGenerating}
            loadingText="Sending"
            isDisabled={isGenerating || !value}
            colorScheme="blue"
          >
            Send
          </Button>
        </Flex>
      </Flex>
    </Box>
  );
};