import React, { FC } from "react";
import {
  Box,
  OrderedList,
  UnorderedList,
  ListItem,
  Heading,
  Text,
} from "@chakra-ui/react";
import { MessageMarkdownMemoized } from "./message-markdown-memoized";
import { MessageCodeBlock } from "./message-codeblock";

interface MessageMarkdownProps {
  content: string;
  textColor?: string;
}

export const MessageMarkdown: FC<MessageMarkdownProps> = ({
  content,
  textColor = "var(--text-default-color)",
}) => {
  return (
    <MessageMarkdownMemoized
      components={{
        p({ children }) {
          return (
            <Box mb={2} _last={{ mb: 0 }}>
              <Text color={textColor}>{children}</Text>
            </Box>
          );
        },
        ol({ children }) {
          return (
            <OrderedList pl={4} mb={4} color={textColor}>
              {children}
            </OrderedList>
          );
        },
        ul({ children }) {
          return (
            <UnorderedList pl={4} mb={4} color={textColor}>
              {children}
            </UnorderedList>
          );
        },
        li({ children }) {
          return <ListItem color={textColor}>{children}</ListItem>;
        },
        h1({ children }) {
          return (
            <Heading as="h1" size="md" mb={4} color={textColor}>
              {children}
            </Heading>
          );
        },
        h2({ children }) {
          return (
            <Heading as="h2" size="md" mb={3} color={textColor}>
              {children}
            </Heading>
          );
        },
        h3({ children }) {
          return (
            <Heading as="h3" size="md" mb={2} color={textColor}>
              {children}
            </Heading>
          );
        },
        code({ node, className, children, ...props }) {
          const childArray = React.Children.toArray(children);
          const firstChild = childArray[0] as React.ReactElement;
          const firstChildAsString = React.isValidElement(firstChild)
            ? (firstChild as React.ReactElement).props.children
            : firstChild;

          if (firstChildAsString === "▍") {
            return <span className="mt-1 animate-pulse cursor-default">▍</span>;
          }

          if (typeof firstChildAsString === "string") {
            childArray[0] = firstChildAsString.replace("`▍`", "▍");
          }

          const match = /language-(\w+)/.exec(className || "");
          if (
            typeof firstChildAsString === "string" &&
            !firstChildAsString.includes("\n")
          ) {
            return (
              <code className={className} {...props}>
                {childArray}
              </code>
            );
          }
          return (
            <MessageCodeBlock
              key={Math.random()}
              language={(match && match[1]) || ""}
              value={String(childArray).replace(/\n$/, "")}
              {...props}
            />
          );
        },
      }}
    >
      {content}
    </MessageMarkdownMemoized>
  );
};
