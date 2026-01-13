# Document Creation & Export Feature Design

## Overview
Allow Company Chat to create structured documents and export them as Markdown or PDF.

## New Function: `create_and_export_document`

### Function Declaration
```typescript
{
  name: "create_and_export_document",
  description: "Create a structured document from the analysis and save it to the asset's files. Use this when the user asks for a document, report, analysis, or export. The document will be saved and can be downloaded as Markdown or PDF.",
  parameters: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "Document title (e.g., 'DCF Analysis - AAPL', 'Risk Assessment Report')"
      },
      document_type: {
        type: "string",
        enum: ["analysis", "report", "summary", "dcf", "valuation", "comparison", "custom"],
        description: "Type of document being created"
      },
      content: {
        type: "string",
        description: "Full markdown content of the document. Use proper markdown formatting with headers, tables, lists, etc."
      },
      export_format: {
        type: "string",
        enum: ["markdown", "pdf", "both"],
        description: "Format to export the document"
      }
    },
    required: ["title", "document_type", "content", "export_format"]
  }
}
```

### Implementation Flow
1. AI generates document content in markdown
2. Function saves to `asset_files` table with `file_type: 'chat_export'`
3. If PDF requested, convert markdown to PDF using existing utilities
4. Return download URLs for both formats
5. UI shows download buttons in the chat

### Database Storage
- Save to `asset_files` with:
  - `file_type`: 'chat_export'
  - `file_name`: `{title}_{date}.md`
  - `content`: markdown content
  - `metadata`: { document_type, export_format, chat_id, created_from: 'company_chat' }

### PDF Generation
- Use server-side markdown-to-PDF conversion
- Store PDF in Supabase Storage bucket
- Return public URL for download

### UI Changes
- When AI creates a document, show a card with:
  - Document title and type
  - Download buttons (Markdown / PDF)
  - "View" button to expand content inline

## Example Usage

User: "Create a DCF analysis for this company"

AI Response:
1. Gathers data using existing tools
2. Calls `create_and_export_document` with:
   - title: "DCF Valuation Analysis - AAPL"
   - document_type: "dcf"
   - content: [full markdown DCF analysis]
   - export_format: "both"
3. Returns confirmation with download links

## Files to Modify
1. `company-chat-api/index.ts` - Add function declaration and handler
2. `CompanyChatInterface.tsx` - Add document export card component
3. Add PDF generation endpoint (or use existing utilities)
