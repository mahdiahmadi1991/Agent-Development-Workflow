import * as vscode from "vscode";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { QuestionnaireFlow } from "../contracts/questionnaire";
import { runDynamicQuestionFlow } from "./questionnaireFlowRunner";

describe("questionnaireFlowRunner", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(vscode.window, "showWarningMessage").mockResolvedValue(undefined);
  });

  it("traverses dynamic multi-branch tree with multi-select nodes", async () => {
    const flow: QuestionnaireFlow = {
      version: 1,
      family: "dotnet-csharp",
      entrypoint: "root",
      nodes: [
        {
          id: "root",
          type: "select",
          question: "Select domain",
          selection_mode: "multi",
          min_select: 1,
          options: [
            {
              id: "backend",
              label: "Backend",
              next: "backend_stack"
            },
            {
              id: "frontend",
              label: "Frontend",
              next: "frontend_stack"
            }
          ]
        },
        {
          id: "backend_stack",
          type: "select",
          question: "Backend stack",
          selection_mode: "single",
          options: [
            {
              id: "dotnet_web_api",
              label: ".NET Web API",
              emits: {
                profile_hints: ["dotnet-csharp-web-api-simple"],
                capability_tags: ["tech.backend.dotnet.webapi"]
              }
            }
          ]
        },
        {
          id: "frontend_stack",
          type: "select",
          question: "Frontend stack",
          selection_mode: "single",
          options: [
            {
              id: "react",
              label: "React",
              emits: {
                profile_hints: ["dotnet-csharp-baseline"],
                capability_tags: ["tech.frontend.react"]
              }
            }
          ]
        }
      ]
    };

    const quickPickSpy = vi.spyOn(vscode.window, "showQuickPick");
    quickPickSpy
      .mockResolvedValueOnce([
        { option: flow.nodes[0]!.type === "select" ? flow.nodes[0]!.options[0] : undefined },
        { option: flow.nodes[0]!.type === "select" ? flow.nodes[0]!.options[1] : undefined }
      ] as never)
      .mockResolvedValueOnce({
        option: flow.nodes[1]!.type === "select" ? flow.nodes[1]!.options[0] : undefined
      } as never)
      .mockResolvedValueOnce({
        option: flow.nodes[2]!.type === "select" ? flow.nodes[2]!.options[0] : undefined
      } as never);

    const output = await runDynamicQuestionFlow(flow, { log: vi.fn() }, "op-1");
    expect(output).toBeDefined();
    expect(output?.answers.root).toEqual(["backend", "frontend"]);
    expect(output?.answers.backend_stack).toEqual(["dotnet_web_api"]);
    expect(output?.answers.frontend_stack).toEqual(["react"]);
    expect(output?.profile_hints).toEqual(
      expect.arrayContaining(["dotnet-csharp-web-api-simple", "dotnet-csharp-baseline"])
    );
    expect(output?.capability_tags).toEqual(
      expect.arrayContaining(["tech.backend.dotnet.webapi", "tech.frontend.react"])
    );
    expect(output?.selected_paths).toEqual(
      expect.arrayContaining([
        "root:backend",
        "root:backend>backend_stack:dotnet_web_api",
        "root:frontend",
        "root:frontend>frontend_stack:react"
      ])
    );
  });

  it("re-prompts multi-select node when min/max constraints fail", async () => {
    const flow: QuestionnaireFlow = {
      version: 1,
      family: "dotnet-csharp",
      entrypoint: "root",
      nodes: [
        {
          id: "root",
          type: "select",
          question: "Select at least two",
          selection_mode: "multi",
          min_select: 2,
          options: [
            { id: "a", label: "A" },
            { id: "b", label: "B" },
            { id: "c", label: "C" }
          ]
        }
      ]
    };

    const quickPickSpy = vi.spyOn(vscode.window, "showQuickPick");
    quickPickSpy
      .mockResolvedValueOnce([{ option: flow.nodes[0]!.type === "select" ? flow.nodes[0]!.options[0] : undefined }] as never)
      .mockResolvedValueOnce([
        { option: flow.nodes[0]!.type === "select" ? flow.nodes[0]!.options[0] : undefined },
        { option: flow.nodes[0]!.type === "select" ? flow.nodes[0]!.options[1] : undefined }
      ] as never);

    const output = await runDynamicQuestionFlow(flow, { log: vi.fn() }, "op-2");
    expect(output?.answers.root).toEqual(["a", "b"]);
    expect(vscode.window.showWarningMessage).toHaveBeenCalledTimes(1);
    expect(quickPickSpy).toHaveBeenCalledTimes(2);
  });

  it("returns undefined when user cancels any node", async () => {
    const flow: QuestionnaireFlow = {
      version: 1,
      family: "dotnet-csharp",
      entrypoint: "root",
      nodes: [
        {
          id: "root",
          type: "select",
          question: "Select",
          selection_mode: "single",
          options: [{ id: "a", label: "A" }]
        }
      ]
    };

    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValueOnce(undefined);
    const output = await runDynamicQuestionFlow(flow, { log: vi.fn() }, "op-3");
    expect(output).toBeUndefined();
  });

  it("skips node when visible_when rule evaluates false", async () => {
    const flow: QuestionnaireFlow = {
      version: 1,
      family: "dotnet-csharp",
      entrypoint: "root",
      nodes: [
        {
          id: "root",
          type: "select",
          question: "Select",
          selection_mode: "single",
          options: [{ id: "a", label: "A", next: "react_only" }]
        },
        {
          id: "react_only",
          type: "select",
          question: "React only",
          selection_mode: "single",
          visible_when: {
            all: [{ fact: "detect.react", eq: true }]
          },
          options: [{ id: "react", label: "React" }]
        }
      ]
    };

    vi.spyOn(vscode.window, "showQuickPick").mockResolvedValueOnce({
      option: flow.nodes[0]!.type === "select" ? flow.nodes[0]!.options[0] : undefined
    } as never);

    const output = await runDynamicQuestionFlow(
      flow,
      { log: vi.fn() },
      "op-4",
      {
        detect: { react: false }
      }
    );
    expect(output?.answers.root).toEqual(["a"]);
    expect(output?.answers.react_only).toBeUndefined();
    expect(output?.why_skipped).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "node_hidden_by_rule",
          node_id: "react_only"
        })
      ])
    );
  });
});

