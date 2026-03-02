import type { LLMRequest } from "../../types/index.js";
import type { LLMProvider } from "../../../llm/provider.interface.js";

const REDUNDANCY_FILTER_PROMPT = `You are a strict editor reviewing documentation generated for AI agent consumption.

## YOUR MISSION
Review the document and REMOVE any content that is:
1. **Inferable from code** — anything a \`tree\`, \`grep\`, or file read would reveal
2. **Framework documentation** — things every developer/agent already knows about the framework
3. **File/endpoint listings** — lists of files, endpoints, routes, controllers
4. **Structural descriptions** — "the project has a src/ folder with..."
5. **Import statements** — obvious import/dependency relationships
6. **Redundant with other documents** — (you'll be told which documents exist)
7. **Detectable symbols** — class names, method names, endpoint paths, import lines, directory trees
8. **Unsupported assertions** — any factual claim without a [CLAIM:<id>] reference

## THE VALUE TEST
For each section, ask: "If I remove this, will an AI agent perform worse on this specific project?"
- If YES → keep it
- If NO → remove it

## RULES
- Return ONLY the cleaned document content (markdown)
- Preserve the document structure (headers, sections)
- Remove entire sections if they contain only redundant information
- DO NOT add new content — only remove
- Preserve any project-specific insights that cannot be found in the code
- Remove even partially-structural paragraphs if their core value is structural inventory
- Never remove lines that include [CLAIM:<id>] tags
- If a section has factual claims without [CLAIM:<id>], remove those lines

## OUTPUT
Return the cleaned markdown document. Nothing else.`;

export class RedundancyFilter {
  constructor(private readonly provider: LLMProvider) {}

  async filter(documentContent: string, documentName: string, otherDocNames: string[]): Promise<string> {
    const request: LLMRequest = {
      messages: [
        { role: "system", content: REDUNDANCY_FILTER_PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            documentName,
            otherExistingDocuments: otherDocNames,
            content: documentContent
          })
        }
      ],
      temperature: 0.1,
      jsonMode: false
    };

    const response = await this.provider.chat(request);

    // Strip any code fences
    const fenceMatch = response.content.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)```\s*$/);
    if (fenceMatch) {
      return fenceMatch[1].trim() + "\n";
    }

    return response.content.trim() + "\n";
  }

  async filterAll(documents: Map<string, string>): Promise<Map<string, string>> {
    const allDocNames = [...documents.keys()];
    const filtered = new Map<string, string>();

    for (const [name, content] of documents) {
      const otherDocs = allDocNames.filter((n) => n !== name);
      const cleaned = await this.filter(content, name, otherDocs);
      filtered.set(name, cleaned);
    }

    return filtered;
  }
}
