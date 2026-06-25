export const tabsListLabelContext = Symbol("tabs-list-label");

export type TabsListLabelContext = {
  getLabel: () => string | undefined;
};
