import type { RootContent, Text } from "mdast";

export type MarkdownData = Record<string, unknown> & {
  hName?: string;
  hProperties?: Record<string, unknown>;
};

export type DirectiveNode = {
  attributes?: Record<string, string>;
  data?: MarkdownData;
  name?: string;
  type: string;
};

export type InlineExtensionNode = {
  children: Text[];
  data: { hName: string };
  type: "inlineExtension";
};

export type MarkdownChild = RootContent | InlineExtensionNode;

export type MutableMarkdownParent = {
  children: MarkdownChild[];
  type?: string;
};
