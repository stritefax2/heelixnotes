import { type FC, useEffect } from "react";
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextStyle from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';
import History from '@tiptap/extension-history';

/**
 * A hidden TipTap editor component used for sanitizing HTML content
 * This component serves as a processing pipeline for HTML before
 * it gets stored in a document
 */
export const HtmlSanitizer: FC<{
  onHtmlProcessed: (html: string) => void;
  htmlToProcess: string | null;
}> = ({ onHtmlProcessed, htmlToProcess }) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        history: false, // Disable built-in history
      }),
      History.configure({
        depth: 50,
        newGroupDelay: 1000,
      }),
      TextStyle,
      FontFamily
    ],
    content: '',
    editable: false,
  });

  // Process HTML when content changes
  useEffect(() => {
    if (editor && htmlToProcess) {
      editor.commands.setContent(htmlToProcess);
      
      // Use timeout to ensure content is fully processed
      setTimeout(() => {
        const processedHtml = editor.getHTML();
        onHtmlProcessed(processedHtml);
      }, 10);
    }
  }, [editor, htmlToProcess, onHtmlProcessed]);

  // Return an invisible editor
  return <div style={{ display: 'none' }}><EditorContent editor={editor} /></div>;
}; 