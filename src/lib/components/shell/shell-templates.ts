/** Route-owned presentation capabilities. Authentication and data access stay in loaders. */
export type ShellTemplate =
  | "standard"
  | "academic-detail"
  | "young-detail"
  | "workspace"
  | "settings"
  | "home"
  | "focused";
type Presentation = {
  focused: boolean;
  detailScroll: boolean;
  edgeToEdge: boolean;
  footer: "public" | "sidebar" | "none";
};
const templates: Record<ShellTemplate, Presentation> = {
  standard: {
    focused: false,
    detailScroll: false,
    edgeToEdge: false,
    footer: "public",
  },
  "academic-detail": {
    focused: false,
    detailScroll: true,
    edgeToEdge: true,
    footer: "sidebar",
  },
  "young-detail": {
    focused: false,
    detailScroll: false,
    edgeToEdge: true,
    footer: "public",
  },
  workspace: {
    focused: false,
    detailScroll: false,
    edgeToEdge: false,
    footer: "sidebar",
  },
  settings: {
    focused: false,
    detailScroll: false,
    edgeToEdge: false,
    footer: "sidebar",
  },
  home: {
    focused: false,
    detailScroll: false,
    edgeToEdge: false,
    footer: "public",
  },
  focused: {
    focused: true,
    detailScroll: false,
    edgeToEdge: false,
    footer: "none",
  },
};
export function shellPresentation(
  template: unknown,
  signedIn: boolean,
): Presentation {
  const key =
    typeof template === "string" && Object.hasOwn(templates, template)
      ? (template as ShellTemplate)
      : "standard";
  return key === "home" && signedIn ? templates.workspace : templates[key];
}
