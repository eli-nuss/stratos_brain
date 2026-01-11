# Implementation Plan: Stratos Brain "Universal Analyst" Upgrade

**Date:** January 10, 2026
**Author:** Manus AI

## 1. Overview

This document outlines the implementation plan for the **Stratos Brain "Universal Analyst"** upgrade, based on the provided Product Requirements Document (PRD) and a thorough review of the existing codebase. The goal is to transform the research chat from a data retrieval tool into a true autonomous analyst capable of reading source documents, performing complex calculations, and generating dynamic visualizations.

## 2. Gap Analysis: PRD vs. Current Codebase

A detailed comparison reveals several key gaps between the specified features and the current implementation. The existing system has a strong foundation for chat and basic tool use, but the "Universal Analyst" features require significant new components.

| Feature from PRD | Current Status | Gap / Required Action |
| :--- | :--- | :--- |
| **1. Document Ingestion** | **Missing** | The `company_documents` table does not exist. There is no worker for ingesting 10-K/10-Q filings. |
| **2. Document Retrieval Tool** | **Missing** | The `get_company_docs` function is not defined in the Gemini toolset. |
| **3. Python Sandbox** | **Partially Implemented** | An `execute_python` tool exists and uses E2B for sandboxing. The PRD suggests a slightly different function signature, which can be easily adapted. |
| **4. Generative UI** | **Missing** | The frontend has no mechanism to dynamically render UI components like charts or tables based on AI output. The `generate_dynamic_ui` tool is not defined. |
| **5. Advanced System Prompt** | **Partially Implemented** | A system prompt exists but needs to be updated to include the new reasoning protocol and tool usage guidelines from the PRD. |
| **6. High Reasoning Effort** | **Missing** | The Gemini API call configuration does not currently include the `reasoning_effort` parameter. |

## 3. Implementation To-Do List

Based on the gap analysis, the following is a comprehensive to-do list, broken down by component.

### Phase 1: Foundational Data Layer

*   [ ] **Database:**
    *   [ ] Create a new Supabase migration file (`015_add_company_documents.sql`).
    *   [ ] Define and create the `company_documents` table as specified in the PRD.
*   [ ] **Backend (Data Ingestion):**
    *   [ ] Create a new Supabase Edge Function named `ingest-filings`.
    *   [ ] Integrate with a financial data provider API (e.g., Financial Modeling Prep, as it's a common choice) to fetch URLs for new 10-K, 10-Q, and earnings transcripts.
    *   [ ] Implement logic to download the full text, clean it (e.g., convert HTML to Markdown), and store it in the new `company_documents` table.
    *   [ ] Set up a `pg_cron` job to run the `ingest-filings` function daily.

### Phase 2: AI & Backend Logic

*   [ ] **Backend (Edge Function - `company-chat-api`):**
    *   [ ] **Add New Tool:** Define and implement the `get_company_docs` function within `unifiedFunctionDeclarations`. This function will query the `company_documents` table.
    *   [ ] **Add New Tool:** Define the `generate_dynamic_ui` function. Initially, this function will simply pass the UI data structure through to the frontend.
    *   [ ] **Update System Prompt:** Replace the existing system prompt with the new, more detailed version from the PRD that enforces the new reasoning protocol.
    *   [ ] **Update Gemini Config:** Modify the `callGeminiWithTools` function to include the `reasoning_effort: "high"` parameter in the Gemini API request body.

### Phase 3: Frontend & User Experience

*   [ ] **Frontend (React - `CompanyChatInterface.tsx`):**
    *   [ ] Create a new component, `GenerativeUIRenderer.tsx`.
    *   [ ] This component will inspect incoming assistant messages for `tool_calls` corresponding to `generate_dynamic_ui`.
    *   [ ] Implement a mapping logic (e.g., a `switch` statement) that renders a specific UI component (`<RechartsChart>`, `<ShadcnTable>`) based on the `component` property in the AI's response.
    *   [ ] Pass the `data` from the AI's response as props to these new UI components.
*   [ ] **Frontend (React - `ThinkingSection.tsx`):**
    *   [ ] Enhance the component to better display the chain-of-thought reasoning described in the PRD, potentially by looking for specific patterns in the AI's response text.

## 4. Phased Implementation Plan

This project can be rolled out in three logical phases to ensure stability and iterative progress.

### **Phase 1: Data Foundation (1-2 days)**
*Focus: Get the data pipeline working.* 
1.  **Task 1:** Implement the `company_documents` table migration.
2.  **Task 2:** Build and test the `ingest-filings` Edge Function locally.
3.  **Task 3:** Manually run the ingestion to populate the database with initial data for testing.
4.  **Task 4:** Set up the `pg_cron` schedule.

### **Phase 2: Core AI Upgrade (2-3 days)**
*Focus: Empower the AI with new tools and reasoning.* 
1.  **Task 5:** Add the `get_company_docs` tool to the backend and test its ability to retrieve data from the new table.
2.  **Task 6:** Update the system prompt and Gemini API configuration (`reasoning_effort`).
3.  **Task 7:** Test the full loop: ask a question that requires reading a document, and verify the AI uses the `get_company_docs` tool and provides a correct answer.

### **Phase 3: Generative UI (2-3 days)**
*Focus: Bring the analysis to life in the frontend.* 
1.  **Task 8:** Add the `generate_dynamic_ui` tool definition to the backend.
2.  **Task 9:** Build the `GenerativeUIRenderer.tsx` component and the underlying chart/table components.
3.  **Task 10:** Test the end-to-end flow: ask a question like "Chart the revenue for the last 3 years," and verify the AI calls the `generate_dynamic_ui` tool and the frontend renders the chart correctly.

This structured approach ensures that each layer is built and tested before the next one is added, minimizing risk and simplifying debugging. I am ready to begin with Phase 1, Task 1: creating the database migration.
