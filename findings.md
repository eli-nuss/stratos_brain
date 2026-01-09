# Investigation of HTML Rendering Issue in Document Generation

## Introduction

This report details the investigation into an issue where raw HTML was appearing in generated investment memos. The root cause has been identified, and a solution is proposed below.

## Root Cause Analysis

The issue stems from the `memo_template` stored in your Supabase database. This template contains hardcoded HTML for tables instead of using Markdown syntax. The `react-markdown` library, which is used to render the generated documents, does not interpret raw HTML by default for security reasons. As a result, the HTML is displayed as plain text, leading to the "gibberish" you observed.

### Document Generation Workflow

1.  **Initiation:** The document generation process is initiated from the `DocumentsSection.tsx` component in the frontend.
2.  **API Call:** A request is sent to the `/dashboard/create-document` endpoint in the `control-api` Supabase function.
3.  **Content Generation:** The `control-api` function fetches data, prepares a prompt using the `memo_template` from the database, and calls the Gemini API to generate the document content.
4.  **Storage:** The generated content is then saved as a Markdown file in Supabase storage.

### The Problematic Template

The `memo_template` in the `document_templates` table contains the following HTML code for tables, which is the source of the issue:

```html
<table class=\"border-collapse border border-gray-600\\\" style=\\\"min-width: 100px;\\\"><colgroup><col style=\\\"min-width: 25px;\\\"><col style=\\\"min-width: 25px;\\\"><col style=\\\"min-width: 25px;\\\"><col style=\\\"min-width: 25px;\\\"></colgroup><tbody><tr><th class=\\\"border border-gray-600 bg-gray-800 px-3 py-2 text-left font-semibold\\\" colspan=\\\"1\\\" rowspan=\\\"1\\\">Metric\\n\\n</th><th class=\\\"border border-gray-600 bg-gray-800 px-3 py-2 text-left font-semibold\\\" colspan=\\\"1\\\" rowspan=\\\"1\\\">Value\\n\\n</th><th class=\\\"border border-gray-600 bg-gray-800 px-3 py-2 text-left font-semibold\\\" colspan=\\\"1\\\" rowspan=\\\"1\\\">Metric\\n\\n</th><th class=\\\"border border-gray-600 bg-gray-800 px-3 py-2 text-left font-semibold\\\" colspan=\\\"1\\\" rowspan=\\\"1\\\">Value\\n\\n</th></tr><tr><td class=\\\"border border-gray-600 px-3 py-2\\\" colspan=\\\"1\\\" rowspan=\\\"1\\\">Current Price\\n\\n</td><td class=\\\"border border-gray-600 px-3 py-2\\\" colspan=\\\"1\\\" rowspan=\\\"1\\\">$[Price]\\n\\n</td><td class=\\\"border border-gray-600 px-3 py-2\\\" colspan=\\\"1\\\" rowspan=\\\"1\\\">Market Cap\\n\\n</td><td class=\\\"border border-gray-600 px-3 py-2\\\" colspan=\\\"1\\\" rowspan=\\\"1\\\">$[X]B\\n\\n</td></tr><tr><td class=\\\"border border-gray-600 px-3 py-2\\\" colspan=\\\"1\\\" rowspan=\\\"1\\\">[P/E (TTM) OR P/Sales, etc.]\\n\\n</td><td class=\\\"border border-gray-600 px-3 py-2\\\" colspan=\\\"1\\\" rowspan=\\\"1\\\">[X]x\\n\\n</td><td class=\\\"border border-gray-600 px-3 py-2\\\" colspan=\\\"1\\\" rowspan=\\\"1\\\">[P/E (Fwd) OR EV/Rev, etc.]\\n\\n</td><td class=\\\"border border-gray-600 px-3 py-2\\\" colspan=\\\"1\\\" rowspan=\\\"1\\\">[X]x\\n\\n</td></tr><tr><td class=\\\"border border-gray-600 px-3 py-2\\\" colspan=\\\"1\\\" rowspan=\\\"1\\\">[FCF Yield OR Cash Runway, etc.]\\n\\n</td><td class=\\\"border border-gray-600 px-3 py-2\\\" colspan=\\\"1\\\" rowspan=\\\"1\\\">[X]\\n\\n</td><td class=\\\"border border-gray-600 px-3 py-2\\\" colspan=\\\"1\\\" rowspan=\\\"1\\\">[ROIC OR Gross Margin, etc.]\\n\\n</td><td class=\\\"border border-gray-600 px-3 py-2\\\" colspan=\\\"1\\\">[X]\\n\\n</td></tr><tr><td class=\\\"border border-gray-600 px-3 py-2\\\" colspan=\\\"1\\\" rowspan=\\\"1\\\">1-Year Return\\n\\n</td><td class=\\\"border border-gray-600 px-3 py-2\\\" colspan=\\\"1\\\" rowspan=\\\"1\\\">[X]%\\n\\n</td><td class=\\\"border border-gray-600 px-3 py-2\\\" colspan=\\\"1\\\" rowspan=\\\"1\\\">3-Year Return\\n\\n</td><td class=\\\"border border-gray-600 px-3 py-2\\\" colspan=\\\"1\\\" rowspan=\\\"1\\\">[X]%\\n\\n</td></tr><tr><td class=\\\"border border-gray-600 px-3 py-2\\\" colspan=\\\"1\\\" rowspan=\\\"1\\\">5-Year Return\\n\\n</td><td class=\\\"border border-gray-600 px-3 py-2\\\" colspan=\\\"1\\\" rowspan=\\\"1\\\">[X]%\\n\\n</td><td class=\\\"border border-gray-600 px-3 py-2\\\" colspan=\\\"1\\\" rowspan=\\\"1\\\">Trend Signal\\n\\n</td><td class=\\\"border border-gray-600 px-3 py-2\\\" colspan=\\\"1\\\" rowspan=\\\"1\\\">[Bullish/Bearish]\\n\\n</td></tr></tbody></table>
```

## Solution

To resolve this issue, the HTML table code in the `memo_template` must be replaced with the correct Markdown table syntax. The corrected template is provided in the attached `corrected_memo_template.md` file.

### Corrected Markdown Table Syntax

Here is an example of the corrected Markdown syntax for the "Market Data Snapshot" table:

```markdown
| Metric | Value | Metric | Value |
| :--- | :--- | :--- | :--- |
| Current Price | $[Price] | Market Cap | $[X]B |
| [P/E (TTM) OR P/Sales, etc.] | [X]x | [P/E (Fwd) OR EV/Rev, etc.] | [X]x |
| [FCF Yield OR Cash Runway, etc.] | [X] | [ROIC OR Gross Margin, etc.] | [X] |
| 1-Year Return | [X]% | 3-Year Return | [X]% |
| 5-Year Return | [X]% | Trend Signal | [Bullish/Bearish] |
```

### Recommendation

I recommend updating the `memo_template` in your Supabase `document_templates` table with the content from the attached `corrected_memo_template.md` file. This will ensure that the generated documents use the correct Markdown syntax and are rendered properly in the frontend.

I can perform this update for you, or you can do it yourself by copying the content of the attached file and pasting it into the `template_content` field of the `memo_template` row in your `document_templates` table.
