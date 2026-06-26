import * as ts from "typescript";

function isRegisterToolCallExpression(expression: ts.Expression) {
  if (ts.isIdentifier(expression)) {
    return expression.text === "registerTool";
  }

  return (
    ts.isPropertyAccessExpression(expression) &&
    expression.name.text === "registerTool"
  );
}

function getStringLiteralValue(expression: ts.Expression): string | null {
  if (
    ts.isStringLiteral(expression) ||
    ts.isNoSubstitutionTemplateLiteral(expression)
  ) {
    return expression.text;
  }

  return null;
}

export function getRegisteredMcpToolNames(source: string) {
  const sourceFile = ts.createSourceFile(
    "mcp-tool.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const toolNames: string[] = [];

  function visit(node: ts.Node) {
    if (
      ts.isCallExpression(node) &&
      isRegisterToolCallExpression(node.expression)
    ) {
      const toolName = node.arguments[0]
        ? getStringLiteralValue(node.arguments[0])
        : null;
      if (toolName) {
        toolNames.push(toolName);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return toolNames;
}
