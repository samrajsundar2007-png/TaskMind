import React from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  // Parse inline elements: **bold**, *italic*, `code`
  const renderInline = (text: string) => {
    // Regex matches inline code `code` or bold **bold** or *italic*
    const parts: (string | React.ReactNode)[] = [];
    const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      const token = match[0];
      if (token.startsWith('`') && token.endsWith('`')) {
        parts.push(
          <code
            key={match.index}
            className="px-1.5 py-0.5 rounded bg-gray-200/80 text-indigo-700 font-mono text-xs font-medium"
          >
            {token.slice(1, -1)}
          </code>
        );
      } else if (token.startsWith('**') && token.endsWith('**')) {
        parts.push(
          <strong key={match.index} className="font-bold text-gray-900">
            {token.slice(2, -2)}
          </strong>
        );
      } else if (token.startsWith('*') && token.endsWith('*')) {
        parts.push(
          <em key={match.index} className="italic text-gray-800">
            {token.slice(1, -1)}
          </em>
        );
      }
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  // Split lines into blocks (tables, code blocks, lists, headers, paragraphs)
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 1. Code Block ```
    if (line.trim().startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <div key={`code-${i}`} className="my-2 p-3 rounded-xl bg-gray-900 text-gray-100 font-mono text-xs overflow-x-auto">
          <pre>{codeLines.join('\n')}</pre>
        </div>
      );
      i++;
      continue;
    }

    // 2. Table (| Col | Col |)
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }

      if (tableLines.length >= 2) {
        const headerRow = tableLines[0]
          .split('|')
          .slice(1, -1)
          .map((c) => c.trim());
        const hasDivider = tableLines[1].includes('---');
        const dataRows = (hasDivider ? tableLines.slice(2) : tableLines.slice(1)).map((row) =>
          row
            .split('|')
            .slice(1, -1)
            .map((c) => c.trim())
        );

        elements.push(
          <div key={`table-${i}`} className="my-2.5 overflow-x-auto rounded-xl border border-gray-200 shadow-2xs">
            <table className="w-full text-left text-xs border-collapse bg-white">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {headerRow.map((h, hIdx) => (
                    <th key={hIdx} className="px-3 py-2 font-bold text-gray-800 uppercase tracking-wider text-2xs">
                      {renderInline(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dataRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-gray-50/50">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="px-3 py-2 text-gray-700">
                        {renderInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // 3. Headings
    if (line.startsWith('### ')) {
      elements.push(
        <h4 key={`h3-${i}`} className="text-sm font-bold text-gray-900 mt-2.5 mb-1">
          {renderInline(line.substring(4))}
        </h4>
      );
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h3 key={`h2-${i}`} className="text-base font-bold text-gray-900 mt-3 mb-1.5">
          {renderInline(line.substring(3))}
        </h3>
      );
      i++;
      continue;
    }
    if (line.startsWith('# ')) {
      elements.push(
        <h2 key={`h1-${i}`} className="text-lg font-extrabold text-gray-900 mt-3.5 mb-2">
          {renderInline(line.substring(2))}
        </h2>
      );
      i++;
      continue;
    }

    // 4. Bullet lists
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      const listItems: string[] = [];
      while (i < lines.length && (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))) {
        listItems.push(lines[i].trim().substring(2));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="list-disc pl-4 space-y-1 my-1.5 text-gray-800">
          {listItems.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // 5. Numbered lists (1. 2. etc.)
    if (/^\d+\.\s/.test(line.trim())) {
      const numItems: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        numItems.push(lines[i].trim().replace(/^\d+\.\s/, ''));
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="list-decimal pl-4 space-y-1 my-1.5 text-gray-800">
          {numItems.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // 6. Blockquotes
    if (line.trim().startsWith('>')) {
      elements.push(
        <blockquote
          key={`quote-${i}`}
          className="border-l-3 border-indigo-400 pl-3 my-1.5 italic text-gray-600 bg-indigo-50/30 py-1 rounded-r-lg"
        >
          {renderInline(line.trim().substring(1).trim())}
        </blockquote>
      );
      i++;
      continue;
    }

    // 7. Regular paragraph / empty line
    if (line.trim()) {
      elements.push(
        <p key={`p-${i}`} className="my-1 leading-relaxed">
          {renderInline(line)}
        </p>
      );
    }

    i++;
  }

  return <div className={`space-y-0.5 ${className}`}>{elements}</div>;
};
