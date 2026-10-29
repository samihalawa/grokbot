import test from 'node:test';
import assert from 'node:assert/strict';
import { extractEntryText, formatTimestamp, ConversationExporter } from '../src/exporter.js';

test('ConversationExporter: text extraction and token-efficient markdown generation', () => {
  // 1. Text extraction
  assert.equal(extractEntryText('plain text'), 'plain text');
  assert.equal(extractEntryText({ message: 'nested message' }), 'nested message');
  assert.equal(extractEntryText({ content: [{ text: 'part 1' }, { text: 'part 2' }] }), 'part 1\npart 2');

  // 2. Timestamp formatting
  const ts = formatTimestamp(1730000000000);
  assert.ok(ts.includes('2024') || ts.includes('UTC'));

  // 3. Token-efficient markdown formatting
  const exporter = new ConversationExporter();
  const mockConvs = [
    {
      id: 'conv-123',
      title: 'Tender Analysis',
      source: 'grok-web-rest',
      created: 1730000000000,
      turns: [
        { role: 'USER', time: 1730000000000, text: 'Review requirement 4.2' },
        { role: 'GROK', time: 1730000005000, text: 'Clause 4.2 mandates ISO 27001 certification.' },
      ],
    },
  ];

  const md = exporter.formatToTokenEfficientMarkdown(mockConvs);
  assert.ok(md.includes('Tender Analysis'));
  assert.ok(md.includes('conv-123'));
  assert.ok(md.includes('USER'));
  assert.ok(md.includes('Clause 4.2 mandates ISO 27001'));
  assert.ok(!md.includes('{"responseId"')); // No verbose JSON brackets
});
