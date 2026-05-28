"use client";

import NextImage from "next/image";
import { Component, type ReactNode, useEffect, useMemo, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkDirective from "remark-directive";
import remarkEmoji from "remark-emoji";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import type { Node, Parent } from "unist";
import { visit } from "unist-util-visit";
import { cn } from "@/lib/utils";
import "katex/dist/katex.min.css";

type MarkdownErrorBoundaryProps = {
  children: ReactNode;
  fallback: ReactNode;
};

type MarkdownErrorBoundaryState = {
  hasError: boolean;
};

class MarkdownErrorBoundary extends Component<
  MarkdownErrorBoundaryProps,
  MarkdownErrorBoundaryState
> {
  constructor(props: MarkdownErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("Markdown rendering error:", error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

const mentionPattern = /\b(section|teacher)#(\d+)\b/g;

function preprocessMarkdown(value: string) {
  return value.replace(mentionPattern, (_match, kind: string, id: string) => {
    const href = kind === "teacher" ? `/teachers/${id}` : `/sections/${id}`;
    return `[${kind}#${id}](${href})`;
  });
}

type CommentMarkdownProps = {
  content: string;
  className?: string;
};

/**
 * Permissive schema for rehype-sanitize to allow classes and styles.
 * Essential for KaTeX and our custom directives.
 */
const customSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames || []),
    "math",
    "mi",
    "mo",
    "mn",
    "mrow",
    "msup",
    "msub",
    "mfrac",
    "msqrt",
    "mtable",
    "mtr",
    "mtd",
    "semantics",
    "annotation",
    "ins",
    "mark",
    "sup",
    "sub",
    "center",
  ],
  attributes: {
    ...defaultSchema.attributes,
    "*": [
      ...(defaultSchema.attributes?.["*"] || []),
      "className",
      "class",
      "style",
    ],
    div: [
      ...(defaultSchema.attributes?.div || []),
      "className",
      "class",
      "style",
    ],
    span: [
      ...(defaultSchema.attributes?.span || []),
      "className",
      "class",
      "style",
    ],
  },
};

type HastElementLike = Node & {
  type: "element";
  tagName?: string;
  properties?: Record<string, unknown>;
};

type HastTextLike = Node & {
  type: "text";
  value?: string;
};

type HastParentLike = Parent & {
  children: Node[];
};

/**
 * Plugin to parse {width=200 align=center} syntax after images/links.
 */
function rehypeAttributes() {
  return (tree: Node) => {
    visit(
      tree,
      "element",
      (node: Node, index: number | undefined, parent: Parent | undefined) => {
        const element = node as HastElementLike;
        if (element.tagName !== "img" && element.tagName !== "a") return;
        if (!parent || typeof index !== "number") return;

        const parentNode = parent as HastParentLike;
        const next = parentNode.children[index + 1] as Node | undefined;
        const textNode = next as HastTextLike | undefined;
        if (textNode?.type === "text" && textNode.value) {
          const match = textNode.value.match(/^\s*\{([^}]+)\}/);
          if (match) {
            const attrString = match[1];
            const attrs = attrString.split(/\s+/);
            const properties: Record<string, unknown> =
              element.properties ?? {};
            attrs.forEach((attr: string) => {
              const parts = attr.split("=");
              if (parts.length === 2) {
                const [key, value] = parts;
                const normalizedKey = key === "class" ? "className" : key;
                properties[normalizedKey] = value.replace(/['"]/g, "");
              }
            });
            element.properties = properties;
            textNode.value = textNode.value
              .replace(/^\s*\{([^}]+)\}/, "")
              .trim();
            // If the text node is now empty, remove it
            if (!textNode.value) {
              parentNode.children.splice(index + 1, 1);
            }
          }
        }
      },
    );
  };
}

/**
 * Plugin to transform remark-directive nodes into HAST nodes.
 */
function directivePlugin() {
  return (tree: Node) => {
    visit(tree, (node: Node) => {
      if (
        node.type === "containerDirective" ||
        node.type === "leafDirective" ||
        node.type === "textDirective"
      ) {
        const directive = node as Node & {
          name?: string;
          data?: Record<string, unknown>;
          attributes?: Record<string, unknown>;
        };

        directive.data = directive.data ?? {};
        const attributes = directive.attributes ?? {};
        const name = directive.name ?? "";
        const classValue =
          typeof attributes.class === "string" ? attributes.class : undefined;
        const classNameValue =
          typeof attributes.className === "string"
            ? attributes.className
            : undefined;

        directive.data.hName = name === "center" ? "center" : "div";
        directive.data.hProperties = {
          ...attributes,
          className: cn(
            name === "center"
              ? "text-center"
              : ["markdown-directive", `directive-${name}`],
            classValue,
            classNameValue,
          ),
        };
      }
    });
  };
}

export function CommentMarkdown({ content, className }: CommentMarkdownProps) {
  const [isMounted, setIsMounted] = useState(false);
  const processedContent = useMemo(
    () => preprocessMarkdown(content),
    [content],
  );

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className={cn("space-y-3 text-foreground text-sm", className)}>
        <pre className="whitespace-pre-wrap text-muted-foreground text-xs">
          {content}
        </pre>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "space-y-3 text-foreground text-sm",
        // Global styles for markdown elements
        "[&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline",
        "[&_blockquote]:border-muted [&_blockquote]:border-l-2 [&_blockquote]:pl-3",
        "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-muted [&_pre]:p-3",
        "[&_ol]:list-decimal [&_ol]:pl-4 [&_ul]:list-disc [&_ul]:pl-4",
        "[&_img]:max-w-full [&_img]:rounded-lg",
        "[&_h1]:font-bold [&_h1]:text-xl [&_h2]:font-bold [&_h2]:text-lg [&_h3]:font-bold [&_h3]:text-base",
        "[&_table]:my-4 [&_table]:w-full [&_table]:border-collapse",
        "[&_th]:border [&_th]:border-muted [&_th]:bg-muted/30 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold",
        "[&_td]:border [&_td]:border-muted [&_td]:px-3 [&_td]:py-2",
        "[&_sub]:text-[0.7em] [&_sup]:text-[0.7em]",
        "[&_ins]:bg-green-500/10 [&_ins]:no-underline [&_mark]:bg-yellow-500/20 [&_mark]:px-0.5",
        // Directive specific styles
        "[&_.markdown-directive]:my-4 [&_.markdown-directive]:rounded-xl [&_.markdown-directive]:border [&_.markdown-directive]:p-4",
        "[&_.directive-tip]:border-green-500/20 [&_.directive-tip]:bg-green-500/5 [&_.directive-tip]:before:mb-2 [&_.directive-tip]:before:block [&_.directive-tip]:before:font-bold [&_.directive-tip]:before:text-green-600 [&_.directive-tip]:before:content-['💡_Tip']",
        "[&_.directive-warning]:border-yellow-500/20 [&_.directive-warning]:bg-yellow-500/5 [&_.directive-warning]:before:mb-2 [&_.directive-warning]:before:block [&_.directive-warning]:before:font-bold [&_.directive-warning]:before:text-yellow-600 [&_.directive-warning]:before:content-['⚠️_Warning']",
        "[&_.directive-error]:border-red-500/20 [&_.directive-error]:bg-red-500/5 [&_.directive-error]:before:mb-2 [&_.directive-error]:before:block [&_.directive-error]:before:font-bold [&_.directive-error]:before:text-red-600 [&_.directive-error]:before:content-['🚫_Error']",
        className,
      )}
    >
      <MarkdownErrorBoundary
        fallback={
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
            <p className="mb-2 font-semibold text-destructive text-xs">
              Markdown 渲染出错，已回退到纯文本模式：
            </p>
            <pre className="whitespace-pre-wrap text-muted-foreground text-xs">
              {content}
            </pre>
          </div>
        }
      >
        <ReactMarkdown
          remarkPlugins={[
            remarkGfm,
            remarkMath,
            remarkDirective,
            [remarkEmoji, { emoticon: true }],
            directivePlugin,
          ]}
          rehypePlugins={[
            rehypeAttributes,
            rehypeKatex,
            [rehypeSanitize, customSchema],
          ]}
          components={
            {
              a: ({ href, children, ...props }) => {
                const { node: _node, ...rest } = props;
                const safeHref = href ?? "";
                const isExternal = safeHref.startsWith("http");
                return (
                  <a
                    href={safeHref}
                    target={isExternal ? "_blank" : undefined}
                    rel={isExternal ? "noopener noreferrer" : undefined}
                    {...rest}
                  >
                    {children}
                  </a>
                );
              },
              img: ({ src, alt, ...props }) => {
                const {
                  node: _node,
                  width,
                  height,
                  className,
                  ..._rest
                } = props;
                const align = (props as { align?: unknown }).align;
                const safeSrc = typeof src === "string" ? src : "";
                const safeAlt = typeof alt === "string" ? alt : "";
                const hasExplicitWidth = width !== undefined && width !== null;
                const w = Number(width) || 800;
                const h = Number(height) || 450;
                return (
                  <NextImage
                    src={safeSrc}
                    alt={safeAlt}
                    unoptimized
                    width={w}
                    height={h}
                    style={{
                      maxWidth: "100%",
                      height: "auto",
                      width: hasExplicitWidth ? w : "auto",
                    }}
                    className={cn(
                      "rounded-lg",
                      align === "center" && "mx-auto block",
                      align === "right" && "ml-auto block",
                      className,
                    )}
                  />
                );
              },
              center: ({ children, ...props }) => {
                const { node: _node, ref: _ref, ...rest } = props;
                return (
                  <div className="text-center" {...rest}>
                    {children}
                  </div>
                );
              },
              // Ensure typography elements are rendered correctly
              ins: ({ children, ...props }) => {
                const { node: _node, ...rest } = props;
                return <ins {...rest}>{children}</ins>;
              },
              mark: ({ children, ...props }) => {
                const { node: _node, ...rest } = props;
                return <mark {...rest}>{children}</mark>;
              },
              sub: ({ children, ...props }) => {
                const { node: _node, ...rest } = props;
                return <sub {...rest}>{children}</sub>;
              },
              sup: ({ children, ...props }) => {
                const { node: _node, ...rest } = props;
                return <sup {...rest}>{children}</sup>;
              },
            } satisfies Components
          }
        >
          {processedContent}
        </ReactMarkdown>
      </MarkdownErrorBoundary>
    </div>
  );
}
