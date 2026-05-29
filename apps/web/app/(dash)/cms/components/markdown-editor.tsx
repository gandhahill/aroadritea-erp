'use client';

import { Button } from '@erp/ui';
import { useRef, useState } from 'react';
import { MediaLibraryModal } from './media-library-modal';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function MarkdownEditor({ value, onChange, placeholder }: MarkdownEditorProps) {
  const [showMedia, setShowMedia] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertText = (before: string, after = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selected = text.slice(start, end);

    const newText = text.slice(0, start) + before + selected + after + text.slice(end);
    onChange(newText);

    // Restore focus and cursor position in next tick
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  };

  const handleBold = () => insertText('**', '**');
  const handleItalic = () => insertText('*', '*');
  const handleLink = () => insertText('[', '](url)');
  const handleCode = () => insertText('\`', '\`');

  const handleSelectImage = (url: string, alt: string) => {
    insertText(\`![\${alt}](\${url})\`);
  };

  return (
    <div className="rounded-md border border-brand-cream-3 focus-within:border-brand-red focus-within:ring-1 focus-within:ring-brand-red">
      {/* Toolbar */}
      <div className="flex items-center gap-1 border-b border-brand-cream-3 bg-brand-cream-1/30 p-2">
        <Button variant="ghost" size="sm" type="button" onClick={handleBold} className="h-8 px-2 font-bold">
          B
        </Button>
        <Button variant="ghost" size="sm" type="button" onClick={handleItalic} className="h-8 px-2 italic">
          I
        </Button>
        <Button variant="ghost" size="sm" type="button" onClick={handleLink} className="h-8 px-2">
          Link
        </Button>
        <Button variant="ghost" size="sm" type="button" onClick={handleCode} className="h-8 px-2 font-mono">
          &lt;/&gt;
        </Button>
        <div className="mx-2 h-4 w-px bg-brand-cream-3" />
        <Button variant="outline" size="sm" type="button" onClick={() => setShowMedia(true)} className="h-8">
          + Media Library
        </Button>
      </div>

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-[250px] w-full resize-y rounded-b-md border-0 bg-transparent p-3 text-sm focus:ring-0"
      />

      <MediaLibraryModal
        open={showMedia}
        onOpenChange={setShowMedia}
        onSelectImage={handleSelectImage}
      />
    </div>
  );
}
