import { type FC } from "react";
import styled, { keyframes } from "styled-components";
import { Text } from "@platypus-app/design";
import { Sparkles } from "lucide-react";

const NewConversationContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  gap: var(--space-l);
  justify-content: center;
`;

const PlatypusIcon = styled.div`
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, #0d9488, #14b8a6);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: white;
  font-weight: 700;
  font-family: "Nunito", sans-serif;
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
`;

const SuggestionsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-s);
  justify-content: center;
  max-width: 560px;
  animation: ${fadeIn} 0.25s ease-out;
`;

const SuggestionChip = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1px solid var(--chakra-colors-gray-200, #e2e8f0);
  border-radius: 999px;
  background: white;
  color: var(--chakra-colors-gray-700, #2d3748);
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;

  &:hover {
    border-color: #14b8a6;
    background: var(--chakra-colors-teal-50, #e6fffa);
  }
`;

const LoadingHint = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--chakra-colors-gray-400, #a0aec0);
  font-size: 13px;
`;

type Props = {
  suggestions?: string[];
  isLoadingSuggestions?: boolean;
  onSelectSuggestion?: (question: string) => void;
};

export const NewConversationMessage: FC<Props> = ({
  suggestions = [],
  isLoadingSuggestions = false,
  onSelectSuggestion,
}) => (
  <NewConversationContainer>
    <PlatypusIcon>P</PlatypusIcon>
    <Text type="m" bold>
      What's on your mind? Ask Platypus anything or start a new note
    </Text>
    {suggestions.length > 0 ? (
      <SuggestionsContainer>
        {suggestions.map((question) => (
          <SuggestionChip
            key={question}
            onClick={() => onSelectSuggestion?.(question)}
          >
            <Sparkles size={13} color="#14b8a6" />
            {question}
          </SuggestionChip>
        ))}
      </SuggestionsContainer>
    ) : isLoadingSuggestions ? (
      <LoadingHint>
        <Sparkles size={13} />
        Thinking of questions about this project…
      </LoadingHint>
    ) : null}
  </NewConversationContainer>
);
