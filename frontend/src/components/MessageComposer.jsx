import React, { useMemo } from 'react';
import { Paperclip, X, Eye } from 'lucide-react';

export default function MessageComposer({
  message,
  setMessage,
  mediaFile,
  setMediaFile,
  contacts,
  onMediaUpload,
}) {
  const wordCount = message.trim() ? message.trim().split(/\s+/).length : 0;
  const charCount = message.length;

  const preview = useMemo(() => {
    if (!contacts || contacts.length === 0) return message;
    const first = contacts.find((c) => c.status === 'pending') || contacts[0];
    return message
      .replace(/\{\{name\}\}/gi, first.name || '')
      .replace(/\{\{custom_field_1\}\}/gi, first.custom_field_1 || '')
      .replace(/\{\{custom_field_2\}\}/gi, first.custom_field_2 || '');
  }, [message, contacts]);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (onMediaUpload) {
      const result = await onMediaUpload(file);
      setMediaFile({ name: file.name, path: result.path });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">
          Message Template
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your message here... Use {{name}}, {{custom_field_1}}, {{custom_field_2}} for personalization"
          className="input-field h-32 resize-y font-mono text-sm"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>
            Variables: {'{{name}}'} {'{{custom_field_1}}'} {'{{custom_field_2}}'}
          </span>
          <span>
            {charCount} chars / {wordCount} words
          </span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Attachment (optional)
        </label>
        {mediaFile ? (
          <div className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <Paperclip size={16} />
            <span className="text-sm flex-1">{mediaFile.name}</span>
            <button
              onClick={() => setMediaFile(null)}
              className="text-red-400 hover:text-red-600"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <label className="block cursor-pointer">
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-3 text-center text-sm text-gray-500 hover:border-whatsapp transition-colors">
              <Paperclip size={16} className="inline mr-1" />
              Click to attach image, PDF, or video
            </div>
            <input
              type="file"
              accept="image/*,application/pdf,video/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        )}
      </div>

      {message && (
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Eye size={14} />
            <label className="text-sm font-medium">Message Preview</label>
          </div>
          <div className="bg-whatsapp-light dark:bg-gray-700 rounded-lg p-4 text-sm whitespace-pre-wrap">
            {preview}
          </div>
        </div>
      )}
    </div>
  );
}
