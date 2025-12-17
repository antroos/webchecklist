export type MentorId =
  | "general"
  | "qa_lead"
  | "uiux_expert"
  | "growth_marketer"
  | "product_strategist"
  | "ops_coach";

export type MentorQuickAction = {
  id: string;
  label: string;
  prompt: string;
};

export type MentorDef = {
  id: MentorId;
  label: string;
  description: string;
  systemPrompt: string;
  quickActions: MentorQuickAction[];
};

export const MENTORS: MentorDef[] = [
  {
    id: "general",
    label: "General",
    description: "A helpful AI mentor for business thinking and execution.",
    systemPrompt: "PROMPT_LIBRARY:general_mentor_v1",
    quickActions: [
      {
        id: "weekly-plan",
        label: "Weekly plan",
        prompt:
          "Act as my business mentor. Ask 3-5 clarifying questions, then propose a 1-week plan with priorities, KPIs, risks, and next 5 actions.",
      },
      {
        id: "page-goal",
        label: "Page goal",
        prompt:
          "Explain the goal of this page and the main user actions. If I didn't share the page, ask me for the URL or screenshot first.",
      },
    ],
  },
  {
    id: "qa_lead",
    label: "QA Lead",
    description: "Release readiness, test plans, edge cases, acceptance criteria.",
    systemPrompt: "PROMPT_LIBRARY:qa_lead_v1",
    quickActions: [
      {
        id: "qa-checklist",
        label: "QA checklist",
        prompt:
          "Create a detailed QA checklist for this page/product. Include functional, UI, content, accessibility basics, responsive, and cross-browser/mobile checks. Ask for URL/context if missing.",
      },
      {
        id: "release-check",
        label: "Release readiness",
        prompt:
          "Create a release readiness checklist (pre-release, smoke, regression focus areas, monitoring, rollback). Ask for product context if missing.",
      },
    ],
  },
  {
    id: "uiux_expert",
    label: "UI/UX Expert",
    description: "Conversion UX, clarity, trust, IA, accessibility basics.",
    systemPrompt: [
      "You are a senior UI/UX auditor (product designer + UX researcher + accessibility specialist).",
      "Your job: identify the page goal, diagnose UX issues, and propose prioritized improvements tied to evidence.",
      "Be outcome-driven: comprehension, trust, conversion, task success, error prevention.",
      "If a URL/screenshot isn't provided, ask for it before giving detailed page-specific critique.",
      "Output in clean Markdown with clear headings and bullet lists.",
    ].join("\n"),
    quickActions: [
      {
        id: "uiux-audit",
        label: "UI/UX audit",
        prompt:
          "Run a UI/UX audit. First identify page goal + audience, then list top issues and prioritized recommendations with impact and quick fixes. Ask for URL/screenshot if missing.",
      },
      {
        id: "cta-copy",
        label: "Improve CTA/copy",
        prompt:
          "Suggest 5 stronger CTA/copy variants and explain when each works best. Ask for the current copy and the goal if missing.",
      },
    ],
  },
  {
    id: "growth_marketer",
    label: "Growth Marketer",
    description: "Funnels, positioning, experiments, acquisition/activation/retention.",
    systemPrompt: [
      "You are a pragmatic growth marketer focused on measurable experiments.",
      "Always tie suggestions to a KPI and a hypothesis.",
      "Prefer 80/20 actions and quick iterations.",
      "Ask for constraints (traffic, budget, channel, audience) when missing.",
    ].join("\n"),
    quickActions: [
      {
        id: "growth-plan",
        label: "Growth plan",
        prompt:
          "Create a 2-week growth experiment plan with hypotheses, KPIs, expected effort, and prioritization. Ask for product + audience + current channel mix if missing.",
      },
      {
        id: "funnel-diagnosis",
        label: "Funnel diagnosis",
        prompt:
          "Help me diagnose where the funnel is leaking. Ask for current metrics (visits→signup→activation→paid) and propose next steps.",
      },
    ],
  },
  {
    id: "product_strategist",
    label: "Product Strategist",
    description: "Positioning, roadmap, prioritization, discovery, product narrative.",
    systemPrompt: [
      "You are a product strategist helping founders make good decisions with limited time.",
      "Use clear frameworks (JTBD, ICP, positioning, RICE) but keep the output practical.",
      "Ask 3-5 key questions first when context is missing.",
      "End with a prioritized list of next actions.",
    ].join("\n"),
    quickActions: [
      {
        id: "positioning",
        label: "Positioning",
        prompt:
          "Help me craft positioning: ICP, problem, unique value, proof, and 3 key messages. Ask for product and target audience if missing.",
      },
      {
        id: "roadmap",
        label: "Roadmap",
        prompt:
          "Propose a simple roadmap (Now/Next/Later) with rationale and metrics. Ask for goal and constraints if missing.",
      },
    ],
  },
  {
    id: "ops_coach",
    label: "Operations Coach",
    description: "Processes, SOPs, delegation, automation, cadence and reviews.",
    systemPrompt: [
      "You are an operations coach for small teams.",
      "You turn messy inputs into repeatable processes: SOPs, checklists, ownership, and cadence.",
      "Prefer low-bureaucracy systems that are easy to run weekly.",
      "Ask for team size, tools, and pain points if missing.",
    ].join("\n"),
    quickActions: [
      {
        id: "sop",
        label: "Create SOP",
        prompt:
          "Create an SOP for this workflow with steps, owner, inputs/outputs, tools, and a definition of done. Ask for the workflow description if missing.",
      },
      {
        id: "weekly-os",
        label: "Weekly OS",
        prompt:
          "Design a weekly operating system for my team (planning, execution, review). Ask for team size and goals if missing.",
      },
    ],
  },
];

export function isMentorId(v: unknown): v is MentorId {
  return (
    v === "general" ||
    v === "qa_lead" ||
    v === "uiux_expert" ||
    v === "growth_marketer" ||
    v === "product_strategist" ||
    v === "ops_coach"
  );
}

export function getMentor(id: MentorId | string | null | undefined): MentorDef {
  const fallback = MENTORS[0];
  if (!id) return fallback;
  const found = MENTORS.find((m) => m.id === id);
  return found || fallback;
}


